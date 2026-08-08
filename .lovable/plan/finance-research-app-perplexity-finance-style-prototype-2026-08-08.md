# Finance Research App — Perplexity Finance style prototype

A stock research app with live market data from the YFinance MCP server you linked, plus AI analysis, built around the animated chat input you provided.

## Visual direction

Perplexity Finance as the primary reference (dark, editorial, dense data cards, thin rules, mono numerals) with Google Finance's clarity for the ticker header and chart controls. Light/dark both supported, dark by default. All colors as semantic tokens in `src/styles.css` — no hardcoded color classes.

## Pages

1. **Home / Search (`/`)** — market pulse: index strip (NIFTY50, SENSEX, BANKNIFTY, S&P 500) with sparklines, trending/most-followed tickers, latest market news, and the big animated prompt input as the hero. Typing a company name resolves to a ticker via `lookup_ticker`.
2. **Ticker page (`/stock/$symbol`)** — Google-Finance-style header (name, price, delta, exchange), interactive price chart with 1D/5D/1M/6M/YTD/1Y/5Y/MAX range tabs, key stats grid, about/profile, financials tabs (income / balance sheet / cash flow, annual + quarterly toggle), analyst panel (recommendation gauge, price targets, upgrades/downgrades), calendar (earnings, ex-dividend), corporate actions (dividends, splits), and a news feed.
3. **Compare (`/compare`)** — multi-ticker normalized performance chart plus a side-by-side ratio table.
4. **AI Analysis chat (`/chat` and an embedded panel on the ticker page)** — streaming answers that call the MCP tools, showing which data tool ran and rendering results as compact finance cards (quote card, chart card, news list, financial table) inside the answer.

## Components

Shared: `TickerHeader`, `PriceChart` (Recharts), `RangeTabs`, `StatGrid`, `DeltaBadge`, `SparkLine`, `NewsList`, `FinancialsTable`, `AnalystPanel`, `CalendarCard`, `CompareTable`, `MarketStrip`, plus the AI chat surface built on AI Elements.

The `PromptInput` component you pasted goes in `src/components/ui/ai-chat-input.tsx` essentially as-is (attachments, morphing model selector, effort bars, voice visualizer) and is the composer everywhere — home hero and chat.

## Data + AI

- A server-side MCP client connects to `https://Sanyam400-screener.hf.space/mcp` (Streamable HTTP, `Accept: application/json, text/event-stream`). Verified working — it exposes 12 tools: `get_all_data_summary`, `get_stock_overview`, `get_price_history`, `get_financials`, `get_news`, `get_calendar`, `get_analyst_summary`, `get_upgrades_downgrades`, `get_corporate_actions`, `get_index_data`, `compare_stocks`, `lookup_ticker`.
- Page data is fetched through typed server functions wrapping those tools, cached with TanStack Query.
- AI analysis uses the built-in Lovable AI key (already provisioned — no key needed from you) with those same MCP tools exposed to the model, streamed to the chat UI.

## Technical notes

- TanStack Start routes: `index.tsx`, `stock.$symbol.tsx`, `compare.tsx`, `chat.tsx`, plus `api/chat.ts` for the streaming endpoint.
- MCP calls live in `src/lib/mcp.server.ts` behind `src/lib/finance.functions.ts` server functions; the MCP URL never touches the client.
- Chat is a single conversation, not persisted (prototype). Say the word if you want saved threads.
- Charts: Recharts. Numbers formatted for INR/USD based on the resolved exchange.
- Per-route SEO head metadata; ticker pages get dynamic titles.

## Out of scope for this prototype

Auth, watchlists/portfolios, real-time streaming quotes (data is Yahoo-delayed), and persisted chat history.
