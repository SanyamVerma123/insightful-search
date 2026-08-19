import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useServerFn } from "@tanstack/react-start";
import { classifySymbols } from "@/lib/finance.functions";
import { MARKETS, type MarketId } from "@/lib/markets";

export type AssetClass = "equities" | "etfs" | "crypto" | "forex";
export type Theme = "terminal" | "light" | "paper";

export type WatchItem = {
  symbol: string;
  name: string;
  sector: string;
  industry: string;
  marketId: MarketId;
  assetClass: AssetClass;
};

export type Alert = { id: string; symbol: string; above: boolean; price: number; enabled: boolean };

export type ScreenerFilters = {
  region: string;
  sector: string;
  industry?: string;
  size: number;
  minMarketCap: string;
  maxMarketCap: string;
  minPe: string;
  maxPe: string;
  minGrowth: string;
  minDividendYield: string;
  minPrice: string;
  maxPrice: string;
  minVolume: string;
  minChangePercent: string;
  maxChangePercent: string;
  exchange: string;
  nameContains: string;
  sortField: string;
  sortAscending: boolean;
};

export const EMPTY_FILTERS: ScreenerFilters = {
  region: "us",
  sector: "",
  industry: "",
  size: 50,
  minMarketCap: "",
  maxMarketCap: "",
  minPe: "",
  maxPe: "",
  minGrowth: "",
  minDividendYield: "",
  minPrice: "",
  maxPrice: "",
  minVolume: "",
  minChangePercent: "",
  maxChangePercent: "",
  exchange: "",
  nameContains: "",
  sortField: "intradaymarketcap",
  sortAscending: false,
};

export type SavedScreener = {
  id: string;
  name: string;
  filters: ScreenerFilters;
  marketId?: MarketId;
  assetClass?: AssetClass;
};

export type AIProviderId = "openrouter" | "kilo" | "groq" | "together" | "deepseek" | "opencode";

export type CustomAIModel = {
  id: string;
  label: string;
  provider: AIProviderId;
};

export type ApiKeys = {
  lovable?: string;
  openrouter: string;
  openrouterFallback?: string;
  kilo: string;
  kiloFallback?: string;
  groq: string;
  groqFallback?: string;
  together: string;
  togetherFallback?: string;
  deepseek: string;
  deepseekFallback?: string;
  opencode: string;
  opencodeFallback?: string;
  tinyfish: string;
  preferredModel?: string;
  customModels?: CustomAIModel[];
};

type State = {
  market: MarketId;
  setMarket: (m: MarketId) => void;
  assetClass: AssetClass;
  setAssetClass: (assetClass: AssetClass) => void;
  watchlist: WatchItem[];
  isWatched: (symbol: string) => boolean;
  addToWatchlist: (symbol: string, name?: string) => void;
  removeFromWatchlist: (symbol: string) => void;
  toggleWatchlist: (symbol: string, name?: string) => void;
  watchSymbols: string[];
  alerts: Alert[];
  setAlerts: (a: Alert[]) => void;
  screeners: SavedScreener[];
  saveScreener: (s: SavedScreener) => void;
  deleteScreener: (id: string) => void;
  apiKeys: ApiKeys;
  setApiKeys: (k: ApiKeys) => void;
  refreshSeconds: number;
  setRefreshSeconds: (n: number) => void;
  theme: Theme;
  setTheme: (theme: Theme) => void;
  aiPrefill: string | null;
  setAiPrefill: (prompt: string | null) => void;
};

const Ctx = createContext<State | null>(null);

function load<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function save<T>(key: string, value: T) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore */
  }
}

function normalizeApiKeys(raw: unknown): ApiKeys {
  const item = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const text = (key: string) => (typeof item[key] === "string" ? item[key] : "");
  const providers: AIProviderId[] = [
    "openrouter",
    "kilo",
    "groq",
    "together",
    "deepseek",
    "opencode",
  ];
  const customModels = Array.isArray(item["customModels"])
    ? item["customModels"].flatMap((entry) => {
        if (!entry || typeof entry !== "object") return [];
        const candidate = entry as Record<string, unknown>;
        const id = typeof candidate["id"] === "string" ? candidate["id"].trim() : "";
        const label = typeof candidate["label"] === "string" ? candidate["label"].trim() : "";
        const provider = candidate["provider"];
        if (
          !id ||
          !label ||
          typeof provider !== "string" ||
          !providers.includes(provider as AIProviderId)
        ) {
          return [];
        }
        return [{ id, label, provider: provider as AIProviderId }];
      })
    : [];
  return {
    openrouter: text("openrouter"),
    openrouterFallback: text("openrouterFallback"),
    kilo: text("kilo"),
    kiloFallback: text("kiloFallback"),
    groq: text("groq"),
    groqFallback: text("groqFallback"),
    together: text("together"),
    togetherFallback: text("togetherFallback"),
    deepseek: text("deepseek"),
    deepseekFallback: text("deepseekFallback"),
    opencode: text("opencode"),
    opencodeFallback: text("opencodeFallback"),
    tinyfish: text("tinyfish"),
    preferredModel:
      typeof item["preferredModel"] === "string" && item["preferredModel"]
        ? item["preferredModel"]
        : "openrouter:openai/gpt-4o-mini",
    customModels,
  };
}

function inferScope(symbol: string): { marketId: MarketId; assetClass: AssetClass } {
  if (symbol.endsWith("-USD")) return { marketId: "US", assetClass: "crypto" };
  if (symbol.endsWith("=X")) return { marketId: "US", assetClass: "forex" };
  if (symbol.endsWith(".NS") || symbol.endsWith(".BO"))
    return { marketId: "IN", assetClass: "equities" };
  return { marketId: "US", assetClass: "equities" };
}

function normalizeWatchlist(raw: unknown): WatchItem[] {
  if (!Array.isArray(raw)) return DEFAULT_WATCH;
  return raw.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const item = entry as Record<string, unknown>;
    const symbol = typeof item["symbol"] === "string" ? item["symbol"].toUpperCase() : "";
    if (!symbol) return [];
    const inferred = inferScope(symbol);
    const marketId =
      item["marketId"] === "US" || item["marketId"] === "IN" ? item["marketId"] : inferred.marketId;
    const assetClass = ["equities", "etfs", "crypto", "forex"].includes(String(item["assetClass"]))
      ? (item["assetClass"] as AssetClass)
      : inferred.assetClass;
    return [
      {
        symbol,
        name: typeof item["name"] === "string" ? item["name"] : symbol,
        sector: typeof item["sector"] === "string" ? item["sector"] : "",
        industry: typeof item["industry"] === "string" ? item["industry"] : "",
        marketId: marketId as MarketId,
        assetClass,
      },
    ];
  });
}

const DEFAULT_WATCH: WatchItem[] = [
  {
    symbol: "AAPL",
    name: "Apple Inc.",
    sector: "",
    industry: "",
    marketId: "US",
    assetClass: "equities",
  },
  {
    symbol: "NVDA",
    name: "NVIDIA Corp.",
    sector: "",
    industry: "",
    marketId: "US",
    assetClass: "equities",
  },
  {
    symbol: "TCS.NS",
    name: "Tata Consultancy Services",
    sector: "",
    industry: "",
    marketId: "IN",
    assetClass: "equities",
  },
];

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [market, setMarketState] = useState<MarketId>("US");
  const [assetClass, setAssetClassState] = useState<AssetClass>("equities");
  const [allWatchlist, setAllWatchlist] = useState<WatchItem[]>(DEFAULT_WATCH);
  const [alerts, setAlertsState] = useState<Alert[]>([]);
  const [allScreeners, setAllScreeners] = useState<SavedScreener[]>([]);
  const [apiKeys, setApiKeysState] = useState<ApiKeys>({
    openrouter: "",
    kilo: "",
    groq: "",
    together: "",
    deepseek: "",
    opencode: "",
    tinyfish: "",
    preferredModel: "openrouter:openai/gpt-4o-mini",
    customModels: [],
  });
  const [refreshSeconds, setRefreshState] = useState(60);
  const [theme, setThemeState] = useState<Theme>("paper");
  const [aiPrefill, setAiPrefillState] = useState<string | null>(null);
  const classify = useServerFn(classifySymbols);

  useEffect(() => {
    setMarketState(load<MarketId>("sc:market", "US"));
    setAssetClassState(load<AssetClass>("sc:asset-class", "equities"));
    setAllWatchlist(normalizeWatchlist(load<unknown>("sc:watchlist2", DEFAULT_WATCH)));
    setAlertsState(load<Alert[]>("sc:alerts", []));
    setAllScreeners(load<SavedScreener[]>("sc:screeners", []));
    setApiKeysState(normalizeApiKeys(load<unknown>("sc:apikeys", null)));
    setRefreshState(load<number>("sc:refresh", 60));
    setThemeState(load<Theme>("sc:theme", "paper"));
  }, []);

  useEffect(() => {
    document.documentElement.dataset["theme"] = theme;
    document.documentElement.classList.toggle("light", theme === "light");
    document.documentElement.classList.toggle("paper", theme === "paper");
  }, [theme]);

  useEffect(() => {
    const pending = allWatchlist
      .filter((w) => w.assetClass === "equities" && !w.sector)
      .map((w) => w.symbol);
    if (pending.length === 0) return;
    let cancelled = false;
    void classify({ data: { symbols: pending.join(",") } })
      .then((meta) => {
        if (cancelled || meta.length === 0) return;
        setAllWatchlist((prev) => {
          const next = prev.map((w) => {
            const m = meta.find((x) => x.symbol === w.symbol);
            if (!m) return w;
            return {
              ...w,
              name: m.name || w.name || w.symbol,
              sector: m.sector || "Uncategorised",
              industry: m.industry || "Other",
            };
          });
          save("sc:watchlist2", next);
          return next;
        });
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [allWatchlist, classify]);

  const persistWatch = useCallback((next: WatchItem[]) => {
    setAllWatchlist(next);
    save("sc:watchlist2", next);
  }, []);

  const value = useMemo<State>(() => {
    const scopedWatchlist = allWatchlist.filter(
      (w) => w.marketId === market && w.assetClass === assetClass,
    );
    const scopedScreeners = allScreeners.filter(
      (s) => (s.marketId ?? "US") === market && (s.assetClass ?? "equities") === assetClass,
    );
    const symbols = scopedWatchlist.map((w) => w.symbol);
    return {
      market,
      setMarket: (m) => {
        setMarketState(m);
        save("sc:market", m);
      },
      assetClass,
      setAssetClass: (next) => {
        setAssetClassState(next);
        save("sc:asset-class", next);
      },
      watchlist: scopedWatchlist,
      watchSymbols: symbols,
      isWatched: (s) => symbols.includes(s),
      addToWatchlist: (symbol, name) => {
        const normalized = symbol.toUpperCase();
        if (
          allWatchlist.some(
            (w) => w.symbol === normalized && w.marketId === market && w.assetClass === assetClass,
          )
        )
          return;
        persistWatch([
          ...allWatchlist,
          {
            symbol: normalized,
            name: name ?? normalized,
            sector: "",
            industry: "",
            marketId: market,
            assetClass,
          },
        ]);
      },
      removeFromWatchlist: (symbol) =>
        persistWatch(
          allWatchlist.filter(
            (w) => !(w.symbol === symbol && w.marketId === market && w.assetClass === assetClass),
          ),
        ),
      toggleWatchlist: (symbol, name) => {
        const normalized = symbol.toUpperCase();
        const exists = allWatchlist.some(
          (w) => w.symbol === normalized && w.marketId === market && w.assetClass === assetClass,
        );
        persistWatch(
          exists
            ? allWatchlist.filter(
                (w) =>
                  !(
                    w.symbol === normalized &&
                    w.marketId === market &&
                    w.assetClass === assetClass
                  ),
              )
            : [
                ...allWatchlist,
                {
                  symbol: normalized,
                  name: name ?? normalized,
                  sector: "",
                  industry: "",
                  marketId: market,
                  assetClass,
                },
              ],
        );
      },
      alerts,
      setAlerts: (a) => {
        setAlertsState(a);
        save("sc:alerts", a);
      },
      screeners: scopedScreeners,
      saveScreener: (s) => {
        const nextScreener: SavedScreener = {
          ...s,
          marketId: s.marketId ?? market,
          assetClass: s.assetClass ?? assetClass,
        };
        const next = [...allScreeners.filter((x) => x.id !== s.id), nextScreener];
        setAllScreeners(next);
        save("sc:screeners", next);
      },
      deleteScreener: (id) => {
        const next = allScreeners.filter((s) => s.id !== id);
        setAllScreeners(next);
        save("sc:screeners", next);
      },
      apiKeys,
      setApiKeys: (k) => {
        setApiKeysState(k);
        save("sc:apikeys", k);
      },
      refreshSeconds,
      setRefreshSeconds: (n) => {
        setRefreshState(n);
        save("sc:refresh", n);
      },
      theme,
      setTheme: (next) => {
        setThemeState(next);
        save("sc:theme", next);
      },
      aiPrefill,
      setAiPrefill: setAiPrefillState,
    };
  }, [
    market,
    assetClass,
    allWatchlist,
    alerts,
    allScreeners,
    apiKeys,
    refreshSeconds,
    theme,
    aiPrefill,
    persistWatch,
  ]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAppState() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAppState must be used inside AppStateProvider");
  return ctx;
}

export function useMarketConfig() {
  const { market } = useAppState();
  return MARKETS[market];
}
