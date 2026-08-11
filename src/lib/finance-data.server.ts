import { callMcpTool } from "./mcp.server";
import {
  isRecord,
  num,
  rows,
  str,
  toCandles,
  toGenericTable,
  toStatementTable,
  type GenericTable,
} from "./finance-normalize";
import type {
  AnalystSummary,
  CalendarInfo,
  Candle,
  CompareSeries,
  CorporateActions,
  IndexQuote,
  KeyRatios,
  NewsItem,
  Quote,
  ScreenerRow,
  SearchResult,
  StatementTable,
  StockSummary,
} from "./finance-types";
import { MARKET_INDICES } from "./finance-types";

const INCOME_ORDER = [
  "Total Revenue",
  "Cost Of Revenue",
  "Gross Profit",
  "Operating Expense",
  "Research And Development",
  "Operating Income",
  "EBITDA",
  "EBIT",
  "Pretax Income",
  "Tax Provision",
  "Net Income",
  "Diluted EPS",
  "Basic EPS",
];
const BALANCE_ORDER = [
  "Total Assets",
  "Current Assets",
  "Cash And Cash Equivalents",
  "Inventory",
  "Total Liabilities Net Minority Interest",
  "Current Liabilities",
  "Total Debt",
  "Stockholders Equity",
  "Working Capital",
];
const CASHFLOW_ORDER = [
  "Operating Cash Flow",
  "Investing Cash Flow",
  "Financing Cash Flow",
  "Free Cash Flow",
  "Capital Expenditure",
  "Repurchase Of Capital Stock",
  "Cash Dividends Paid",
  "End Cash Position",
];

function pick(raw: unknown, key: string): unknown {
  return isRecord(raw) ? raw[key] : null;
}

function buildQuote(symbol: string, snapshot: unknown, info: unknown): Quote {
  const s = isRecord(snapshot) ? snapshot : {};
  const r = isRecord(info) ? info : {};
  const price = num(s["last_price"]) ?? num(r["currentPrice"]);
  const prev = num(s["previous_close"]) ?? num(r["previousClose"]);
  const change = price !== null && prev !== null ? price - prev : null;
  const shares = num(s["shares"]);
  return {
    symbol,
    name: str(r["shortName"]) ?? str(r["longName"]) ?? symbol,
    exchange: str(s["exchange"]) ?? str(r["exchange"]),
    currency: str(s["currency"]) ?? str(r["currency"]),
    price,
    previousClose: prev,
    open: num(s["open"]) ?? num(r["open"]),
    dayHigh: num(s["day_high"]),
    dayLow: num(s["day_low"]),
    yearHigh: num(s["year_high"]) ?? num(r["fiftyTwoWeekHigh"]),
    yearLow: num(s["year_low"]) ?? num(r["fiftyTwoWeekLow"]),
    marketCap: num(s["market_cap"]) ?? num(r["marketCap"]) ?? (shares && price ? shares * price : null),
    change,
    changePercent: change !== null && prev ? (change / prev) * 100 : null,
  };
}

function buildRatios(info: unknown): KeyRatios {
  const r = isRecord(info) ? info : {};
  return {
    sector: str(r["sector"]),
    industry: str(r["industry"]),
    country: str(r["country"]),
    summary: str(r["longBusinessSummary"]),
    trailingPE: num(r["trailingPE"]),
    forwardPE: num(r["forwardPE"]),
    priceToBook: num(r["priceToBook"]),
    enterpriseToEbitda: num(r["enterpriseToEbitda"]),
    profitMargins: num(r["profitMargins"]),
    operatingMargins: num(r["operatingMargins"]),
    returnOnEquity: num(r["returnOnEquity"]),
    revenueGrowth: num(r["revenueGrowth"]),
    earningsGrowth: num(r["earningsGrowth"]),
    debtToEquity: num(r["debtToEquity"]),
    dividendYield: num(r["dividendYield"]),
    beta: num(r["beta"]),
    targetMeanPrice: num(r["targetMeanPrice"]),
    recommendationKey: str(r["recommendationKey"]),
    numberOfAnalystOpinions: num(r["numberOfAnalystOpinions"]),
  };
}

export async function fetchSummary(symbol: string): Promise<StockSummary> {
  const [snap, info] = await Promise.all([
    callMcpTool("get_price_snapshot", { ticker: symbol }).catch(() => null),
    callMcpTool("get_company_info", { ticker: symbol }).catch(() => null),
  ]);
  const snapshot = pick(snap, "snapshot");
  const details = pick(info, "info");
  return { quote: buildQuote(symbol, snapshot, details), ratios: buildRatios(details) };
}

export async function fetchHistory(symbol: string, period: string, interval: string): Promise<Candle[]> {
  const raw = await callMcpTool("get_price_history", {
    ticker: symbol,
    period,
    interval,
    max_rows: 500,
  });
  return toCandles(pick(raw, "history"));
}

export async function fetchNews(symbol: string, count = 12): Promise<NewsItem[]> {
  const raw = await callMcpTool("get_news", { ticker: symbol, count });
  return normalizeNews(pick(raw, "news"));
}

function normalizeNews(raw: unknown): NewsItem[] {
  return rows(raw)
    .map((n) => {
      const c = isRecord(n["content"]) ? n["content"] : n;
      const provider = isRecord(c["provider"]) ? c["provider"] : {};
      const url =
        (isRecord(c["canonicalUrl"]) ? str(c["canonicalUrl"]["url"]) : null) ??
        (isRecord(c["clickThroughUrl"]) ? str(c["clickThroughUrl"]["url"]) : null) ??
        str(c["link"]) ??
        "#";
      return {
        title: str(c["title"]) ?? "Untitled",
        publisher: str(provider["displayName"]) ?? str(c["publisher"]),
        link: url,
        pubDate: str(c["pubDate"]) ?? str(c["displayTime"]),
        summary: str(c["summary"]) ?? str(c["description"]),
      };
    })
    .filter((n) => n.title !== "Untitled" || n.link !== "#");
}

export async function fetchSearchNews(query: string, count = 15): Promise<NewsItem[]> {
  const raw = await callMcpTool("search_news", { query, news_count: count });
  return normalizeNews(pick(raw, "news") ?? pick(raw, "data"));
}

export async function fetchSearch(query: string): Promise<SearchResult[]> {
  const raw = await callMcpTool("search_tickers", { query, max_results: 8, news_count: 0 });
  const list = rows(pick(raw, "quotes") ?? pick(raw, "results") ?? pick(raw, "data"));
  const mapped = list
    .map((q) => ({
      symbol: str(q["symbol"]) ?? "",
      name: str(q["longname"]) ?? str(q["shortname"]) ?? str(q["name"]) ?? "",
      exchange: str(q["exchDisp"]) ?? str(q["exchange"]),
      type: str(q["typeDisp"]) ?? str(q["type"]),
      sector: str(q["sectorDisp"]) ?? null,
    }))
    .filter((q) => q.symbol.length > 0);
  if (mapped.length > 0) return mapped.slice(0, 8);

  const resolved = await callMcpTool("resolve_ticker", { query, max_results: 8 }).catch(() => null);
  return rows(pick(resolved, "all_matches"))
    .map((q) => ({
      symbol: str(q["symbol"]) ?? "",
      name: str(q["name"]) ?? "",
      exchange: str(q["exchange"]),
      type: str(q["type"]),
      sector: null,
    }))
    .filter((q) => q.symbol.length > 0)
    .slice(0, 8);
}

export async function fetchResolve(query: string, region?: string) {
  const raw = await callMcpTool("resolve_ticker", { query, region, max_results: 6 });
  return {
    best: pick(raw, "best_match"),
    matches: rows(pick(raw, "all_matches")),
  };
}

export async function fetchFinancials(
  symbol: string,
  statement: "income" | "balance" | "cash",
  quarterly: boolean,
): Promise<StatementTable> {
  const tool =
    statement === "income"
      ? "get_income_statement"
      : statement === "balance"
        ? "get_balance_sheet"
        : "get_cash_flow";
  const raw = await callMcpTool(tool, { ticker: symbol, freq: quarterly ? "quarterly" : "yearly" });
  const order = statement === "income" ? INCOME_ORDER : statement === "balance" ? BALANCE_ORDER : CASHFLOW_ORDER;
  return toStatementTable(pick(raw, "statement") ?? pick(raw, "data"), order);
}

export async function fetchAnalyst(symbol: string): Promise<AnalystSummary> {
  const [recs, targets, history] = await Promise.all([
    callMcpTool("get_recommendations", { ticker: symbol }).catch(() => null),
    callMcpTool("get_analyst_price_targets", { ticker: symbol }).catch(() => null),
    callMcpTool("get_earnings_history", { ticker: symbol }).catch(() => null),
  ]);

  const distribution = rows(pick(recs, "data")).map((r) => ({
    period: str(r["period"]) ?? "",
    strongBuy: num(r["strongBuy"]) ?? 0,
    buy: num(r["buy"]) ?? 0,
    hold: num(r["hold"]) ?? 0,
    sell: num(r["sell"]) ?? 0,
    strongSell: num(r["strongSell"]) ?? 0,
  }));

  const t = isRecord(pick(targets, "targets")) ? (pick(targets, "targets") as Record<string, unknown>) : {};

  const earningsHistory = rows(pick(history, "data")).map((r) => ({
    date: (str(r["quarter"]) ?? "").slice(0, 10),
    actual: num(r["epsActual"]),
    estimate: num(r["epsEstimate"]),
    surprisePercent: num(r["surprisePercent"]) !== null ? num(r["surprisePercent"])! * 100 : null,
  }));

  return {
    distribution,
    targets: {
      current: num(t["current"]),
      low: num(t["low"]),
      mean: num(t["mean"]),
      median: num(t["median"]),
      high: num(t["high"]),
    },
    earningsHistory,
  };
}

export async function fetchUpgrades(symbol: string) {
  const raw = await callMcpTool("get_upgrades_downgrades", { ticker: symbol });
  return rows(pick(raw, "data"))
    .slice(0, 20)
    .map((r) => ({
      date: (str(r["GradeDate"]) ?? "").slice(0, 10),
      firm: str(r["Firm"]) ?? "",
      fromGrade: str(r["FromGrade"]) ?? "",
      toGrade: str(r["ToGrade"]) ?? "",
      action: str(r["Action"]) ?? "",
      priceTarget: num(r["currentPriceTarget"]),
    }));
}

export async function fetchCalendar(symbol: string): Promise<CalendarInfo> {
  const raw = await callMcpTool("get_calendar", { ticker: symbol });
  const c = isRecord(pick(raw, "calendar")) ? (pick(raw, "calendar") as Record<string, unknown>) : {};
  const earnings = c["Earnings Date"];
  return {
    earningsDate: Array.isArray(earnings) ? str(earnings[0]) : str(earnings),
    exDividendDate: str(c["Ex-Dividend Date"]),
    dividendDate: str(c["Dividend Date"]),
    earningsLow: num(c["Earnings Low"]),
    earningsAverage: num(c["Earnings Average"]),
    earningsHigh: num(c["Earnings High"]),
    revenueAverage: num(c["Revenue Average"]),
  };
}

export async function fetchCorporateActions(symbol: string): Promise<CorporateActions> {
  const [div, split] = await Promise.all([
    callMcpTool("get_dividends", { ticker: symbol, period: "5y" }).catch(() => null),
    callMcpTool("get_splits", { ticker: symbol, period: "max" }).catch(() => null),
  ]);
  const dividends = rows(pick(div, "dividends") ?? pick(div, "data"))
    .map((r) => ({ date: (str(r["Date"]) ?? "").slice(0, 10), amount: num(r["Dividends"]) ?? 0 }))
    .filter((d) => d.amount > 0)
    .reverse()
    .slice(0, 12);
  const splits = rows(pick(split, "splits") ?? pick(split, "data"))
    .map((r) => ({
      date: (str(r["Date"]) ?? "").slice(0, 10),
      ratio: num(r["Stock Splits"]) ?? num(r["Splits"]) ?? 0,
    }))
    .filter((d) => d.ratio > 0)
    .reverse()
    .slice(0, 8);
  return { dividends, splits };
}

export async function fetchCompare(symbols: string, period: string, interval: string): Promise<CompareSeries[]> {
  const tickers = symbols
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 20);
  const raw = await callMcpTool("batch_price_history", { tickers, period, interval, max_rows: 400 });
  const results = pick(raw, "results");
  if (!isRecord(results)) return [];
  return tickers
    .filter((t) => results[t])
    .map((symbol) => ({
      symbol,
      points: toCandles(pick(results[symbol], "history")).map((c) => ({ t: c.t, c: c.c })),
    }));
}

/** Fast batch quotes — one MCP call per 20 tickers. */
export async function fetchQuotes(symbols: string[]): Promise<Quote[]> {
  const chunks: string[][] = [];
  for (let i = 0; i < symbols.length; i += 20) chunks.push(symbols.slice(i, i + 20));

  const settled = await Promise.allSettled(
    chunks.map((tickers) => callMcpTool("batch_snapshots", { tickers })),
  );

  const out: Quote[] = [];
  settled.forEach((res, i) => {
    if (res.status !== "fulfilled") return;
    const results = pick(res.value, "results");
    if (!isRecord(results)) return;
    for (const symbol of chunks[i]!) {
      const entry = results[symbol];
      const snapshot = pick(entry, "snapshot");
      if (!isRecord(snapshot)) continue;
      out.push(buildQuote(symbol, snapshot, null));
    }
  });
  return out;
}

export async function fetchMarketStrip(indices?: { key: string; label: string }[]): Promise<IndexQuote[]> {
  const list = indices && indices.length > 0 ? indices : MARKET_INDICES.map((i) => ({ key: i.key, label: i.label }));
  const tickers = list.map((i) => i.key);

  const raw = await callMcpTool("batch_price_history", {
    tickers,
    period: "1mo",
    interval: "1d",
    max_rows: 40,
  }).catch(() => null);
  const results = pick(raw, "results");

  return list.map((index) => {
    const points = isRecord(results)
      ? toCandles(pick(results[index.key], "history")).map((c) => ({ t: c.t, c: c.c }))
      : [];
    const last = points[points.length - 1]?.c ?? null;
    const prev = points[points.length - 2]?.c ?? null;
    return {
      key: index.key,
      label: index.label,
      points,
      last,
      changePercent: last !== null && prev ? ((last - prev) / prev) * 100 : null,
    };
  });
}

/* ---------- Discovery: screeners, movers, sectors, calendars ---------- */

function toScreenerRows(raw: unknown): ScreenerRow[] {
  return rows(raw)
    .map((q) => ({
      symbol: str(q["symbol"]) ?? "",
      name: str(q["shortName"]) ?? str(q["longName"]) ?? str(q["displayName"]) ?? "",
      price: num(q["regularMarketPrice"]),
      changePercent: num(q["regularMarketChangePercent"]),
      marketCap: num(q["marketCap"]),
      volume: num(q["regularMarketVolume"]),
      peRatio: num(q["trailingPE"]),
      exchange: str(q["fullExchangeName"]) ?? str(q["exchange"]),
      sector: str(q["sector"]) ?? str(q["sectorDisp"]),
      rating: str(q["averageAnalystRating"]),
    }))
    .filter((q) => q.symbol.length > 0);
}

export async function fetchPredefinedScreeners(): Promise<string[]> {
  const raw = await callMcpTool("list_predefined_screeners", {});
  const list = pick(raw, "predefined");
  return Array.isArray(list) ? list.map(String) : [];
}

export async function fetchScreenPredefined(name: string, size = 25): Promise<ScreenerRow[]> {
  const raw = await callMcpTool("screen_predefined", { name, size });
  return toScreenerRows(pick(raw, "quotes") ?? pick(raw, "data"));
}

export type EquityScreenInput = {
  region?: string;
  minMarketCap?: number;
  maxPe?: number;
  minGrowth?: number;
  minDividendYield?: number;
  sector?: string;
  size?: number;
  sortField?: string;
  sortAscending?: boolean;
};

export async function fetchScreenEquities(input: EquityScreenInput): Promise<ScreenerRow[]> {
  const raw = await callMcpTool("screen_equities", {
    region: input.region ?? "us",
    min_market_cap: input.minMarketCap,
    max_pe: input.maxPe,
    min_growth: input.minGrowth,
    min_dividend_yield: input.minDividendYield,
    sector: input.sector,
    size: input.size ?? 25,
    sort_field: input.sortField,
    sort_ascending: input.sortAscending,
  });
  return toScreenerRows(pick(raw, "quotes") ?? pick(raw, "data"));
}

export async function fetchScreenEtfs(region = "us", size = 25): Promise<ScreenerRow[]> {
  const raw = await callMcpTool("screen_etfs", { region, size });
  return toScreenerRows(pick(raw, "quotes") ?? pick(raw, "data"));
}

export async function fetchScreenFunds(size = 25): Promise<ScreenerRow[]> {
  const raw = await callMcpTool("screen_funds", { size });
  return toScreenerRows(pick(raw, "quotes") ?? pick(raw, "data"));
}

export async function fetchMarketSummary(market = "US") {
  const raw = await callMcpTool("get_market_summary", { market });
  const summary = pick(raw, "summary");
  if (!isRecord(summary)) return [];
  return Object.values(summary)
    .filter(isRecord)
    .map((q) => ({
      symbol: str(q["symbol"]) ?? str(q["fullExchangeName"]) ?? "",
      name: str(q["shortName"]) ?? str(q["fullExchangeName"]) ?? "",
      price: num(q["regularMarketPrice"]),
      change: num(q["regularMarketChange"]),
      changePercent: num(q["regularMarketChangePercent"]),
      exchange: str(q["fullExchangeName"]),
    }))
    .filter((q) => q.name);
}

export async function fetchMarketStatus(market = "US") {
  const raw = await callMcpTool("get_market_status", { market });
  const s = isRecord(pick(raw, "status")) ? (pick(raw, "status") as Record<string, unknown>) : {};
  return {
    name: str(s["name"]) ?? market,
    status: str(s["status"]) ?? "unknown",
    message: str(s["message"]) ?? "",
    open: str(s["open"]),
    close: str(s["close"]),
    timezone: str(s["tz"]),
  };
}

export async function fetchSectors(): Promise<string[]> {
  const raw = await callMcpTool("list_sectors", {});
  const list = pick(raw, "sectors");
  return Array.isArray(list) ? list.map(String) : [];
}

export async function fetchSectorOverview(sectorKey: string, region = "US") {
  const raw = await callMcpTool("get_sector_overview", { sector_key: sectorKey, region });
  const o = isRecord(pick(raw, "overview")) ? (pick(raw, "overview") as Record<string, unknown>) : {};
  return {
    name: str(pick(raw, "name")) ?? sectorKey,
    description: str(o["description"]),
    marketCap: num(o["market_cap"]),
    companiesCount: num(o["companies_count"]),
    industriesCount: num(o["industries_count"]),
    employeeCount: num(o["employee_count"]),
    marketWeight: num(o["market_weight"]),
    topCompanies: toGenericTable(pick(raw, "top_companies"), 25),
    topEtfs: toGenericTable(pick(raw, "top_etfs"), 15),
    industries: toGenericTable(pick(raw, "industries"), 25),
  };
}

export async function fetchIndustryOverview(industryKey: string, region = "US") {
  const raw = await callMcpTool("get_industry_overview", { industry_key: industryKey, region });
  return toGenericTable(pick(raw, "top_companies") ?? pick(raw, "data"), 25);
}

type CalendarKind = "earnings" | "ipo" | "splits" | "economic";

export async function fetchMarketCalendar(kind: CalendarKind, limit = 40): Promise<GenericTable> {
  const tool =
    kind === "earnings"
      ? "get_earnings_calendar"
      : kind === "ipo"
        ? "get_ipo_calendar"
        : kind === "splits"
          ? "get_splits_calendar"
          : "get_economic_events_calendar";
  const raw = await callMcpTool(tool, { limit });
  return toGenericTable(pick(raw, "data") ?? pick(raw, "events"), limit);
}

/* ---------- Per-ticker deep tools ---------- */

export async function fetchOptionExpirations(symbol: string): Promise<string[]> {
  const raw = await callMcpTool("get_option_expirations", { ticker: symbol });
  const list = pick(raw, "expirations");
  return Array.isArray(list) ? list.map(String) : [];
}

export async function fetchOptionChain(symbol: string, expiration: string) {
  const raw = await callMcpTool("get_option_chain", { ticker: symbol, expiration });
  return {
    calls: toGenericTable(pick(raw, "calls") ?? pick(pick(raw, "chain"), "calls"), 40),
    puts: toGenericTable(pick(raw, "puts") ?? pick(pick(raw, "chain"), "puts"), 40),
  };
}

export async function fetchOwnership(symbol: string) {
  const [major, institutional, funds, insider] = await Promise.all([
    callMcpTool("get_major_holders", { ticker: symbol }).catch(() => null),
    callMcpTool("get_institutional_holders", { ticker: symbol }).catch(() => null),
    callMcpTool("get_mutualfund_holders", { ticker: symbol }).catch(() => null),
    callMcpTool("get_insider_transactions", { ticker: symbol }).catch(() => null),
  ]);
  return {
    major: toGenericTable(pick(major, "data"), 10),
    institutional: toGenericTable(pick(institutional, "data"), 15),
    funds: toGenericTable(pick(funds, "data"), 15),
    insider: toGenericTable(pick(insider, "data"), 15),
  };
}

export async function fetchEstimates(symbol: string) {
  const [eps, revenue, growth, trend, revisions] = await Promise.all([
    callMcpTool("get_earnings_estimate", { ticker: symbol }).catch(() => null),
    callMcpTool("get_revenue_estimate", { ticker: symbol }).catch(() => null),
    callMcpTool("get_growth_estimates", { ticker: symbol }).catch(() => null),
    callMcpTool("get_eps_trend", { ticker: symbol }).catch(() => null),
    callMcpTool("get_eps_revisions", { ticker: symbol }).catch(() => null),
  ]);
  return {
    eps: toGenericTable(pick(eps, "data"), 10),
    revenue: toGenericTable(pick(revenue, "data"), 10),
    growth: toGenericTable(pick(growth, "data"), 10),
    epsTrend: toGenericTable(pick(trend, "data"), 10),
    epsRevisions: toGenericTable(pick(revisions, "data"), 10),
  };
}

export async function fetchValuationMeasures(symbol: string): Promise<StatementTable> {
  const raw = await callMcpTool("get_valuation_measures", { ticker: symbol, freq: "quarterly" });
  return toStatementTable(pick(raw, "valuation") ?? pick(raw, "data"), [
    "Market Cap",
    "Enterprise Value",
    "Trailing P/E",
    "Forward P/E",
    "PEG Ratio",
    "Price/Sales",
    "Price/Book",
    "Enterprise Value/Revenue",
    "Enterprise Value/EBITDA",
  ]);
}

export async function fetchSustainability(symbol: string): Promise<GenericTable> {
  const raw = await callMcpTool("get_sustainability", { ticker: symbol });
  return toGenericTable(pick(raw, "data"), 20);
}

export async function fetchSecFilings(symbol: string): Promise<GenericTable> {
  const raw = await callMcpTool("get_sec_filings", { ticker: symbol });
  return toGenericTable(pick(raw, "data") ?? pick(raw, "filings"), 20);
}

export async function fetchEarningsDates(symbol: string): Promise<GenericTable> {
  const raw = await callMcpTool("get_earnings_dates", { ticker: symbol, limit: 12 });
  return toGenericTable(pick(raw, "data"), 12);
}

export async function fetchServerInfo() {
  return callMcpTool("get_server_info", {});
}

/** Escape hatch used by the AI: call any MCP tool by name. */
export async function callAnyTool(name: string, args: Record<string, unknown>) {
  return callMcpTool(name, args);
}
