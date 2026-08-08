import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { SiteHeader, TickerSearch } from "@/components/finance/SiteHeader";
import { Sparkline } from "@/components/finance/Sparkline";
import { DeltaBadge } from "@/components/finance/DeltaBadge";
import { getMarketStrip, getSummary } from "@/lib/finance.functions";
import { TRENDING } from "@/lib/finance-types";
import { fmtPrice } from "@/lib/format";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Screener — Live Markets, Stock Data & AI Analysis" },
      {
        name: "description",
        content:
          "Track indices, stock quotes, fundamentals and news in one place, then ask an AI analyst to break down any company.",
      },
      { property: "og:title", content: "Screener — Live Markets & AI Stock Analysis" },
      {
        property: "og:description",
        content: "Real-time index levels, ticker fundamentals, filings-grade financials and an AI market analyst.",
      },
    ],
  }),
  component: Home,
});

function IndexCard({ label, points, last, changePercent }: { label: string; points: { t: string; c: number }[]; last: number | null; changePercent: number | null }) {
  const up = (changePercent ?? 0) >= 0;
  return (
    <div className="rounded-2xl border border-border bg-card p-4 transition-colors hover:border-primary/40">
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="tabular mt-1 text-xl font-semibold text-foreground">
        {last === null ? "—" : last.toLocaleString(undefined, { maximumFractionDigits: 2 })}
      </p>
      <DeltaBadge value={changePercent} size="sm" />
      <div className="mt-2">
        <Sparkline points={points} up={up} />
      </div>
    </div>
  );
}

function TrendingRow({ symbol, name }: { symbol: string; name: string }) {
  const summary = useServerFn(getSummary);
  const { data } = useQuery({
    queryKey: ["summary", symbol],
    queryFn: () => summary({ data: { symbol } }),
    staleTime: 60_000,
  });
  const q = data?.quote;

  return (
    <Link
      to="/stock/$symbol"
      params={{ symbol }}
      className="flex items-center justify-between gap-4 border-b border-border px-4 py-3.5 transition-colors last:border-0 hover:bg-accent/50"
    >
      <div className="min-w-0">
        <p className="tabular text-sm font-medium text-foreground">{symbol}</p>
        <p className="truncate text-xs text-muted-foreground">{q?.name ?? name}</p>
      </div>
      <div className="text-right">
        <p className="tabular text-sm font-medium text-foreground">{fmtPrice(q?.price, q?.currency)}</p>
        <DeltaBadge value={q?.changePercent} size="sm" />
      </div>
    </Link>
  );
}

function Home() {
  const strip = useServerFn(getMarketStrip);
  const { data: indices, isLoading } = useQuery({
    queryKey: ["market-strip"],
    queryFn: () => strip({}),
    staleTime: 60_000,
  });

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader compactSearch={false} />

      <main className="mx-auto max-w-7xl px-4 pb-24 sm:px-6">
        <section className="py-14 text-center sm:py-20">
          <h1 className="mx-auto max-w-3xl text-balance text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
            Every number behind the market, explained.
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-pretty text-muted-foreground">
            Live quotes, fundamentals, analyst targets and filings — paired with an AI analyst that reads the data for
            you.
          </p>
          <div className="mx-auto mt-8 max-w-2xl">
            <TickerSearch size="lg" placeholder="Try RELIANCE.NS, AAPL or “Tata Motors”" />
          </div>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {TRENDING.slice(0, 5).map((t) => (
              <Link
                key={t.symbol}
                to="/stock/$symbol"
                params={{ symbol: t.symbol }}
                className="tabular rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
              >
                {t.symbol}
              </Link>
            ))}
          </div>
        </section>

        <section>
          <h2 className="mb-3 text-sm font-medium uppercase tracking-widest text-muted-foreground">Market pulse</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {isLoading
              ? Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-[132px] animate-pulse rounded-2xl border border-border bg-card" />
                ))
              : (indices ?? []).map((idx) => (
                  <IndexCard
                    key={idx.key}
                    label={idx.label}
                    points={idx.points}
                    last={idx.last}
                    changePercent={idx.changePercent}
                  />
                ))}
          </div>
        </section>

        <section className="mt-12 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="overflow-hidden rounded-2xl border border-border bg-card">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <h2 className="text-sm font-medium text-foreground">Trending tickers</h2>
              <Link to="/compare" className="text-xs text-primary hover:underline">
                Compare →
              </Link>
            </div>
            {TRENDING.map((t) => (
              <TrendingRow key={t.symbol} symbol={t.symbol} name={t.name} />
            ))}
          </div>

          <div className="rounded-2xl border border-border bg-gradient-to-b from-card to-surface p-6">
            <p className="text-xs font-medium uppercase tracking-widest text-primary">AI analyst</p>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight text-foreground">
              Ask anything about a company.
            </h2>
            <p className="mt-3 text-sm text-muted-foreground">
              The analyst pulls live quotes, income statements, analyst targets, corporate actions and news through the
              screener data layer, then answers with the numbers attached.
            </p>
            <ul className="mt-5 space-y-2 text-sm text-muted-foreground">
              {[
                "Break down Reliance's last four quarters of margins",
                "Is NVDA expensive versus its own 5-year multiple?",
                "What's driving HDFC Bank's move today?",
              ].map((q) => (
                <li key={q} className="rounded-xl border border-border bg-background/60 px-3 py-2">
                  “{q}”
                </li>
              ))}
            </ul>
            <Link
              to="/chat"
              className="mt-6 inline-flex h-10 items-center rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
            >
              Open AI analyst
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
