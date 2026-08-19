import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { DashboardShell, PAGE_TITLES, type PageId } from "@/components/dashboard/DashboardShell";
import { QuoteTable } from "@/components/dashboard/QuoteTable";
import { AIView } from "@/components/dashboard/AIView";
import {
  AlertsView,
  MarketStrip,
  NewsView,
  SettingsView,
  WatchlistView,
} from "@/components/dashboard/views";
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
  SavedScreenerView,
  SectorsView,
} from "@/components/dashboard/tool-views";
import { useAppState, useMarketConfig } from "@/lib/app-state";
import { CRYPTO_SYMS, FOREX_SYMS } from "@/lib/markets";
import { PRESETS, symbolsForMarketPreset } from "@/lib/universe";

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
        content:
          "Screener presets, watchlists, alerts, news and an AI analyst grounded in live market data.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const [page, setPage] = useState<PageId>("markets");
  const { market, watchSymbols, toggleWatchlist, alerts, screeners } = useAppState();
  const cfg = useMarketConfig();
  const qc = useQueryClient();

  const table = (
    symbols: string[],
    filter?: Parameters<typeof QuoteTable>[0]["filter"],
    empty?: string,
  ) => (
    <QuoteTable
      symbols={symbols}
      {...(filter ? { filter } : {})}
      watchlist={watchSymbols}
      onToggleWatch={toggleWatchlist}
      {...(empty ? { emptyLabel: empty } : {})}
    />
  );

  const body = () => {
    if (page === "ai") return <AIView />;

    const saved = page.startsWith("saved:")
      ? screeners.find((s) => `saved:${s.id}` === page)
      : undefined;

    const inner = (() => {
      if (saved) return <SavedScreenerView filters={saved.filters} name={saved.name} />;
      switch (page) {
        case "markets":
          return (
            <div className="space-y-6">
              <div className="flex items-end justify-between gap-4 border-b border-border/60 pb-4">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
                    Market intelligence
                  </p>
                  <h2 className="mt-1 text-xl font-semibold tracking-tight text-foreground">
                    Momentum, breadth, and activity
                  </h2>
                  <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
                    Live market context for {cfg.label} equities, refreshed quietly in the
                    background.
                  </p>
                </div>
                <span className="quiet-live-indicator hidden shrink-0 items-center gap-1.5 text-[11px] text-muted-foreground sm:flex">
                  <span className="quiet-live-dot" aria-hidden="true" />
                  Live context
                </span>
              </div>
              <MarketStrip />
              <MoversView />
              <div>
                <h2 className="mb-3 text-sm font-semibold text-foreground">
                  Sector & industry detail
                </h2>
                <SectorsView />
              </div>
            </div>
          );
        case "watchlist":
          return <WatchlistView />;
        case "news":
          return <NewsView />;
        case "alerts":
          return <AlertsView />;
        case "settings":
          return <SettingsView />;
        case "equities":
          return table(cfg.equities);
        case "etfs":
          return table(cfg.etfs);
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
          return (
            <p className="text-sm text-muted-foreground">
              Local session only — your data stays in this browser.
            </p>
          );
        default: {
          const preset = PRESETS[page];
          if (preset) {
            return table(
              symbolsForMarketPreset(page, market),
              preset.test,
              "No tickers match this preset right now.",
            );
          }
          return <ProScreenerView />;
        }
      }
    })();

    return (
      <div className="h-full overflow-y-auto px-6 py-6">
        <div className="mx-auto w-full max-w-6xl space-y-6">
          <h1 className="text-lg font-semibold tracking-tight text-foreground">
            {saved?.name ?? PAGE_TITLES[page] ?? "Markets"}
          </h1>
          {inner}
        </div>
      </div>
    );
  };

  return (
    <DashboardShell
      page={page}
      onNavigate={setPage}
      watchlistCount={watchSymbols.length}
      alertCount={alerts.filter((a) => a.enabled).length}
      onRefresh={() => void qc.invalidateQueries()}
    >
      {body()}
    </DashboardShell>
  );
}
