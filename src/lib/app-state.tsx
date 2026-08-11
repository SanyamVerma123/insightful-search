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

export type WatchItem = {
  symbol: string;
  name: string;
  sector: string;
  industry: string;
};

export type Alert = { id: string; symbol: string; above: boolean; price: number; enabled: boolean };

export type ScreenerFilters = {
  region: string;
  sector: string;
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

export type SavedScreener = { id: string; name: string; filters: ScreenerFilters };

export type ApiKeys = { openrouter: string; lovable: string };

type State = {
  market: MarketId;
  setMarket: (m: MarketId) => void;
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

const DEFAULT_WATCH: WatchItem[] = [
  { symbol: "AAPL", name: "Apple Inc.", sector: "", industry: "" },
  { symbol: "NVDA", name: "NVIDIA Corp.", sector: "", industry: "" },
  { symbol: "TCS.NS", name: "Tata Consultancy Services", sector: "", industry: "" },
];

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [market, setMarketState] = useState<MarketId>("US");
  const [watchlist, setWatchlist] = useState<WatchItem[]>(DEFAULT_WATCH);
  const [alerts, setAlertsState] = useState<Alert[]>([]);
  const [screeners, setScreeners] = useState<SavedScreener[]>([]);
  const [apiKeys, setApiKeysState] = useState<ApiKeys>({ openrouter: "", lovable: "" });
  const [refreshSeconds, setRefreshState] = useState(60);
  const classify = useServerFn(classifySymbols);

  useEffect(() => {
    setMarketState(load<MarketId>("sc:market", "US"));
    setWatchlist(load<WatchItem[]>("sc:watchlist2", DEFAULT_WATCH));
    setAlertsState(load<Alert[]>("sc:alerts", []));
    setScreeners(load<SavedScreener[]>("sc:screeners", []));
    setApiKeysState(load<ApiKeys>("sc:apikeys", { openrouter: "", lovable: "" }));
    setRefreshState(load<number>("sc:refresh", 60));
  }, []);

  /* Auto-categorise new watchlist entries by sector / industry. */
  useEffect(() => {
    const pending = watchlist.filter((w) => !w.sector).map((w) => w.symbol);
    if (pending.length === 0) return;
    let cancelled = false;
    void classify({ data: { symbols: pending.join(",") } })
      .then((meta) => {
        if (cancelled || meta.length === 0) return;
        setWatchlist((prev) => {
          const next = prev.map((w) => {
            const m = meta.find((x) => x.symbol === w.symbol);
            if (!m) return w;
            return {
              symbol: w.symbol,
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
  }, [watchlist, classify]);

  const persistWatch = useCallback((next: WatchItem[]) => {
    setWatchlist(next);
    save("sc:watchlist2", next);
  }, []);

  const value = useMemo<State>(() => {
    const symbols = watchlist.map((w) => w.symbol);
    return {
      market,
      setMarket: (m) => {
        setMarketState(m);
        save("sc:market", m);
      },
      watchlist,
      watchSymbols: symbols,
      isWatched: (s) => symbols.includes(s),
      addToWatchlist: (symbol, name) => {
        if (symbols.includes(symbol)) return;
        persistWatch([...watchlist, { symbol, name: name ?? symbol, sector: "", industry: "" }]);
      },
      removeFromWatchlist: (symbol) => persistWatch(watchlist.filter((w) => w.symbol !== symbol)),
      toggleWatchlist: (symbol, name) => {
        if (symbols.includes(symbol)) persistWatch(watchlist.filter((w) => w.symbol !== symbol));
        else persistWatch([...watchlist, { symbol, name: name ?? symbol, sector: "", industry: "" }]);
      },
      alerts,
      setAlerts: (a) => {
        setAlertsState(a);
        save("sc:alerts", a);
      },
      screeners,
      saveScreener: (s) => {
        const next = [...screeners.filter((x) => x.id !== s.id), s];
        setScreeners(next);
        save("sc:screeners", next);
      },
      deleteScreener: (id) => {
        const next = screeners.filter((x) => x.id !== id);
        setScreeners(next);
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
    };
  }, [market, watchlist, alerts, screeners, apiKeys, refreshSeconds, persistWatch]);

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
