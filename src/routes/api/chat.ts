import { createFileRoute } from "@tanstack/react-router";
import { convertToModelMessages, stepCountIs, streamText, tool, type UIMessage } from "ai";
import { z } from "zod";
import { createLovableAiGatewayProvider, createOpenRouterProvider } from "@/lib/ai-gateway.server";
import {
  callAnyTool,
  fetchAnalyst,
  fetchCalendar,
  fetchCompare,
  fetchCorporateActions,
  fetchEarningsDates,
  fetchEstimates,
  fetchFinancials,
  fetchHistory,
  fetchMarketCalendar,
  fetchMarketStatus,
  fetchMarketSummary,
  fetchNews,
  fetchOptionChain,
  fetchOptionExpirations,
  fetchOwnership,
  fetchPredefinedScreeners,
  fetchQuotes,
  fetchScreenEquities,
  fetchScreenEtfs,
  fetchScreenPredefined,
  fetchSearch,
  fetchSearchNews,
  fetchSecFilings,
  fetchSectorOverview,
  fetchSectors,
  fetchSummary,
  fetchSustainability,
  fetchUpgrades,
  fetchValuationMeasures,
} from "@/lib/finance-data.server";
import { MCP_TOOL_NAMES } from "@/lib/mcp.server";

const SYSTEM_PROMPT = `You are the AI analyst inside a market research terminal.
You answer questions about listed companies, ETFs, funds, sectors, indices and markets using live tools.

Rules:
- Always call a tool before quoting any number. Never invent prices, ratios or dates.
- Indian tickers need the exchange suffix (RELIANCE.NS, TCS.NS). US tickers are plain (AAPL, MSFT). Indices use ^GSPC, ^NSEI, ^IXIC.
- If the user names a company rather than a ticker, resolve it with search_ticker first.
- Prefer the dedicated tool for a job; use raw_market_tool only when no dedicated tool fits.
- Lead with the answer in one or two sentences, then support it with a markdown table or tight bullets.
- When a comparison, breakdown or flow is asked for, produce a markdown table or a \`\`\`mermaid\`\`\` diagram — these open as artifacts in the UI.
- Quote the currency with every figure and state the as-of context when relevant.
- Be direct about uncertainty and end analysis-style answers with a one-line note that this is not investment advice.`;

const symbolInput = z.object({ symbol: z.string().describe("Ticker symbol, e.g. AAPL or RELIANCE.NS") });

function financeTools() {
  return {
    search_ticker: tool({
      description: "Resolve a company name to its exact ticker symbol.",
      inputSchema: z.object({ query: z.string() }),
      execute: ({ query }) => fetchSearch(query),
    }),
    stock_summary: tool({
      description: "Price snapshot plus key financial ratios, analyst view and company profile.",
      inputSchema: symbolInput,
      execute: ({ symbol }) => fetchSummary(symbol),
    }),
    batch_quotes: tool({
      description: "Fast price snapshots for many tickers at once.",
      inputSchema: z.object({ symbols: z.string().describe("Comma separated tickers") }),
      execute: ({ symbols }) =>
        fetchQuotes(
          symbols
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
        ),
    }),
    price_history: tool({
      description: "OHLCV price history. period: 1d,5d,1mo,6mo,ytd,1y,5y,max. interval: 5m,1d,1wk,1mo.",
      inputSchema: z.object({
        symbol: z.string(),
        period: z.string().default("6mo"),
        interval: z.string().default("1d"),
      }),
      execute: async ({ symbol, period, interval }) => (await fetchHistory(symbol, period, interval)).slice(-60),
    }),
    financials: tool({
      description: "Income statement, balance sheet or cash flow statement.",
      inputSchema: z.object({
        symbol: z.string(),
        statement: z.enum(["income", "balance", "cash"]),
        quarterly: z.boolean().default(false),
      }),
      execute: ({ symbol, statement, quarterly }) => fetchFinancials(symbol, statement, quarterly),
    }),
    valuation_measures: tool({
      description: "Historical valuation multiples: market cap, EV, P/E, P/S, P/B, EV/EBITDA.",
      inputSchema: symbolInput,
      execute: ({ symbol }) => fetchValuationMeasures(symbol),
    }),
    company_news: tool({
      description: "Latest news headlines for a ticker.",
      inputSchema: symbolInput,
      execute: async ({ symbol }) => (await fetchNews(symbol)).slice(0, 8),
    }),
    news_search: tool({
      description: "Free-text news search across the market, not tied to one ticker.",
      inputSchema: z.object({ query: z.string() }),
      execute: async ({ query }) => (await fetchSearchNews(query)).slice(0, 10),
    }),
    analyst_view: tool({
      description: "Analyst recommendation distribution, price targets and earnings surprise history.",
      inputSchema: symbolInput,
      execute: ({ symbol }) => fetchAnalyst(symbol),
    }),
    analyst_actions: tool({
      description: "Recent analyst upgrades and downgrades with price target changes.",
      inputSchema: symbolInput,
      execute: ({ symbol }) => fetchUpgrades(symbol),
    }),
    estimates: tool({
      description: "EPS and revenue estimates, EPS trend, revisions and growth estimates.",
      inputSchema: symbolInput,
      execute: ({ symbol }) => fetchEstimates(symbol),
    }),
    upcoming_events: tool({
      description: "Next earnings date, ex-dividend date and guidance ranges for a ticker.",
      inputSchema: symbolInput,
      execute: ({ symbol }) => fetchCalendar(symbol),
    }),
    earnings_dates: tool({
      description: "Historical and upcoming earnings dates with EPS estimate vs actual.",
      inputSchema: symbolInput,
      execute: ({ symbol }) => fetchEarningsDates(symbol),
    }),
    corporate_actions: tool({
      description: "Dividend history and stock split history.",
      inputSchema: symbolInput,
      execute: ({ symbol }) => fetchCorporateActions(symbol),
    }),
    ownership: tool({
      description: "Major holders, institutional holders, fund holders and insider transactions.",
      inputSchema: symbolInput,
      execute: ({ symbol }) => fetchOwnership(symbol),
    }),
    sec_filings: tool({
      description: "Recent SEC filings for US-listed companies.",
      inputSchema: symbolInput,
      execute: ({ symbol }) => fetchSecFilings(symbol),
    }),
    esg_scores: tool({
      description: "ESG / sustainability scores where available.",
      inputSchema: symbolInput,
      execute: ({ symbol }) => fetchSustainability(symbol),
    }),
    option_expirations: tool({
      description: "Available option expiration dates for a ticker.",
      inputSchema: symbolInput,
      execute: ({ symbol }) => fetchOptionExpirations(symbol),
    }),
    option_chain: tool({
      description: "Option chain (calls and puts) for one expiration date (YYYY-MM-DD).",
      inputSchema: z.object({ symbol: z.string(), expiration: z.string() }),
      execute: ({ symbol, expiration }) => fetchOptionChain(symbol, expiration),
    }),
    compare: tool({
      description: "Compare price history for multiple comma-separated tickers.",
      inputSchema: z.object({
        symbols: z.string().describe("Comma separated, e.g. TCS.NS,INFY.NS,WIPRO.NS"),
        period: z.string().default("1y"),
      }),
      execute: async ({ symbols, period }) => {
        const series = await fetchCompare(symbols, period, "1d");
        return series.map((s) => ({ symbol: s.symbol, points: s.points.slice(-40) }));
      },
    }),
    market_summary: tool({
      description: "Major indices and movers for a market (US, IN, GB, ...).",
      inputSchema: z.object({ market: z.string().default("US") }),
      execute: ({ market }) => fetchMarketSummary(market),
    }),
    market_status: tool({
      description: "Whether a market is open or closed, with session times.",
      inputSchema: z.object({ market: z.string().default("US") }),
      execute: ({ market }) => fetchMarketStatus(market),
    }),
    market_calendar: tool({
      description: "Market-wide calendars: earnings releases, IPOs, splits or macro economic events.",
      inputSchema: z.object({ kind: z.enum(["earnings", "ipo", "splits", "economic"]) }),
      execute: ({ kind }) => fetchMarketCalendar(kind),
    }),
    list_screeners: tool({
      description: "List the predefined screener names (day_gainers, most_actives, ...).",
      inputSchema: z.object({}),
      execute: () => fetchPredefinedScreeners(),
    }),
    run_screener: tool({
      description: "Run a predefined screener such as day_gainers, day_losers, most_actives, undervalued_growth_stocks.",
      inputSchema: z.object({ name: z.string(), size: z.number().default(20) }),
      execute: ({ name, size }) => fetchScreenPredefined(name, size),
    }),
    custom_screener: tool({
      description: "Custom equity screen by market cap, P/E, growth, dividend yield and sector.",
      inputSchema: z.object({
        region: z.string().default("us"),
        minMarketCap: z.number().nullable().default(null),
        maxPe: z.number().nullable().default(null),
        minGrowth: z.number().nullable().default(null),
        minDividendYield: z.number().nullable().default(null),
        sector: z.string().nullable().default(null),
        size: z.number().default(20),
      }),
      execute: (input) =>
        fetchScreenEquities({
          region: input.region,
          ...(input.minMarketCap !== null ? { minMarketCap: input.minMarketCap } : {}),
          ...(input.maxPe !== null ? { maxPe: input.maxPe } : {}),
          ...(input.minGrowth !== null ? { minGrowth: input.minGrowth } : {}),
          ...(input.minDividendYield !== null ? { minDividendYield: input.minDividendYield } : {}),
          ...(input.sector !== null ? { sector: input.sector } : {}),
          size: input.size,
        }),
    }),
    etf_screener: tool({
      description: "Screen ETFs by region.",
      inputSchema: z.object({ region: z.string().default("us"), size: z.number().default(20) }),
      execute: ({ region, size }) => fetchScreenEtfs(region, size),
    }),
    list_sectors: tool({
      description: "List valid sector keys for sector research.",
      inputSchema: z.object({}),
      execute: () => fetchSectors(),
    }),
    sector_overview: tool({
      description: "Sector overview: size, weight, top companies, top ETFs and industries.",
      inputSchema: z.object({ sectorKey: z.string(), region: z.string().default("US") }),
      execute: ({ sectorKey, region }) => fetchSectorOverview(sectorKey, region),
    }),
    raw_market_tool: tool({
      description: `Escape hatch: call any market data tool directly by name. Available: ${MCP_TOOL_NAMES.join(", ")}. Arguments are the tool's own JSON arguments (most take "ticker").`,
      inputSchema: z.object({
        name: z.string(),
        args: z.string().describe('JSON object of arguments, e.g. {"ticker":"AAPL"}').default("{}"),
      }),
      execute: async ({ name, args }) => {
        let parsed: Record<string, unknown> = {};
        try {
          parsed = JSON.parse(args || "{}") as Record<string, unknown>;
        } catch {
          return { error: "args must be a JSON object string" };
        }
        return callAnyTool(name, parsed);
      },
    }),
  };
}

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = (await request.json()) as { messages?: unknown; model?: unknown; keys?: unknown };
        if (!Array.isArray(body.messages)) {
          return new Response("Messages are required", { status: 400 });
        }

        const keys = (body.keys ?? {}) as { openrouter?: string; lovable?: string };
        const selected = typeof body.model === "string" && body.model.includes(":") ? body.model : "lovable:openai/gpt-5.6-sol";
        const [providerId, ...rest] = selected.split(":");
        const modelId = rest.join(":");

        let model;
        let isLovableOpenAI = false;

        if (providerId === "openrouter") {
          const orKey = keys.openrouter?.trim() || process.env["OPENROUTER_API_KEY"];
          if (!orKey) {
            return new Response("OpenRouter is not connected yet — add an OpenRouter API key in settings.", {
              status: 400,
            });
          }
          model = createOpenRouterProvider(orKey)(modelId);
        } else {
          const key = keys.lovable?.trim() || process.env["LOVABLE_API_KEY"];
          if (!key) return new Response("AI is not configured", { status: 500 });
          model = createLovableAiGatewayProvider(key)(modelId);
          isLovableOpenAI = modelId.startsWith("openai/gpt-5");
        }


        const messages = body.messages as UIMessage[];

        const result = streamText({
          model,
          system: SYSTEM_PROMPT,
          messages: await convertToModelMessages(messages),
          tools: financeTools(),
          stopWhen: stepCountIs(50),
          ...(isLovableOpenAI ? { providerOptions: { lovable: { reasoningEffort: "none" } } } : {}),
        });

        return result.toUIMessageStreamResponse({
          originalMessages: messages,
          onError: (error) => {
            const message = error instanceof Error ? error.message : String(error);
            if (message.includes("402") || message.toLowerCase().includes("credit")) {
              return "AI credits are exhausted for this provider. Add credits, or switch model in the picker.";
            }
            if (message.includes("401")) return "The selected provider rejected the API key.";
            if (message.includes("429")) return "Too many requests right now — try again in a moment.";
            return `The analyst could not complete that request: ${message}`;
          },
        });
      },
    },
  },
});
