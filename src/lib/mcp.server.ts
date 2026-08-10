const MCP_URL = "https://hermes05-trader.hf.space/mcp";

type JsonRpcResponse = {
  result?: unknown;
  error?: { code: number; message: string };
};

let rpcId = 0;

function parseSse(text: string): JsonRpcResponse {
  for (const line of text.split("\n")) {
    if (line.startsWith("data: ")) {
      try {
        return JSON.parse(line.slice(6)) as JsonRpcResponse;
      } catch {
        /* keep looking */
      }
    }
  }
  try {
    return JSON.parse(text) as JsonRpcResponse;
  } catch {
    throw new Error("Unreadable response from the market data service");
  }
}

/**
 * Calls a tool on the trader MCP server. The server is stateless over HTTP,
 * so each call is a single JSON-RPC POST.
 */
export async function callMcpTool<T = unknown>(
  name: string,
  args: Record<string, unknown> = {},
): Promise<T> {
  const cleaned: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(args)) {
    if (v !== undefined && v !== null && v !== "") cleaned[k] = v;
  }

  const res = await fetch(MCP_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: ++rpcId,
      method: "tools/call",
      params: { name, arguments: cleaned },
    }),
  });

  const parsed = parseSse(await res.text());
  if (parsed.error) throw new Error(parsed.error.message);

  const result = parsed.result as
    | {
        structuredContent?: { result?: unknown };
        content?: Array<{ type: string; text?: string }>;
        isError?: boolean;
      }
    | undefined;
  if (!result) throw new Error(`No result from ${name}`);

  const text = result.content?.find((c) => c.type === "text")?.text;
  if (result.isError) throw new Error(text || `${name} failed`);

  if (result.structuredContent && "result" in result.structuredContent) {
    return result.structuredContent.result as T;
  }
  if (text) {
    try {
      return JSON.parse(text) as T;
    } catch {
      return text as unknown as T;
    }
  }
  return null as T;
}

/** Every tool exposed by the trader MCP server. */
export const MCP_TOOL_NAMES = [
  "get_price_snapshot",
  "get_price_history",
  "download_price_history",
  "get_history_metadata",
  "get_dividends",
  "get_splits",
  "get_actions",
  "get_capital_gains",
  "get_shares_full",
  "get_company_info",
  "get_fast_info",
  "get_isin",
  "get_news",
  "get_income_statement",
  "get_balance_sheet",
  "get_cash_flow",
  "get_earnings",
  "get_earnings_dates",
  "get_calendar",
  "get_sec_filings",
  "get_valuation_measures",
  "get_recommendations",
  "get_recommendations_summary",
  "get_upgrades_downgrades",
  "get_analyst_price_targets",
  "get_earnings_estimate",
  "get_revenue_estimate",
  "get_eps_trend",
  "get_eps_revisions",
  "get_growth_estimates",
  "get_earnings_history",
  "get_sustainability",
  "get_insider_purchases",
  "get_insider_transactions",
  "get_insider_roster_holders",
  "get_major_holders",
  "get_institutional_holders",
  "get_mutualfund_holders",
  "get_shares",
  "get_funds_data",
  "get_option_expirations",
  "get_option_chain",
  "batch_price_history",
  "batch_news",
  "batch_snapshots",
  "get_market_status",
  "get_market_summary",
  "get_earnings_calendar",
  "get_ipo_calendar",
  "get_splits_calendar",
  "get_economic_events_calendar",
  "search_tickers",
  "search_news",
  "search_lists",
  "lookup_instruments",
  "resolve_ticker",
  "get_sector_overview",
  "get_industry_overview",
  "get_sector_research_reports",
  "get_industry_research_reports",
  "list_sectors",
  "screen_equities",
  "screen_funds",
  "screen_etfs",
  "screen_predefined",
  "list_predefined_screeners",
  "get_streaming_info",
  "get_server_info",
] as const;

export type McpToolName = (typeof MCP_TOOL_NAMES)[number];
