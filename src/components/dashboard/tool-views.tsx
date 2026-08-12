import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ExternalLink } from "lucide-react";
import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  getEstimates,
  getMarketCalendar,
  getMarketStatus,
  getMarketSummary,
  getOptionChain,
  getOptionExpirations,
  getOwnership,
  getSecFilings,
  getSectorOverview,
  getIndustryOverview,
  getSustainability,
  getValuationMeasures,
  listPredefinedScreeners,
  listSectors,
  runEquityScreener,
  runEtfScreener,
  runPredefinedScreener,
  searchNews,
} from "@/lib/finance.functions";
import { DataTable, Panel, ScreenerTable, StatementView } from "./tables";
import { DeltaBadge } from "@/components/finance/DeltaBadge";
import { TickerAutocomplete } from "@/components/finance/TickerAutocomplete";
import { fmtCompact, fmtPrice, timeAgo } from "@/lib/format";
import { useAppState, useMarketConfig, EMPTY_FILTERS, type ScreenerFilters } from "@/lib/app-state";
import { SECTOR_INDUSTRIES, SECTOR_KEYS, sectorLabel } from "@/lib/markets";
import { cn } from "@/lib/utils";

const field =
  "h-9 rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-primary/60";

function Chip({ active, children, onClick }: { active: boolean; children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "shrink-0 rounded-full border px-3 py-1.5 text-xs transition-colors",
        active
          ? "border-primary/50 bg-primary/10 text-primary"
          : "border-border text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

/** Ticker picker scoped to the watchlist — research tools only run on watched names. */
function WatchSymbolPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { watchlist, addToWatchlist } = useAppState();
  if (watchlist.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-card p-4">
        <p className="text-sm text-foreground">Add a stock to your watchlist to use this tool.</p>
        <TickerAutocomplete className="mt-3 max-w-sm" onSelect={(s, n) => addToWatchlist(s, n)} />
      </div>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      <TickerAutocomplete
        className="w-64"
        value={value}
        scope={watchlist.map((w) => ({ symbol: w.symbol, name: w.name }))}
        onSelect={onChange}
        placeholder="Watchlist ticker"
      />
      <div className="no-scrollbar flex gap-2 overflow-x-auto">
        {watchlist.slice(0, 12).map((w) => (
          <Chip key={w.symbol} active={w.symbol === value} onClick={() => onChange(w.symbol)}>
            {w.symbol}
          </Chip>
        ))}
      </div>
    </div>
  );
}

function useWatchSymbol() {
  const { watchlist } = useAppState();
  const [symbol, setSymbol] = useState(watchlist[0]?.symbol ?? "AAPL");
  return [symbol, setSymbol] as const;
}

/* ---------------- Movers ---------------- */

export function MoversView() {
  const listFn = useServerFn(listPredefinedScreeners);
  const runFn = useServerFn(runPredefinedScreener);
  const [name, setName] = useState("day_gainers");

  const { data: names } = useQuery({ queryKey: ["screeners"], queryFn: () => listFn(), staleTime: 600_000 });
  const { data, isLoading } = useQuery({
    queryKey: ["screen", name],
    queryFn: () => runFn({ data: { name, size: 25 } }),
    staleTime: 60_000,
  });

  return (
    <div className="space-y-4">
      <div className="no-scrollbar flex gap-2 overflow-x-auto">
        {(names ?? ["day_gainers", "day_losers", "most_actives"]).map((n) => (
          <Chip key={n} active={n === name} onClick={() => setName(n)}>
            {n.replace(/_/g, " ")}
          </Chip>
        ))}
      </div>
      <Panel title={name.replace(/_/g, " ")} subtitle="Live predefined market screener">
        <ScreenerTable rows={data} loading={isLoading} />
      </Panel>
    </div>
  );
}

/* ---------------- Screener builder ---------------- */

function Num({
  label,
  value,
  onChange,
  placeholder,
  width = "w-32",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  width?: string;
}) {
  return (
    <label className="text-xs text-muted-foreground">
      {label}
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? "any"}
        className={cn(field, "mt-1 block", width)}
      />
    </label>
  );
}

function toParams(f: ScreenerFilters) {
  const n = (v: string) => (v.trim() === "" || Number.isNaN(Number(v)) ? undefined : Number(v));
  return {
    region: f.region,
    size: f.size,
    ...(f.sector ? { sector: f.sector } : {}),
    ...(f.exchange ? { exchange: f.exchange } : {}),
    ...(f.nameContains ? { nameContains: f.nameContains } : {}),
    ...(n(f.minMarketCap) !== undefined ? { minMarketCap: n(f.minMarketCap) } : {}),
    ...(n(f.maxMarketCap) !== undefined ? { maxMarketCap: n(f.maxMarketCap) } : {}),
    ...(n(f.minPe) !== undefined ? { minPe: n(f.minPe) } : {}),
    ...(n(f.maxPe) !== undefined ? { maxPe: n(f.maxPe) } : {}),
    ...(n(f.minGrowth) !== undefined ? { minGrowth: n(f.minGrowth) } : {}),
    ...(n(f.minDividendYield) !== undefined ? { minDividendYield: n(f.minDividendYield) } : {}),
    ...(n(f.minPrice) !== undefined ? { minPrice: n(f.minPrice) } : {}),
    ...(n(f.maxPrice) !== undefined ? { maxPrice: n(f.maxPrice) } : {}),
    ...(n(f.minVolume) !== undefined ? { minVolume: n(f.minVolume) } : {}),
    ...(n(f.minChangePercent) !== undefined ? { minChangePercent: n(f.minChangePercent) } : {}),
    ...(n(f.maxChangePercent) !== undefined ? { maxChangePercent: n(f.maxChangePercent) } : {}),
    sortField: f.sortField,
    sortAscending: f.sortAscending,
  };
}

/** Read-only run of a saved screener preset. */
export function SavedScreenerView({ filters, name }: { filters: ScreenerFilters; name: string }) {
  const runFn = useServerFn(runEquityScreener);
  const params = toParams(filters);
  const { data, isLoading } = useQuery({
    queryKey: ["saved-screen", JSON.stringify(params)],
    queryFn: () => runFn({ data: params }),
    staleTime: 120_000,
  });
  return (
    <Panel title={name} subtitle="Saved custom screener — re-run live on every visit">
      <ScreenerTable rows={data} loading={isLoading} />
    </Panel>
  );
}

export function ProScreenerView() {
  const cfg = useMarketConfig();
  const { saveScreener, screeners, deleteScreener } = useAppState();
  const runFn = useServerFn(runEquityScreener);
  const sectorsFn = useServerFn(listSectors);
  const { data: sectors } = useQuery({ queryKey: ["sectors"], queryFn: () => sectorsFn(), staleTime: 600_000 });

  const [f, setF] = useState<ScreenerFilters>({ ...EMPTY_FILTERS, region: cfg.region });
  const [runs, setRuns] = useState(0);
  const [name, setName] = useState("");
  const set = <K extends keyof ScreenerFilters>(k: K, v: ScreenerFilters[K]) => setF((p) => ({ ...p, [k]: v }));

  const params = toParams(f);
  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["proscreen", runs, JSON.stringify(params)],
    queryFn: () => runFn({ data: params }),
    staleTime: 120_000,
  });

  const sectorOptions = sectors && sectors.length > 0 ? sectors : [...SECTOR_KEYS];

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-xs text-muted-foreground">
            Region
            <select value={f.region} onChange={(e) => set("region", e.target.value)} className={cn(field, "mt-1 block w-24")}>
              {["us", "in", "gb", "de", "jp", "hk", "ca", "au", "fr"].map((r) => (
                <option key={r} value={r}>
                  {r.toUpperCase()}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-muted-foreground">
            Sector
            <select value={f.sector} onChange={(e) => set("sector", e.target.value)} className={cn(field, "mt-1 block w-48")}>
              <option value="">Any sector</option>
              {sectorOptions.map((s) => (
                <option key={s} value={s}>
                  {sectorLabel(s)}
                </option>
              ))}
            </select>
          </label>
          <Num label="Min market cap" value={f.minMarketCap} onChange={(v) => set("minMarketCap", v)} width="w-36" />
          <Num label="Max market cap" value={f.maxMarketCap} onChange={(v) => set("maxMarketCap", v)} width="w-36" />
          <Num label="Min P/E" value={f.minPe} onChange={(v) => set("minPe", v)} width="w-24" />
          <Num label="Max P/E" value={f.maxPe} onChange={(v) => set("maxPe", v)} width="w-24" />
          <Num label="Min growth %" value={f.minGrowth} onChange={(v) => set("minGrowth", v)} width="w-28" />
          <Num label="Min div. yield %" value={f.minDividendYield} onChange={(v) => set("minDividendYield", v)} width="w-32" />
          <Num label="Min price" value={f.minPrice} onChange={(v) => set("minPrice", v)} width="w-24" />
          <Num label="Max price" value={f.maxPrice} onChange={(v) => set("maxPrice", v)} width="w-24" />
          <Num label="Min volume" value={f.minVolume} onChange={(v) => set("minVolume", v)} width="w-32" />
          <Num label="Min day %" value={f.minChangePercent} onChange={(v) => set("minChangePercent", v)} width="w-24" />
          <Num label="Max day %" value={f.maxChangePercent} onChange={(v) => set("maxChangePercent", v)} width="w-24" />
          <label className="text-xs text-muted-foreground">
            Exchange contains
            <input value={f.exchange} onChange={(e) => set("exchange", e.target.value)} placeholder="NMS, NSI…" className={cn(field, "mt-1 block w-32")} />
          </label>
          <label className="text-xs text-muted-foreground">
            Name contains
            <input value={f.nameContains} onChange={(e) => set("nameContains", e.target.value)} placeholder="any" className={cn(field, "mt-1 block w-36")} />
          </label>
          <label className="text-xs text-muted-foreground">
            Sort by
            <select value={f.sortField} onChange={(e) => set("sortField", e.target.value)} className={cn(field, "mt-1 block w-44")}>
              {[
                ["intradaymarketcap", "Market cap"],
                ["percentchange", "Day change %"],
                ["dayvolume", "Volume"],
                ["peratio.lasttwelvemonths", "P/E"],
                ["intradayprice", "Price"],
              ].map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-muted-foreground">
            Order
            <select
              value={f.sortAscending ? "asc" : "desc"}
              onChange={(e) => set("sortAscending", e.target.value === "asc")}
              className={cn(field, "mt-1 block w-28")}
            >
              <option value="desc">Descending</option>
              <option value="asc">Ascending</option>
            </select>
          </label>
          <Num label="Results" value={String(f.size)} onChange={(v) => set("size", Number(v) || 50)} width="w-24" />

          <button
            type="button"
            onClick={() => setRuns((r) => r + 1)}
            className="h-9 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground"
          >
            Run screen
          </button>
          <button
            type="button"
            onClick={() => setF({ ...EMPTY_FILTERS, region: cfg.region })}
            className="h-9 rounded-lg border border-border px-4 text-sm text-muted-foreground hover:text-foreground"
          >
            Reset
          </button>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-4">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Name this screener"
            className={cn(field, "w-56")}
          />
          <button
            type="button"
            disabled={!name.trim()}
            onClick={() => {
              saveScreener({ id: crypto.randomUUID(), name: name.trim(), filters: f });
              setName("");
            }}
            className="h-9 rounded-lg border border-primary/50 bg-primary/10 px-4 text-sm font-medium text-primary disabled:opacity-50"
          >
            Save to presets
          </button>
          {screeners.map((s) => (
            <span key={s.id} className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1 text-xs text-muted-foreground">
              <button type="button" onClick={() => setF(s.filters)} className="hover:text-foreground">
                {s.name}
              </button>
              <button type="button" onClick={() => deleteScreener(s.id)} className="hover:text-negative">
                ×
              </button>
            </span>
          ))}
        </div>
      </div>

      <Panel title="Screen results" subtitle="Live equity screener from the market data service">
        <ScreenerTable rows={data} loading={isLoading || isFetching} />
      </Panel>
    </div>
  );
}

export function EtfScreenerView() {
  const cfg = useMarketConfig();
  const fn = useServerFn(runEtfScreener);
  const [region, setRegion] = useState(cfg.region);
  const { data, isLoading } = useQuery({
    queryKey: ["etfscreen", region],
    queryFn: () => fn({ data: { region, size: 30 } }),
    staleTime: 300_000,
  });
  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {["us", "in", "gb"].map((r) => (
          <Chip key={r} active={r === region} onClick={() => setRegion(r)}>
            {r.toUpperCase()}
          </Chip>
        ))}
      </div>
      <Panel title="ETF screener">
        <ScreenerTable rows={data} loading={isLoading} />
      </Panel>
    </div>
  );
}

/* ---------------- Sectors & industries ---------------- */

function numeric(v: string | undefined) {
  if (!v) return null;
  const n = Number(String(v).replace(/[%,+]/g, ""));
  return Number.isFinite(n) ? n : null;
}

/** Horizontal bar chart from a generic table column. */
export function TableBarChart({
  table,
  labelKey,
  valueKey,
  height = 280,
}: {
  table?: { columns: string[]; rows: Record<string, string>[] } | undefined;
  labelKey?: string;
  valueKey?: string;
  height?: number;
}) {
  if (!table || table.rows.length === 0) return <p className="p-5 text-sm text-muted-foreground">No data to plot.</p>;
  const label = labelKey ?? table.columns[0]!;
  const value =
    valueKey ??
    table.columns.find((c) => /change|perf|weight|return|%/i.test(c)) ??
    table.columns[1] ??
    table.columns[0]!;
  const data = table.rows
    .map((r) => ({ name: r[label] ?? "", value: numeric(r[value]) }))
    .filter((d): d is { name: string; value: number } => d.value !== null)
    .slice(0, 15);
  if (data.length === 0) return <p className="p-5 text-sm text-muted-foreground">No numeric column to plot.</p>;

  return (
    <div className="p-4" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ left: 24, right: 16, top: 4, bottom: 4 }}>
          <XAxis type="number" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
          <YAxis
            type="category"
            dataKey="name"
            width={140}
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            cursor={{ fill: "var(--accent)" }}
            contentStyle={{
              background: "var(--card)",
              border: "1px solid var(--border)",
              borderRadius: 12,
              fontSize: 12,
            }}
          />
          <Bar dataKey="value" radius={[0, 4, 4, 0]}>
            {data.map((d, i) => (
              <Cell key={i} fill={d.value >= 0 ? "var(--positive)" : "var(--negative)"} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function SectorsView() {
  const overviewFn = useServerFn(getSectorOverview);
  const industryFn = useServerFn(getIndustryOverview);
  const cfg = useMarketConfig();
  const [sector, setSector] = useState("technology");
  const [industry, setIndustry] = useState<string | null>(null);

  const { data } = useQuery({
    queryKey: ["sector", sector, cfg.id],
    queryFn: () => overviewFn({ data: { sectorKey: sector, region: cfg.id } }),
    staleTime: 300_000,
  });
  const { data: ind } = useQuery({
    queryKey: ["industry", industry, cfg.id],
    queryFn: () => industryFn({ data: { industryKey: industry!, region: cfg.id } }),
    enabled: Boolean(industry),
    staleTime: 300_000,
  });

  return (
    <div className="space-y-4">
      <div className="no-scrollbar flex gap-2 overflow-x-auto">
        {SECTOR_KEYS.map((s) => (
          <Chip
            key={s}
            active={s === sector}
            onClick={() => {
              setSector(s);
              setIndustry(null);
            }}
          >
            {sectorLabel(s)}
          </Chip>
        ))}
      </div>

      {data && (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            ["Market cap", fmtCompact(data.marketCap)],
            ["Companies", data.companiesCount?.toLocaleString() ?? "—"],
            ["Industries", data.industriesCount?.toLocaleString() ?? "—"],
            ["Market weight", data.marketWeight === null ? "—" : `${(data.marketWeight * 100).toFixed(1)}%`],
          ].map(([label, value]) => (
            <div key={label} className="rounded-2xl border border-border bg-card p-4">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
              <p className="tabular mt-1 text-lg font-semibold text-foreground">{value}</p>
            </div>
          ))}
        </div>
      )}

      {data?.description && (
        <p className="rounded-2xl border border-border bg-card p-5 text-sm leading-relaxed text-muted-foreground">
          {data.description}
        </p>
      )}

      <Panel title="Industry performance" subtitle="Relative performance inside the sector">
        <TableBarChart table={data?.industries} />
      </Panel>

      <div className="no-scrollbar flex gap-2 overflow-x-auto">
        {(SECTOR_INDUSTRIES[sector] ?? []).map((i) => (
          <Chip key={i} active={i === industry} onClick={() => setIndustry(i === industry ? null : i)}>
            {sectorLabel(i)}
          </Chip>
        ))}
      </div>

      {industry && (
        <>
          <Panel title={`${sectorLabel(industry)} — top companies`}>
            <TableBarChart table={ind?.topPerforming ?? ind?.topCompanies} />
          </Panel>
          <Panel title={`${sectorLabel(industry)} — companies`}>
            <DataTable table={ind?.topCompanies} />
          </Panel>
          <Panel title="Growth companies">
            <DataTable table={ind?.topGrowth} />
          </Panel>
        </>
      )}

      <Panel title="Top companies">
        <DataTable table={data?.topCompanies} />
      </Panel>
      <Panel title="Top ETFs">
        <DataTable table={data?.topEtfs} />
      </Panel>
      <Panel title="Industries">
        <DataTable table={data?.industries} />
      </Panel>
    </div>
  );
}

/* ---------------- Calendars ---------------- */

const CALENDARS = [
  { key: "earnings", label: "Earnings" },
  { key: "ipo", label: "IPOs" },
  { key: "splits", label: "Splits" },
  { key: "economic", label: "Economic events" },
] as const;

export function CalendarsView() {
  const fn = useServerFn(getMarketCalendar);
  const [kind, setKind] = useState<(typeof CALENDARS)[number]["key"]>("earnings");
  const { data, isLoading } = useQuery({
    queryKey: ["cal", kind],
    queryFn: () => fn({ data: { kind } }),
    staleTime: 300_000,
  });
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {CALENDARS.map((c) => (
          <Chip key={c.key} active={c.key === kind} onClick={() => setKind(c.key)}>
            {c.label}
          </Chip>
        ))}
      </div>
      <Panel title={`${CALENDARS.find((c) => c.key === kind)?.label} calendar`}>
        {isLoading ? <p className="p-5 text-sm text-muted-foreground">Loading calendar…</p> : <DataTable table={data} />}
      </Panel>
    </div>
  );
}

/* ---------------- Market summary / status ---------------- */

export function GlobalMarketsView() {
  const summaryFn = useServerFn(getMarketSummary);
  const statusFn = useServerFn(getMarketStatus);
  const [market, setMarket] = useState("US");
  const { data: summary } = useQuery({
    queryKey: ["summary", market],
    queryFn: () => summaryFn({ data: { market } }),
    staleTime: 60_000,
  });
  const { data: status } = useQuery({
    queryKey: ["status", market],
    queryFn: () => statusFn({ data: { market } }),
    staleTime: 60_000,
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {["US", "IN", "GB", "DE", "JP", "HK"].map((m) => (
          <Chip key={m} active={m === market} onClick={() => setMarket(m)}>
            {m}
          </Chip>
        ))}
      </div>
      {status && (
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="text-sm font-medium text-foreground">
            {status.name} ·{" "}
            <span className={status.status === "open" ? "text-positive" : "text-muted-foreground"}>{status.status}</span>
          </p>
          <p className="mt-1 text-xs text-muted-foreground">{status.message}</p>
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {(summary ?? []).map((q) => (
          <div key={q.name} className="rounded-2xl border border-border bg-card p-4">
            <p className="truncate text-xs uppercase tracking-wider text-muted-foreground">{q.name}</p>
            <p className="tabular mt-1 text-lg font-semibold text-foreground">{fmtPrice(q.price)}</p>
            <DeltaBadge value={q.changePercent} size="sm" />
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------------- Options ---------------- */

export function OptionsView() {
  const expFn = useServerFn(getOptionExpirations);
  const chainFn = useServerFn(getOptionChain);
  const [symbol, setSymbol] = useWatchSymbol();
  const [expiration, setExpiration] = useState<string | null>(null);

  const { data: expirations } = useQuery({
    queryKey: ["exp", symbol],
    queryFn: () => expFn({ data: { symbol } }),
    staleTime: 300_000,
  });
  const active = expiration ?? expirations?.[0] ?? null;
  const { data: chain, isLoading } = useQuery({
    queryKey: ["chain", symbol, active],
    queryFn: () => chainFn({ data: { symbol, expiration: active! } }),
    enabled: Boolean(active),
    staleTime: 120_000,
  });

  return (
    <div className="space-y-4">
      <WatchSymbolPicker
        value={symbol}
        onChange={(v) => {
          setSymbol(v);
          setExpiration(null);
        }}
      />
      <div className="no-scrollbar flex gap-2 overflow-x-auto">
        {(expirations ?? []).map((e) => (
          <Chip key={e} active={e === active} onClick={() => setExpiration(e)}>
            {e}
          </Chip>
        ))}
      </div>
      <Panel title={`Calls · ${symbol} ${active ?? ""}`}>
        {isLoading ? <p className="p-5 text-sm text-muted-foreground">Loading chain…</p> : <DataTable table={chain?.calls} />}
      </Panel>
      <Panel title={`Puts · ${symbol} ${active ?? ""}`}>
        <DataTable table={chain?.puts} />
      </Panel>
    </div>
  );
}

/* ---------------- Ownership ---------------- */

export function OwnershipView() {
  const fn = useServerFn(getOwnership);
  const [symbol, setSymbol] = useWatchSymbol();
  const { data } = useQuery({ queryKey: ["own", symbol], queryFn: () => fn({ data: { symbol } }), staleTime: 300_000 });
  return (
    <div className="space-y-4">
      <WatchSymbolPicker value={symbol} onChange={setSymbol} />
      <Panel title="Institutional ownership split">
        <TableBarChart table={data?.institutional} height={320} />
      </Panel>
      <Panel title="Major holders">
        <DataTable table={data?.major} />
      </Panel>
      <Panel title="Institutional holders">
        <DataTable table={data?.institutional} />
      </Panel>
      <Panel title="Mutual fund holders">
        <DataTable table={data?.funds} />
      </Panel>
      <Panel title="Insider transactions">
        <DataTable table={data?.insider} empty="No insider activity reported (common outside the US)." />
      </Panel>
    </div>
  );
}

/* ---------------- Estimates & valuation ---------------- */

export function EstimatesView() {
  const estFn = useServerFn(getEstimates);
  const valFn = useServerFn(getValuationMeasures);
  const [symbol, setSymbol] = useWatchSymbol();
  const { data } = useQuery({ queryKey: ["est", symbol], queryFn: () => estFn({ data: { symbol } }), staleTime: 300_000 });
  const { data: valuation } = useQuery({
    queryKey: ["val", symbol],
    queryFn: () => valFn({ data: { symbol } }),
    staleTime: 300_000,
  });
  return (
    <div className="space-y-4">
      <WatchSymbolPicker value={symbol} onChange={setSymbol} />
      <Panel title="EPS estimate trend">
        <TableBarChart table={data?.eps} />
      </Panel>
      <Panel title="Valuation measures">
        <StatementView table={valuation} />
      </Panel>
      <Panel title="EPS estimates">
        <DataTable table={data?.eps} />
      </Panel>
      <Panel title="Revenue estimates">
        <DataTable table={data?.revenue} />
      </Panel>
      <Panel title="Growth estimates">
        <DataTable table={data?.growth} />
      </Panel>
      <Panel title="EPS trend">
        <DataTable table={data?.epsTrend} />
      </Panel>
      <Panel title="EPS revisions">
        <DataTable table={data?.epsRevisions} />
      </Panel>
    </div>
  );
}

/* ---------------- Filings & ESG (US only) ---------------- */

export function FilingsView() {
  const filingsFn = useServerFn(getSecFilings);
  const esgFn = useServerFn(getSustainability);
  const [symbol, setSymbol] = useWatchSymbol();
  const { data: filings } = useQuery({
    queryKey: ["filings", symbol],
    queryFn: () => filingsFn({ data: { symbol } }),
    staleTime: 300_000,
  });
  const { data: esg } = useQuery({ queryKey: ["esg", symbol], queryFn: () => esgFn({ data: { symbol } }), staleTime: 300_000 });
  return (
    <div className="space-y-4">
      <WatchSymbolPicker value={symbol} onChange={setSymbol} />
      <Panel title="SEC filings" subtitle="US-listed companies only">
        <DataTable table={filings} empty="No filings found for this listing." />
      </Panel>
      <Panel title="ESG / sustainability">
        <DataTable table={esg} empty="No ESG coverage for this ticker." />
      </Panel>
    </div>
  );
}

/* ---------------- News search ---------------- */

export function NewsSearchView() {
  const fn = useServerFn(searchNews);
  const [query, setQuery] = useState("stock market");
  const { data, isLoading } = useQuery({
    queryKey: ["newssearch", query],
    queryFn: () => fn({ data: { query } }),
    staleTime: 120_000,
  });

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-card p-4">
        <TickerAutocomplete
          className="max-w-md"
          onSelect={(s, n) => setQuery(n ? `${s} ${n}` : s)}
          placeholder="Search a company for news…"
        />
      </div>
      <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
        {isLoading && <p className="p-6 text-sm text-muted-foreground">Searching…</p>}
        {(data ?? []).map((n) => (
          <a key={n.link} href={n.link} target="_blank" rel="noreferrer" className="block px-5 py-4 hover:bg-accent/40">
            <p className="text-sm font-medium text-foreground">{n.title}</p>
            <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{n.summary}</p>
            <p className="mt-2 flex items-center gap-2 text-[11px] text-muted-foreground">
              {n.publisher} · {timeAgo(n.pubDate)} <ExternalLink className="h-3 w-3" />
            </p>
          </a>
        ))}
        {!isLoading && (data ?? []).length === 0 && <p className="p-6 text-sm text-muted-foreground">No results.</p>}
      </div>
    </div>
  );
}
