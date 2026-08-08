import { createFileRoute } from "@tanstack/react-router";
import { convertToModelMessages, stepCountIs, streamText, tool, type UIMessage } from "ai";
import { z } from "zod";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";
import {
  fetchAnalyst,
  fetchCalendar,
  fetchCompare,
  fetchCorporateActions,
  fetchFinancials,
  fetchHistory,
  fetchNews,
  fetchSearch,
  fetchSummary,
} from "@/lib/finance-data.server";

const SYSTEM_PROMPT = `You are the AI analyst inside a market research terminal.
You answer questions about listed companies, indices and markets using the live tools available to you.

Rules:
- Always call a tool before quoting any number. Never invent prices, ratios or dates.
- Indian tickers resolve automatically (TCS, RELIANCE, INFY -> NSE). US tickers are plain (AAPL, MSFT).
- If the user names a company rather than a ticker, resolve it with search_ticker first.
- Lead with the answer in one or two sentences, then support it with a short markdown table or tight bullets.
- Quote the currency with every figure and state the as-of context when relevant.
- Be direct about uncertainty and always end analysis-style answers with a one-line note that this is not investment advice.`;

const symbolInput = z.object({ symbol: z.string().describe("Ticker symbol, e.g. AAPL or RELIANCE") });

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
    price_history: tool({
      description: "OHLCV price history. period: 1d,5d,1mo,6mo,ytd,1y,5y,max. interval: 5m,1d,1wk,1mo.",
      inputSchema: z.object({
        symbol: z.string(),
        period: z.string().default("6mo"),
        interval: z.string().default("1d"),
      }),
      execute: async ({ symbol, period, interval }) => {
        const candles = await fetchHistory(symbol, period, interval);
        return candles.slice(-60);
      },
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
    company_news: tool({
      description: "Latest news headlines for a ticker.",
      inputSchema: symbolInput,
      execute: async ({ symbol }) => (await fetchNews(symbol)).slice(0, 8),
    }),
    analyst_view: tool({
      description: "Analyst recommendation distribution, price targets and earnings surprise history.",
      inputSchema: symbolInput,
      execute: ({ symbol }) => fetchAnalyst(symbol),
    }),
    upcoming_events: tool({
      description: "Next earnings date, ex-dividend date and guidance ranges.",
      inputSchema: symbolInput,
      execute: ({ symbol }) => fetchCalendar(symbol),
    }),
    corporate_actions: tool({
      description: "Dividend history and stock split history.",
      inputSchema: symbolInput,
      execute: ({ symbol }) => fetchCorporateActions(symbol),
    }),
    compare: tool({
      description: "Compare price history for multiple comma-separated tickers.",
      inputSchema: z.object({
        symbols: z.string().describe("Comma separated, e.g. TCS,INFY,WIPRO"),
        period: z.string().default("1y"),
      }),
      execute: async ({ symbols, period }) => {
        const series = await fetchCompare(symbols, period, "1d");
        return series.map((s) => ({ symbol: s.symbol, points: s.points.slice(-40) }));
      },
    }),
  };
}

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = (await request.json()) as { messages?: unknown };
        if (!Array.isArray(body.messages)) {
          return new Response("Messages are required", { status: 400 });
        }

        const key = process.env["LOVABLE_API_KEY"];
        if (!key) return new Response("AI is not configured", { status: 500 });

        const gateway = createLovableAiGatewayProvider(key);
        const messages = body.messages as UIMessage[];

        const result = streamText({
          model: gateway("openai/gpt-5.6-sol"),
          system: SYSTEM_PROMPT,
          messages: await convertToModelMessages(messages),
          tools: financeTools(),
          stopWhen: stepCountIs(50),
          providerOptions: { lovable: { reasoningEffort: "none" } },
        });

        return result.toUIMessageStreamResponse({ originalMessages: messages });
      },
    },
  },
});
