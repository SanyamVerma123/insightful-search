import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { SiteHeader } from "@/components/finance/SiteHeader";
import { PriceChart } from "@/components/finance/PriceChart";
import { DeltaBadge } from "@/components/finance/DeltaBadge";
import {
  getAnalyst,
  getCalendar,
  getCorporateActions,
  getFinancials,
  getHistory,
  getNews,
  getSummary,
  getUpgrades,
} from "@/lib/finance.functions";
import { RANGES, type RangeKey } from "@/lib/finance-types";
import { fmtCompact, fmtDate, fmtNumber, fmtPercent, fmtPrice, timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/stock/$symbol")({
  head: ({ params }) => ({
    meta: [
      { title: `${params.symbol} Stock Price, Financials & AI Analysis — Screener` },
      {
        name: "description",
        content: `Live ${params.symbol} quote, interactive price chart, key ratios, income statement, analyst targets and latest news.`,
      },
      { property: "og:title", content: `${params.symbol} — Price, Financials & Analysis` },
      {
        property: "og:description",
        content: `Interactive chart, fundamentals and analyst coverage for ${params.symbol}.`,
      },
    ],
  }),
  component: StockPage,
});

function Card({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card">
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <h2 className="text-sm font-medium text-foreground">{title}</h2>
        {action}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface px-3 py-2.5">
      <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="tabular mt-0.5 text-sm font-medium text-foreground">{value}</p>
    </div>
  );
}

function StockPage() {
  const { symbol } = Route.useParams();
  const [range, setRange] = useState<RangeKey>("6mo");
  const [statement, setStatement] = useState<"income" | "balance" | "cash">("income");
  const [quarterly, setQuarterly] = useState(false);

  const summaryFn = useServerFn(getSummary);
  const historyFn = useServerFn(getHistory);
  const newsFn = useServerFn(getNews);
  const finFn = useServerFn(getFinancials);
  const analystFn = useServerFn(getAnalyst);
  const upgradesFn = useServerFn(getUpgrades);
  const calFn = useServerFn(getCalendar);
  const caFn = useServerFn(getCorporateActions);

  const cfg = RANGES.find((r) => r.key === range)!;

  const { data: summary, isLoading: loadingSummary, error } = useQuery({
    queryKey: ["summary", symbol],
    queryFn: () => summaryFn({ data: { symbol } }),
    staleTime: 30_000,
  });
  const { data: history, isFetching: loadingHistory } = useQuery({
    queryKey: ["history", symbol, range],
    queryFn: () => historyFn({ data: { symbol, period: cfg.period, interval: cfg.interval } }),
    staleTime: 30_000,
  });
  const { data: news } = useQuery({
    queryKey: ["news", symbol],
    queryFn: () => newsFn({ data: { symbol } }),
    staleTime: 120_000,
  });
  const { data: financials } = useQuery({
    queryKey: ["financials", symbol, statement, quarterly],
    queryFn: () => finFn({ data: { symbol, statement, quarterly } }),
    staleTime: 300_000,
  });
  const { data: analyst } = useQuery({
    queryKey: ["analyst", symbol],
    queryFn: () => analystFn({ data: { symbol } }),
    staleTime: 300_000,
  });
  const { data: upgrades } = useQuery({
    queryKey: ["upgrades", symbol],
    queryFn: () => upgradesFn({ data: { symbol } }),
    staleTime: 300_000,
  });
  const { data: calendar } = useQuery({
    queryKey: ["calendar", symbol],
    queryFn: () => calFn({ data: { symbol } }),
    staleTime: 300_000,
  });
  const { data: actions } = useQuery({
    queryKey: ["actions", symbol],
    queryFn: () => caFn({ data: { symbol } }),
    staleTime: 300_000,
  });

  const q = summary?.quote;
  const r = summary?.ratios;

  if (error) {
    return (
      <div className="min-h-screen bg-background">
        <SiteHeader />
        <div className="mx-auto max-w-3xl px-4 py-24 text-center">
          <h1 className="tabular text-2xl font-semibold text-foreground">{symbol}</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            We couldn't load data for this ticker. Check the symbol (Indian listings need a .NS or .BO suffix).
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <div className="flex items-center gap-2">
              <span className="tabular rounded-md border border-border px-2 py-0.5 text-xs text-muted-foreground">
                {q?.exchange ?? "—"}
              </span>
              <span className="tabular text-xs text-muted-foreground">{symbol}</span>
            </div>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground">
              {loadingSummary ? "Loading…" : (q?.name ?? symbol)}
            </h1>
            <div className="mt-3 flex items-end gap-3">
              <span className="tabular text-4xl font-semibold text-foreground">{fmtPrice(q?.price, q?.currency)}</span>
              <DeltaBadge value={q?.changePercent} absolute={q?.change} currency={q?.currency} size="lg" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Stat label="Open" value={fmtPrice(q?.open, q?.currency)} />
            <Stat label="Prev close" value={fmtPrice(q?.previousClose, q?.currency)} />
            <Stat label="Day range" value={`${fmtNumber(q?.dayLow)} – ${fmtNumber(q?.dayHigh)}`} />
            <Stat label="52w range" value={`${fmtNumber(q?.yearLow)} – ${fmtNumber(q?.yearHigh)}`} />
          </div>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1.6fr_1fr]">
          <div className="space-y-6">
            <Card
              title="Price"
              action={
                <div className="flex flex-wrap gap-1">
                  {RANGES.map((rg) => (
                    <button
                      key={rg.key}
                      type="button"
                      onClick={() => setRange(rg.key)}
                      className={cn(
                        "rounded-full px-2.5 py-1 text-xs transition-colors",
                        range === rg.key
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:bg-accent hover:text-foreground",
                      )}
                    >
                      {rg.label}
                    </button>
                  ))}
                </div>
              }
            >
              <div className={cn(loadingHistory && "opacity-60 transition-opacity")}>
                <PriceChart candles={history ?? []} currency={q?.currency} />
              </div>
            </Card>

            <Card
              title="Financials"
              action={
                <div className="flex items-center gap-1">
                  {(["income", "balance", "cash"] as const).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setStatement(s)}
                      className={cn(
                        "rounded-full px-2.5 py-1 text-xs capitalize transition-colors",
                        statement === s
                          ? "bg-accent text-foreground"
                          : "text-muted-foreground hover:bg-accent hover:text-foreground",
                      )}
                    >
                      {s}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setQuarterly((v) => !v)}
                    className="ml-2 rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground"
                  >
                    {quarterly ? "Quarterly" : "Annual"}
                  </button>
                </div>
              }
            >
              <div className="-mx-4 overflow-x-auto px-4">
                <table className="w-full min-w-[560px] border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
                      <th className="py-2 pr-4 font-medium">Line item</th>
                      {(financials?.columns ?? []).map((c) => (
                        <th key={c} className="tabular py-2 pl-4 text-right font-medium">
                          {fmtDate(c)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(financials?.rows ?? []).map((row) => (
                      <tr key={row.label} className="border-b border-border/60 last:border-0">
                        <td className="py-2.5 pr-4 text-muted-foreground">{row.label}</td>
                        {row.values.map((v, i) => (
                          <td key={i} className="tabular py-2.5 pl-4 text-right text-foreground">
                            {fmtCompact(v, q?.currency)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!financials?.rows.length && <p className="py-6 text-sm text-muted-foreground">No statement data.</p>}
              </div>
            </Card>

            <Card title="Analyst coverage">
              <div className="grid gap-3 sm:grid-cols-4">
                <Stat label="Low" value={fmtPrice(analyst?.targets.low, q?.currency)} />
                <Stat label="Mean" value={fmtPrice(analyst?.targets.mean, q?.currency)} />
                <Stat label="Median" value={fmtPrice(analyst?.targets.median, q?.currency)} />
                <Stat label="High" value={fmtPrice(analyst?.targets.high, q?.currency)} />
              </div>
              <div className="mt-4 space-y-2">
                {(analyst?.distribution ?? []).map((d) => {
                  const total = d.strongBuy + d.buy + d.hold + d.sell + d.strongSell || 1;
                  const bars = [
                    { v: d.strongBuy + d.buy, c: "var(--positive)" },
                    { v: d.hold, c: "var(--muted-foreground)" },
                    { v: d.sell + d.strongSell, c: "var(--negative)" },
                  ];
                  return (
                    <div key={d.period} className="flex items-center gap-3">
                      <span className="tabular w-12 text-xs text-muted-foreground">{d.period}</span>
                      <span className="flex h-2 flex-1 overflow-hidden rounded-full bg-surface">
                        {bars.map((b, i) => (
                          <span key={i} style={{ width: `${(b.v / total) * 100}%`, background: b.c }} />
                        ))}
                      </span>
                      <span className="tabular w-8 text-right text-xs text-muted-foreground">{total}</span>
                    </div>
                  );
                })}
              </div>
              {!!upgrades?.length && (
                <div className="mt-5 -mx-4 overflow-x-auto px-4">
                  <table className="w-full min-w-[480px] text-sm">
                    <tbody>
                      {upgrades.slice(0, 8).map((u, i) => (
                        <tr key={i} className="border-b border-border/60 last:border-0">
                          {Object.values(u)
                            .slice(0, 4)
                            .map((cell, j) => (
                              <td key={j} className="py-2 pr-4 text-muted-foreground first:text-foreground">
                                {cell}
                              </td>
                            ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </div>

          <div className="space-y-6">
            <Card title="Key ratios">
              <div className="grid grid-cols-2 gap-2">
                <Stat label="Market cap" value={fmtCompact(q?.marketCap, q?.currency)} />
                <Stat label="P/E (TTM)" value={fmtNumber(r?.trailingPE)} />
                <Stat label="Forward P/E" value={fmtNumber(r?.forwardPE)} />
                <Stat label="P/B" value={fmtNumber(r?.priceToBook)} />
                <Stat label="EV/EBITDA" value={fmtNumber(r?.enterpriseToEbitda)} />
                <Stat label="ROE" value={fmtPercent(r?.returnOnEquity)} />
                <Stat label="Profit margin" value={fmtPercent(r?.profitMargins)} />
                <Stat label="Rev growth" value={fmtPercent(r?.revenueGrowth)} />
                <Stat label="Debt/Equity" value={fmtNumber(r?.debtToEquity)} />
                <Stat label="Dividend yield" value={fmtPercent(r?.dividendYield)} />
                <Stat label="Beta" value={fmtNumber(r?.beta)} />
                <Stat label="Rating" value={r?.recommendationKey ?? "—"} />
              </div>
              {r?.summary && (
                <p className="mt-4 line-clamp-6 text-sm leading-relaxed text-muted-foreground">{r.summary}</p>
              )}
              {(r?.sector || r?.industry) && (
                <p className="mt-3 text-xs text-muted-foreground">
                  {r?.sector} {r?.industry ? `· ${r.industry}` : ""}
                </p>
              )}
            </Card>

            <Card title="Events">
              <div className="space-y-2">
                <Stat label="Next earnings" value={fmtDate(calendar?.earningsDate)} />
                <Stat label="Ex-dividend" value={fmtDate(calendar?.exDividendDate)} />
                <Stat label="EPS estimate" value={fmtNumber(calendar?.earningsAverage)} />
              </div>
              {!!actions?.dividends.length && (
                <div className="mt-4">
                  <p className="mb-2 text-xs uppercase tracking-wider text-muted-foreground">Recent dividends</p>
                  {actions.dividends.slice(-5).reverse().map((d) => (
                    <div key={d.date} className="flex justify-between border-b border-border/60 py-1.5 text-sm last:border-0">
                      <span className="text-muted-foreground">{fmtDate(d.date)}</span>
                      <span className="tabular text-foreground">{fmtPrice(d.amount, q?.currency)}</span>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <Card title="News">
              <div className="space-y-3">
                {(news ?? []).slice(0, 10).map((n, i) => (
                  <a
                    key={i}
                    href={n.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block rounded-xl border border-border bg-surface p-3 transition-colors hover:border-primary/40"
                  >
                    <p className="text-sm font-medium leading-snug text-foreground">{n.title}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {n.publisher ?? "Source"} · {timeAgo(n.pubDate)}
                    </p>
                  </a>
                ))}
                {!news?.length && <p className="text-sm text-muted-foreground">No recent headlines.</p>}
              </div>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
