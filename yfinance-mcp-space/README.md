# SignalDock yfinance MCP

SignalDock is a compact, Docker-ready **Model Context Protocol (MCP)** server that turns selected, JSON-safe [yfinance](https://ranaroussi.github.io/yfinance/) capabilities into explicit tools for AI applications. It includes a separate responsive dashboard for service health, connection details, tool discovery, privacy-conscious usage analytics, and recent activity.

The implementation follows the supplied yfinance reference book. It deliberately exposes focused operations rather than raw `Ticker` objects, pandas data frames, NumPy values, or arbitrary Python execution.

> **Financial-data disclaimer:** yfinance is an unofficial Yahoo Finance wrapper. Yahoo Finance data can be delayed, incomplete, changed, rate-limited, or unavailable. This project provides data access, not financial advice, and does not guarantee accuracy, freshness, or availability.

## Architecture

```text
MCP-compatible AI client
        │ Streamable HTTP
        ▼
Public Space URL /mcp
        ▼
FastMCP transport mounted in app.py
        ▼
Validated tool functions
        ▼
yfinance → Yahoo Finance

Dashboard: Space URL /
Health:    Space URL /health
Stats:     Space URL /api/stats
Tools:     Space URL /api/tools
```

The dashboard is not the MCP implementation. The MCP transport remains independently available at `/mcp`.

## File structure

The standalone Space contains exactly four project files:

```text
app.py
requirements.txt
Dockerfile
README.md
```

## Features

The server includes official FastMCP Streamable HTTP transport, explicit input validation, JSON serialization for pandas/NumPy/yfinance values, short-lived in-memory caching, global and per-client upstream throttling, bounded retry with jitter, concurrency limits, safe machine-readable errors, and a lightweight activity log.

The dashboard derives its MCP URL from `PUBLIC_URL`, `HF_SPACE_URL`, `SPACE_HOST`, or `SPACE_ID` when available. When none is present, it displays the local runtime URL. The optional `PUBLIC_URL` variable is the most reliable choice when a deployment uses a custom public hostname.

## Deploy on Hugging Face Spaces

1. Create a new Hugging Face Space and select **Docker** as the SDK.
2. Upload the four files from this directory to the root of the Space. Do not upload the reference PDF or extracted text as runtime files.
3. Wait for the Docker build to complete. The container listens on port `7860`, which is the standard Space port configured by the Dockerfile.
4. Open the Space dashboard at the Space URL. The dashboard will show the resolved MCP URL, health endpoint, tool count, and runtime status.
5. If the runtime cannot infer the public URL, add a Space variable named `PUBLIC_URL` with the HTTPS URL of the Space, then restart or rebuild the Space.
6. For a private Space, the MCP client must be able to authenticate to that Space according to the access controls configured on Hugging Face. This application does not invent an authentication scheme.

## MCP connection

Copy the **MCP URL** shown in the dashboard. It is the public dashboard origin followed by `/mcp`, for example:

```text
https://your-space-name.hf.space/mcp
```

Use that URL in an MCP-compatible client that supports **Streamable HTTP**. A generic configuration shape is:

```json
{
  "mcpServers": {
    "signalDock": {
      "url": "https://your-space-name.hf.space/mcp"
    }
  }
}
```

The dashboard URL, MCP URL, health URL, and JSON API URLs are different. Do not use `/`, `/health`, or `/api/tools` as the MCP endpoint.

## Available tools

| Category | Tools |
|---|---|
| Prices | `get_price_snapshot`, `get_price_history`, `download_price_history`, `get_history_metadata`, `get_actions` |
| Company | `get_company_info`, `get_fast_info`, `get_isin`, `get_news` |
| Fundamentals | `get_financial_statement`, `get_earnings`, `get_calendar`, `get_sec_filings`, `get_valuation_measures` |
| Analysts | `get_analyst_data` for recommendations, targets, estimates, trends, revisions, growth, earnings history, and sustainability |
| Ownership | `get_ownership_data` for insider, holder, share, and funds datasets |
| Options | `get_option_expirations`, `get_option_chain` |
| Batch | `batch_price_history`, `batch_news` |
| Search | `search_tickers`, `lookup_instruments` |
| Market | `get_market_summary` |
| Sector / Industry | `get_sector_overview`, `get_industry_overview` |
| Screener | `list_predefined_screeners`, `screen_stocks` |
| Service | `get_server_info` |

The server exposes 28 focused tools in the current implementation. The installed yfinance version is reported by `get_server_info` and the dashboard.

### Example tool inputs

Daily history:

```json
{
  "symbol": "RELIANCE.NS",
  "period": "1mo",
  "interval": "1d",
  "limit": 100
}
```

Bulk download:

```json
{
  "symbols": ["RELIANCE.NS", "TCS.NS", "INFY.NS", "HDFCBANK.NS"],
  "period": "3mo",
  "interval": "1d"
}
```

Structured India-focused screen:

```json
{
  "asset_class": "equity",
  "filters": {
    "region": "in",
    "max_pe": 25,
    "min_growth": 15
  },
  "size": 50,
  "sort_field": "epsgrowth.lasttwelvemonths",
  "sort_ascending": false
}
```

For advanced screens, `conditions` accepts a safe query tree using `eq`, `is-in`, `btwn`, `gt`, `lt`, `gte`, `lte`, `and`, and `or`. Values are validated before yfinance is called. Arbitrary Python expressions are rejected.

## Ticker and India guidance

Use exchange-qualified symbols when required. `.NS` represents NSE and `.BO` represents BSE. Useful examples are `RELIANCE.NS`, `TCS.NS`, `INFY.NS`, and `HDFCBANK.NS`. The server does not silently add or replace suffixes, does not hard-code INR, and returns the currency that yfinance provides when the upstream payload contains it.

Some US-centric data such as SEC filings and certain insider endpoints can be empty or sparse for NSE/BSE-only listings. The server preserves an empty, successful data result where the upstream method returned no rows; this is not automatically treated as a software failure.

## Dashboard sections

The **Overview** cards show MCP request volume, successful and failed calls, anonymous unique-client count, average latency, and cache hit rate. The **Connection center** distinguishes the dashboard, MCP, and health URLs and provides a generic Streamable HTTP configuration example. **System status** reports application, MCP, yfinance, uptime, and deployment environment.

The **Tool explorer** lists every registered MCP tool with category, description, input count, usage count, and rolling average latency. It supports search and category filtering. **Recent activity** shows timestamp, tool, short anonymous client fingerprint, latency, and result status. **Guidelines** explains ticker formats, caching, rate limits, data limitations, streaming scope, and the financial disclaimer.

## Caching, rate limiting, and errors

Caching is process-local and intentionally lightweight for an ephemeral container. Snapshots cache for about 30–60 seconds, intraday data for about 90 seconds, daily history for about 15 minutes, news and search for about 15 minutes, calendars for about six hours, and metadata/fundamental/analyst/ownership/sector/industry data for up to 24 hours. A bounded cache prevents unbounded memory growth.

The server applies a global upstream request window, a per-anonymous-client window, a semaphore limiting concurrent upstream work, a cache-before-network check, and up to three retries with exponential backoff and jitter. These controls reduce request storms but cannot guarantee that Yahoo will not rate-limit the service.

Tool responses use a predictable shape. Success responses contain `success: true`, optional symbol metadata, and `data`. Safe failures contain `success: false` and an error object with `type`, `message`, and `retryable`. Raw tracebacks are logged server-side only.

## Monitoring endpoints

`GET /health` returns machine-readable application, MCP, yfinance, uptime, timestamp, and tool-count status. `GET /api/tools` returns the tool manifest plus usage metrics. `GET /api/stats` returns request counts, cache metrics, throttling events, latency, unique-client estimate, activity, and resolved endpoint URLs.

The **Unique Clients** metric is not a human-user count. It is an approximate, anonymous fingerprint derived from proxy/network metadata and the user-agent. It can merge or split real people, change across networks, and be absent or transformed by a proxy. No names, emails, account IDs, or authentication identities are collected by this project.

## Environment variables

| Variable | Purpose | Default |
|---|---|---|
| `PORT` | HTTP port | `7860` |
| `PUBLIC_URL` | Explicit public dashboard origin used to derive endpoint URLs | inferred from runtime or localhost |
| `HF_SPACE_URL` | Alternate explicit public origin | unset |
| `SPACE_HOST` | Hugging Face runtime host when provided | unset |
| `SPACE_ID` | Hugging Face `owner/space` identifier when provided | unset |
| `YF_TZ_CACHE` | Writable yfinance timezone-cache directory | `/tmp/yfinance-tz-cache` |
| `LOG_LEVEL` | Python log level | `INFO` |

## Local run

```bash
python -m venv .venv
. .venv/bin/activate
pip install -r requirements.txt
python app.py
```

Open `http://localhost:7860/`, inspect `http://localhost:7860/health`, and use `http://localhost:7860/mcp` for a local MCP client.

## Limitations

Yahoo Finance can throttle, change, or remove upstream endpoints without notice. yfinance is an unofficial wrapper with no service-level guarantee. Quotes may be delayed, historical series may be revised, and some datasets may be empty for a valid symbol. The process-local cache is lost when the container restarts, and analytics are not a durable multi-replica database. The anonymous unique-client metric is approximate. This build does not expose yfinance WebSocket or AsyncWebSocket streaming over MCP; stable non-streaming tools are provided instead, avoiding a new upstream connection per client. Hugging Face Space storage should be treated as ephemeral for critical state, so no SQLite or local database is required.

## References

[1]: https://ranaroussi.github.io/yfinance/ "yfinance documentation"
[2]: https://modelcontextprotocol.io/ "Model Context Protocol documentation"
[3]: https://huggingface.co/docs/hub/spaces-sdks-docker "Hugging Face Docker Spaces documentation"
