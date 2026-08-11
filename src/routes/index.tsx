import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { DashboardShell, PAGE_TITLES, type PageId } from "@/components/dashboard/DashboardShell";
import { QuoteTable } from "@/components/dashboard/QuoteTable";
import { AIView } from "@/components/dashboard/AIView";
import { AlertsView, MarketStrip, NewsView, SettingsView, type Alert } from "@/components/dashboard/views";
import {
  CalendarsView,
  EstimatesView,
  EtfScreenerView,
  FilingsView,
  GlobalMarketsView,
  MoversView,
  NewsSearchView,
  OptionsView,
  OwnershipView,
  ProScreenerView,
  SectorsView,
} from "@/components/dashboard/tool-views";
import {
  CRYPTO_SYMS,
  ETF_SYMS,
  FOREX_SYMS,
  IN_SYMS,
  PRESETS,
  SCREENER_SYMS,
  US_SYMS,
} from "@/lib/universe";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Screener Terminal — Live Markets, Screener & AI Analyst" },
      {
        name: "description",
        content:
          "A live market terminal: indices, screener presets, watchlist, alerts, news and an AI analyst that reads real fundamentals.",
      },
      { property: "og:title", content: "Screener Terminal — Live Markets & AI Analyst" },
      {
        property: "og:description",
        content: "Screener presets, watchlists, alerts, news and an AI analyst grounded in live market data.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Dashboard,
});

function useLocal<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(initial);
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(key);
      if (raw) setValue(JSON.parse(raw) as T);
    } catch {
      /* ignore */
    }
  }, [key]);
  const update = (next: T) => {
    setValue(next);
    try {
      window.localStorage.setItem(key, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  };
  return [value, update] as const;
}

function Dashboard() {
  const [page, setPage] = useState<PageId>("markets");
  const [watchlist, setWatchlist] = useLocal<string[]>("sc:watchlist", ["AAPL", "NVDA", "TCS.NS"]);
  const [alerts, setAlerts] = useLocal<Alert[]>("sc:alerts", []);
  const [refreshSeconds, setRefreshSeconds] = useLocal<number>("sc:refresh", 60);
  const qc = useQueryClient();

  const toggleWatch = (symbol: string) =>
    setWatchlist(watchlist.includes(symbol) ? watchlist.filter((s) => s !== symbol) : [...watchlist, symbol]);

  const table = (symbols: string[], filter?: Parameters<typeof QuoteTable>[0]["filter"], empty?: string) => (
    <QuoteTable
      symbols={symbols}
      {...(filter ? { filter } : {})}
      watchlist={watchlist}
      onToggleWatch={toggleWatch}
      {...(empty ? { emptyLabel: empty } : {})}
    />
  );

  const body = () => {
    if (page === "ai") return <AIView />;

    const inner = (() => {
      switch (page) {
        case "markets":
          return (
            <div className="space-y-6">
              <MarketStrip />
              <div>
                <h2 className="mb-3 text-sm font-semibold text-foreground">Your watchlist</h2>
                {table(watchlist, undefined, "Star a ticker to track it here.")}
              </div>
              <div>
                <h2 className="mb-3 text-sm font-semibold text-foreground">Most active</h2>
                {table(US_SYMS.slice(0, 6))}
              </div>
            </div>
          );
        case "screener":
          return table(SCREENER_SYMS);
        case "watchlist":
          return table(watchlist, undefined, "Star a ticker to track it here.");
        case "news":
          return <NewsView />;
        case "alerts":
          return <AlertsView alerts={alerts} setAlerts={setAlerts} />;
        case "settings":
          return <SettingsView refreshSeconds={refreshSeconds} onRefreshSeconds={setRefreshSeconds} />;
        case "equities":
          return table([...US_SYMS, ...IN_SYMS]);
        case "etfs":
          return table(ETF_SYMS);
        case "crypto":
          return table(CRYPTO_SYMS);
        case "forex":
          return table(FOREX_SYMS);
        case "movers":
          return <MoversView />;
        case "proscreener":
          return <ProScreenerView />;
        case "etfscreener":
          return <EtfScreenerView />;
        case "sectors":
          return <SectorsView />;
        case "calendars":
          return <CalendarsView />;
        case "globalmarkets":
          return <GlobalMarketsView />;
        case "options":
          return <OptionsView />;
        case "ownership":
          return <OwnershipView />;
        case "estimates":
          return <EstimatesView />;
        case "filings":
          return <FilingsView />;
        case "newssearch":
          return <NewsSearchView />;

        case "logout":
          return <p className="text-sm text-muted-foreground">Local session only — your data stays in this browser.</p>;
        default: {
          const preset = PRESETS[page];
          if (preset) return table(preset.syms, preset.test, "No tickers match this preset right now.");
          return table(SCREENER_SYMS);
        }
      }
    })();

    return (
      <div className="h-full overflow-y-auto px-6 py-6">
        <div className="mx-auto w-full max-w-6xl space-y-6">
          <h1 className="text-lg font-semibold tracking-tight text-foreground">{PAGE_TITLES[page] ?? "Markets"}</h1>
          {inner}
        </div>
      </div>
    );
  };

  return (
    <DashboardShell
      page={page}
      onNavigate={setPage}
      watchlistCount={watchlist.length}
      alertCount={alerts.filter((a) => a.enabled).length}
      onRefresh={() => void qc.invalidateQueries()}
    >
      {body()}
    </DashboardShell>
  );
}
