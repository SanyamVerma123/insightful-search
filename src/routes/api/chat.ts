import { createFileRoute } from "@tanstack/react-router";
import { convertToModelMessages, stepCountIs, streamText, tool, type UIMessage } from "ai";
import { z } from "zod";
import {
  createDeepSeekProvider,
  createGroqProvider,
  createKiloProvider,
  createOpenCodeProvider,
  createOpenRouterProvider,
  createTogetherProvider,
} from "@/lib/ai-gateway.server";
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
import {
  classifyChatError,
  createChatDiagnostic,
  serializeChatDiagnostic,
} from "@/lib/chat-diagnostics";

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
  - When the user asks for current internet research, broader context, or sources outside the finance tools, call web_search when it is available and cite the returned URLs as markdown links.
  - When the user asks for a chart, dashboard, or visual, prefer a self-contained HTML or SVG code block so the terminal can render it inline. Keep scripts minimal and do not rely on external assets.
  - When the user asks for a detailed stock document, use stock_report and format the result as a polished report with sections, tables, sources, and an as-of note.
  - Be direct about uncertainty and end analysis-style answers with a one-line note that this is not investment advice.
  - Continue until the requested research is complete. If the response is long, prioritize finishing the answer over adding optional detail; never stop mid-sentence or ask the user to say "continue" unless a required tool or provider has genuinely failed.`;

const symbolInput = z.object({
  symbol: z.string().describe("Ticker symbol, e.g. AAPL or RELIANCE.NS"),
});

function newChatRequestId() {
  try {
    return crypto.randomUUID();
  } catch {
    return `chat-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }
}

function diagnosticResponse(diagnostic: ReturnType<typeof createChatDiagnostic>, status: number) {
  return new Response(serializeChatDiagnostic(diagnostic), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

function logChatEvent(
  event: string,
  fields: Record<string, string | number | boolean | undefined>,
) {
  console.info(`[chat:${event}]`, JSON.stringify(fields));
}

async function tinyFishSearch(
  query: string,
  apiKey: string | undefined,
  options: { region?: string | undefined; newsOnly?: boolean | undefined } = {},
) {
  if (!apiKey) {
    return {
      error:
        "TinyFish web search is not configured. Add a TinyFish API key in Settings to enable internet research.",
    };
  }

  const url = new URL("https://api.search.tinyfish.ai");
  url.searchParams.set("query", query);
  url.searchParams.set("language", "en");
  url.searchParams.set(
    "purpose",
    "Provide current, source-backed context for a finance research answer.",
  );
  if (options.region)
    url.searchParams.set("location", options.region === "in" ? "India" : options.region);
  if (options.newsOnly) url.searchParams.set("domain_type", "news");

  try {
    const response = await fetch(url, {
      headers: { "X-API-Key": apiKey, Accept: "application/json" },
    });
    if (!response.ok) {
      return {
        error: `TinyFish search failed with HTTP ${response.status}. Check the API key in Settings.`,
      };
    }
    const payload: unknown = await response.json();
    const parsed = z
      .object({
        query: z.string().optional(),
        results: z
          .array(
            z.object({
              position: z.number().optional(),
              site_name: z.string().optional(),
              title: z.string().optional(),
              snippet: z.string().optional(),
              url: z.string().url(),
            }),
          )
          .default([]),
        total_results: z.number().optional(),
        page: z.number().optional(),
      })
      .safeParse(payload);
    if (!parsed.success) return { error: "TinyFish returned an unexpected search response." };
    return {
      query: parsed.data.query ?? query,
      totalResults: parsed.data.total_results ?? parsed.data.results.length,
      results: parsed.data.results.slice(0, 8),
    };
  } catch (error) {
    return {
      error: `TinyFish search is unavailable: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

function financeTools(tinyfishKey?: string) {
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
      description:
        "OHLCV price history. period: 1d,5d,1mo,6mo,ytd,1y,5y,max. interval: 5m,1d,1wk,1mo.",
      inputSchema: z.object({
        symbol: z.string(),
        period: z.string().default("6mo"),
        interval: z.string().default("1d"),
      }),
      execute: async ({ symbol, period, interval }) =>
        (await fetchHistory(symbol, period, interval)).slice(-60),
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
    web_search: tool({
      description:
        "Search the live internet with TinyFish by keyword or a pasted URL. Use it for current web research, source discovery, and news, then cite the returned URLs.",
      inputSchema: z.object({
        query: z.string().min(2).optional(),
        url: z.string().url().optional(),
        region: z.string().optional(),
        newsOnly: z.boolean().default(false),
      }),
      execute: ({ query, url, region, newsOnly }) =>
        tinyFishSearch(query ?? url ?? "", tinyfishKey, { region, newsOnly }),
    }),
    stock_report: tool({
      description:
        "Collect a detailed stock research packet for a symbol, including quote, ratios, financial statements, analyst view, events, ownership, and recent news.",
      inputSchema: z.object({
        symbol: z.string(),
        quarterly: z.boolean().default(false),
      }),
      execute: async ({ symbol, quarterly }) => {
        const [summary, financials, analyst, calendar, ownership, news] = await Promise.all([
          fetchSummary(symbol),
          fetchFinancials(symbol, "income", quarterly),
          fetchAnalyst(symbol),
          fetchCalendar(symbol),
          fetchOwnership(symbol),
          fetchNews(symbol),
        ]);
        return {
          symbol,
          summary,
          financials,
          analyst,
          calendar,
          ownership,
          news: news.slice(0, 8),
        };
      },
    }),
    analyst_view: tool({
      description:
        "Analyst recommendation distribution, price targets and earnings surprise history.",
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
      description:
        "Market-wide calendars: earnings releases, IPOs, splits or macro economic events.",
      inputSchema: z.object({ kind: z.enum(["earnings", "ipo", "splits", "economic"]) }),
      execute: ({ kind }) => fetchMarketCalendar(kind),
    }),
    list_screeners: tool({
      description: "List the predefined screener names (day_gainers, most_actives, ...).",
      inputSchema: z.object({}),
      execute: () => fetchPredefinedScreeners(),
    }),
    run_screener: tool({
      description:
        "Run a predefined screener such as day_gainers, day_losers, most_actives, undervalued_growth_stocks.",
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
    create_screener: tool({
      description:
        "Create and run a saved custom equity screener from natural-language criteria. Use region 'in' for India, and return the matching stocks plus the exact structured filters used.",
      inputSchema: z.object({
        name: z.string().min(1).max(80),
        criteria: z.string().min(1).max(500),
        filters: z.object({
          region: z.string().default("us"),
          sector: z.string().default(""),
          industry: z.string().default(""),
          size: z.number().int().min(1).max(100).default(25),
          minMarketCap: z.number().nullable().default(null),
          maxMarketCap: z.number().nullable().default(null),
          minPe: z.number().nullable().default(null),
          maxPe: z.number().nullable().default(null),
          minGrowth: z.number().nullable().default(null),
          minDividendYield: z.number().nullable().default(null),
          minPrice: z.number().nullable().default(null),
          maxPrice: z.number().nullable().default(null),
          minVolume: z.number().nullable().default(null),
          minChangePercent: z.number().nullable().default(null),
          maxChangePercent: z.number().nullable().default(null),
          exchange: z.string().default(""),
          nameContains: z.string().default(""),
          sortField: z.string().default("intradaymarketcap"),
          sortAscending: z.boolean().default(false),
        }),
        symbols: z.array(z.string()).max(100).optional(),
      }),
      execute: async ({ name, criteria, filters, symbols }) => {
        const region = /^(india|in|nse|bse)$/i.test(filters.region) ? "in" : filters.region;
        const rows = await fetchScreenEquities({
          region,
          ...(filters.sector ? { sector: filters.sector } : {}),
          ...(filters.industry ? { industry: filters.industry } : {}),
          ...(filters.minMarketCap !== null ? { minMarketCap: filters.minMarketCap } : {}),
          ...(filters.maxMarketCap !== null ? { maxMarketCap: filters.maxMarketCap } : {}),
          ...(filters.minPe !== null ? { minPe: filters.minPe } : {}),
          ...(filters.maxPe !== null ? { maxPe: filters.maxPe } : {}),
          ...(filters.minGrowth !== null ? { minGrowth: filters.minGrowth } : {}),
          ...(filters.minDividendYield !== null
            ? { minDividendYield: filters.minDividendYield }
            : {}),
          ...(filters.minPrice !== null ? { minPrice: filters.minPrice } : {}),
          ...(filters.maxPrice !== null ? { maxPrice: filters.maxPrice } : {}),
          ...(filters.minVolume !== null ? { minVolume: filters.minVolume } : {}),
          ...(filters.minChangePercent !== null
            ? { minChangePercent: filters.minChangePercent }
            : {}),
          ...(filters.maxChangePercent !== null
            ? { maxChangePercent: filters.maxChangePercent }
            : {}),
          ...(filters.exchange ? { exchange: filters.exchange } : {}),
          ...(filters.nameContains ? { nameContains: filters.nameContains } : {}),
          size: filters.size,
          sortField: filters.sortField,
          sortAscending: filters.sortAscending,
        });
        const filteredRows = symbols?.length
          ? rows.filter((row) =>
              symbols.some((symbol) => symbol.toUpperCase() === row.symbol.toUpperCase()),
            )
          : rows;
        return {
          type: "screener_result",
          name,
          criteria,
          filters: { ...filters, region },
          rows: filteredRows.slice(0, filters.size),
          saved: true,
        };
      },
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
        const requestId = newChatRequestId();
        const body = (await request.json()) as {
          messages?: unknown;
          model?: unknown;
          keys?: unknown;
          researchMode?: unknown;
          effort?: unknown;
        };
        if (!Array.isArray(body.messages)) {
          return diagnosticResponse(
            createChatDiagnostic(
              "unknown",
              { phase: "configuration", requestId },
              {
                code: "MESSAGES_REQUIRED",
                title: "The research request is incomplete",
                message: "No chat messages were provided to the analyst.",
                action: "Send the request again from the chat composer.",
                retryable: true,
              },
            ),
            400,
          );
        }

        const keys = (body.keys ?? {}) as {
          openrouter?: string;
          openrouterFallback?: string;
          kilo?: string;
          kiloFallback?: string;
          groq?: string;
          groqFallback?: string;
          together?: string;
          togetherFallback?: string;
          deepseek?: string;
          deepseekFallback?: string;
          opencode?: string;
          opencodeFallback?: string;
          tinyfish?: string;
        };
        type ProviderId = "openrouter" | "kilo" | "groq" | "together" | "deepseek" | "opencode";
        const defaults: Record<ProviderId, string> = {
          openrouter: "openai/gpt-4o-mini",
          kilo: "anthropic/claude-sonnet-4.5",
          groq: "llama-3.3-70b-versatile",
          together: "meta-llama/Llama-3.3-70B-Instruct-Turbo",
          deepseek: "deepseek-chat",
          opencode: "big-pickle",
        };
        const envKeys: Record<ProviderId, string> = {
          openrouter: "OPENROUTER_API_KEY",
          kilo: "KILO_API_KEY",
          groq: "GROQ_API_KEY",
          together: "TOGETHER_API_KEY",
          deepseek: "DEEPSEEK_API_KEY",
          opencode: "OPENCODE_ZEN_API_KEY",
        };
        const configuredKeys: Record<ProviderId, string | undefined> = {
          openrouter: keys.openrouter?.trim() || process.env[envKeys.openrouter],
          kilo: keys.kilo?.trim() || process.env[envKeys.kilo],
          groq: keys.groq?.trim() || process.env[envKeys.groq],
          together: keys.together?.trim() || process.env[envKeys.together],
          deepseek: keys.deepseek?.trim() || process.env[envKeys.deepseek],
          opencode: keys.opencode?.trim() || process.env[envKeys.opencode],
        };
        const fallbackKeys: Record<ProviderId, string | undefined> = {
          openrouter: keys.openrouterFallback?.trim(),
          kilo: keys.kiloFallback?.trim(),
          groq: keys.groqFallback?.trim(),
          together: keys.togetherFallback?.trim(),
          deepseek: keys.deepseekFallback?.trim(),
          opencode: keys.opencodeFallback?.trim(),
        };
        const hasExplicitModel = typeof body.model === "string" && body.model.includes(":");
        const selected =
          hasExplicitModel && typeof body.model === "string"
            ? body.model
            : "openrouter:openai/gpt-4o-mini";
        const [rawProvider, ...rest] = selected.split(":");
        const requestedProvider: ProviderId =
          rawProvider === "kilo" ||
          rawProvider === "groq" ||
          rawProvider === "together" ||
          rawProvider === "deepseek" ||
          rawProvider === "opencode"
            ? rawProvider
            : "openrouter";
        const requestedModel = rest.join(":") || defaults[requestedProvider];
        const requestedKey = configuredKeys[requestedProvider] || fallbackKeys[requestedProvider];
        if (hasExplicitModel && !requestedKey) {
          const providerLabels: Record<ProviderId, string> = {
            openrouter: "OpenRouter",
            kilo: "Kilo AI",
            groq: "Groq",
            together: "Together AI",
            deepseek: "DeepSeek",
            opencode: "OpenCode Zen",
          };
          const diagnostic = createChatDiagnostic(
            "missing_configuration",
            {
              provider: providerLabels[requestedProvider],
              model: requestedModel,
              phase: "configuration",
              requestId,
            },
            {
              message: `${providerLabels[requestedProvider]} is not configured for the selected model.`,
              action:
                "Open Settings to add its API key, or choose a model from a configured provider.",
            },
          );
          logChatEvent("configuration-error", {
            requestId,
            provider: requestedProvider,
            model: requestedModel,
            code: diagnostic.code,
          });
          return diagnosticResponse(diagnostic, 400);
        }
        const providerOrder: ProviderId[] = hasExplicitModel
          ? [requestedProvider]
          : [
              requestedProvider,
              ...(
                ["openrouter", "kilo", "groq", "together", "deepseek", "opencode"] as ProviderId[]
              ).filter((provider) => provider !== requestedProvider),
            ];
        const candidates = providerOrder.flatMap((provider) => [
          {
            providerId: provider,
            modelId: provider === requestedProvider ? requestedModel : defaults[provider],
            key: configuredKeys[provider],
          },
          {
            providerId: provider,
            modelId: provider === requestedProvider ? requestedModel : defaults[provider],
            key: fallbackKeys[provider],
          },
        ]);
        const candidate = candidates.find((item) => Boolean(item.key));
        if (!candidate) {
          const diagnostic = createChatDiagnostic(
            "missing_configuration",
            { phase: "configuration", requestId },
            {
              message: "No configured AI provider is available for this request.",
              action: "Open Settings to add a provider API key, then retry the request.",
            },
          );
          logChatEvent("configuration-error", { requestId, code: diagnostic.code });
          return diagnosticResponse(diagnostic, 400);
        }

        const providerFactories = {
          openrouter: createOpenRouterProvider,
          kilo: createKiloProvider,
          groq: createGroqProvider,
          together: createTogetherProvider,
          deepseek: createDeepSeekProvider,
          opencode: createOpenCodeProvider,
        } satisfies Record<ProviderId, (apiKey: string) => (modelId: string) => unknown>;
        const model = providerFactories[candidate.providerId](candidate.key!)(candidate.modelId);
        const messages = body.messages as UIMessage[];
        const tinyfishKey = keys.tinyfish?.trim() || process.env["TINYFISH_API_KEY"];
        const researchMode = typeof body.researchMode === "string" ? body.researchMode : "Balanced";
        const effort = typeof body.effort === "string" ? body.effort : "Medium Effort";
        logChatEvent("start", {
          requestId,
          provider: candidate.providerId,
          model: candidate.modelId,
          researchMode,
          effort,
        });
        const modeInstructions =
          researchMode === "Quick Take"
            ? "Use a concise answer. Prefer one relevant tool call and keep the final response under 500 words unless the user asks for detail."
            : researchMode === "Deep Research"
              ? "Use the relevant finance and web tools thoroughly. Cross-check important claims, cite sources, and provide a detailed structured response with assumptions and as-of context."
              : "Use a balanced workflow: call the relevant tools, explain the key evidence, and keep the response focused.";
        // These are generous response budgets for long-running research. The selected provider
        // may clamp them to its own context window, but the request should not stop early because
        // of the terminal's previous 850/1600/2600 token ceilings.
        const requestedMaxOutputTokens =
          effort === "High Effort" ? 1_000_000 : effort === "Medium Effort" ? 75_000 : 50_000;
        // Kilo's Nemotron 3 Ultra catalog entry advertises a 65,536-token completion ceiling.
        // Sending a larger max_tokens value makes the gateway reject the request before the
        // model can emit its first token, which previously appeared in the UI as a mid-session stop.
        const isNemotron = candidate.providerId === "kilo" && /nemotron/i.test(candidate.modelId);
        const maxOutputTokens = isNemotron
          ? Math.min(requestedMaxOutputTokens, 65_536)
          : requestedMaxOutputTokens;
        const maxResearchSteps =
          researchMode === "Deep Research" || effort === "High Effort" ? 100 : 40;
        const kiloReasoningEffort =
          effort === "Low Effort" ? "low" : effort === "High Effort" ? "high" : "medium";
        const providerOptions =
          candidate.providerId === "kilo"
            ? { kilo: { reasoningEffort: kiloReasoningEffort } }
            : undefined;

        const allTools = financeTools(tinyfishKey);
        const tools =
          candidate.providerId === "kilo"
            ? {
                search_ticker: allTools.search_ticker,
                stock_summary: allTools.stock_summary,
                batch_quotes: allTools.batch_quotes,
                price_history: allTools.price_history,
                financials: allTools.financials,
                valuation_measures: allTools.valuation_measures,
                company_news: allTools.company_news,
                news_search: allTools.news_search,
                web_search: allTools.web_search,
                stock_report: allTools.stock_report,
                compare: allTools.compare,
                market_summary: allTools.market_summary,
                run_screener: allTools.run_screener,
                custom_screener: allTools.custom_screener,
                create_screener: allTools.create_screener,
                etf_screener: allTools.etf_screener,
              }
            : allTools;

        const result = streamText({
          model,
          system: `${SYSTEM_PROMPT}\n\nCurrent response mode: ${researchMode}. ${modeInstructions}\nReasoning effort: ${effort}.`,
          messages: await convertToModelMessages(messages),
          tools,
          stopWhen: stepCountIs(maxResearchSteps),
          // Do not pass the generic AI SDK reasoning string here. OpenAI-compatible gateways
          // such as Kilo expect provider-specific reasoning options and reject generic strings.
          maxOutputTokens,
          ...(providerOptions ? { providerOptions } : {}),
        });

        return result.toUIMessageStreamResponse({
          originalMessages: messages,
          onError: (error) => {
            const diagnostic = classifyChatError(error, {
              provider: candidate.providerId,
              model: candidate.modelId,
              phase: "stream",
              requestId,
            });
            const rawMessage = error instanceof Error ? error.message : String(error);
            logChatEvent("error", {
              requestId,
              provider: candidate.providerId,
              model: candidate.modelId,
              category: diagnostic.category,
              code: diagnostic.code,
              raw: rawMessage.slice(0, 240),
            });
            return serializeChatDiagnostic(diagnostic);
          },
        });
      },
    },
  },
});
