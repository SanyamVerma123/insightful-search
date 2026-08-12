import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Search } from "lucide-react";
import { searchTickers } from "@/lib/finance.functions";
import { cn } from "@/lib/utils";

export type TickerOption = { symbol: string; name: string; exchange?: string | null };

/**
 * Shared search box with live ticker suggestions.
 * `scope` restricts suggestions to a fixed list (used for watchlist-only tools).
 */
export function TickerAutocomplete({
  value,
  onSelect,
  placeholder = "Search company or ticker…",
  scope,
  className,
  autoFocus,
}: {
  value?: string;
  onSelect: (symbol: string, name?: string) => void;
  placeholder?: string;
  scope?: TickerOption[];
  className?: string;
  autoFocus?: boolean;
}) {
  const [q, setQ] = useState(value ?? "");
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement | null>(null);
  const search = useServerFn(searchTickers);

  useEffect(() => setQ(value ?? ""), [value]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", onClick);
    return () => window.removeEventListener("mousedown", onClick);
  }, []);

  const remoteEnabled = !scope && open && q.trim().length > 1;
  const { data: remote } = useQuery({
    queryKey: ["tickersearch", q],
    queryFn: () => search({ data: { query: q } }),
    enabled: remoteEnabled,
    staleTime: 60_000,
  });

  const options = useMemo<TickerOption[]>(() => {
    if (scope) {
      const needle = q.trim().toLowerCase();
      return scope.filter((s) => !needle || `${s.symbol} ${s.name}`.toLowerCase().includes(needle)).slice(0, 20);
    }
    return (remote ?? []).slice(0, 12);
  }, [scope, remote, q]);

  return (
    <div ref={box} className={cn("relative", className)}>
      <div className="flex h-9 items-center gap-2 rounded-lg border border-border bg-background px-3 focus-within:border-primary/60">
        <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <input
          value={q}
          autoFocus={autoFocus}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              const first = options[0];
              if (first) {
                onSelect(first.symbol, first.name);
                setQ(first.symbol);
              } else if (q.trim()) onSelect(q.trim().toUpperCase());
              setOpen(false);
            }
          }}
          placeholder={placeholder}
          className="h-full w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
        />
      </div>
      {open && options.length > 0 && (
        <div className="absolute z-40 mt-1 max-h-72 w-full min-w-[260px] overflow-y-auto rounded-xl border border-border bg-card p-1 shadow-xl">
          {options.map((o) => (
            <button
              key={o.symbol}
              type="button"
              onClick={() => {
                onSelect(o.symbol, o.name);
                setQ(o.symbol);
                setOpen(false);
              }}
              className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left hover:bg-accent"
            >
              <span className="min-w-0">
                <span className="text-[13px] font-medium text-foreground">{o.symbol}</span>
                <span className="ml-2 truncate text-[11px] text-muted-foreground">{o.name}</span>
              </span>
              {o.exchange && <span className="shrink-0 text-[10px] text-muted-foreground">{o.exchange}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
