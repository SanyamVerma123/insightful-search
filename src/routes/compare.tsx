import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { LineChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid, Legend } from "recharts";
import { SiteHeader } from "@/components/finance/SiteHeader";
import { getCompare } from "@/lib/finance.functions";

export const Route = createFileRoute("/compare")({
  head: () => ({
    meta: [
      { title: "Compare Stocks Side by Side — Screener" },
      { name: "description", content: "Normalize and compare the performance of multiple tickers over any period." },
      { property: "og:title", content: "Compare Stocks Side by Side — Screener" },
      { property: "og:description", content: "Rebased performance comparison across multiple tickers." },
    ],
  }),
  component: ComparePage,
});

const COLORS = ["var(--primary)", "var(--positive)", "var(--negative)", "var(--chart-4)", "var(--chart-5)"];

function ComparePage() {
  const [input, setInput] = useState("RELIANCE.NS, TCS.NS, INFY.NS");
  const [symbols, setSymbols] = useState("RELIANCE.NS,TCS.NS,INFY.NS");
  const compare = useServerFn(getCompare);

  const { data, isFetching } = useQuery({
    queryKey: ["compare", symbols],
    queryFn: () => compare({ data: { symbols, period: "1y", interval: "1d" } }),
    staleTime: 120_000,
  });

  const series = data ?? [];
  const merged = new Map<string, Record<string, number | string>>();
  for (const s of series) {
    const base = s.points[0]?.c;
    if (!base) continue;
    for (const p of s.points) {
      const row = merged.get(p.t) ?? { t: p.t };
      row[s.symbol] = ((p.c / base - 1) * 100).toFixed(2) as unknown as number;
      merged.set(p.t, row);
    }
  }
  const rows = Array.from(merged.values());

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">Compare performance</h1>
        <p className="mt-2 text-sm text-muted-foreground">Rebased to 0% at the start of the trailing year.</p>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            setSymbols(
              input
                .split(",")
                .map((s) => s.trim().toUpperCase())
                .filter(Boolean)
                .join(","),
            );
          }}
          className="mt-6 flex gap-2"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="tabular h-11 flex-1 rounded-full border border-border bg-card px-4 text-sm text-foreground outline-none focus:border-primary/60"
            placeholder="Comma separated tickers"
          />
          <button className="h-11 rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground">
            Compare
          </button>
        </form>

        <div className="mt-8 rounded-2xl border border-border bg-card p-4" style={{ height: 440 }}>
          {rows.length ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid stroke="var(--border)" strokeDasharray="2 6" vertical={false} />
                <XAxis
                  dataKey="t"
                  tickLine={false}
                  axisLine={false}
                  minTickGap={48}
                  tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                  tickFormatter={(v: string) =>
                    new Date(v.replace(" ", "T")).toLocaleDateString(undefined, { month: "short", year: "2-digit" })
                  }
                />
                <YAxis
                  orientation="right"
                  tickLine={false}
                  axisLine={false}
                  width={56}
                  tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                  tickFormatter={(v: number) => `${v}%`}
                />
                <Tooltip
                  contentStyle={{
                    background: "var(--popover)",
                    border: "1px solid var(--border)",
                    borderRadius: 12,
                    fontSize: 12,
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                {series.map((s, i) => (
                  <Line
                    key={s.symbol}
                    type="monotone"
                    dataKey={s.symbol}
                    stroke={COLORS[i % COLORS.length]}
                    strokeWidth={2}
                    dot={false}
                    isAnimationActive={false}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              {isFetching ? "Loading comparison…" : "No data for these tickers."}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
