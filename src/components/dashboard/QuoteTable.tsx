import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Star } from "lucide-react";
import { getQuotes } from "@/lib/finance.functions";
import { UNIVERSE } from "@/lib/universe";
import { DeltaBadge } from "@/components/finance/DeltaBadge";
import { fmtCompact, fmtPrice } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Quote } from "@/lib/finance-types";

export function useQuotes(symbols: string[]) {
  const fn = useServerFn(getQuotes);
  const key = symbols.join(",");
  return useQuery({
    queryKey: ["quotes", key],
    queryFn: () => fn({ data: { symbols: key } }),
    enabled: symbols.length > 0,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}

export function QuoteTable({
  symbols,
  filter,
  watchlist,
  onToggleWatch,
  emptyLabel = "Nothing here yet.",
}: {
  symbols: string[];
  filter?: (q: Quote) => boolean;
  watchlist: string[];
  onToggleWatch: (symbol: string) => void;
  emptyLabel?: string;
}) {
  const { data, isLoading } = useQuotes(symbols);
  const rows = (data ?? []).filter((q) => (filter ? filter(q) : true));

  if (!symbols.length) return <p className="p-8 text-sm text-muted-foreground">{emptyLabel}</p>;

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card">
      <table className="w-full text-sm">
        <thead className="bg-muted/30 text-[11px] uppercase tracking-wider text-muted-foreground">
          <tr>
            <th className="px-4 py-2.5 text-left font-medium">Symbol</th>
            <th className="px-4 py-2.5 text-right font-medium">Price</th>
            <th className="px-4 py-2.5 text-right font-medium">Change</th>
            <th className="hidden px-4 py-2.5 text-right font-medium md:table-cell">Day range</th>
            <th className="hidden px-4 py-2.5 text-right font-medium lg:table-cell">52W high</th>
            <th className="hidden px-4 py-2.5 text-right font-medium sm:table-cell">Mkt cap</th>
          </tr>
        </thead>
        <tbody>
          {isLoading &&
            symbols.map((s) => (
              <tr key={s} className="border-t border-border">
                <td colSpan={6} className="px-4 py-3">
                  <div className="h-4 w-full animate-pulse rounded bg-muted/50" />
                </td>
              </tr>
            ))}
          {rows.map((q) => {
            const meta = UNIVERSE[q.symbol];
            const starred = watchlist.includes(q.symbol);
            return (
              <tr key={q.symbol} className="border-t border-border transition-colors hover:bg-accent/40">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => onToggleWatch(q.symbol)}
                      className={cn("p-1", starred ? "text-amber-400" : "text-muted-foreground hover:text-amber-400")}
                      title={starred ? "Remove from watchlist" : "Add to watchlist"}
                    >
                      <Star className="h-4 w-4" fill={starred ? "currentColor" : "none"} />
                    </button>
                    <span className="flex h-8 w-8 items-center justify-center rounded-md bg-muted text-[9px] font-bold text-muted-foreground">
                      {q.symbol.replace(/[-=.].*$/, "").slice(0, 4)}
                    </span>
                    <Link to="/stock/$symbol" params={{ symbol: q.symbol }} className="min-w-0">
                      <span className="block text-[13px] font-semibold text-foreground">{q.symbol}</span>
                      <span className="block truncate text-[11px] text-muted-foreground">
                        {meta?.name ?? q.name}
                      </span>
                    </Link>
                  </div>
                </td>
                <td className="tabular px-4 py-3 text-right font-medium text-foreground">
                  {fmtPrice(q.price, q.currency)}
                </td>
                <td className="px-4 py-3 text-right">
                  <DeltaBadge value={q.changePercent} absolute={q.change} currency={q.currency} size="sm" />
                </td>
                <td className="tabular hidden px-4 py-3 text-right text-muted-foreground md:table-cell">
                  {fmtPrice(q.dayLow, q.currency)} – {fmtPrice(q.dayHigh, q.currency)}
                </td>
                <td className="tabular hidden px-4 py-3 text-right text-muted-foreground lg:table-cell">
                  {fmtPrice(q.yearHigh, q.currency)}
                </td>
                <td className="tabular hidden px-4 py-3 text-right text-muted-foreground sm:table-cell">
                  {fmtCompact(q.marketCap, q.currency)}
                </td>
              </tr>
            );
          })}
          {!isLoading && rows.length === 0 && (
            <tr>
              <td colSpan={6} className="px-4 py-10 text-center text-sm text-muted-foreground">
                {emptyLabel}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
