import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { Bell, ExternalLink, Star, Trash2 } from "lucide-react";
import { getMarketStrip, getNews, getWatchlistNews } from "@/lib/finance.functions";
import { Sparkline } from "@/components/finance/Sparkline";
import { DeltaBadge } from "@/components/finance/DeltaBadge";
import { TickerAutocomplete } from "@/components/finance/TickerAutocomplete";
import { QuoteTable } from "@/components/dashboard/QuoteTable";
import { timeAgo } from "@/lib/format";
import { useAppState, useMarketConfig } from "@/lib/app-state";
import { MARKETS, type MarketId } from "@/lib/markets";
import { cn } from "@/lib/utils";

export type Alert = { id: string; symbol: string; above: boolean; price: number; enabled: boolean };

export function MarketStrip() {
  const cfg = useMarketConfig();
  const fn = useServerFn(getMarketStrip);
  const { data } = useQuery({
    queryKey: ["strip", cfg.id],
    queryFn: () => fn({ data: { indices: cfg.indices } }),
    staleTime: 60_000,
  });
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {(data ?? []).map((ix) => (
        <div key={ix.key} className="rounded-2xl border border-border bg-card p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{ix.label}</p>
          <p className="tabular mt-1 text-xl font-semibold text-foreground">
            {ix.last === null ? "—" : ix.last.toLocaleString(undefined, { maximumFractionDigits: 2 })}
          </p>
          <DeltaBadge value={ix.changePercent} size="sm" />
          <div className="mt-2">
            <Sparkline points={ix.points} up={(ix.changePercent ?? 0) >= 0} />
          </div>
        </div>
      ))}
    </div>
  );
}

/* ---------------- Watchlist ---------------- */

export function WatchlistView() {
  const { watchlist, addToWatchlist, removeFromWatchlist, watchSymbols } = useAppState();

  const groups = useMemo(() => {
    const map = new Map<string, typeof watchlist>();
    for (const w of watchlist) {
      const key = w.sector || "Categorising…";
      map.set(key, [...(map.get(key) ?? []), w]);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [watchlist]);

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-border bg-card p-4">
        <p className="mb-2 text-sm font-medium text-foreground">Add a stock to your watchlist</p>
        <TickerAutocomplete
          className="max-w-md"
          onSelect={(symbol, name) => addToWatchlist(symbol, name)}
          placeholder="Search any company or ticker…"
        />
        <p className="mt-2 text-xs text-muted-foreground">
          New tickers are auto-categorised by sector and industry from live company data.
        </p>
      </div>

      {groups.length === 0 && (
        <p className="rounded-2xl border border-border bg-card p-8 text-sm text-muted-foreground">
          Your watchlist is empty — search above to add your first ticker.
        </p>
      )}

      {groups.map(([sector, items]) => (
        <section key={sector} className="space-y-2">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-foreground">{sector}</h2>
            <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] text-muted-foreground">{items.length}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {items.map((w) => (
              <span
                key={w.symbol}
                className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground"
              >
                <Link to="/stock/$symbol" params={{ symbol: w.symbol }} className="font-medium text-foreground">
                  {w.symbol}
                </Link>
                <span className="hidden sm:inline">{w.industry || "—"}</span>
                <button type="button" onClick={() => removeFromWatchlist(w.symbol)} className="hover:text-negative">
                  <Trash2 className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
          <QuoteTable
            symbols={items.map((i) => i.symbol)}
            watchlist={watchSymbols}
            onToggleWatch={(s) => removeFromWatchlist(s)}
          />
        </section>
      ))}
    </div>
  );
}

/* ---------------- News ---------------- */

export function NewsView() {
  const { watchSymbols } = useAppState();
  const [symbol, setSymbol] = useState<string | null>(null);
  const watchFn = useServerFn(getWatchlistNews);
  const oneFn = useServerFn(getNews);

  const { data: feed, isLoading } = useQuery({
    queryKey: ["watchnews", watchSymbols.join(",")],
    queryFn: () => watchFn({ data: { symbols: watchSymbols.join(",") } }),
    enabled: !symbol && watchSymbols.length > 0,
    staleTime: 120_000,
  });
  const { data: single, isLoading: loadingSingle } = useQuery({
    queryKey: ["news", symbol],
    queryFn: () => oneFn({ data: { symbol: symbol! } }),
    enabled: Boolean(symbol),
    staleTime: 120_000,
  });

  const items = symbol
    ? (single ?? []).map((n) => ({ ...n, symbol }))
    : (feed ?? []);
  const busy = symbol ? loadingSingle : isLoading;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-card p-4">
        <TickerAutocomplete
          className="w-full max-w-sm"
          onSelect={(s) => setSymbol(s)}
          placeholder="Search news for a specific company…"
        />
        <button
          type="button"
          onClick={() => setSymbol(null)}
          className={cn(
            "rounded-full border px-3 py-1.5 text-xs",
            symbol ? "border-border text-muted-foreground hover:text-foreground" : "border-primary/50 bg-primary/10 text-primary",
          )}
        >
          Watchlist feed
        </button>
        {symbol && (
          <span className="rounded-full border border-primary/50 bg-primary/10 px-3 py-1.5 text-xs text-primary">
            {symbol}
          </span>
        )}
      </div>

      <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
        {busy && <p className="p-6 text-sm text-muted-foreground">Loading headlines…</p>}
        {items.map((n) => (
          <a
            key={`${n.symbol}-${n.link}`}
            href={n.link}
            target="_blank"
            rel="noreferrer"
            className="block px-5 py-4 transition-colors hover:bg-accent/40"
          >
            <p className="text-sm font-medium text-foreground">
              <span className="mr-2 rounded bg-accent px-1.5 py-0.5 text-[10px] text-muted-foreground">{n.symbol}</span>
              {n.title}
            </p>
            <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{n.summary}</p>
            <p className="mt-2 flex items-center gap-2 text-[11px] text-muted-foreground">
              {n.publisher} · {timeAgo(n.pubDate)} <ExternalLink className="h-3 w-3" />
            </p>
          </a>
        ))}
        {!busy && items.length === 0 && (
          <p className="p-6 text-sm text-muted-foreground">
            {watchSymbols.length === 0 && !symbol
              ? "Add tickers to your watchlist to build a news feed."
              : "No headlines right now."}
          </p>
        )}
      </div>
    </div>
  );
}

/* ---------------- Alerts ---------------- */

export function AlertsView() {
  const { alerts, setAlerts, watchlist } = useAppState();
  const [symbol, setSymbol] = useState(watchlist[0]?.symbol ?? "AAPL");
  const [price, setPrice] = useState("");
  const [above, setAbove] = useState(true);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-card p-4">
        <p className="mb-3 text-sm font-medium text-foreground">New price alert</p>
        <div className="flex flex-wrap items-center gap-2">
          <TickerAutocomplete
            className="w-56"
            value={symbol}
            onSelect={(s) => setSymbol(s)}
            scope={watchlist.map((w) => ({ symbol: w.symbol, name: w.name }))}
            placeholder="Watchlist ticker"
          />
          <select
            value={above ? "above" : "below"}
            onChange={(e) => setAbove(e.target.value === "above")}
            className="h-9 rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none"
          >
            <option value="above">Rises above</option>
            <option value="below">Falls below</option>
          </select>
          <input
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="Price"
            inputMode="decimal"
            className="h-9 w-28 rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-primary/60"
          />
          <button
            type="button"
            disabled={!symbol || !Number(price)}
            onClick={() => {
              setAlerts([
                ...alerts,
                { id: crypto.randomUUID(), symbol, above, price: Number(price), enabled: true },
              ]);
              setPrice("");
            }}
            className="h-9 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            Create alert
          </button>
        </div>
      </div>

      <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
        {alerts.length === 0 && (
          <p className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
            <Bell className="h-4 w-4" /> No alerts yet.
          </p>
        )}
        {alerts.map((a) => (
          <div key={a.id} className="flex items-center gap-3 px-5 py-3.5">
            <span className="text-sm font-semibold text-foreground">{a.symbol}</span>
            <span className="text-sm text-muted-foreground">
              {a.above ? "rises above" : "falls below"} <span className="tabular text-foreground">{a.price}</span>
            </span>
            <button
              type="button"
              onClick={() => setAlerts(alerts.map((x) => (x.id === a.id ? { ...x, enabled: !x.enabled } : x)))}
              className={cn(
                "ml-auto rounded-full border px-2.5 py-1 text-[11px]",
                a.enabled ? "border-positive/40 text-positive" : "border-border text-muted-foreground",
              )}
            >
              {a.enabled ? "Active" : "Paused"}
            </button>
            <button
              type="button"
              onClick={() => setAlerts(alerts.filter((x) => x.id !== a.id))}
              className="rounded-md p-1.5 text-muted-foreground hover:text-negative"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------------- Settings ---------------- */

export function SettingsView() {
  const { refreshSeconds, setRefreshSeconds, market, setMarket, apiKeys, setApiKeys, screeners, deleteScreener } =
    useAppState();
  const [openrouter, setOpenrouter] = useState(apiKeys.openrouter);
  const [lovable, setLovable] = useState(apiKeys.lovable);
  const [saved, setSaved] = useState(false);

  const field =
    "mt-2 h-9 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-primary/60";

  return (
    <div className="max-w-2xl space-y-4">
      <div className="rounded-2xl border border-border bg-card p-5">
        <p className="text-sm font-medium text-foreground">Equity market</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Switches indices, equities and ETFs across the terminal. Crypto and forex stay global.
        </p>
        <div className="mt-3 flex gap-2">
          {(Object.keys(MARKETS) as MarketId[]).map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => setMarket(id)}
              className={cn(
                "rounded-lg border px-3 py-1.5 text-xs",
                market === id
                  ? "border-primary/50 bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {MARKETS[id].label}
            </button>
          ))}
        </div>
        {!MARKETS[market].supportsFilings && (
          <p className="mt-2 text-xs text-muted-foreground">
            SEC filings and ESG scores are unavailable for Indian listings, so those tools are hidden.
          </p>
        )}
      </div>

      <div className="rounded-2xl border border-border bg-card p-5">
        <p className="text-sm font-medium text-foreground">API keys</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Stored only in this browser and sent with your chat requests. Leave blank to use the built-in keys.
        </p>
        <label className="mt-3 block text-xs text-muted-foreground">
          OpenRouter API key
          <input
            value={openrouter}
            onChange={(e) => setOpenrouter(e.target.value)}
            type="password"
            placeholder="sk-or-v1-…"
            className={field}
          />
        </label>
        <label className="mt-3 block text-xs text-muted-foreground">
          Lovable AI key
          <input
            value={lovable}
            onChange={(e) => setLovable(e.target.value)}
            type="password"
            placeholder="Optional override"
            className={field}
          />
        </label>
        <button
          type="button"
          onClick={() => {
            setApiKeys({ openrouter: openrouter.trim(), lovable: lovable.trim() });
            setSaved(true);
            window.setTimeout(() => setSaved(false), 1800);
          }}
          className="mt-3 h-9 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground"
        >
          {saved ? "Saved" : "Save keys"}
        </button>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5">
        <p className="text-sm font-medium text-foreground">Live data refresh</p>
        <p className="mt-1 text-xs text-muted-foreground">How often quote tables re-poll the market data service.</p>
        <div className="mt-3 flex gap-2">
          {[30, 60, 120, 300].map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setRefreshSeconds(s)}
              className={cn(
                "rounded-lg border px-3 py-1.5 text-xs",
                refreshSeconds === s
                  ? "border-primary/50 bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {s}s
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5">
        <p className="text-sm font-medium text-foreground">Saved screeners</p>
        {screeners.length === 0 ? (
          <p className="mt-1 text-xs text-muted-foreground">
            Build one in the Screener and save it — it appears under Screener Presets.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {screeners.map((s) => (
              <li key={s.id} className="flex items-center gap-2 text-sm text-foreground">
                <Star className="h-3.5 w-3.5 text-primary" />
                {s.name}
                <button
                  type="button"
                  onClick={() => deleteScreener(s.id)}
                  className="ml-auto text-muted-foreground hover:text-negative"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
