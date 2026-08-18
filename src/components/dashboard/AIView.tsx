import { useCallback, useEffect, useRef, useState } from "react";
import type { UIMessage } from "ai";
import { Chat, useChat } from "@ai-sdk/react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { DefaultChatTransport } from "ai";
import {
  ArrowUpRight,
  Check,
  Copy,
  History,
  PanelLeftClose,
  PanelLeftOpen,
  ChevronDown,
  Plus,
  Search,
  Sparkles,
  ShieldCheck,
  X,
} from "lucide-react";
import { InlineLoading } from "@/components/ui/loading-state";
import { TextShimmerLoader } from "@/components/ui/loader";
import { listChatModels } from "@/lib/models.functions";
import { PromptInput } from "@/components/ui/ai-chat-input";
import { Markdown } from "@/components/chat/Markdown";
import { ArtifactPanel } from "@/components/chat/ArtifactPanel";
import type { Artifact } from "@/components/chat/artifact-types";
import {
  classifyChatError,
  createChatDiagnostic,
  parseChatDiagnostic,
  type ChatDiagnostic,
} from "@/lib/chat-diagnostics";
import { useAppState, type SavedScreener, type ScreenerFilters } from "@/lib/app-state";
import { cn } from "@/lib/utils";

type ChatSession = {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: UIMessage[];
};

type ChatRuntimeStatus = "submitted" | "streaming" | "ready" | "error";

type ChatRuntimeObserver = {
  onFinish: (messages: UIMessage[]) => void;
  onError: (error: unknown) => void;
};

const chatRuntimeStore = new Map<string, Chat<UIMessage>>();
const chatRuntimeObservers = new Map<string, ChatRuntimeObserver>();
const chatRuntimeErrors = new Map<string, ChatDiagnostic>();
const chatRuntimeStatuses = new Map<string, ChatRuntimeStatus>();
const chatRuntimeListeners = new Set<() => void>();

function notifyRuntimeListeners() {
  chatRuntimeListeners.forEach((listener) => listener());
}

function getChatRuntime(id: string, messages: UIMessage[]) {
  const existing = chatRuntimeStore.get(id);
  if (existing) return existing;

  const runtime = new Chat<UIMessage>({
    id,
    messages,
    transport: new DefaultChatTransport({ api: "/api/chat" }),
    onFinish: ({ messages: nextMessages }) => {
      chatRuntimeErrors.delete(id);
      chatRuntimeObservers.get(id)?.onFinish(nextMessages);
    },
    onError: (error) => {
      const diagnostic =
        parseChatDiagnostic(error) ??
        classifyChatError(error, { phase: "client", requestId: id });
      chatRuntimeErrors.set(id, diagnostic);
      chatRuntimeObservers.get(id)?.onError(diagnostic);
      notifyRuntimeListeners();
    },
  });
  chatRuntimeStatuses.set(id, runtime.status);
  runtime["~registerStatusCallback"](() => {
    chatRuntimeStatuses.set(id, runtime.status);
    notifyRuntimeListeners();
  });
  chatRuntimeStore.set(id, runtime);
  return runtime;
}

function newChatSession(): ChatSession {
  const now = Date.now();
  return { id: `chat-${now}`, title: "New research", createdAt: now, updatedAt: now, messages: [] };
}

function loadChatSessions(): ChatSession[] {
  if (typeof window === "undefined") return [newChatSession()];
  try {
    const raw = window.localStorage.getItem("sc:chat-sessions");
    const parsed = raw ? (JSON.parse(raw) as ChatSession[]) : [];
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : [newChatSession()];
  } catch {
    return [newChatSession()];
  }
}

function historyBucket(timestamp: number) {
  const date = new Date(timestamp);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return "Today";
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
  return "Earlier";
}

function messageText(message: UIMessage) {
  return message.parts
    .filter((part) => part.type === "text")
    .map((part) => (part.type === "text" ? part.text : ""))
    .join(" ")
    .trim();
}

type ScreenerToolResult = {
  id: string;
  name: string;
  criteria: string;
  filters: ScreenerFilters;
  rows: Array<Record<string, unknown>>;
};

function screenerFiltersFromUnknown(value: unknown): ScreenerFilters | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const text = (key: keyof ScreenerFilters, fallback = "") =>
    typeof record[key] === "string" ? (record[key] as string) : fallback;
  const numberText = (key: keyof ScreenerFilters) => {
    const value = record[key];
    return typeof value === "number" && Number.isFinite(value) ? String(value) : "";
  };
  return {
    region: text("region", "us"),
    sector: text("sector"),
    industry: text("industry"),
    size: typeof record["size"] === "number" ? Math.max(1, Math.min(100, record["size"])) : 25,
    minMarketCap: numberText("minMarketCap"),
    maxMarketCap: numberText("maxMarketCap"),
    minPe: numberText("minPe"),
    maxPe: numberText("maxPe"),
    minGrowth: numberText("minGrowth"),
    minDividendYield: numberText("minDividendYield"),
    minPrice: numberText("minPrice"),
    maxPrice: numberText("maxPrice"),
    minVolume: numberText("minVolume"),
    minChangePercent: numberText("minChangePercent"),
    maxChangePercent: numberText("maxChangePercent"),
    exchange: text("exchange"),
    nameContains: text("nameContains"),
    sortField: text("sortField", "intradaymarketcap"),
    sortAscending: record["sortAscending"] === true,
  };
}

function screenerToolResultFromPart(part: unknown, id: string): ScreenerToolResult | null {
  if (!part || typeof part !== "object") return null;
  const candidate = part as Record<string, unknown>;
  if (candidate["type"] !== "tool-create_screener") return null;
  const output = candidate["output"];
  if (!output || typeof output !== "object") return null;
  const result = output as Record<string, unknown>;
  if (result["type"] !== "screener_result" || !Array.isArray(result["rows"])) return null;
  const filters = screenerFiltersFromUnknown(result["filters"]);
  if (!filters) return null;
  return {
    id: String(candidate["toolCallId"] ?? id),
    name: typeof result["name"] === "string" ? result["name"] : "AI screener",
    criteria: typeof result["criteria"] === "string" ? result["criteria"] : "Custom criteria",
    filters,
    rows: (result["rows"] as unknown[]).filter((row): row is Record<string, unknown> =>
      Boolean(row && typeof row === "object"),
    ),
  };
}

function formatScreenerValue(value: unknown, kind: "price" | "percent" | "multiple" | "marketCap") {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—";
  if (kind === "percent") return `${value.toFixed(2)}%`;
  if (kind === "multiple") return `${value.toFixed(1)}×`;
  if (kind === "marketCap")
    return value >= 1_000_000_000_000
      ? `${(value / 1_000_000_000_000).toFixed(1)}T`
      : value >= 1_000_000_000
        ? `${(value / 1_000_000_000).toFixed(1)}B`
        : `${(value / 1_000_000).toFixed(0)}M`;
  return value.toFixed(2);
}

function ChatDiagnosticCard({
  diagnostic,
  onRetry,
}: {
  diagnostic: ChatDiagnostic;
  onRetry: () => void;
}) {
  return (
    <div className="mx-auto my-2 w-full max-w-2xl rounded-xl border border-negative/20 bg-negative/[0.035] px-3 py-3 text-left sm:px-4">
      <div className="flex items-start gap-2.5">
        <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-negative/10 text-xs font-bold text-negative">
          !
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <p className="text-xs font-semibold text-foreground">{diagnostic.title}</p>
            {diagnostic.retryAfterSeconds ? (
              <span className="rounded-full bg-amber-500/10 px-1.5 py-0.5 text-[10px] text-amber-700 dark:text-amber-300">
                Retry in about {diagnostic.retryAfterSeconds}s
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-[11px] leading-5 text-muted-foreground">{diagnostic.message}</p>
          <p className="mt-1 text-[11px] leading-5 text-foreground/80">{diagnostic.action}</p>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {diagnostic.retryable ? (
              <button
                type="button"
                onClick={onRetry}
                className="rounded-md bg-foreground px-2.5 py-1.5 text-[11px] font-medium text-background transition-opacity hover:opacity-85"
              >
                Retry research
              </button>
            ) : null}
            <details className="text-[10px] text-muted-foreground">
              <summary className="cursor-pointer rounded-md px-1.5 py-1 hover:bg-accent">Technical details</summary>
              <div className="mt-1 rounded-md bg-background/60 px-2 py-1.5 leading-4">
                <div>Code: {diagnostic.code}</div>
                {diagnostic.provider ? <div>Provider: {diagnostic.provider}</div> : null}
                {diagnostic.model ? <div className="break-all">Model: {diagnostic.model}</div> : null}
                {diagnostic.requestId ? <div>Request ID: {diagnostic.requestId}</div> : null}
              </div>
            </details>
          </div>
        </div>
      </div>
    </div>
  );
}

function ScreenerResultCard({ result }: { result: ScreenerToolResult }) {
  return (
    <div className="my-3 overflow-hidden rounded-xl border border-primary/20 bg-primary/[0.03]">
      <div className="flex flex-wrap items-start justify-between gap-2 border-b border-border/60 px-3 py-2.5">
        <div className="min-w-0">
          <p className="truncate text-xs font-semibold text-foreground">{result.name}</p>
          <p className="mt-0.5 text-[10px] leading-4 text-muted-foreground">{result.criteria}</p>
        </div>
        <span className="shrink-0 rounded-full bg-primary/10 px-2 py-1 text-[10px] font-medium text-primary">
          {result.rows.length} matches · saved preset
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[540px] text-left text-[11px]">
          <thead className="bg-muted/30 text-[10px] uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">Symbol</th>
              <th className="px-3 py-2 font-medium">Price</th>
              <th className="px-3 py-2 font-medium">Change</th>
              <th className="px-3 py-2 font-medium">P/E</th>
              <th className="px-3 py-2 font-medium">Market cap</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {result.rows.slice(0, 12).map((row, index) => (
              <tr
                key={`${String(row["symbol"] ?? row["name"] ?? "row")}-${index}`}
                className="text-foreground"
              >
                <td className="max-w-[220px] px-3 py-2">
                  <span className="font-semibold">{String(row["symbol"] ?? "—")}</span>
                  <span className="ml-1.5 text-muted-foreground">{String(row["name"] ?? "")}</span>
                </td>
                <td className="px-3 py-2">{formatScreenerValue(row["price"], "price")}</td>
                <td
                  className={cn(
                    "px-3 py-2",
                    Number(row["changePercent"]) >= 0 ? "text-positive" : "text-negative",
                  )}
                >
                  {formatScreenerValue(row["changePercent"], "percent")}
                </td>
                <td className="px-3 py-2">{formatScreenerValue(row["peRatio"], "multiple")}</td>
                <td className="px-3 py-2">{formatScreenerValue(row["marketCap"], "marketCap")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const SUGGESTIONS = [
  "Compare TCS and Infosys on margins and valuation",
  "Draw a mermaid flowchart of NVIDIA's revenue drivers",
  "Build a table of the Magnificent 7 with P/E and 1Y growth",
  "What moved Reliance today and why?",
];

export function AIView({ visible = true }: { visible?: boolean }) {
  const [sessionErrors, setSessionErrors] = useState<Record<string, ChatDiagnostic>>({});
  const [, forceRuntimeRender] = useState(0);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [artifact, setArtifact] = useState<Artifact | null>(null);
  const [model, setModel] = useState("openrouter:openai/gpt-4o-mini");
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyQuery, setHistoryQuery] = useState("");
  const [historyMenuId, setHistoryMenuId] = useState<string | null>(null);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const historyPressTimer = useRef<number | null>(null);
  const suppressHistoryClick = useRef(false);
  const [sessions, setSessions] = useState<ChatSession[]>(loadChatSessions);
  const [activeChatId, setActiveChatId] = useState(() => {
    if (typeof window === "undefined") return "";
    return window.localStorage.getItem("sc:active-chat") ?? "";
  });
  const { apiKeys, aiPrefill, setAiPrefill, saveScreener } = useAppState();
  const savedScreenerIds = useRef(new Set<string>());
  const modelsFn = useServerFn(listChatModels);
  const { data: catalog } = useQuery({
    queryKey: [
      "chatmodels",
      apiKeys.openrouter,
      apiKeys.kilo,
      apiKeys.groq,
      apiKeys.together,
      apiKeys.deepseek,
      apiKeys.opencode,
    ],
    queryFn: () =>
      modelsFn({
        data: {
          openrouterKey: apiKeys.openrouter,
          kiloKey: apiKeys.kilo,
          groqKey: apiKeys.groq,
          togetherKey: apiKeys.together,
          deepseekKey: apiKeys.deepseek,
          opencodeKey: apiKeys.opencode,
        },
      }),
    staleTime: 600_000,
  });

  const activeSession = sessions.find((session) => session.id === activeChatId) ?? sessions[0];
  const currentChatId = activeSession?.id ?? "";

  useEffect(() => {
    if (!activeChatId && currentChatId) setActiveChatId(currentChatId);
  }, [activeChatId, currentChatId]);

  useEffect(() => {
    const listener = () => forceRuntimeRender((value) => value + 1);
    chatRuntimeListeners.add(listener);
    return () => {
      chatRuntimeListeners.delete(listener);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const media = window.matchMedia("(min-width: 1024px)");
    const syncHistoryVisibility = () => setHistoryOpen(media.matches);
    syncHistoryVisibility();
    media.addEventListener("change", syncHistoryVisibility);
    return () => media.removeEventListener("change", syncHistoryVisibility);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("sc:chat-sessions", JSON.stringify(sessions.slice(0, 20)));
    if (currentChatId) window.localStorage.setItem("sc:active-chat", currentChatId);
  }, [sessions, currentChatId]);

  const runtimeId = currentChatId || "chat-default";
  const runtime = getChatRuntime(runtimeId, activeSession?.messages ?? []);

  useEffect(() => {
    chatRuntimeObservers.set(runtimeId, {
      onFinish: (nextMessages) => {
        setSessions((previous) =>
          previous.map((session) =>
            session.id === runtimeId
              ? { ...session, messages: nextMessages, updatedAt: Date.now() }
              : session,
          ),
        );
      },
      onError: (error) => {
        const diagnostic =
          (error as ChatDiagnostic | undefined) ??
          createChatDiagnostic("unknown", { phase: "client", requestId: runtimeId });
        setSessionErrors((previous) => ({
          ...previous,
          [runtimeId]: diagnostic,
        }));
      },
    });
    return () => {
      if (chatRuntimeObservers.get(runtimeId)) chatRuntimeObservers.delete(runtimeId);
    };
  }, [runtimeId]);

  const { messages, sendMessage, regenerate, status, stop } = useChat({ chat: runtime });

  const clearRuntimeError = useCallback(() => {
    chatRuntimeErrors.delete(runtimeId);
    setSessionErrors((previous) => {
      const next = { ...previous };
      delete next[runtimeId];
      return next;
    });
  }, [runtimeId]);

  const sendResearch = useCallback(
    (text: string, meta?: { model?: string | undefined; effort?: string | undefined }) => {
      clearRuntimeError();
      return sendMessage(
        { text },
        {
          body: {
            model,
            keys: apiKeys,
            researchMode: meta?.model ?? "Balanced",
            effort: meta?.effort ?? "Medium Effort",
          },
        },
      );
    },
    [apiKeys, clearRuntimeError, model, sendMessage],
  );

  const retryResearch = useCallback(
    (assistantMessageId: string | undefined, fallbackText: string) => {
      clearRuntimeError();
      if (assistantMessageId) {
        return regenerate({
          messageId: assistantMessageId,
          body: {
            model,
            keys: apiKeys,
            researchMode: "Balanced",
            effort: "Medium Effort",
          },
        });
      }
      if (fallbackText) return sendResearch(fallbackText);
      return Promise.resolve();
    },
    [apiKeys, clearRuntimeError, model, regenerate, sendResearch],
  );

  useEffect(() => {
    if (!currentChatId) return;
    setSessions((previous) =>
      previous.map((session) => {
        if (session.id !== currentChatId) return session;
        const firstUser = messages.find((message) => message.role === "user");
        const firstText = firstUser ? messageText(firstUser) : "";
        return {
          ...session,
          title:
            session.title === "New research" && firstText ? firstText.slice(0, 64) : session.title,
          messages,
          updatedAt: Date.now(),
        };
      }),
    );
  }, [messages, currentChatId]);

  useEffect(() => {
    messages.forEach((message) => {
      message.parts.forEach((part, index) => {
        const result = screenerToolResultFromPart(part, `${message.id}-${index}`);
        if (!result || savedScreenerIds.current.has(result.id)) return;
        const preset: SavedScreener = {
          id: `ai-${result.id}`,
          name: result.name,
          filters: result.filters,
        };
        saveScreener(preset);
        savedScreenerIds.current.add(result.id);
      });
    });
  }, [messages, saveScreener]);

  const models = [...(catalog?.models ?? []), ...(apiKeys.customModels ?? [])].filter(
    (item, index, all) => all.findIndex((candidate) => candidate.id === item.id) === index,
  );
  const busy = status === "submitted" || status === "streaming";
  const activeError = sessionErrors[currentChatId] ?? chatRuntimeErrors.get(currentChatId) ?? null;
  const normalizedHistoryQuery = historyQuery.trim().toLowerCase();
  const historyGroups = ["Today", "Yesterday", "Earlier"].map((label) => ({
    label,
    sessions: sessions
      .filter((session) => historyBucket(session.updatedAt) === label)
      .filter((session) =>
        normalizedHistoryQuery
          ? session.title.toLowerCase().includes(normalizedHistoryQuery)
          : true,
      )
      .sort((a, b) => b.updatedAt - a.updatedAt),
  }));
  const latestUserText = [...messages].reverse().find((message) => message.role === "user");
  const latestAssistant = [...messages].reverse().find((message) => message.role === "assistant");
  const retryText = latestUserText ? messageText(latestUserText) : "";
  const copyMessage = useCallback(async (messageId: string, text: string) => {
    if (!text || typeof navigator === "undefined" || !navigator.clipboard) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedMessageId(messageId);
      window.setTimeout(() => setCopiedMessageId(null), 1600);
    } catch {
      setCopiedMessageId(null);
    }
  }, []);

  useEffect(() => {
    if (apiKeys.preferredModel) setModel(apiKeys.preferredModel);
  }, [apiKeys.preferredModel]);

  useEffect(() => {
    if (!catalog || models.length === 0) return;
    if (models.some((item) => item.id === model)) return;
    const configuredModel = models.find((item) => catalog.configuredProviders[item.provider]);
    const nextModel = configuredModel?.id ?? models[0]?.id;
    if (nextModel) setModel(nextModel);
  }, [apiKeys.preferredModel, catalog, model, models]);

  useEffect(() => {
    if (!aiPrefill || messages.length > 0 || busy) return;
    setAiPrefill(null);
    void sendResearch(aiPrefill);
  }, [aiPrefill, busy, messages.length, sendResearch, setAiPrefill]);
  const openrouter = models.filter((m) => m.provider === "openrouter");
  const kilo = models.filter((m) => m.provider === "kilo");
  const groq = models.filter((m) => m.provider === "groq");
  const together = models.filter((m) => m.provider === "together");
  const deepseek = models.filter((m) => m.provider === "deepseek");
  const opencode = models.filter((m) => m.provider === "opencode");
  const providerGroups = [
    { label: "OpenRouter", models: openrouter },
    { label: "Kilo AI", models: kilo },
    { label: "Groq", models: groq },
    { label: "Together AI", models: together },
    { label: "DeepSeek", models: deepseek },
    { label: "OpenCode Zen", models: opencode },
  ];
  const selectedProvider = model.split(":", 1)[0] as
    "openrouter" | "kilo" | "groq" | "together" | "deepseek" | "opencode";
  const selectedProviderLabel =
    providerGroups.find((group) => group.models.some((item) => item.id === model))?.label ??
    selectedProvider;
  const selectedProviderReady = catalog?.configuredProviders?.[selectedProvider] ?? true;

  const createChat = () => {
    const session = newChatSession();
    setSessions((previous) => [session, ...previous].slice(0, 20));
    setActiveChatId(session.id);
    setSessionErrors((previous) => {
      const next = { ...previous };
      delete next[session.id];
      return next;
    });
    setArtifact(null);
    setHistoryOpen(false);
  };

  const selectChat = (id: string) => {
    setActiveChatId(id);
    setSessionErrors((previous) => {
      const next = { ...previous };
      delete next[id];
      return next;
    });
    setArtifact(null);
    setHistoryOpen(false);
    setHistoryMenuId(null);
  };

  const clearHistoryPress = () => {
    if (historyPressTimer.current !== null) {
      window.clearTimeout(historyPressTimer.current);
      historyPressTimer.current = null;
    }
  };

  const beginHistoryPress = (id: string) => {
    clearHistoryPress();
    suppressHistoryClick.current = false;
    historyPressTimer.current = window.setTimeout(() => {
      suppressHistoryClick.current = true;
      setHistoryMenuId(id);
      setEditingSessionId(null);
    }, 520);
  };

  const openHistoryMenu = (event: React.MouseEvent, id: string) => {
    event.preventDefault();
    clearHistoryPress();
    suppressHistoryClick.current = true;
    setHistoryMenuId(id);
    setEditingSessionId(null);
  };

  const startRenameSession = (session: ChatSession) => {
    setHistoryMenuId(session.id);
    setEditingSessionId(session.id);
    setEditingTitle(session.title);
  };

  const commitRenameSession = (id: string) => {
    const title = editingTitle.trim();
    if (title) {
      setSessions((previous) =>
        previous.map((session) =>
          session.id === id ? { ...session, title: title.slice(0, 80) } : session,
        ),
      );
    }
    setEditingSessionId(null);
    setHistoryMenuId(null);
  };

  const deleteSession = (id: string) => {
    clearHistoryPress();
    chatRuntimeStore.delete(id);
    chatRuntimeObservers.delete(id);
    chatRuntimeErrors.delete(id);
    chatRuntimeStatuses.delete(id);
    setSessionErrors((previous) => {
      const next = { ...previous };
      delete next[id];
      return next;
    });
    setSessions((previous) => {
      const remaining = previous.filter((session) => session.id !== id);
      const nextSessions = remaining.length > 0 ? remaining : [newChatSession()];
      if (id === currentChatId) {
        setActiveChatId(nextSessions[0]?.id ?? "");
      }
      return nextSessions;
    });
    setHistoryMenuId(null);
    setEditingSessionId(null);
  };

  useEffect(() => () => clearHistoryPress(), []);

  return (
    <div className="relative flex h-full min-h-0 min-w-0 overflow-x-hidden">
      {historyOpen && (
        <button
          type="button"
          aria-label="Close chat history"
          onClick={() => setHistoryOpen(false)}
          className="fixed inset-0 z-20 bg-background/55 backdrop-blur-sm lg:hidden"
        />
      )}
      <aside
        className={cn(
          "absolute inset-y-0 left-0 z-30 flex w-[min(84vw,300px)] shrink-0 flex-col overflow-hidden border-r border-border/80 bg-card/95 backdrop-blur-xl transition-[width,transform,opacity] duration-200 lg:relative lg:z-0 lg:bg-card/35",
          historyOpen
            ? "translate-x-0 lg:w-[256px] lg:opacity-100"
            : "-translate-x-full lg:pointer-events-none lg:w-0 lg:-translate-x-0 lg:border-r-0 lg:opacity-0",
        )}
      >
        <div className="flex h-12 shrink-0 items-center gap-2 border-b border-border/70 px-3">
          <History className="h-3.5 w-3.5 text-primary" />
          <span className="text-sm font-semibold text-foreground">Chats</span>
          <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
            {sessions.length}
          </span>
          <button
            type="button"
            onClick={() => setHistoryOpen(false)}
            className="ml-auto rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground lg:hidden"
            aria-label="Close history"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className="space-y-1.5 border-b border-border/70 px-2 py-2">
          <button
            type="button"
            onClick={createChat}
            className="flex h-8 w-full items-center gap-2 rounded-lg bg-primary px-2.5 text-left text-xs font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
          >
            <Plus className="h-3.5 w-3.5" /> New research
          </button>
          <label className="relative block">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              value={historyQuery}
              onChange={(event) => setHistoryQuery(event.target.value)}
              placeholder="Search in chats"
              aria-label="Search in chats"
              className="h-8 w-full rounded-lg border border-border/70 bg-background/45 pl-8 pr-2 text-xs text-foreground outline-none placeholder:text-muted-foreground focus:border-border"
            />
          </label>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3 pt-2">
          {historyGroups.map(
            (group) =>
              group.sessions.length > 0 && (
                <section key={group.label} className="mb-3 last:mb-0">
                  <div className="flex items-center gap-1 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/80">
                    <ChevronDown className="h-3 w-3" />
                    {group.label}
                  </div>
                  <div className="space-y-0.5">
                    {group.sessions.map((session) => (
                      <div key={session.id} className="relative">
                        <button
                          type="button"
                          onClick={() => {
                            if (suppressHistoryClick.current) {
                              suppressHistoryClick.current = false;
                              return;
                            }
                            selectChat(session.id);
                          }}
                          onContextMenu={(event) => openHistoryMenu(event, session.id)}
                          onPointerDown={() => beginHistoryPress(session.id)}
                          onPointerUp={clearHistoryPress}
                          onPointerCancel={clearHistoryPress}
                          onPointerLeave={clearHistoryPress}
                          className={cn(
                            "w-full rounded-xl px-2.5 py-2 text-left transition-colors",
                            session.id === currentChatId
                              ? "bg-primary/10 text-primary"
                              : "text-muted-foreground hover:bg-accent hover:text-foreground",
                          )}
                        >
                          {editingSessionId === session.id ? (
                            <input
                              autoFocus
                              value={editingTitle}
                              onChange={(event) => setEditingTitle(event.target.value)}
                              onClick={(event) => event.stopPropagation()}
                              onPointerDown={(event) => event.stopPropagation()}
                              onKeyDown={(event) => {
                                if (event.key === "Enter") commitRenameSession(session.id);
                                if (event.key === "Escape") {
                                  setEditingSessionId(null);
                                  setHistoryMenuId(null);
                                }
                              }}
                              onBlur={() => commitRenameSession(session.id)}
                              aria-label="Rename chat"
                              className="h-6 w-full rounded-md border border-primary/30 bg-background/75 px-1.5 text-xs text-foreground outline-none"
                            />
                          ) : (
                            <>
                              <span className="flex min-w-0 items-center gap-1.5 text-xs font-medium">
                                {(() => {
                                  const sessionStatus = chatRuntimeStatuses.get(session.id);
                                  const working =
                                    sessionStatus === "submitted" || sessionStatus === "streaming";
                                  return working ? (
                                    <span
                                      className="flex shrink-0 items-center gap-0.5"
                                      aria-label="Research in progress"
                                    >
                                      <span className="tool-dot h-1.5 w-1.5 rounded-full bg-primary" />
                                      <span className="tool-dot tool-dot-delay-1 h-1.5 w-1.5 rounded-full bg-primary" />
                                      <span className="tool-dot tool-dot-delay-2 h-1.5 w-1.5 rounded-full bg-primary" />
                                    </span>
                                  ) : null;
                                })()}
                                <span className="min-w-0 truncate">{session.title}</span>
                              </span>
                              <span className="mt-0.5 block text-[10px] opacity-70">
                                {session.messages.length > 0
                                  ? `${session.messages.length} messages`
                                  : "New chat"}
                              </span>
                            </>
                          )}
                        </button>
                        {historyMenuId === session.id && editingSessionId !== session.id && (
                          <div className="absolute right-1 top-full z-40 mt-1 w-32 rounded-lg border border-border bg-popover p-1 text-popover-foreground shadow-xl">
                            <button
                              type="button"
                              onClick={() => startRenameSession(session)}
                              className="w-full rounded-md px-2 py-1.5 text-left text-[11px] hover:bg-accent"
                            >
                              Rename
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteSession(session.id)}
                              className="w-full rounded-md px-2 py-1.5 text-left text-[11px] text-negative hover:bg-negative/10"
                            >
                              Delete
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </section>
              ),
          )}
          {historyGroups.every((group) => group.sessions.length === 0) && (
            <p className="px-2 py-4 text-center text-xs text-muted-foreground">No matching chats</p>
          )}
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex min-w-0 shrink-0 items-center gap-1.5 overflow-hidden border-b border-border/80 bg-card/30 px-2 py-1.5 sm:gap-2.5 sm:px-4 sm:py-2">
          <button
            type="button"
            onClick={() => setHistoryOpen((open) => !open)}
            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            aria-label={historyOpen ? "Hide chat history" : "Show chat history"}
          >
            {historyOpen ? (
              <PanelLeftClose className="h-4 w-4" />
            ) : (
              <PanelLeftOpen className="h-4 w-4" />
            )}
          </button>
          <div className="flex min-w-0 items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-primary/25 bg-primary/10 text-primary">
              <Sparkles className="h-3.5 w-3.5" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-foreground">AI analyst</p>
              <p className="hidden text-[10px] text-muted-foreground sm:block">
                Grounded market research
              </p>
            </div>
          </div>
          <div className="ml-auto flex min-w-0 items-center gap-1.5">
            <span className="hidden items-center gap-1 rounded-full border border-positive/20 bg-positive/5 px-2 py-1 text-[10px] font-medium text-positive lg:flex">
              <ShieldCheck className="h-3 w-3" /> Live context
            </span>
            <span
              className={cn(
                "hidden rounded-full border px-2 py-1 text-[10px] font-medium xl:inline-flex",
                apiKeys.tinyfish
                  ? "border-primary/25 bg-primary/10 text-primary"
                  : "border-border text-muted-foreground",
              )}
              title={
                apiKeys.tinyfish
                  ? "TinyFish web search is ready"
                  : "Add TinyFish in Settings for internet research"
              }
            >
              {apiKeys.tinyfish ? "Web search ready" : "Web search off"}
            </span>
            <span className="hidden text-[10px] uppercase tracking-wider text-muted-foreground lg:inline">
              Model
            </span>
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="h-8 min-w-0 max-w-[132px] rounded-lg border border-border/80 bg-background/60 px-1.5 text-[10px] text-foreground shadow-sm transition-colors focus:border-border sm:max-w-[240px] sm:px-2 sm:text-[11px]"
            >
              {providerGroups.map(({ label, models: providerModels }) =>
                providerModels.length > 0 ? (
                  <optgroup key={label} label={label}>
                    {providerModels.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.label}
                        {"note" in m && m.note ? ` · ${m.note}` : ""}
                      </option>
                    ))}
                  </optgroup>
                ) : null,
              )}
            </select>
            {!catalog && <InlineLoading label="Loading model catalog" variant="pulse-dot" />}
            {catalog && !selectedProviderReady && (
              <span className="hidden max-w-[260px] text-[11px] text-negative xl:inline">
                Add a {selectedProviderLabel} key in Settings to use this model.
              </span>
            )}
            {!apiKeys.tinyfish && (
              <span className="hidden text-[11px] text-muted-foreground">
                Add TinyFish in Settings to enable live internet sources.
              </span>
            )}
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3 sm:px-5 sm:py-4">
          <div
            className={cn(
              "mx-auto w-full space-y-6 transition-[max-width] duration-200",
              historyOpen ? "max-w-3xl" : "max-w-5xl",
            )}
          >
            {messages.length === 0 && (
              <div className="relative overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/10 via-card to-card p-4 text-left shadow-2xl shadow-primary/5 sm:rounded-[1.5rem] sm:p-6">
                <div className="absolute -right-20 -top-24 h-64 w-64 rounded-full bg-primary/10 blur-3xl" />
                <div className="relative">
                  <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-2xl border border-primary/25 bg-primary/10 text-primary">
                    <Sparkles className="h-5 w-5" />
                  </div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
                    Research copilot
                  </p>
                  <h1 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-foreground sm:text-3xl">
                    Ask sharper market questions.
                  </h1>
                  <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">
                    Every answer is grounded in live quotes, fundamentals, analyst data, and news.
                    Ask for a comparison, a table, or a visual explanation.
                  </p>
                  <div className="mt-7 grid gap-2 sm:grid-cols-2">
                    {SUGGESTIONS.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => void sendResearch(s)}
                        className="group flex items-start justify-between gap-3 rounded-2xl border border-border/80 bg-background/35 p-3.5 text-left text-[13px] text-muted-foreground transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:bg-primary/5 hover:text-foreground"
                      >
                        <span>{s}</span>
                        <ArrowUpRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary/60 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {messages.map((m, messageIndex) => {
              const assistantText = m.role === "assistant" ? messageText(m) : "";
              const previousUser = messages
                .slice(0, messageIndex)
                .reverse()
                .find((message) => message.role === "user");
              const messageRetryText = previousUser ? messageText(previousUser) : "";
              return (
                <div
                  key={m.id}
                  className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}
                >
                  <div
                    className={cn(
                      "min-w-0 max-w-[88%] break-words",
                      m.role === "user"
                        ? "rounded-2xl rounded-br-md bg-primary px-4 py-2.5 text-[15px] leading-6 text-primary-foreground shadow-lg shadow-primary/10"
                        : "w-full rounded-2xl border border-border/70 bg-card/45 px-4 py-3 sm:px-5",
                    )}
                  >
                    {m.role === "user"
                      ? m.parts.map((p, i) =>
                          p.type === "text" ? <span key={i}>{p.text}</span> : null,
                        )
                      : m.parts.map((p, i) =>
                          p.type === "text" ? (
                            <Markdown
                              key={i}
                              content={p.text}
                              messageId={`${m.id}-${i}`}
                              onOpenArtifact={setArtifact}
                            />
                          ) : p.type === "tool-create_screener" ? (
                            (() => {
                              const result = screenerToolResultFromPart(p, `${m.id}-${i}`);
                              return result ? <ScreenerResultCard key={i} result={result} /> : null;
                            })()
                          ) : p.type.startsWith("tool-") ? (
                            (() => {
                              const toolState =
                                "state" in p && typeof p.state === "string" ? p.state : "";
                              const toolActive =
                                toolState === "input-streaming" || toolState === "input-available";
                              const toolFailed = toolState === "output-error";
                              return (
                                <span
                                  key={i}
                                  className={cn(
                                    "mr-1 mb-1 inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-[11px]",
                                    toolActive
                                      ? "border-primary/20 bg-primary/5 text-muted-foreground"
                                      : toolFailed
                                        ? "border-negative/20 bg-negative/5 text-negative"
                                        : "border-border/80 bg-card/50 text-muted-foreground",
                                  )}
                                >
                                  {toolActive ? (
                                    <span className="flex items-center gap-0.5" aria-hidden="true">
                                      <span className="tool-dot h-1.5 w-1.5 rounded-full bg-primary" />
                                      <span className="tool-dot tool-dot-delay-1 h-1.5 w-1.5 rounded-full bg-primary" />
                                      <span className="tool-dot tool-dot-delay-2 h-1.5 w-1.5 rounded-full bg-primary" />
                                    </span>
                                  ) : (
                                    <span className="text-[10px]" aria-hidden="true">
                                      {toolFailed ? "!" : "✓"}
                                    </span>
                                  )}
                                  <span>
                                    {p.type.replace("tool-", "").replace(/_/g, " ")}{" "}
                                    {toolActive
                                      ? "in progress"
                                      : toolFailed
                                        ? "failed"
                                        : "complete"}
                                  </span>
                                </span>
                              );
                            })()
                          ) : null,
                        )}
                    {m.role === "assistant" && (assistantText || messageRetryText) && (
                      <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-border/50 pt-2">
                        {assistantText && (
                          <button
                            type="button"
                            onClick={() => void copyMessage(m.id, assistantText)}
                            className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                          >
                            {copiedMessageId === m.id ? (
                              <Check className="h-3 w-3 text-positive" />
                            ) : (
                              <Copy className="h-3 w-3" />
                            )}
                            {copiedMessageId === m.id ? "Copied" : "Copy"}
                          </button>
                        )}
                        {messageRetryText && (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => {
                              void retryResearch(m.id, messageRetryText);
                            }}
                            className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <ArrowUpRight className="h-3 w-3 rotate-180" />
                            Retry
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {status === "submitted" && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <InlineLoading label="Preparing research tools" variant="wave" />
              </div>
            )}
            {status === "streaming" && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <TextShimmerLoader text="Writing research" size="sm" />
              </div>
            )}
            {activeError && retryText && (
              <ChatDiagnosticCard
                diagnostic={activeError}
                onRetry={() => {
                  void retryResearch(latestAssistant?.id, retryText);
                }}
              />
            )}
          </div>
        </div>

        <div className="shrink-0 border-t border-border/70 bg-background/75 px-4 pb-4 pt-3 backdrop-blur-xl sm:px-6 sm:pb-6">
          <div className="mx-auto flex w-full max-w-5xl justify-center">
            <PromptInput
              autoFocus={visible}
              isStreaming={busy}
              models={["Balanced", "Quick Take", "Deep Research"]}
              efforts={["Low Effort", "Medium Effort", "High Effort"]}
              onStop={() => void stop()}
              onSubmit={(text, meta) => {
                void sendResearch(text, meta);
              }}
            />
          </div>
        </div>
      </div>

      {artifact && (
        <div className="hidden w-[440px] shrink-0 lg:block">
          <ArtifactPanel artifact={artifact} onClose={() => setArtifact(null)} />
        </div>
      )}
    </div>
  );
}
