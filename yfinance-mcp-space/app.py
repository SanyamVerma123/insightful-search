from __future__ import annotations

import asyncio
import contextvars
import functools
import hashlib
import inspect
import logging
import math
import os
import random
import re
import threading
import time
from collections import Counter, deque
from contextlib import asynccontextmanager
from datetime import date, datetime, timezone
from typing import Any, Callable, Dict, List, Mapping, Optional

import numpy as np
import pandas as pd
import yfinance as yf
from fastapi import FastAPI, Request
from fastapi.responses import HTMLResponse, JSONResponse
from mcp.server.fastmcp import FastMCP

try:
    import yfinance as _yf
    _yf.set_tz_cache_location(os.getenv("YF_TZ_CACHE", "/tmp/yfinance-tz-cache"))
except Exception:
    pass

logging.basicConfig(level=os.getenv("LOG_LEVEL", "INFO"), format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("yf-mcp")

APP_NAME = "SignalDock yfinance MCP"
VERSION = "1.0.0"
STARTED_AT = time.time()
MAX_BATCH = 10
MAX_ROWS = 2000
CACHE_MAX = 512

mcp = FastMCP(APP_NAME)
TOOL_SPECS: List[Dict[str, Any]] = []

client_context: contextvars.ContextVar[str] = contextvars.ContextVar("client_id", default="anonymous")
cache_lock = threading.RLock()
cache: Dict[str, tuple[float, Any]] = {}
rate_lock = threading.Lock()
recent_network_calls: deque[float] = deque(maxlen=32)
client_network_calls: Dict[str, deque[float]] = {}
network_slots = threading.BoundedSemaphore(4)

stats = {
    "total_mcp_requests": 0,
    "successful_requests": 0,
    "failed_requests": 0,
    "total_tool_calls": 0,
    "cache_hits": 0,
    "cache_misses": 0,
    "rate_limited_requests": 0,
    "total_latency_ms": 0.0,
    "unique_clients": set(),
    "activity": deque(maxlen=80),
    "tools": {},
    "lock": threading.RLock(),
}


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def public_base_url() -> str:
    configured = os.getenv("PUBLIC_URL") or os.getenv("HF_SPACE_URL")
    if configured:
        return configured.rstrip("/")
    host = os.getenv("SPACE_HOST")
    if host:
        return f"https://{host}".rstrip("/")
    space_id = os.getenv("SPACE_ID")
    if space_id and "/" in space_id:
        return f"https://{space_id.replace('/', '-')}.hf.space"
    return f"http://localhost:{os.getenv('PORT', '7860')}"


def endpoint_urls() -> Dict[str, str]:
    base = public_base_url()
    return {
        "dashboard": base,
        "mcp": f"{base}/mcp",
        "health": f"{base}/health",
        "api": f"{base}/api",
    }


def anonymous_client(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for", "").split(",")[0].strip()
    host = forwarded or (request.client.host if request.client else "unknown")
    agent = request.headers.get("user-agent", "unknown")[:120]
    digest = hashlib.sha256(f"{host}|{agent}".encode()).hexdigest()[:10]
    return f"client-{digest}"


def clean(value: Any, rows: int = MAX_ROWS) -> Any:
    """Convert pandas, NumPy, timestamps, and yfinance containers to JSON-safe values."""
    if value is None or isinstance(value, (str, int, bool)):
        return value
    if isinstance(value, float):
        return value if math.isfinite(value) else None
    if isinstance(value, (datetime, date, pd.Timestamp, pd.Timedelta)):
        return str(value)
    if isinstance(value, np.generic):
        return clean(value.item(), rows)
    if value is pd.NA:
        return None
    if isinstance(value, pd.DataFrame):
        frame = value.copy()
        if len(frame) > rows:
            frame = frame.tail(rows)
        if isinstance(frame.columns, pd.MultiIndex):
            frame.columns = [" | ".join(str(x) for x in col if str(x) != "") for col in frame.columns]
        frame = frame.reset_index()
        return clean(frame.to_dict(orient="records"), rows)
    if isinstance(value, pd.Series):
        series = value.copy()
        if len(series) > rows:
            series = series.tail(rows)
        return clean(series.reset_index().to_dict(orient="records"), rows)
    if hasattr(value, "_asdict"):
        return clean(value._asdict(), rows)
    if isinstance(value, Mapping):
        return {str(k): clean(v, rows) for k, v in value.items()}
    if isinstance(value, (list, tuple, set)):
        return [clean(v, rows) for v in list(value)[:rows]]
    if hasattr(value, "to_dict"):
        try:
            return clean(value.to_dict(), rows)
        except Exception:
            pass
    try:
        return str(value)
    except Exception:
        return None


def is_empty(value: Any) -> bool:
    if isinstance(value, (pd.DataFrame, pd.Series)):
        return value.empty
    if isinstance(value, (list, tuple, dict)):
        return len(value) == 0
    return False


class ServiceError(Exception):
    def __init__(self, error_type: str, message: str, retryable: bool = False):
        super().__init__(message)
        self.error_type = error_type
        self.message = message
        self.retryable = retryable

    def payload(self) -> Dict[str, Any]:
        return {"type": self.error_type, "message": self.message, "retryable": self.retryable}


def require_symbol(symbol: str) -> str:
    if not isinstance(symbol, str) or not symbol.strip():
        raise ServiceError("invalid_parameter", "symbol must be a non-empty string")
    symbol = symbol.strip().upper()
    if len(symbol) > 32 or not re.fullmatch(r"[A-Z0-9^._=\-]+", symbol):
        raise ServiceError("invalid_parameter", "symbol contains unsupported characters")
    return symbol


def require_symbols(symbols: List[str]) -> List[str]:
    if not isinstance(symbols, list) or not symbols:
        raise ServiceError("invalid_parameter", "symbols must be a non-empty list")
    if len(symbols) > MAX_BATCH:
        raise ServiceError("invalid_parameter", f"a maximum of {MAX_BATCH} symbols is allowed per batch")
    return [require_symbol(symbol) for symbol in symbols]


VALID_PERIODS = {"1d", "5d", "1mo", "3mo", "6mo", "1y", "2y", "5y", "10y", "ytd", "max"}
VALID_INTERVALS = {"1m", "2m", "5m", "15m", "30m", "60m", "90m", "1h", "1d", "5d", "1wk", "1mo", "3mo"}


def validate_history(period: str, interval: str, limit: int) -> None:
    if period not in VALID_PERIODS:
        raise ServiceError("invalid_parameter", f"unsupported period: {period}")
    if interval not in VALID_INTERVALS:
        raise ServiceError("invalid_parameter", f"unsupported interval: {interval}")
    if not 1 <= limit <= MAX_ROWS:
        raise ServiceError("invalid_parameter", f"limit must be between 1 and {MAX_ROWS}")
    if interval.endswith("m") and period in {"5y", "10y", "max"}:
        raise ServiceError("invalid_parameter", "intraday intervals require a shorter period")


def cache_get(key: str) -> Any:
    now = time.time()
    with cache_lock:
        item = cache.get(key)
        if item and item[0] > now:
            with stats["lock"]:
                stats["cache_hits"] += 1
            return item[1]
        if item:
            cache.pop(key, None)
    with stats["lock"]:
        stats["cache_misses"] += 1
    return None


def cache_put(key: str, value: Any, ttl: int) -> None:
    with cache_lock:
        if len(cache) >= CACHE_MAX:
            oldest = min(cache, key=lambda k: cache[k][0])
            cache.pop(oldest, None)
        cache[key] = (time.time() + ttl, value)


def throttle() -> None:
    client = client_context.get()
    now = time.time()
    with rate_lock:
        while recent_network_calls and now - recent_network_calls[0] > 5:
            recent_network_calls.popleft()
        client_window = client_network_calls.setdefault(client, deque(maxlen=10))
        while client_window and now - client_window[0] > 5:
            client_window.popleft()
        if len(recent_network_calls) >= 8 or len(client_window) >= 4:
            with stats["lock"]:
                stats["rate_limited_requests"] += 1
            raise ServiceError("rate_limited", "request throttled to protect Yahoo Finance; retry shortly", True)
        recent_network_calls.append(now)
        client_window.append(now)


def classify_error(exc: Exception) -> ServiceError:
    text = str(exc).lower()
    if "429" in text or "too many requests" in text or "rate limit" in text:
        return ServiceError("yahoo_rate_limited", "Yahoo Finance rate-limited the upstream request", True)
    if "timeout" in text or "timed out" in text or "connection" in text:
        return ServiceError("network_error", "The Yahoo Finance request timed out or failed to connect", True)
    if "no data" in text or "delisted" in text or "not found" in text:
        return ServiceError("invalid_ticker", "No usable data was returned for the requested symbol")
    return ServiceError("yfinance_error", "yfinance could not complete the requested operation", True)


def network_call(key: str, ttl: int, fn: Callable[[], Any], allow_empty: bool = True) -> Any:
    cached = cache_get(key)
    if cached is not None:
        return cached
    throttle()
    with network_slots:
        last_error: Optional[ServiceError] = None
        for attempt in range(3):
            try:
                value = fn()
                if not allow_empty and is_empty(value):
                    raise ServiceError("empty_result", "Yahoo Finance returned no data for the request")
                value = clean(value)
                cache_put(key, value, ttl)
                return value
            except ServiceError as exc:
                last_error = exc
                if not exc.retryable:
                    raise
            except Exception as exc:
                last_error = classify_error(exc)
            if attempt < 2:
                time.sleep((0.35 * (2**attempt)) + random.random() * 0.2)
        raise last_error or ServiceError("upstream_error", "The upstream request failed", True)


def ok(symbol: Optional[str], data: Any, **extra: Any) -> Dict[str, Any]:
    result: Dict[str, Any] = {"success": True}
    if symbol:
        result["symbol"] = symbol
    result["data"] = data
    result.update(extra)
    return result


def tool(name: str, category: str, description: str, inputs: Dict[str, Any]):
    def decorator(fn: Callable[..., Any]):
        @functools.wraps(fn)
        def wrapped(*args: Any, **kwargs: Any) -> Dict[str, Any]:
            started = time.perf_counter()
            with stats["lock"]:
                stats["total_tool_calls"] += 1
                tool_stat = stats["tools"].setdefault(name, {"calls": 0, "success": 0, "errors": 0, "last_used": None, "latency_ms": 0.0})
                tool_stat["calls"] += 1
            error_type = None
            try:
                result = fn(*args, **kwargs)
                with stats["lock"]:
                    tool_stat["success"] += 1
                return result
            except ServiceError as exc:
                error_type = exc.error_type
                with stats["lock"]:
                    tool_stat["errors"] += 1
                return {"success": False, "error": exc.payload()}
            except Exception as exc:
                error_type = "internal_error"
                log.exception("Unhandled tool error in %s", name)
                with stats["lock"]:
                    tool_stat["errors"] += 1
                return {"success": False, "error": {"type": error_type, "message": "The tool failed safely; inspect server logs for details", "retryable": False}}
            finally:
                elapsed = (time.perf_counter() - started) * 1000
                with stats["lock"]:
                    tool_stat["last_used"] = utc_now()
                    tool_stat["latency_ms"] = round((tool_stat["latency_ms"] * 0.8) + (elapsed * 0.2), 2)
                    stats["total_latency_ms"] += elapsed
                    stats["activity"].appendleft({"timestamp": utc_now(), "tool": name, "client": client_context.get(), "latency_ms": round(elapsed, 2), "success": error_type is None, "error_type": error_type})

        mcp.tool(name=name, description=description)(wrapped)
        TOOL_SPECS.append({"name": name, "category": category, "description": description, "inputs": inputs, "status": "ready"})
        return wrapped
    return decorator


def ticker(symbol: str) -> yf.Ticker:
    return yf.Ticker(require_symbol(symbol))


def history_payload(symbol: str, period: str, interval: str, start: Optional[str], end: Optional[str], auto_adjust: bool, limit: int) -> Dict[str, Any]:
    symbol = require_symbol(symbol)
    validate_history(period, interval, limit)
    key = f"history:{symbol}:{period}:{interval}:{start}:{end}:{auto_adjust}:{limit}"
    data = network_call(key, 90 if interval != "1d" else 900, lambda: ticker(symbol).history(period=period, interval=interval, start=start, end=end, auto_adjust=auto_adjust, actions=True, repair=False), allow_empty=False)
    if isinstance(data, list):
        data = data[-limit:]
    return ok(symbol, data, period=period, interval=interval, auto_adjust=auto_adjust)


@tool("get_price_snapshot", "Prices", "Return a lightweight current-price snapshot using yfinance fast_info with a small history fallback.", {"symbol": {"type": "string", "required": True}})
def get_price_snapshot(symbol: str) -> Dict[str, Any]:
    symbol = require_symbol(symbol)
    data = network_call(f"snapshot:{symbol}", 30, lambda: dict(ticker(symbol).fast_info), allow_empty=False)
    return ok(symbol, data, freshness="upstream Yahoo Finance timing; may be delayed")


@tool("get_price_history", "Prices", "Return bounded OHLCV history from Ticker.history with explicit period and interval validation.", {"symbol": {"type": "string", "required": True}, "period": {"type": "string", "default": "1mo"}, "interval": {"type": "string", "default": "1d"}, "start": {"type": "string", "optional": True}, "end": {"type": "string", "optional": True}, "auto_adjust": {"type": "boolean", "default": True}, "limit": {"type": "integer", "default": 250}})
def get_price_history(symbol: str, period: str = "1mo", interval: str = "1d", start: Optional[str] = None, end: Optional[str] = None, auto_adjust: bool = True, limit: int = 250) -> Dict[str, Any]:
    return history_payload(symbol, period, interval, start, end, auto_adjust, limit)


@tool("download_price_history", "Prices", "Bulk-download bounded price history with yfinance.download for up to ten symbols.", {"symbols": {"type": "array", "required": True, "maxItems": 10}, "period": {"type": "string", "default": "1mo"}, "interval": {"type": "string", "default": "1d"}, "start": {"type": "string", "optional": True}, "end": {"type": "string", "optional": True}, "auto_adjust": {"type": "boolean", "default": True}})
def download_price_history(symbols: List[str], period: str = "1mo", interval: str = "1d", start: Optional[str] = None, end: Optional[str] = None, auto_adjust: bool = True) -> Dict[str, Any]:
    symbols = require_symbols(symbols)
    validate_history(period, interval, MAX_ROWS)
    key = f"download:{','.join(symbols)}:{period}:{interval}:{start}:{end}:{auto_adjust}"
    data = network_call(key, 900 if interval == "1d" else 90, lambda: yf.download(tickers=symbols, period=period, interval=interval, start=start, end=end, auto_adjust=auto_adjust, actions=True, progress=False, threads=False), allow_empty=False)
    return ok(None, data, symbols=symbols, period=period, interval=interval)


@tool("get_history_metadata", "Prices", "Return the exchange and timezone metadata associated with a ticker's price history.", {"symbol": {"type": "string", "required": True}})
def get_history_metadata(symbol: str) -> Dict[str, Any]:
    symbol = require_symbol(symbol)
    data = network_call(f"metadata:{symbol}", 86400, lambda: ticker(symbol).get_history_metadata(), allow_empty=True)
    return ok(symbol, data)


@tool("get_actions", "Prices", "Return dividends, splits, and capital gains in a single normalized response.", {"symbol": {"type": "string", "required": True}})
def get_actions(symbol: str) -> Dict[str, Any]:
    symbol = require_symbol(symbol)
    data = network_call(f"actions:{symbol}", 3600, lambda: {"dividends": ticker(symbol).dividends, "splits": ticker(symbol).splits, "capital_gains": ticker(symbol).capital_gains}, allow_empty=True)
    return ok(symbol, data)


@tool("get_company_info", "Company", "Return the full yfinance company information payload; use fast_info for lightweight snapshots.", {"symbol": {"type": "string", "required": True}})
def get_company_info(symbol: str) -> Dict[str, Any]:
    symbol = require_symbol(symbol)
    data = network_call(f"info:{symbol}", 21600, lambda: ticker(symbol).get_info(), allow_empty=True)
    return ok(symbol, data)


@tool("get_fast_info", "Company", "Return yfinance fast_info values for a lightweight quote and market overview.", {"symbol": {"type": "string", "required": True}})
def get_fast_info(symbol: str) -> Dict[str, Any]:
    symbol = require_symbol(symbol)
    data = network_call(f"fastinfo:{symbol}", 60, lambda: dict(ticker(symbol).fast_info), allow_empty=True)
    return ok(symbol, data)


@tool("get_isin", "Company", "Return the identifier returned by Ticker.get_isin when available.", {"symbol": {"type": "string", "required": True}})
def get_isin(symbol: str) -> Dict[str, Any]:
    symbol = require_symbol(symbol)
    data = network_call(f"isin:{symbol}", 86400, lambda: ticker(symbol).get_isin(), allow_empty=True)
    return ok(symbol, data)


@tool("get_news", "Company", "Return recent Yahoo Finance news items for a ticker.", {"symbol": {"type": "string", "required": True}, "limit": {"type": "integer", "default": 10, "maximum": 30}})
def get_news(symbol: str, limit: int = 10) -> Dict[str, Any]:
    symbol = require_symbol(symbol)
    if not 1 <= limit <= 30:
        raise ServiceError("invalid_parameter", "limit must be between 1 and 30")
    data = network_call(f"news:{symbol}:{limit}", 900, lambda: ticker(symbol).get_news(count=limit), allow_empty=True)
    return ok(symbol, data)


STATEMENT_MAP = {"income": "get_income_stmt", "balance_sheet": "get_balance_sheet", "cash_flow": "get_cash_flow"}


@tool("get_financial_statement", "Fundamentals", "Return an annual, quarterly, or trailing yfinance financial statement for income, balance sheet, or cash flow.", {"symbol": {"type": "string", "required": True}, "statement": {"type": "string", "enum": ["income", "balance_sheet", "cash_flow"]}, "freq": {"type": "string", "enum": ["yearly", "quarterly", "trailing"], "default": "yearly"}})
def get_financial_statement(symbol: str, statement: str = "income", freq: str = "yearly") -> Dict[str, Any]:
    symbol = require_symbol(symbol)
    if statement not in STATEMENT_MAP or freq not in {"yearly", "quarterly", "trailing"}:
        raise ServiceError("invalid_parameter", "statement or freq is unsupported")
    method_name = STATEMENT_MAP[statement]
    def fetch() -> Any:
        obj = ticker(symbol)
        method = getattr(obj, method_name, None)
        if not callable(method):
            raise ServiceError("unsupported_capability", f"yfinance does not expose {method_name} in this runtime")
        return method(freq=freq)
    data = network_call(f"statement:{symbol}:{statement}:{freq}", 86400, fetch, allow_empty=True)
    return ok(symbol, data, statement=statement, freq=freq)


@tool("get_earnings", "Fundamentals", "Return yfinance earnings data for a ticker.", {"symbol": {"type": "string", "required": True}, "freq": {"type": "string", "default": "yearly"}})
def get_earnings(symbol: str, freq: str = "yearly") -> Dict[str, Any]:
    symbol = require_symbol(symbol)
    if freq not in {"yearly", "quarterly", "trailing"}:
        raise ServiceError("invalid_parameter", "freq must be yearly, quarterly, or trailing")
    def fetch() -> Any:
        obj = ticker(symbol)
        method = getattr(obj, "get_earnings", None)
        return method(freq=freq) if callable(method) else getattr(obj, "earnings", None)
    data = network_call(f"earnings:{symbol}:{freq}", 86400, fetch, allow_empty=True)
    return ok(symbol, data, freq=freq)


@tool("get_calendar", "Calendars", "Return the ticker calendar, including earnings dates when Yahoo provides them.", {"symbol": {"type": "string", "required": True}})
def get_calendar(symbol: str) -> Dict[str, Any]:
    symbol = require_symbol(symbol)
    data = network_call(f"calendar:{symbol}", 21600, lambda: ticker(symbol).calendar, allow_empty=True)
    return ok(symbol, data)


@tool("get_sec_filings", "Fundamentals", "Return SEC filings exposed by yfinance; coverage may be sparse outside US listings.", {"symbol": {"type": "string", "required": True}})
def get_sec_filings(symbol: str) -> Dict[str, Any]:
    symbol = require_symbol(symbol)
    data = network_call(f"sec:{symbol}", 86400, lambda: ticker(symbol).sec_filings, allow_empty=True)
    return ok(symbol, data, limitation="SEC coverage can be sparse for NSE/BSE-only listings")


@tool("get_valuation_measures", "Fundamentals", "Return valuation measures when the installed yfinance version exposes get_valuation_measures.", {"symbol": {"type": "string", "required": True}, "timescale": {"type": "string", "default": "trailing"}})
def get_valuation_measures(symbol: str, timescale: str = "trailing") -> Dict[str, Any]:
    symbol = require_symbol(symbol)
    if timescale not in {"trailing", "quarterly", "annual"}:
        raise ServiceError("invalid_parameter", "timescale must be trailing, quarterly, or annual")
    def fetch() -> Any:
        method = getattr(ticker(symbol), "get_valuation_measures", None)
        if not callable(method):
            raise ServiceError("unsupported_capability", "valuation measures are not exposed by this yfinance runtime")
        return method(timescale=timescale)
    data = network_call(f"valuation:{symbol}:{timescale}", 86400, fetch, allow_empty=True)
    return ok(symbol, data, timescale=timescale)


ANALYST_ATTRS = {"recommendations": "recommendations", "recommendations_summary": "recommendations_summary", "upgrades_downgrades": "upgrades_downgrades", "analyst_price_targets": "analyst_price_targets", "earnings_estimate": "earnings_estimate", "revenue_estimate": "revenue_estimate", "eps_trend": "eps_trend", "eps_revisions": "eps_revisions", "growth_estimates": "growth_estimates", "earnings_history": "earnings_history", "sustainability": "sustainability"}


@tool("get_analyst_data", "Analysts", "Return one supported yfinance analyst dataset selected by name.", {"symbol": {"type": "string", "required": True}, "dataset": {"type": "string", "enum": list(ANALYST_ATTRS)}})
def get_analyst_data(symbol: str, dataset: str = "recommendations") -> Dict[str, Any]:
    symbol = require_symbol(symbol)
    if dataset not in ANALYST_ATTRS:
        raise ServiceError("invalid_parameter", f"dataset must be one of: {', '.join(ANALYST_ATTRS)}")
    attr = ANALYST_ATTRS[dataset]
    data = network_call(f"analyst:{symbol}:{dataset}", 86400, lambda: getattr(ticker(symbol), attr), allow_empty=True)
    return ok(symbol, data, dataset=dataset)


OWNERSHIP_ATTRS = {"insider_purchases": "insider_purchases", "insider_transactions": "insider_transactions", "insider_roster": "insider_roster_holders", "major_holders": "major_holders", "institutional_holders": "institutional_holders", "mutualfund_holders": "mutualfund_holders", "shares": "shares", "funds_data": "funds_data"}


@tool("get_ownership_data", "Ownership", "Return one supported yfinance ownership dataset selected by name.", {"symbol": {"type": "string", "required": True}, "dataset": {"type": "string", "enum": list(OWNERSHIP_ATTRS)}})
def get_ownership_data(symbol: str, dataset: str = "institutional_holders") -> Dict[str, Any]:
    symbol = require_symbol(symbol)
    if dataset not in OWNERSHIP_ATTRS:
        raise ServiceError("invalid_parameter", f"dataset must be one of: {', '.join(OWNERSHIP_ATTRS)}")
    data = network_call(f"ownership:{symbol}:{dataset}", 86400, lambda: getattr(ticker(symbol), OWNERSHIP_ATTRS[dataset]), allow_empty=True)
    return ok(symbol, data, dataset=dataset)


@tool("get_option_expirations", "Options", "Return available option expiration dates for a ticker.", {"symbol": {"type": "string", "required": True}})
def get_option_expirations(symbol: str) -> Dict[str, Any]:
    symbol = require_symbol(symbol)
    data = network_call(f"options:{symbol}", 1800, lambda: list(ticker(symbol).options), allow_empty=True)
    return ok(symbol, data)


@tool("get_option_chain", "Options", "Return calls and puts for one available option expiration.", {"symbol": {"type": "string", "required": True}, "expiration": {"type": "string", "required": True}})
def get_option_chain(symbol: str, expiration: str) -> Dict[str, Any]:
    symbol = require_symbol(symbol)
    if not isinstance(expiration, str) or not re.fullmatch(r"\d{4}-\d{2}-\d{2}", expiration):
        raise ServiceError("invalid_parameter", "expiration must use YYYY-MM-DD")
    def fetch() -> Any:
        obj = ticker(symbol)
        expirations = list(obj.options)
        if expiration not in expirations:
            raise ServiceError("option_expiration_not_found", "requested expiration is not available")
        chain = obj.option_chain(expiration)
        return {"calls": chain.calls, "puts": chain.puts}
    data = network_call(f"optionchain:{symbol}:{expiration}", 900, fetch, allow_empty=True)
    return ok(symbol, data, expiration=expiration)


@tool("batch_price_history", "Batch", "Fetch bounded daily or interval history for several symbols with per-symbol error isolation.", {"symbols": {"type": "array", "required": True, "maxItems": 10}, "period": {"type": "string", "default": "1mo"}, "interval": {"type": "string", "default": "1d"}, "limit": {"type": "integer", "default": 100}})
def batch_price_history(symbols: List[str], period: str = "1mo", interval: str = "1d", limit: int = 100) -> Dict[str, Any]:
    symbols = require_symbols(symbols)
    results = {}
    for symbol in symbols:
        try:
            results[symbol] = history_payload(symbol, period, interval, None, None, True, limit)
        except ServiceError as exc:
            results[symbol] = {"success": False, "error": exc.payload()}
    return ok(None, results, symbols=symbols)


@tool("batch_news", "Batch", "Fetch recent news for several symbols with per-symbol error isolation.", {"symbols": {"type": "array", "required": True, "maxItems": 10}, "limit": {"type": "integer", "default": 5}})
def batch_news(symbols: List[str], limit: int = 5) -> Dict[str, Any]:
    symbols = require_symbols(symbols)
    if not 1 <= limit <= 20:
        raise ServiceError("invalid_parameter", "limit must be between 1 and 20")
    results = {}
    for symbol in symbols:
        try:
            results[symbol] = clean(network_call(f"news:{symbol}:{limit}", 900, lambda s=symbol: ticker(s).get_news(count=limit), allow_empty=True))
        except ServiceError as exc:
            results[symbol] = {"success": False, "error": exc.payload()}
    return ok(None, results, symbols=symbols)


@tool("search_tickers", "Search", "Search Yahoo Finance instruments using yfinance.Search and return bounded quote/news metadata.", {"query": {"type": "string", "required": True}, "limit": {"type": "integer", "default": 10, "maximum": 25}})
def search_tickers(query: str, limit: int = 10) -> Dict[str, Any]:
    if not isinstance(query, str) or not query.strip() or len(query) > 80:
        raise ServiceError("invalid_parameter", "query must be a non-empty string of at most 80 characters")
    if not 1 <= limit <= 25:
        raise ServiceError("invalid_parameter", "limit must be between 1 and 25")
    def fetch() -> Any:
        result = yf.Search(query.strip(), max_results=limit, news_count=0)
        return {"quotes": getattr(result, "quotes", []), "research": getattr(result, "research", [])}
    data = network_call(f"search:{query.strip().lower()}:{limit}", 900, fetch, allow_empty=True)
    return ok(None, data, query=query.strip())


@tool("lookup_instruments", "Search", "Look up instruments by asset class through yfinance.Lookup when supported by the installed runtime.", {"query": {"type": "string", "required": True}, "asset_class": {"type": "string", "default": "all"}, "limit": {"type": "integer", "default": 20}})
def lookup_instruments(query: str, asset_class: str = "all", limit: int = 20) -> Dict[str, Any]:
    if not isinstance(query, str) or not query.strip() or len(query) > 80:
        raise ServiceError("invalid_parameter", "query must be a non-empty string of at most 80 characters")
    if asset_class not in {"all", "stock", "mutualfund", "etf", "index"} or not 1 <= limit <= 50:
        raise ServiceError("invalid_parameter", "unsupported asset_class or limit")
    def fetch() -> Any:
        lookup = yf.Lookup(query.strip())
        attrs = [asset_class] if asset_class != "all" else ["all", "stock", "mutualfund", "etf", "index"]
        result = {}
        for attr in attrs:
            value = getattr(lookup, attr, None)
            if value is not None:
                result[attr] = clean(value, limit)
        return result
    data = network_call(f"lookup:{query.strip().lower()}:{asset_class}:{limit}", 900, fetch, allow_empty=True)
    return ok(None, data, query=query.strip(), asset_class=asset_class)


SECTOR_KEYS = ["basic-materials", "communication-services", "consumer-cyclical", "consumer-defensive", "energy", "financial-services", "healthcare", "industrials", "real-estate", "technology", "utilities"]


@tool("get_sector_overview", "Sector", "Return an overview and top-company data for a yfinance Sector key.", {"sector": {"type": "string", "enum": SECTOR_KEYS}, "region": {"type": "string", "default": "US"}})
def get_sector_overview(sector: str, region: str = "US") -> Dict[str, Any]:
    if sector not in SECTOR_KEYS or not re.fullmatch(r"[A-Za-z]{2}", region):
        raise ServiceError("invalid_parameter", "use a documented sector key and two-letter region")
    def fetch() -> Any:
        obj = yf.Sector(sector, region=region.upper())
        return {"name": obj.name, "overview": getattr(obj, "overview", None), "top_companies": getattr(obj, "top_companies", None), "top_etfs": getattr(obj, "top_etfs", None), "industries": getattr(obj, "industries", None)}
    data = network_call(f"sector:{sector}:{region.upper()}", 86400, fetch, allow_empty=True)
    return ok(None, data, sector=sector, region=region.upper())


@tool("get_industry_overview", "Industry", "Return an overview for a yfinance Industry key.", {"industry": {"type": "string", "required": True}, "region": {"type": "string", "default": "US"}})
def get_industry_overview(industry: str, region: str = "US") -> Dict[str, Any]:
    if not isinstance(industry, str) or not re.fullmatch(r"[a-z0-9&\-]{2,80}", industry) or not re.fullmatch(r"[A-Za-z]{2}", region):
        raise ServiceError("invalid_parameter", "industry must be a documented yfinance key and region must be two letters")
    def fetch() -> Any:
        obj = yf.Industry(industry, region=region.upper())
        return {"name": obj.name, "overview": getattr(obj, "overview", None), "top_companies": getattr(obj, "top_companies", None), "top_etfs": getattr(obj, "top_etfs", None)}
    data = network_call(f"industry:{industry}:{region.upper()}", 86400, fetch, allow_empty=True)
    return ok(None, data, industry=industry, region=region.upper())


@tool("get_market_summary", "Market", "Return market-wide status and summary data when yfinance.Market is available.", {"market": {"type": "string", "default": "US"}})
def get_market_summary(market: str = "US") -> Dict[str, Any]:
    if not isinstance(market, str) or not re.fullmatch(r"[A-Za-z]{2,8}", market):
        raise ServiceError("invalid_parameter", "market must be an alphabetic market code")
    def fetch() -> Any:
        obj = yf.Market(market=market.upper())
        return {"status": getattr(obj, "status", None), "summary": getattr(obj, "summary", None), "sector_industries": getattr(obj, "sector_industries", None)}
    data = network_call(f"market:{market.upper()}", 3600, fetch, allow_empty=True)
    return ok(None, data, market=market.upper())


SCREEN_OPS = {"eq", "is-in", "btwn", "gt", "lt", "gte", "lte"}
LOGICAL_OPS = {"and", "or"}
SHORTCUTS = {"region": ("eq", "region"), "exchange": ("eq", "exchange"), "sector": ("eq", "sector"), "industry": ("eq", "industry"), "max_pe": ("lt", "peratio.lasttwelvemonths"), "min_growth": ("gte", "epsgrowth.lasttwelvemonths"), "max_peg": ("lt", "pegratio_5y")}


def make_query(node: Any, query_cls: Any) -> Any:
    if not isinstance(node, Mapping):
        raise ServiceError("invalid_screener_query", "each query node must be an object")
    operator = str(node.get("operator", "")).lower()
    if operator in LOGICAL_OPS:
        operands = node.get("operands")
        if not isinstance(operands, list) or not 1 <= len(operands) <= 12:
            raise ServiceError("invalid_screener_query", "logical operands must contain 1 to 12 nodes")
        return query_cls(operator, [make_query(child, query_cls) for child in operands])
    if operator not in SCREEN_OPS:
        raise ServiceError("invalid_screener_query", f"operator must be one of {sorted(SCREEN_OPS | LOGICAL_OPS)}")
    field = node.get("field")
    value = node.get("value")
    if not isinstance(field, str) or not re.fullmatch(r"[a-zA-Z0-9_.&\-]{1,100}", field):
        raise ServiceError("invalid_screener_query", "field contains unsupported characters")
    values = value if isinstance(value, list) else [value]
    if operator == "btwn" and len(values) != 2:
        raise ServiceError("invalid_screener_query", "btwn requires exactly two values")
    if operator in {"gt", "lt", "gte", "lte"} and not isinstance(values[0], (int, float)):
        raise ServiceError("invalid_screener_query", "numeric comparison values must be numbers")
    if operator == "is-in" and not 1 <= len(values) <= 25:
        raise ServiceError("invalid_screener_query", "is-in accepts 1 to 25 values")
    return query_cls(operator, [field, *values])


def shortcut_query(filters: Dict[str, Any], query_cls: Any) -> Any:
    nodes = []
    for key, value in filters.items():
        if key not in SHORTCUTS:
            raise ServiceError("invalid_screener_query", f"unsupported shortcut filter: {key}")
        op, field = SHORTCUTS[key]
        nodes.append(query_cls(op, [field, value]))
    if not nodes:
        raise ServiceError("invalid_screener_query", "provide conditions or supported filters")
    return nodes[0] if len(nodes) == 1 else query_cls("and", nodes)


@tool("list_predefined_screeners", "Screener", "List yfinance predefined screener names available in the installed runtime.", {})
def list_predefined_screeners() -> Dict[str, Any]:
    names = sorted(getattr(yf, "PREDEFINED_SCREENER_QUERIES", {}).keys())
    return ok(None, names)


@tool("screen_stocks", "Screener", "Execute a safe structured yfinance equity, fund, or ETF screen; arbitrary Python expressions are not accepted.", {"asset_class": {"type": "string", "enum": ["equity", "fund", "etf"], "default": "equity"}, "predefined": {"type": "string", "optional": True}, "conditions": {"type": "array", "optional": True}, "filters": {"type": "object", "optional": True}, "logic": {"type": "string", "enum": ["and", "or"], "default": "and"}, "size": {"type": "integer", "default": 25, "maximum": 250}, "sort_field": {"type": "string", "default": "ticker"}, "sort_ascending": {"type": "boolean", "default": False}})
def screen_stocks(asset_class: str = "equity", predefined: Optional[str] = None, conditions: Optional[List[Dict[str, Any]]] = None, filters: Optional[Dict[str, Any]] = None, logic: str = "and", size: int = 25, sort_field: str = "ticker", sort_ascending: bool = False) -> Dict[str, Any]:
    if asset_class not in {"equity", "fund", "etf"} or logic not in LOGICAL_OPS or not 1 <= size <= 250 or not re.fullmatch(r"[a-zA-Z0-9_.\-]{1,80}", sort_field):
        raise ServiceError("invalid_parameter", "invalid screener asset class, logic, size, or sort_field")
    class_name = {"equity": "EquityQuery", "fund": "FundQuery", "etf": "ETFQuery"}[asset_class]
    query_cls = getattr(yf, class_name, None)
    if query_cls is None:
        raise ServiceError("unsupported_capability", f"{class_name} is not available in this yfinance runtime")
    if predefined:
        allowed = getattr(yf, "PREDEFINED_SCREENER_QUERIES", {})
        if predefined not in allowed:
            raise ServiceError("invalid_screener_query", "predefined screener name is not available")
        query: Any = predefined
    elif conditions:
        query = query_cls(logic, [make_query(item, query_cls) for item in conditions])
    elif filters:
        query = shortcut_query(filters, query_cls)
    else:
        raise ServiceError("invalid_screener_query", "provide predefined, conditions, or filters")
    data = network_call(f"screen:{asset_class}:{predefined}:{clean(conditions)}:{clean(filters)}:{logic}:{size}:{sort_field}:{sort_ascending}", 600, lambda: yf.screen(query, size=size, sortField=sort_field, sortAsc=sort_ascending), allow_empty=True)
    return ok(None, data, asset_class=asset_class, predefined=predefined, size=size)


@tool("get_server_info", "Streaming", "Return server version, MCP readiness, yfinance version, capabilities, and deployment metadata.", {})
def get_server_info() -> Dict[str, Any]:
    return ok(None, {"name": APP_NAME, "version": VERSION, "mcp": "ready", "yfinance": getattr(yf, "__version__", "unknown"), "tool_count": len(TOOL_SPECS), "deployment": "huggingface-spaces" if os.getenv("SPACE_ID") else "self-hosted", "uptime_seconds": round(time.time() - STARTED_AT, 1), "streaming": "not exposed; use stable non-streaming tools"})


DASHBOARD_HTML = r"""
<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>SignalDock yfinance MCP</title>
<style>
:root{--bg:#f4f7fb;--panel:#fff;--ink:#172033;--muted:#6c7890;--line:#e4e9f1;--blue:#2563eb;--blue2:#dbeafe;--green:#0f9f6e;--green2:#d9f7eb;--orange:#b96a08;--orange2:#fff0d5;--red:#c43d55;--shadow:0 10px 30px rgba(31,49,85,.08)}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:14px/1.5 Inter,ui-sans-serif,system-ui,-apple-system,Segoe UI,sans-serif}button,input{font:inherit}.shell{display:flex;min-height:100vh}.rail{width:240px;background:#101a2d;color:#c8d3e7;padding:22px 16px;position:fixed;inset:0 auto 0 0}.brand{display:flex;gap:10px;align-items:center;color:white;font-weight:800;font-size:17px;margin:0 8px 34px}.mark{width:30px;height:30px;border-radius:9px;background:linear-gradient(135deg,#6b8cff,#7ce4c6);display:grid;place-items:center;color:#10203a;font-weight:900}.rail nav a{display:block;color:#a9b7cf;text-decoration:none;padding:11px 12px;border-radius:9px;margin:3px 0}.rail nav a.active,.rail nav a:hover{background:#1d2a45;color:white}.rail-foot{position:absolute;bottom:22px;left:24px;right:20px;color:#74829c;font-size:12px}.main{margin-left:240px;padding:28px 34px;max-width:1500px;width:calc(100% - 240px)}.top{display:flex;justify-content:space-between;align-items:center;gap:18px;margin-bottom:22px}.eyebrow{color:var(--muted);font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.12em}.title{font-size:30px;line-height:1.1;margin:4px 0 0;font-weight:850;letter-spacing:-.04em}.top-actions{display:flex;align-items:center;gap:10px}.pill{padding:7px 11px;border-radius:99px;background:var(--green2);color:var(--green);font-weight:750;font-size:12px}.icon-btn,.copy{border:1px solid var(--line);background:var(--panel);color:var(--ink);border-radius:8px;padding:8px 10px;cursor:pointer}.grid{display:grid;gap:16px}.stats{grid-template-columns:repeat(4,minmax(0,1fr));margin-bottom:16px}.card{background:var(--panel);border:1px solid var(--line);border-radius:14px;box-shadow:var(--shadow);padding:18px}.metric-label{font-size:12px;color:var(--muted);font-weight:650}.metric{font-size:28px;font-weight:830;margin-top:6px;letter-spacing:-.04em}.metric-sub{font-size:12px;color:var(--muted);margin-top:4px}.twocol{grid-template-columns:minmax(0,1.45fr) minmax(320px,.85fr);margin-bottom:16px}.section-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:15px}.section-title{font-size:16px;font-weight:800}.section-note{font-size:12px;color:var(--muted)}.endpoint{display:flex;gap:9px;align-items:center;background:#f7f9fc;border:1px solid var(--line);border-radius:10px;padding:11px;margin:8px 0}.endpoint strong{min-width:100px;font-size:11px;text-transform:uppercase;color:var(--muted);letter-spacing:.08em}.endpoint code{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;color:#25427d}.copy{font-size:12px;background:white}.connect{background:#10243f;color:#e9f2ff;border-radius:11px;padding:14px;margin-top:14px}.connect .section-note{color:#a9c0e2}.connect pre{white-space:pre-wrap;word-break:break-word;margin:10px 0 0;color:#c3dbff;font-size:12px}.status-row{display:flex;justify-content:space-between;border-bottom:1px solid var(--line);padding:10px 0}.status-row:last-child{border:0}.status-ok{color:var(--green);font-weight:750}.status-muted{color:var(--muted)}.dot{display:inline-block;width:8px;height:8px;border-radius:50%;background:var(--green);margin-right:7px}.toolbar{display:flex;gap:10px;align-items:center;margin-bottom:12px}.search{border:1px solid var(--line);border-radius:8px;padding:9px 11px;background:#fbfcfe;min-width:220px;flex:1}.filters{display:flex;gap:6px;flex-wrap:wrap}.filter{border:1px solid var(--line);background:white;padding:7px 9px;border-radius:7px;cursor:pointer;color:var(--muted);font-size:12px}.filter.active{background:var(--blue2);color:var(--blue);border-color:#b8d0ff}.tools{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;max-height:530px;overflow:auto}.tool{border:1px solid var(--line);border-radius:10px;padding:12px}.tool:hover{border-color:#bfd2f9}.tool-top{display:flex;justify-content:space-between;gap:8px}.tool-name{font-weight:780;font-size:13px}.tag{font-size:10px;border-radius:5px;padding:3px 6px;background:#eef2ff;color:#4759a9;white-space:nowrap}.tool p{font-size:12px;color:var(--muted);margin:8px 0}.tool-meta{font-size:11px;color:var(--muted)}table{width:100%;border-collapse:collapse;font-size:12px}th{text-align:left;color:var(--muted);font-weight:700;padding:9px 7px;border-bottom:1px solid var(--line)}td{padding:10px 7px;border-bottom:1px solid #edf0f5}td code{font-size:11px}.ok{color:var(--green);font-weight:700}.bad{color:var(--red);font-weight:700}.guides{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.guide h3{font-size:13px;margin:0 0 5px}.guide p{font-size:12px;color:var(--muted);margin:0}.disclaimer{font-size:12px;color:var(--muted);padding:2px 2px 28px}.chart{height:78px;display:flex;align-items:end;gap:4px;margin-top:10px}.bar{background:linear-gradient(180deg,#5c7eff,#b7c9ff);border-radius:4px 4px 0 0;min-width:8px;flex:1}.hidden{display:none}@media(max-width:1100px){.stats{grid-template-columns:repeat(2,1fr)}.tools{grid-template-columns:repeat(2,1fr)}.twocol{grid-template-columns:1fr}}@media(max-width:760px){.rail{position:static;width:100%;height:auto;padding:13px 16px}.rail nav{display:flex;overflow:auto;gap:5px}.rail nav a{white-space:nowrap}.rail-foot{display:none}.shell{display:block}.main{margin:0;width:100%;padding:20px 14px}.top{align-items:flex-start}.title{font-size:24px}.stats{grid-template-columns:1fr 1fr;gap:10px}.card{padding:14px}.metric{font-size:22px}.tools,.guides{grid-template-columns:1fr}.endpoint strong{min-width:72px;font-size:10px}.endpoint{padding:8px}.top-actions{flex-direction:column;align-items:flex-end}}
</style></head><body><div class="shell"><aside class="rail"><div class="brand"><span class="mark">S</span>SignalDock</div><nav><a class="active" href="#overview">Overview</a><a href="#tools">Tool explorer</a><a href="#activity">Activity</a><a href="#guides">Guidelines</a></nav><div class="rail-foot">yfinance MCP<br>v1.0.0 · privacy-conscious metrics</div></aside><main class="main"><div class="top"><div><div class="eyebrow">MCP infrastructure console</div><div class="title">yfinance data gateway</div></div><div class="top-actions"><span class="pill"><span class="dot"></span><span id="statusPill">Operational</span></span><button class="icon-btn" id="themeBtn" title="Toggle theme">◐</button></div></div>
<section id="overview" class="grid stats"><div class="card"><div class="metric-label">MCP requests</div><div class="metric" id="requests">—</div><div class="metric-sub" id="requestRate">— per minute</div></div><div class="card"><div class="metric-label">Successful calls</div><div class="metric" id="success">—</div><div class="metric-sub" id="errors">— errors</div></div><div class="card"><div class="metric-label">Unique clients</div><div class="metric" id="clients">—</div><div class="metric-sub">anonymous client fingerprints</div></div><div class="card"><div class="metric-label">Average latency</div><div class="metric" id="latency">—</div><div class="metric-sub" id="cache">— cache hit rate</div></div></section>
<section class="grid twocol"><div class="card"><div class="section-head"><div><div class="section-title">Connection center</div><div class="section-note">The MCP transport is independent from this dashboard.</div></div><span class="tag">Streamable HTTP</span></div><div class="endpoint"><strong>MCP URL</strong><code id="mcpUrl">—</code><button class="copy" data-copy="mcpUrl">Copy</button></div><div class="endpoint"><strong>Dashboard</strong><code id="dashUrl">—</code><button class="copy" data-copy="dashUrl">Copy</button></div><div class="endpoint"><strong>Health</strong><code id="healthUrl">—</code><button class="copy" data-copy="healthUrl">Copy</button></div><div class="connect"><div class="section-title">How to connect</div><div class="section-note">Use the MCP URL above in a client that supports Streamable HTTP.</div><pre id="config">{ "mcpServers": { "signalDock": { "url": "…/mcp" } } }</pre></div></div><div class="card"><div class="section-head"><div><div class="section-title">System status</div><div class="section-note" id="environment">—</div></div></div><div class="status-row"><span>Application</span><span class="status-ok">● Online</span></div><div class="status-row"><span>MCP server</span><span class="status-ok" id="mcpReady">● Ready</span></div><div class="status-row"><span>yfinance</span><span class="status-ok" id="yfReady">● Available</span></div><div class="status-row"><span>Uptime</span><span id="uptime" class="status-muted">—</span></div><div class="status-row"><span>Last request</span><span id="lastRequest" class="status-muted">—</span></div><div class="chart" id="chart"></div></div></section>
<section id="tools" class="card" style="margin-bottom:16px"><div class="section-head"><div><div class="section-title">Tool explorer</div><div class="section-note"><span id="toolCount">—</span> explicit, JSON-safe tools available to MCP clients.</div></div></div><div class="toolbar"><input class="search" id="toolSearch" placeholder="Search tools or descriptions…"><div class="filters" id="filters"></div></div><div class="tools" id="toolGrid"></div></section>
<section id="activity" class="card" style="margin-bottom:16px"><div class="section-head"><div><div class="section-title">Recent activity</div><div class="section-note">Identifiers are short-lived anonymous fingerprints, not real user identities.</div></div><span class="tag" id="rateLimited">0 throttled</span></div><div style="overflow:auto"><table><thead><tr><th>Time</th><th>Tool</th><th>Client</th><th>Latency</th><th>Result</th></tr></thead><tbody id="activityRows"></tbody></table></div></section>
<section id="guides" class="card" style="margin-bottom:16px"><div class="section-head"><div><div class="section-title">Guidelines</div><div class="section-note">Practical guardrails for AI-agent workloads.</div></div></div><div class="guides"><div class="guide"><h3>Ticker format</h3><p>Use exchange-qualified symbols for India: RELIANCE.NS and TCS.NS for NSE, or RELIANCE.BO for BSE. Symbols are not silently rewritten.</p></div><div class="guide"><h3>Freshness and caching</h3><p>Snapshots cache briefly, daily history and metadata longer, and fundamentals for up to 24 hours. Repeated requests are served from memory when safe.</p></div><div class="guide"><h3>Rate limits</h3><p>Requests are throttled globally and per anonymous client with bounded retries. Yahoo can still return 429 responses or change behavior.</p></div><div class="guide"><h3>Data limitations</h3><p>yfinance is an unofficial Yahoo Finance wrapper. Quotes may be delayed, incomplete, or unavailable, and Indian filings can be sparse.</p></div><div class="guide"><h3>Streaming</h3><p>Streaming is intentionally not exposed over MCP in this build. Stable non-streaming tools avoid per-client Yahoo WebSocket storms.</p></div><div class="guide"><h3>Financial disclaimer</h3><p>This service is a data-access tool, not financial advice. Never treat raw or generated financial data as a guaranteed investment recommendation.</p></div></div></section><div class="disclaimer">SignalDock does not collect names, emails, or account identities. Unique clients are estimated from a one-way hash of proxy/network metadata and user-agent; this metric is approximate.</div></main></div>
<script>
const state={tools:[],category:'All'}; const $=id=>document.getElementById(id); const fmt=n=>new Intl.NumberFormat().format(n||0); const ago=t=>{if(!t)return'—';const d=(Date.now()-new Date(t).getTime())/1000;return d<60?Math.max(1,Math.round(d))+'s ago':d<3600?Math.round(d/60)+'m ago':new Date(t).toLocaleString()};
function copyText(text){navigator.clipboard?.writeText(text)}
async function load(){try{const [s,t,h]=await Promise.all([fetch('/api/stats').then(r=>r.json()),fetch('/api/tools').then(r=>r.json()),fetch('/health').then(r=>r.json())]); state.tools=t.tools||[]; renderStats(s,h); renderFilters(); renderTools(); renderActivity(s.activity||[])}catch(e){$('statusPill').textContent='Degraded'}}
function renderStats(s,h){$('requests').textContent=fmt(s.total_mcp_requests);$('requestRate').textContent=(s.requests_per_minute||0).toFixed(1)+' per minute';$('success').textContent=fmt(s.successful_requests);$('errors').textContent=fmt(s.failed_requests)+' errors';$('clients').textContent=fmt(s.unique_clients);$('latency').textContent=(s.average_latency_ms||0).toFixed(0)+' ms';$('cache').textContent=(s.cache_hit_rate||0).toFixed(0)+'% cache hit rate';$('mcpUrl').textContent=s.urls.mcp;$('dashUrl').textContent=s.urls.dashboard;$('healthUrl').textContent=s.urls.health;$('config').textContent='{\n  "mcpServers": {\n    "signalDock": { "url": "'+s.urls.mcp+'" }\n  }\n}';$('environment').textContent=s.environment+' · '+s.version;$('uptime').textContent=(s.uptime_seconds/3600).toFixed(1)+' hours';$('lastRequest').textContent=ago(s.last_request);$('toolCount').textContent=s.tool_count;$('rateLimited').textContent=fmt(s.rate_limited_requests)+' throttled';$('yfReady').textContent=h.yfinance==='available'?'● Available':'● Unavailable';$('mcpReady').textContent=h.mcp==='ready'?'● Ready':'● Not ready';const bars=s.hourly_activity||[];$('chart').innerHTML=bars.map(v=>'<div class="bar" style="height:'+Math.max(8,Math.min(100,v*12))+'%" title="'+v+' calls"></div>').join('')}
function renderFilters(){const cats=['All',...new Set(state.tools.map(x=>x.category))];$('filters').innerHTML=cats.map(c=>'<button class="filter '+(state.category===c?'active':'')+'" onclick="state.category=\''+c+'\';renderFilters();renderTools()">'+c+'</button>').join('')}
function renderTools(){const q=$('toolSearch').value.toLowerCase();const list=state.tools.filter(x=>(state.category==='All'||x.category===state.category)&&(x.name+x.description).toLowerCase().includes(q));$('toolGrid').innerHTML=list.map(x=>{const st=x.stats||{};return'<article class="tool"><div class="tool-top"><div class="tool-name">'+x.name+'</div><span class="tag">'+x.category+'</span></div><p>'+x.description+'</p><div class="tool-meta">'+(x.inputs?Object.keys(x.inputs).length:0)+' inputs · '+fmt(st.calls)+' calls · '+(st.latency_ms||0).toFixed(0)+' ms avg</div></article>'}).join('')||'<div class="section-note">No matching tools.</div>'}
function renderActivity(rows){$('activityRows').innerHTML=rows.slice(0,24).map(x=>'<tr><td>'+ago(x.timestamp)+'</td><td><code>'+x.tool+'</code></td><td><code>'+x.client+'</code></td><td>'+x.latency_ms+' ms</td><td class="'+(x.success?'ok':'bad')+'">'+(x.success?'Success':x.error_type||'Failed')+'</td></tr>').join('')||'<tr><td colspan="5" class="status-muted">No MCP tool activity yet.</td></tr>'}
$('toolSearch').addEventListener('input',renderTools);document.querySelectorAll('[data-copy]').forEach(b=>b.addEventListener('click',()=>{copyText($(b.dataset.copy).textContent);b.textContent='Copied';setTimeout(()=>b.textContent='Copy',900)}));$('themeBtn').addEventListener('click',()=>document.body.classList.toggle('dark'));load();setInterval(load,10000);
</script></body></html>
"""


@asynccontextmanager
async def lifespan(_: FastAPI):
    log.info("Starting %s with %d MCP tools", APP_NAME, len(TOOL_SPECS))
    async with mcp.session_manager.run():
        yield


app = FastAPI(title=APP_NAME, version=VERSION, lifespan=lifespan)


@app.middleware("http")
async def observe_requests(request: Request, call_next: Callable[..., Any]):
    client = anonymous_client(request)
    token = client_context.set(client)
    started = time.perf_counter()
    is_mcp = request.url.path.startswith("/mcp")
    if is_mcp:
        with stats["lock"]:
            stats["total_mcp_requests"] += 1
            stats["unique_clients"].add(client)
    try:
        response = await call_next(request)
        if is_mcp:
            with stats["lock"]:
                if response.status_code < 400:
                    stats["successful_requests"] += 1
                else:
                    stats["failed_requests"] += 1
        return response
    except Exception:
        if is_mcp:
            with stats["lock"]:
                stats["failed_requests"] += 1
        raise
    finally:
        if is_mcp:
            elapsed = (time.perf_counter() - started) * 1000
            with stats["lock"]:
                stats["total_latency_ms"] += elapsed
        client_context.reset(token)


@app.get("/", response_class=HTMLResponse)
async def dashboard() -> str:
    return DASHBOARD_HTML


@app.get("/health")
async def health() -> Dict[str, Any]:
    yf_status = "available" if getattr(yf, "Ticker", None) else "unavailable"
    return {"status": "healthy" if yf_status == "available" else "degraded", "mcp": "ready", "yfinance": yf_status, "uptime": round(time.time() - STARTED_AT, 1), "timestamp": utc_now(), "tool_count": len(TOOL_SPECS)}


@app.get("/api/tools")
async def tools() -> Dict[str, Any]:
    with stats["lock"]:
        merged = []
        for spec in TOOL_SPECS:
            item = dict(spec)
            item["stats"] = dict(stats["tools"].get(spec["name"], {}))
            merged.append(item)
    return {"tools": merged, "count": len(merged)}


@app.get("/api/stats")
async def dashboard_stats() -> Dict[str, Any]:
    with stats["lock"]:
        total = stats["total_mcp_requests"]
        age = max(1, time.time() - STARTED_AT)
        recent = list(stats["activity"])
        tool_stats = {name: dict(value) for name, value in stats["tools"].items()}
        activity_values = [a for a in recent if (time.time() - datetime.fromisoformat(a["timestamp"].replace("Z", "+00:00")).timestamp()) < 3600]
        return {"version": VERSION, "environment": "Hugging Face Spaces" if os.getenv("SPACE_ID") else "Local / self-hosted", "uptime_seconds": round(age, 1), "total_mcp_requests": total, "successful_requests": stats["successful_requests"], "failed_requests": stats["failed_requests"], "total_tool_calls": stats["total_tool_calls"], "unique_clients": len(stats["unique_clients"]), "average_latency_ms": round(stats["total_latency_ms"] / max(1, total + stats["total_tool_calls"]), 2), "cache_hits": stats["cache_hits"], "cache_misses": stats["cache_misses"], "cache_hit_rate": round(100 * stats["cache_hits"] / max(1, stats["cache_hits"] + stats["cache_misses"]), 1), "rate_limited_requests": stats["rate_limited_requests"], "requests_per_minute": round(sum(1 for a in recent if (time.time() - datetime.fromisoformat(a["timestamp"].replace("Z", "+00:00")).timestamp()) < 60), 1), "last_request": recent[0]["timestamp"] if recent else None, "activity": recent, "hourly_activity": [max(0, sum(1 for a in activity_values if i <= (time.time() - datetime.fromisoformat(a["timestamp"].replace("Z", "+00:00")).timestamp()) / 60 < i + 5)) for i in range(12)], "tool_stats": tool_stats, "tool_count": len(TOOL_SPECS), "urls": endpoint_urls()}


# Mount the official Streamable HTTP MCP application. The dashboard remains separate.
app.mount("/", mcp.streamable_http_app())


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app:app", host="0.0.0.0", port=int(os.getenv("PORT", "7860")), proxy_headers=True, forwarded_allow_ips="*")
