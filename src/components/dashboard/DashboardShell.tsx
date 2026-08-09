import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Activity,
  BarChart3,
  Bell,
  Bitcoin,
  Blocks,
  BadgeDollarSign,
  CandlestickChart,
  ChevronDown,
  ChevronRight,
  Coins,
  Crown,
  Flame,
  Globe,
  LineChart,
  LogOut,
  Newspaper,
  PanelLeftClose,
  PanelLeftOpen,
  RefreshCw,
  Search,
  Settings,
  SlidersHorizontal,
  Sparkles,
  Sprout,
  Star,
  Target,
  TrendingUp,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { searchTickers } from "@/lib/finance.functions";
import { cn } from "@/lib/utils";

export type PageId = string;

type NavItem = { id: PageId; title: string; icon: LucideIcon; shortcut?: string; children?: NavItem[]; badge?: number };
type NavGroup = { heading?: string; items: NavItem[] };

export const PAGE_TITLES: Record<string, string> = {};

export function buildNav(watchlistCount: number, alertCount: number): NavGroup[] {
  return [
    {
      items: [
        { id: "search", title: "Search", icon: Search, shortcut: "⌘K" },
        { id: "markets", title: "Markets", icon: TrendingUp },
        { id: "screener", title: "Stock Screener", icon: SlidersHorizontal },
        { id: "watchlist", title: "Watchlist", icon: Star, badge: watchlistCount },
        { id: "ai", title: "AI Analyst", icon: Sparkles },
        { id: "news", title: "Market News", icon: Newspaper },
        { id: "alerts", title: "Alerts", icon: Bell, badge: alertCount },
      ],
    },
    {
      heading: "Screener Presets",
      items: [
        {
          id: "momentum",
          title: "Momentum",
          icon: Flame,
          children: [
            { id: "m-high", title: "High Momentum", icon: Zap },
            { id: "m-breakouts", title: "Breakouts", icon: TrendingUp },
            { id: "m-52w", title: "52-Week Highs", icon: LineChart },
          ],
        },
        {
          id: "value",
          title: "Value",
          icon: BadgeDollarSign,
          children: [
            { id: "v-lowpe", title: "Low P/E", icon: Coins },
            { id: "v-divkings", title: "Dividend Kings", icon: Crown },
            { id: "v-fcf", title: "High FCF Yield", icon: Coins },
          ],
        },
        {
          id: "growth",
          title: "Growth",
          icon: Sprout,
          children: [
            { id: "g-revenue", title: "Revenue Growth", icon: TrendingUp },
            { id: "g-roe", title: "High ROE", icon: Target },
          ],
        },
        {
          id: "volatility",
          title: "Volatility",
          icon: Activity,
          children: [
            { id: "vol-volume", title: "Unusual Volume", icon: BarChart3 },
            { id: "vol-earnings", title: "Earnings Plays", icon: CandlestickChart },
          ],
        },
      ],
    },
    {
      heading: "Markets",
      items: [
        { id: "equities", title: "US Equities", icon: CandlestickChart },
        { id: "etfs", title: "ETFs", icon: Blocks },
        { id: "crypto", title: "Crypto", icon: Bitcoin },
        { id: "forex", title: "Forex", icon: Globe },
      ],
    },
  ];
}

const BOTTOM: NavItem[] = [
  { id: "settings", title: "Settings", icon: Settings, shortcut: "⌘," },
  { id: "logout", title: "Log out", icon: LogOut },
];

function collectTitles(groups: NavGroup[]) {
  const walk = (items: NavItem[]) => {
    for (const i of items) {
      PAGE_TITLES[i.id] = i.title;
      if (i.children) walk(i.children);
    }
  };
  walk(groups.flatMap((g) => g.items).concat(BOTTOM));
}

function NavButton({
  item,
  active,
  level,
  collapsed,
  expanded,
  onToggle,
  onSelect,
}: {
  item: NavItem;
  active: boolean;
  level: number;
  collapsed: boolean;
  expanded: boolean;
  onToggle: () => void;
  onSelect: () => void;
}) {
  const Icon = item.icon;
  return (
    <button
      type="button"
      onClick={item.children ? onToggle : onSelect}
      title={collapsed ? item.title : undefined}
      className={cn(
        "group flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] transition-colors",
        active
          ? "bg-primary/10 font-medium text-primary"
          : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
      )}
      style={{ paddingLeft: collapsed ? undefined : 10 + level * 14 }}
    >
      <Icon className="h-4 w-4 shrink-0" />
      {!collapsed && (
        <>
          <span className="flex-1 truncate text-left">{item.title}</span>
          {item.badge ? (
            <span className="rounded-full bg-accent px-1.5 py-0.5 text-[10px] text-muted-foreground">{item.badge}</span>
          ) : null}
          {item.shortcut && <span className="text-[10px] text-muted-foreground/70">{item.shortcut}</span>}
          {item.children &&
            (expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />)}
        </>
      )}
    </button>
  );
}

function CommandPalette({
  open,
  onClose,
  onNavigate,
}: {
  open: boolean;
  onClose: () => void;
  onNavigate: (id: PageId) => void;
}) {
  const [q, setQ] = useState("");
  const navigate = useNavigate();
  const search = useServerFn(searchTickers);
  const { data: tickers } = useQuery({
    queryKey: ["palette", q],
    queryFn: () => search({ data: { query: q } }),
    enabled: open && q.trim().length > 1,
    staleTime: 30_000,
  });

  const commands = useMemo(
    () =>
      [
        { label: "Go to Markets", id: "markets" },
        { label: "Go to Stock Screener", id: "screener" },
        { label: "Go to Watchlist", id: "watchlist" },
        { label: "Go to AI Analyst", id: "ai" },
        { label: "Go to Market News", id: "news" },
        { label: "Go to Alerts", id: "alerts" },
        { label: "Go to Crypto", id: "crypto" },
        { label: "Go to Settings", id: "settings" },
      ].filter((c) => c.label.toLowerCase().includes(q.toLowerCase())),
    [q],
  );

  useEffect(() => {
    if (!open) setQ("");
  }, [open]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 p-4 pt-[12vh]" onClick={onClose}>
      <div
        className="w-full max-w-xl overflow-hidden rounded-2xl border border-border bg-card shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-border px-4">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search tickers, companies or commands…"
            className="h-12 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
          />
          <kbd className="rounded border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground">ESC</kbd>
        </div>
        <div className="max-h-[50vh] overflow-y-auto p-2">
          {tickers?.map((t) => (
            <button
              key={t.symbol}
              type="button"
              onClick={() => {
                onClose();
                void navigate({ to: "/stock/$symbol", params: { symbol: t.symbol } });
              }}
              className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left hover:bg-accent"
            >
              <span>
                <span className="text-sm font-medium text-foreground">{t.symbol}</span>
                <span className="ml-2 text-xs text-muted-foreground">{t.name}</span>
              </span>
              <span className="text-[11px] text-muted-foreground">{t.exchange}</span>
            </button>
          ))}
          {commands.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => {
                onClose();
                onNavigate(c.id);
              }}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export function DashboardShell({
  page,
  onNavigate,
  watchlistCount,
  alertCount,
  onRefresh,
  children,
}: {
  page: PageId;
  onNavigate: (id: PageId) => void;
  watchlistCount: number;
  alertCount: number;
  onRefresh: () => void;
  children: ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set(["momentum"]));
  const [paletteOpen, setPaletteOpen] = useState(false);
  const groups = buildNav(watchlistCount, alertCount);
  collectTitles(groups);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
      if (e.key === "Escape") setPaletteOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const select = (id: PageId) => {
    if (id === "search") return setPaletteOpen(true);
    onNavigate(id);
  };

  const renderItem = (item: NavItem, level: number) => (
    <div key={item.id}>
      <NavButton
        item={item}
        level={level}
        collapsed={collapsed}
        active={page === item.id}
        expanded={expanded.has(item.id)}
        onToggle={() =>
          setExpanded((prev) => {
            const next = new Set(prev);
            if (next.has(item.id)) next.delete(item.id);
            else next.add(item.id);
            return next;
          })
        }
        onSelect={() => select(item.id)}
      />
      {item.children && expanded.has(item.id) && !collapsed && (
        <div className="mt-0.5 flex flex-col gap-0.5">{item.children.map((c) => renderItem(c, level + 1))}</div>
      )}
    </div>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <aside
        className={cn(
          "flex shrink-0 flex-col border-r border-border bg-card p-3 transition-[width] duration-200",
          collapsed ? "w-[68px]" : "w-[260px]",
        )}
      >
        <div className="flex items-center gap-2.5 rounded-xl border border-border p-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
            <LineChart className="h-4 w-4" />
          </span>
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-semibold text-foreground">Screener Terminal</p>
              <p className="text-[11px] text-muted-foreground">Pro • Live Data</p>
            </div>
          )}
        </div>

        <div className="no-scrollbar mt-3 flex flex-1 flex-col gap-4 overflow-y-auto">
          {groups.map((g, gi) => (
            <div key={gi} className="flex flex-col gap-0.5">
              {g.heading && !collapsed && (
                <span className="mb-1 px-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                  {g.heading}
                </span>
              )}
              {g.items.map((i) => renderItem(i, 0))}
            </div>
          ))}
        </div>

        <div className="mt-auto flex flex-col gap-0.5 border-t border-border pt-3">
          {BOTTOM.map((i) => renderItem(i, 0))}
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-card/60 px-4 backdrop-blur">
          <button
            type="button"
            onClick={() => setCollapsed((v) => !v)}
            className="rounded-md p-1.5 text-muted-foreground hover:text-foreground"
          >
            {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          </button>
          <nav className="flex items-center gap-2 text-[13px]">
            <span className="text-muted-foreground">Personal Terminal</span>
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/60" />
            <span className="font-medium text-foreground">{PAGE_TITLES[page] ?? "Markets"}</span>
          </nav>
          <button
            type="button"
            onClick={() => setPaletteOpen(true)}
            className="ml-auto flex h-9 items-center gap-2 rounded-lg border border-border px-3 text-xs text-muted-foreground hover:text-foreground"
          >
            <Search className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Search markets</span>
            <kbd className="rounded border border-border px-1 py-0.5 text-[10px]">⌘K</kbd>
          </button>
          <button
            type="button"
            onClick={onRefresh}
            className="rounded-md p-2 text-muted-foreground hover:text-foreground"
            title="Refresh live data"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
          <span className="flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-[11px] text-muted-foreground">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-positive" /> Live
          </span>
        </header>

        <main className="min-h-0 flex-1 overflow-hidden">{children}</main>
      </div>

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} onNavigate={select} />
    </div>
  );
}
