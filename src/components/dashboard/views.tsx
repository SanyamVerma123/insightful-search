import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Bell, ExternalLink, Trash2 } from "lucide-react";
import { getMarketStrip, getNews } from "@/lib/finance.functions";
import { Sparkline } from "@/components/finance/Sparkline";
import { DeltaBadge } from "@/components/finance/DeltaBadge";
import { timeAgo } from "@/lib/format";
import { SCREENER_SYMS } from "@/lib/universe";
import { cn } from "@/lib/utils";

export type Alert = { id: string; symbol: string; above: boolean; price: number; enabled: boolean };

export function MarketStrip() {
  const fn = useServerFn(getMarketStrip);
  const { data } = useQuery({ queryKey: ["strip"], queryFn: () => fn(), staleTime: 60_000 });
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

export function NewsView() {
  const [symbol, setSymbol] = useState("AAPL");
  const fn = useServerFn(getNews);
  const { data, isLoading } = useQuery({
    queryKey: ["news", symbol],
    queryFn: () => fn({ data: { symbol } }),
    staleTime: 120_000,
  });

  return (
    <div className="space-y-4">
      <div className="no-scrollbar flex gap-2 overflow-x-auto">
        {SCREENER_SYMS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setSymbol(s)}
            className={cn(
              "shrink-0 rounded-full border px-3 py-1.5 text-xs transition-colors",
              symbol === s
                ? "border-primary/50 bg-primary/10 text-primary"
                : "border-border text-muted-foreground hover:text-foreground",
            )}
          >
            {s}
          </button>
        ))}
      </div>
      <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
        {isLoading && <p className="p-6 text-sm text-muted-foreground">Loading headlines…</p>}
        {(data ?? []).map((n) => (
          <a
            key={n.link}
            href={n.link}
            target="_blank"
            rel="noreferrer"
            className="block px-5 py-4 transition-colors hover:bg-accent/40"
          >
            <p className="text-sm font-medium text-foreground">{n.title}</p>
            <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{n.summary}</p>
            <p className="mt-2 flex items-center gap-2 text-[11px] text-muted-foreground">
              {n.publisher} · {timeAgo(n.pubDate)} <ExternalLink className="h-3 w-3" />
            </p>
          </a>
        ))}
        {!isLoading && (data ?? []).length === 0 && (
          <p className="p-6 text-sm text-muted-foreground">No headlines for {symbol}.</p>
        )}
      </div>
    </div>
  );
}

export function AlertsView({
  alerts,
  setAlerts,
}: {
  alerts: Alert[];
  setAlerts: (next: Alert[]) => void;
}) {
  const [symbol, setSymbol] = useState("AAPL");
  const [price, setPrice] = useState("");
  const [above, setAbove] = useState(true);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-card p-4">
        <p className="mb-3 text-sm font-medium text-foreground">New price alert</p>
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={symbol}
            onChange={(e) => setSymbol(e.target.value.toUpperCase())}
            placeholder="Symbol"
            className="h-9 w-32 rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-primary/60"
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

export function SettingsView({
  refreshSeconds,
  onRefreshSeconds,
}: {
  refreshSeconds: number;
  onRefreshSeconds: (n: number) => void;
}) {
  return (
    <div className="max-w-xl space-y-4">
      <div className="rounded-2xl border border-border bg-card p-5">
        <p className="text-sm font-medium text-foreground">Live data refresh</p>
        <p className="mt-1 text-xs text-muted-foreground">How often quote tables re-poll the market data service.</p>
        <div className="mt-3 flex gap-2">
          {[30, 60, 120, 300].map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => onRefreshSeconds(s)}
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
        <p className="text-sm font-medium text-foreground">Data source</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Live quotes, fundamentals, analyst data and news stream from the connected market data service. The AI
          analyst calls the same tools before answering.
        </p>
      </div>
    </div>
  );
}
