import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { searchTickers } from "@/lib/finance.functions";
import { TRENDING } from "@/lib/finance-types";
import { cn } from "@/lib/utils";

export function TickerSearch({
  size = "md",
  placeholder = "Search stocks, indices or companies",
}: {
  size?: "md" | "lg";
  placeholder?: string;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [debounced, setDebounced] = useState("");
  const boxRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const search = useServerFn(searchTickers);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(query.trim()), 250);
    return () => clearTimeout(id);
  }, [query]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const { data, isFetching } = useQuery({
    queryKey: ["search", debounced],
    queryFn: () => search({ data: { query: debounced } }),
    enabled: debounced.length >= 1,
    staleTime: 60_000,
  });

  const results = debounced.length >= 1 ? (data ?? []) : [];
  const fallback = TRENDING.slice(0, 6);

  function go(symbol: string) {
    setOpen(false);
    setQuery("");
    void navigate({ to: "/stock/$symbol", params: { symbol } });
  }

  return (
    <div ref={boxRef} className="relative w-full">
      <div
        className={cn(
          "flex items-center gap-3 rounded-full border border-border bg-card px-4 transition-colors focus-within:border-primary/60",
          size === "lg" ? "h-14 text-base" : "h-10 text-sm",
        )}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="shrink-0 text-muted-foreground">
          <circle cx="7" cy="7" r="4.75" stroke="currentColor" strokeWidth="1.5" />
          <path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
        <input
          value={query}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              const first = results[0];
              if (first) go(first.symbol);
              else if (query.trim()) go(query.trim().toUpperCase());
            }
          }}
          placeholder={placeholder}
          className="w-full bg-transparent text-foreground outline-none placeholder:text-muted-foreground/70"
        />
        {isFetching && <span className="size-3 animate-spin rounded-full border border-border border-t-primary" />}
      </div>

      {open && (
        <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-40 overflow-hidden rounded-2xl border border-border bg-popover p-1.5 shadow-2xl">
          <p className="px-3 py-1.5 text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
            {results.length ? "Results" : "Trending"}
          </p>
          {(results.length ? results : fallback.map((t) => ({ ...t, exchange: null, type: null, sector: null }))).map(
            (r) => (
              <button
                key={r.symbol}
                type="button"
                onClick={() => go(r.symbol)}
                className="flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-accent"
              >
                <span className="min-w-0">
                  <span className="tabular block text-sm font-medium text-foreground">{r.symbol}</span>
                  <span className="block truncate text-xs text-muted-foreground">{r.name}</span>
                </span>
                {r.exchange && (
                  <span className="shrink-0 rounded-full border border-border px-2 py-0.5 text-[10px] text-muted-foreground">
                    {r.exchange}
                  </span>
                )}
              </button>
            ),
          )}
          {debounced.length >= 1 && !isFetching && results.length === 0 && (
            <p className="px-3 py-4 text-sm text-muted-foreground">No matches. Press Enter to open “{debounced}”.</p>
          )}
        </div>
      )}
    </div>
  );
}

export function SiteHeader({ compactSearch = true }: { compactSearch?: boolean }) {
  const links = [
    { to: "/", label: "Markets" },
    { to: "/compare", label: "Compare" },
    { to: "/chat", label: "AI Analyst" },
  ] as const;

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-6 px-4 sm:px-6">
        <Link to="/" className="flex shrink-0 items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-lg bg-primary text-xs font-bold text-primary-foreground">
            S
          </span>
          <span className="text-sm font-semibold tracking-tight text-foreground">Screener</span>
        </Link>
        {compactSearch && (
          <div className="hidden max-w-md flex-1 md:block">
            <TickerSearch />
          </div>
        )}
        <nav className="ml-auto flex items-center gap-1">
          {links.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              className="rounded-full px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              activeProps={{ className: "bg-accent text-foreground" }}
              activeOptions={{ exact: l.to === "/" }}
            >
              {l.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
