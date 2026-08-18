export type ChatDiagnosticCategory =
  | "missing_configuration"
  | "authentication"
  | "rate_limit"
  | "credits"
  | "unsupported_request"
  | "tool_failure"
  | "network"
  | "interrupted"
  | "unknown";

export type ChatDiagnosticPhase = "configuration" | "provider" | "tool" | "stream" | "client";

export type ChatDiagnostic = {
  type: "chat-diagnostic";
  code: string;
  category: ChatDiagnosticCategory;
  title: string;
  message: string;
  action: string;
  retryable: boolean;
  provider?: string;
  model?: string;
  phase?: ChatDiagnosticPhase;
  requestId?: string;
  retryAfterSeconds?: number;
};

type DiagnosticContext = {
  provider?: string | undefined;
  model?: string | undefined;
  phase?: ChatDiagnosticPhase | undefined;
  requestId?: string | undefined;
};

function contextFields(context: DiagnosticContext) {
  return {
    ...(context.provider ? { provider: context.provider } : {}),
    ...(context.model ? { model: context.model } : {}),
    ...(context.phase ? { phase: context.phase } : {}),
    ...(context.requestId ? { requestId: context.requestId } : {}),
  };
}

export function createChatDiagnostic(
  category: ChatDiagnosticCategory,
  context: DiagnosticContext = {},
  overrides: Partial<
    Pick<
      ChatDiagnostic,
      "code" | "title" | "message" | "action" | "retryable" | "retryAfterSeconds"
    >
  > = {},
): ChatDiagnostic {
  const defaults: Record<
    ChatDiagnosticCategory,
    Omit<ChatDiagnostic, "type" | "provider" | "model" | "phase" | "requestId">
  > = {
    missing_configuration: {
      code: "PROVIDER_KEY_MISSING",
      category: "missing_configuration",
      title: "Provider key is missing",
      message: "The selected AI provider is not configured for this workspace.",
      action: "Open Settings, add the provider API key, or choose a configured model.",
      retryable: true,
    },
    authentication: {
      code: "PROVIDER_AUTH_REJECTED",
      category: "authentication",
      title: "Provider rejected the credentials",
      message: "The selected provider did not accept the configured API key or account access.",
      action:
        "Check the API key in Settings, verify the model is available to that account, or switch providers.",
      retryable: true,
    },
    rate_limit: {
      code: "PROVIDER_RATE_LIMIT",
      category: "rate_limit",
      title: "Provider rate limit reached",
      message: "The provider is temporarily limiting requests for this account or model.",
      action: "Wait briefly and retry, or switch to another configured model.",
      retryable: true,
    },
    credits: {
      code: "PROVIDER_CREDITS_EXHAUSTED",
      category: "credits",
      title: "Provider credits are unavailable",
      message:
        "The provider cannot run this request because the account has no available credits or access.",
      action: "Add provider credits or switch to another configured model.",
      retryable: false,
    },
    unsupported_request: {
      code: "MODEL_REQUEST_REJECTED",
      category: "unsupported_request",
      title: "The model rejected this request",
      message:
        "The selected model or gateway rejected the requested tools, reasoning mode, or output size before generation began.",
      action: "Choose another model, use Quick Take, or retry with a simpler request.",
      retryable: true,
    },
    tool_failure: {
      code: "RESEARCH_TOOL_FAILED",
      category: "tool_failure",
      title: "A research tool could not finish",
      message: "A finance or web data source failed while the analyst was gathering evidence.",
      action: "Retry once, remove the failing data source from the request, or switch providers.",
      retryable: true,
    },
    network: {
      code: "PROVIDER_NETWORK_ERROR",
      category: "network",
      title: "Provider connection failed",
      message: "The request could not reach the provider or the provider connection timed out.",
      action: "Check the connection and retry. If it repeats, switch providers.",
      retryable: true,
    },
    interrupted: {
      code: "STREAM_INTERRUPTED",
      category: "interrupted",
      title: "The response connection ended early",
      message: "The provider connection ended before the analyst finished the response.",
      action: "Retry the saved request. A shorter mode may complete more reliably.",
      retryable: true,
    },
    unknown: {
      code: "ANALYST_REQUEST_FAILED",
      category: "unknown",
      title: "The analyst could not complete the request",
      message: "The provider stopped the request before a complete answer was available.",
      action: "Retry once or choose another configured provider in Settings.",
      retryable: true,
    },
  };
  const base = defaults[category];
  return {
    type: "chat-diagnostic",
    ...base,
    ...contextFields(context),
    ...overrides,
  };
}

function errorText(error: unknown) {
  if (error instanceof Error) {
    const status =
      (error as Error & { status?: unknown; statusCode?: unknown }).status ??
      (error as Error & { statusCode?: unknown }).statusCode;
    return `${error.message}${typeof status === "number" ? ` status=${status}` : ""}`;
  }
  if (typeof error === "string") return error;
  try {
    return JSON.stringify(error) ?? String(error);
  } catch {
    return String(error);
  }
}

function statusFromError(error: unknown) {
  if (!error || typeof error !== "object") return undefined;
  const candidate = error as {
    status?: unknown;
    statusCode?: unknown;
    response?: { status?: unknown };
  };
  const status = candidate.status ?? candidate.statusCode ?? candidate.response?.status;
  return typeof status === "number" ? status : undefined;
}

export function classifyChatError(error: unknown, context: DiagnosticContext = {}): ChatDiagnostic {
  const text = errorText(error).toLowerCase();
  const status = statusFromError(error);
  const full = `${text} ${status ?? ""}`;
  const retryAfterMatch = text.match(/retry[- _]?after[^0-9]*(\d+)/i);
  const retryAfterSeconds = retryAfterMatch?.[1] ? Number(retryAfterMatch[1]) : undefined;

  if (
    text.includes("provider key") ||
    text.includes("not configured") ||
    text.includes("no configured")
  ) {
    return createChatDiagnostic("missing_configuration", context);
  }
  if (status === 429 || /rate limit|too many requests|quota exceeded|throttl/.test(full)) {
    return createChatDiagnostic("rate_limit", context, {
      ...(retryAfterSeconds && retryAfterSeconds > 0 ? { retryAfterSeconds } : {}),
    });
  }
  if (status === 402 || /credit|billing|payment required|insufficient balance/.test(full)) {
    return createChatDiagnostic("credits", context);
  }
  if (
    status === 401 ||
    status === 403 ||
    /invalid api key|unauthorized|authentication|credential|access denied/.test(full)
  ) {
    return createChatDiagnostic("authentication", context);
  }
  if (/tool[- _]?error|tool failed|tool execution|finance tool|web search/.test(full)) {
    return createChatDiagnostic("tool_failure", context);
  }
  if (/abort|aborted|cancel|connection.*closed|stream.*(closed|ended)|premature/.test(full)) {
    return createChatDiagnostic("interrupted", context);
  }
  if (/timeout|timed out|fetch failed|econn|network|gateway|unavailable|503|502/.test(full)) {
    return createChatDiagnostic("network", context);
  }
  if (
    /function call|reasoning|unsupported|not support|max_tokens|max output|context length/.test(
      full,
    )
  ) {
    return createChatDiagnostic("unsupported_request", context);
  }
  return createChatDiagnostic("unknown", context);
}

export function serializeChatDiagnostic(diagnostic: ChatDiagnostic) {
  return JSON.stringify(diagnostic);
}

export function parseChatDiagnostic(value: unknown): ChatDiagnostic | null {
  const text = value instanceof Error ? value.message : typeof value === "string" ? value : "";
  if (!text) return null;
  try {
    const parsed: unknown = JSON.parse(text);
    if (!parsed || typeof parsed !== "object") return null;
    const candidate = parsed as Record<string, unknown>;
    if (candidate["type"] !== "chat-diagnostic") return null;
    if (typeof candidate["category"] !== "string" || typeof candidate["title"] !== "string")
      return null;
    if (typeof candidate["message"] !== "string" || typeof candidate["action"] !== "string")
      return null;
    if (typeof candidate["code"] !== "string" || typeof candidate["retryable"] !== "boolean")
      return null;
    return parsed as ChatDiagnostic;
  } catch {
    return null;
  }
}
