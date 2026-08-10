import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ExternalLink, Search } from "lucide-react";
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
import { fmtCompact, fmtPrice, timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";

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

function SymbolInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [draft, setDraft] = useState(value);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onChange(draft.trim().toUpperCase());
      }}
      className="flex items-center gap-2"
    >
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder="Ticker (AAPL, RELIANCE.NS)"
        className="h-9 w-56 rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-primary/60"
      />
      <button type="submit" className="h-9 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground">
        Load
      </button>
    </form>
  );
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
      <Panel title={name.replace(/_/g, " ")} subtitle="Live Yahoo Finance predefined screener">
        <ScreenerTable rows={data} loading={isLoading} />
      </Panel>
    </div>
  );
}

/* ---------------- Pro screener ---------------- */

export function ProScreenerView() {
  const runFn = useServerFn(runEquityScreener);
  const sectorsFn = useServerFn(listSectors);
  const { data: sectors } = useQuery({ queryKey: ["sectors"], queryFn: () => sectorsFn(), staleTime: 600_000 });

  const [region, setRegion] = useState("us");
  const [minCap, setMinCap] = useState("1000000000");
  const [maxPe, setMaxPe] = useState("");
  const [minGrowth, setMinGrowth] = useState("");
  const [minYield, setMinYield] = useState("");
  const [sector, setSector] = useState("");
  const [query, setQuery] = useState(0);

  const params = {
    region,
    ...(Number(minCap) ? { minMarketCap: Number(minCap) } : {}),
    ...(Number(maxPe) ? { maxPe: Number(maxPe) } : {}),
    ...(Number(minGrowth) ? { minGrowth: Number(minGrowth) } : {}),
    ...(Number(minYield) ? { minDividendYield: Number(minYield) } : {}),
    ...(sector ? { sector } : {}),
    size: 30,
  };

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["proscreen", query, JSON.stringify(params)],
    queryFn: () => runFn({ data: params }),
    staleTime: 120_000,
  });

  const field = "h-9 rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-primary/60";

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-xs text-muted-foreground">
            Region
            <select value={region} onChange={(e) => setRegion(e.target.value)} className={cn(field, "mt-1 block w-28")}>
              {["us", "in", "gb", "de", "jp", "hk"].map((r) => (
                <option key={r} value={r}>
                  {r.toUpperCase()}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-muted-foreground">
            Min market cap
            <input value={minCap} onChange={(e) => setMinCap(e.target.value)} className={cn(field, "mt-1 block w-40")} />
          </label>
          <label className="text-xs text-muted-foreground">
            Max P/E
            <input value={maxPe} onChange={(e) => setMaxPe(e.target.value)} placeholder="any" className={cn(field, "mt-1 block w-24")} />
          </label>
          <label className="text-xs text-muted-foreground">
            Min growth
            <input value={minGrowth} onChange={(e) => setMinGrowth(e.target.value)} placeholder="0.1" className={cn(field, "mt-1 block w-24")} />
          </label>
          <label className="text-xs text-muted-foreground">
            Min div. yield
            <input value={minYield} onChange={(e) => setMinYield(e.target.value)} placeholder="0.02" className={cn(field, "mt-1 block w-28")} />
          </label>
          <label className="text-xs text-muted-foreground">
            Sector
            <select value={sector} onChange={(e) => setSector(e.target.value)} className={cn(field, "mt-1 block w-52")}>
              <option value="">Any sector</option>
              {(sectors ?? []).map((s) => (
                <option key={s} value={s}>
                  {s.replace(/-/g, " ")}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={() => setQuery((q) => q + 1)}
            className="h-9 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground"
          >
            Run screen
          </button>
        </div>
      </div>
      <Panel title="Screen results" subtitle="Live equity screener from the market data service">
        <ScreenerTable rows={data} loading={isLoading || isFetching} />
      </Panel>
    </div>
  );
}

export function EtfScreenerView() {
  const fn = useServerFn(runEtfScreener);
  const [region, setRegion] = useState("us");
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

/* ---------------- Sectors ---------------- */

export function SectorsView() {
  const listFn = useServerFn(listSectors);
  const overviewFn = useServerFn(getSectorOverview);
  const [sector, setSector] = useState("technology");
  const { data: sectors } = useQuery({ queryKey: ["sectors"], queryFn: () => listFn(), staleTime: 600_000 });
  const { data } = useQuery({
    queryKey: ["sector", sector],
    queryFn: () => overviewFn({ data: { sectorKey: sector } }),
    staleTime: 300_000,
  });

  return (
    <div className="space-y-4">
      <div className="no-scrollbar flex gap-2 overflow-x-auto">
        {(sectors ?? []).map((s) => (
          <Chip key={s} active={s === sector} onClick={() => setSector(s)}>
            {s.replace(/-/g, " ")}
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
  const [symbol, setSymbol] = useState("AAPL");
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
      <SymbolInput
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
  const [symbol, setSymbol] = useState("AAPL");
  const { data } = useQuery({ queryKey: ["own", symbol], queryFn: () => fn({ data: { symbol } }), staleTime: 300_000 });
  return (
    <div className="space-y-4">
      <SymbolInput value={symbol} onChange={setSymbol} />
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
  const [symbol, setSymbol] = useState("AAPL");
  const { data } = useQuery({ queryKey: ["est", symbol], queryFn: () => estFn({ data: { symbol } }), staleTime: 300_000 });
  const { data: valuation } = useQuery({
    queryKey: ["val", symbol],
    queryFn: () => valFn({ data: { symbol } }),
    staleTime: 300_000,
  });
  return (
    <div className="space-y-4">
      <SymbolInput value={symbol} onChange={setSymbol} />
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

/* ---------------- Filings & ESG ---------------- */

export function FilingsView() {
  const filingsFn = useServerFn(getSecFilings);
  const esgFn = useServerFn(getSustainability);
  const [symbol, setSymbol] = useState("AAPL");
  const { data: filings } = useQuery({
    queryKey: ["filings", symbol],
    queryFn: () => filingsFn({ data: { symbol } }),
    staleTime: 300_000,
  });
  const { data: esg } = useQuery({ queryKey: ["esg", symbol], queryFn: () => esgFn({ data: { symbol } }), staleTime: 300_000 });
  return (
    <div className="space-y-4">
      <SymbolInput value={symbol} onChange={setSymbol} />
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
  const [draft, setDraft] = useState("stock market");
  const { data, isLoading } = useQuery({
    queryKey: ["newssearch", query],
    queryFn: () => fn({ data: { query } }),
    staleTime: 120_000,
  });

  return (
    <div className="space-y-4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setQuery(draft);
        }}
        className="flex items-center gap-2 rounded-xl border border-border bg-card px-3"
      >
        <Search className="h-4 w-4 text-muted-foreground" />
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Search market news — AI capex, RBI policy, oil prices…"
          className="h-11 flex-1 bg-transparent text-sm text-foreground outline-none"
        />
      </form>
      <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
        {isLoading && <p className="p-6 text-sm text-muted-foreground">Searching headlines…</p>}
        {(data ?? []).map((n) => (
          <a key={n.link + n.title} href={n.link} target="_blank" rel="noreferrer" className="block px-5 py-4 hover:bg-accent/40">
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
