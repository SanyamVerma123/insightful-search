const MCP_URL = "https://Sanyam400-screener.hf.space/mcp";

type JsonRpcResponse = {
  result?: unknown;
  error?: { code: number; message: string };
};

let sessionId: string | null = null;
let sessionPromise: Promise<string> | null = null;
let rpcId = 0;

function parseSse(text: string): JsonRpcResponse {
  const lines = text.split("\n");
  for (const line of lines) {
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

async function openSession(): Promise<string> {
  const res = await fetch(MCP_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: ++rpcId,
      method: "initialize",
      params: {
        protocolVersion: "2025-06-18",
        capabilities: {},
        clientInfo: { name: "finance-app", version: "1.0.0" },
      },
    }),
  });

  const id = res.headers.get("mcp-session-id");
  await res.text();
  if (!id) throw new Error("Market data service did not open a session");

  await fetch(MCP_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      "mcp-session-id": id,
    },
    body: JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }),
  }).catch(() => undefined);

  return id;
}

async function getSession(): Promise<string> {
  if (sessionId) return sessionId;
  if (!sessionPromise) {
    sessionPromise = openSession()
      .then((id) => {
        sessionId = id;
        return id;
      })
      .finally(() => {
        sessionPromise = null;
      });
  }
  return sessionPromise;
}

async function rawCall(name: string, args: Record<string, unknown>, session: string) {
  const res = await fetch(MCP_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      "mcp-session-id": session,
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: ++rpcId,
      method: "tools/call",
      params: { name, arguments: args },
    }),
  });
  return { status: res.status, body: await res.text() };
}

/**
 * Calls a tool on the YFinance MCP server and returns the parsed payload.
 * Tool text output is JSON whenever the server produces structured data.
 */
export async function callMcpTool<T = unknown>(
  name: string,
  args: Record<string, unknown> = {},
): Promise<T> {
  let session = await getSession();
  let { status, body } = await rawCall(name, args, session);

  // Session expired on the server side — reopen once and retry.
  if (status === 404 || status === 400) {
    sessionId = null;
    session = await getSession();
    ({ status, body } = await rawCall(name, args, session));
  }

  const parsed = parseSse(body);
  if (parsed.error) throw new Error(parsed.error.message);

  const result = parsed.result as
    | {
        structuredContent?: unknown;
        content?: Array<{ type: string; text?: string }>;
        isError?: boolean;
      }
    | undefined;

  if (!result) throw new Error(`No result from ${name}`);

  const text = result.content?.find((c) => c.type === "text")?.text;
  if (result.isError) throw new Error(text || `${name} failed`);

  if (text) {
    try {
      return JSON.parse(text) as T;
    } catch {
      return text as unknown as T;
    }
  }

  const structured = result.structuredContent as { result?: unknown } | undefined;
  return (structured?.result ?? structured ?? null) as T;
}

export const MCP_TOOL_NAMES = [
  "get_all_data_summary",
  "get_stock_overview",
  "get_price_history",
  "get_financials",
  "get_news",
  "get_calendar",
  "get_analyst_summary",
  "get_upgrades_downgrades",
  "get_corporate_actions",
  "get_index_data",
  "compare_stocks",
  "lookup_ticker",
] as const;

export type McpToolName = (typeof MCP_TOOL_NAMES)[number];
