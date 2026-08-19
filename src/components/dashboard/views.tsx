import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { Bell, ExternalLink, Star, Trash2 } from "lucide-react";
import { getMarketStrip, getNews, getWatchlistNews } from "@/lib/finance.functions";
import { Sparkline } from "@/components/finance/Sparkline";
import { DeltaBadge } from "@/components/finance/DeltaBadge";
import { TickerAutocomplete } from "@/components/finance/TickerAutocomplete";
import { QuoteTable } from "@/components/dashboard/QuoteTable";
import { timeAgo } from "@/lib/format";
import { useAppState, useMarketConfig } from "@/lib/app-state";
import { MARKETS, type MarketId } from "@/lib/markets";
import { cn } from "@/lib/utils";

export type Alert = { id: string; symbol: string; above: boolean; price: number; enabled: boolean };

export function MarketStrip() {
  const cfg = useMarketConfig();
  const fn = useServerFn(getMarketStrip);
  const { data } = useQuery({
    queryKey: ["strip", cfg.id],
    queryFn: () => fn({ data: { indices: cfg.indices } }),
    staleTime: 60_000,
  });
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {(data ?? []).map((ix) => (
        <div key={ix.key} className="rounded-2xl border border-border bg-card p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {ix.label}
          </p>
          <p className="tabular mt-1 text-xl font-semibold text-foreground">
            {ix.last === null
              ? "—"
              : ix.last.toLocaleString(undefined, { maximumFractionDigits: 2 })}
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

/* ---------------- Watchlist ---------------- */

export function WatchlistView() {
  const { watchlist, addToWatchlist, removeFromWatchlist, watchSymbols } = useAppState();
  const groups = useMemo(() => {
    const map = new Map<string, typeof watchlist>();
    for (const item of watchlist) {
      const key = item.sector || "Uncategorised";
      map.set(key, [...(map.get(key) ?? []), item]);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [watchlist]);
  const [selectedSector, setSelectedSector] = useState("");
  const activeSector =
    selectedSector && groups.some(([sector]) => sector === selectedSector)
      ? selectedSector
      : (groups[0]?.[0] ?? "");
  const activeItems = groups.find(([sector]) => sector === activeSector)?.[1] ?? [];

  return (
    <div className="space-y-5">
      <section className="rounded-3xl border border-border bg-card/80 p-6 shadow-sm">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-primary/20 bg-primary/10 text-primary">
            <Star className="h-5 w-5" />
          </span>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
              Watchlist intelligence
            </p>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
              Keep the important names close
            </h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Your watchlist powers alerts, news feeds, and ticker-scoped research tools across the
              terminal.
            </p>
          </div>
        </div>
      </section>
      <div className="grid gap-4 md:grid-cols-3">
        {[
          { label: "Watchlist", value: watchlist.length, note: "Tracked companies" },
          { label: "Groups", value: groups.length, note: "Sector categories" },
          { label: "Research tools", value: 4, note: "Alerts, news, options, ownership" },
        ].map((item) => (
          <div key={item.label} className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              {item.label}
            </p>
            <p className="mt-3 text-2xl font-semibold text-foreground">{item.value}</p>
            <p className="mt-2 text-xs text-muted-foreground">{item.note}</p>
          </div>
        ))}
      </div>
      <section className="rounded-3xl border border-border bg-card p-6 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-foreground">Build your watchlist</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Track the companies that matter to your next decision.
            </p>
          </div>
          <span className="rounded-full border border-positive/30 bg-positive/10 px-2.5 py-1 text-[10px] text-positive">
            Live data
          </span>
        </div>
        <TickerAutocomplete
          className="mt-4 max-w-xl"
          onSelect={(symbol, name) => addToWatchlist(symbol, name)}
          placeholder="Search any company or ticker…"
        />
        <p className="mt-2 text-xs text-muted-foreground">
          New tickers are auto-categorised by sector and industry from live company data.
        </p>
      </section>
      {groups.length > 0 && (
        <>
          <div className="no-scrollbar flex gap-2 overflow-x-auto rounded-2xl border border-border bg-card p-2">
            {groups.map(([sector, items]) => (
              <button
                key={sector}
                type="button"
                onClick={() => setSelectedSector(sector)}
                className={cn(
                  "shrink-0 rounded-full px-4 py-2 text-xs",
                  activeSector === sector
                    ? "border border-primary/30 bg-primary/10 text-primary"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {sector} <span className="ml-1 opacity-60">{items.length}</span>
              </button>
            ))}
          </div>
          <section>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
              Selected watchlist sector
            </p>
            <div className="mt-1 flex items-baseline gap-2">
              <h3 className="text-xl font-semibold text-foreground">{activeSector}</h3>
              <span className="text-xs text-muted-foreground">
                {activeItems.length} tracked name{activeItems.length === 1 ? "" : "s"}
              </span>
            </div>
            <div className="mt-3 flex items-center justify-end text-[11px] text-muted-foreground">
              <span className="mr-1 h-2 w-2 rounded-full bg-positive" />
              Refreshing silently
            </div>
            <div className="mt-1">
              {activeItems.length > 0 ? (
                <QuoteTable
                  symbols={activeItems.map((item) => item.symbol)}
                  watchlist={watchSymbols}
                  onToggleWatch={(symbol) => removeFromWatchlist(symbol)}
                />
              ) : (
                <p className="rounded-2xl border border-border bg-card p-8 text-sm text-muted-foreground">
                  No tracked names in this sector.
                </p>
              )}
            </div>
          </section>
        </>
      )}
      {groups.length === 0 && (
        <p className="rounded-2xl border border-border bg-card p-8 text-sm text-muted-foreground">
          Your watchlist is empty — search above to add your first ticker.
        </p>
      )}
    </div>
  );
}

/* ---------------- News ---------------- */

export function NewsView() {
  const { watchSymbols } = useAppState();
  const [symbol, setSymbol] = useState<string | null>(null);
  const watchFn = useServerFn(getWatchlistNews);
  const oneFn = useServerFn(getNews);

  const { data: feed, isLoading } = useQuery({
    queryKey: ["watchnews", watchSymbols.join(",")],
    queryFn: () => watchFn({ data: { symbols: watchSymbols.join(",") } }),
    enabled: !symbol && watchSymbols.length > 0,
    staleTime: 120_000,
  });
  const { data: single, isLoading: loadingSingle } = useQuery({
    queryKey: ["news", symbol],
    queryFn: () => oneFn({ data: { symbol: symbol! } }),
    enabled: Boolean(symbol),
    staleTime: 120_000,
  });

  const items = symbol ? (single ?? []).map((n) => ({ ...n, symbol })) : (feed ?? []);
  const busy = symbol ? loadingSingle : isLoading;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-card p-4">
        <TickerAutocomplete
          className="w-full max-w-sm"
          onSelect={(s) => setSymbol(s)}
          placeholder="Search news for a specific company…"
        />
        <button
          type="button"
          onClick={() => setSymbol(null)}
          className={cn(
            "rounded-full border px-3 py-1.5 text-xs",
            symbol
              ? "border-border text-muted-foreground hover:text-foreground"
              : "border-primary/50 bg-primary/10 text-primary",
          )}
        >
          Watchlist feed
        </button>
        {symbol && (
          <span className="rounded-full border border-primary/50 bg-primary/10 px-3 py-1.5 text-xs text-primary">
            {symbol}
          </span>
        )}
      </div>

      <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
        {busy && <p className="p-6 text-sm text-muted-foreground">Loading headlines…</p>}
        {items.map((n) => (
          <a
            key={`${n.symbol}-${n.link}`}
            href={n.link}
            target="_blank"
            rel="noreferrer"
            className="block px-5 py-4 transition-colors hover:bg-accent/40"
          >
            <p className="text-sm font-medium text-foreground">
              <span className="mr-2 rounded bg-accent px-1.5 py-0.5 text-[10px] text-muted-foreground">
                {n.symbol}
              </span>
              {n.title}
            </p>
            <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{n.summary}</p>
            <p className="mt-2 flex items-center gap-2 text-[11px] text-muted-foreground">
              {n.publisher} · {timeAgo(n.pubDate)} <ExternalLink className="h-3 w-3" />
            </p>
          </a>
        ))}
        {!busy && items.length === 0 && (
          <p className="p-6 text-sm text-muted-foreground">
            {watchSymbols.length === 0 && !symbol
              ? "Add tickers to your watchlist to build a news feed."
              : "No headlines right now."}
          </p>
        )}
      </div>
    </div>
  );
}

/* ---------------- Alerts ---------------- */

export function AlertsView() {
  const { alerts, setAlerts, watchlist } = useAppState();
  const [symbol, setSymbol] = useState(watchlist[0]?.symbol ?? "AAPL");
  const [price, setPrice] = useState("");
  const [above, setAbove] = useState(true);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-card p-4">
        <p className="mb-3 text-sm font-medium text-foreground">New price alert</p>
        <div className="flex flex-wrap items-center gap-2">
          <TickerAutocomplete
            className="w-56"
            value={symbol}
            onSelect={(s) => setSymbol(s)}
            scope={watchlist.map((w) => ({ symbol: w.symbol, name: w.name }))}
            placeholder="Watchlist ticker"
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
              {a.above ? "rises above" : "falls below"}{" "}
              <span className="tabular text-foreground">{a.price}</span>
            </span>
            <button
              type="button"
              onClick={() =>
                setAlerts(alerts.map((x) => (x.id === a.id ? { ...x, enabled: !x.enabled } : x)))
              }
              className={cn(
                "ml-auto rounded-full border px-2.5 py-1 text-[11px]",
                a.enabled
                  ? "border-positive/40 text-positive"
                  : "border-border text-muted-foreground",
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

/* ---------------- Settings ---------------- */

export function SettingsView() {
  const {
    refreshSeconds,
    setRefreshSeconds,
    market,
    setMarket,
    apiKeys,
    setApiKeys,
    screeners,
    deleteScreener,
    theme,
    setTheme,
  } = useAppState();
  const [draft, setDraft] = useState(() => ({
    openrouter: apiKeys.openrouter,
    openrouterFallback: apiKeys.openrouterFallback ?? "",
    kilo: apiKeys.kilo,
    kiloFallback: apiKeys.kiloFallback ?? "",
    groq: apiKeys.groq,
    groqFallback: apiKeys.groqFallback ?? "",
    together: apiKeys.together,
    togetherFallback: apiKeys.togetherFallback ?? "",
    deepseek: apiKeys.deepseek,
    deepseekFallback: apiKeys.deepseekFallback ?? "",
    opencode: apiKeys.opencode,
    opencodeFallback: apiKeys.opencodeFallback ?? "",
    tinyfish: apiKeys.tinyfish,
  }));
  const [preferredModel, setPreferredModel] = useState(
    apiKeys.preferredModel ?? "openrouter:openai/gpt-4o-mini",
  );
  const [customProvider, setCustomProvider] = useState<
    "openrouter" | "kilo" | "groq" | "together" | "deepseek" | "opencode"
  >("kilo");
  const [customModelId, setCustomModelId] = useState("");
  const [customModelLabel, setCustomModelLabel] = useState("");
  const [saved, setSaved] = useState(false);
  const field =
    "mt-1 h-9 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-primary/60";
  const modelOptions = [
    ["openrouter:openai/gpt-4o-mini", "GPT-4o Mini · OpenRouter"],
    ["kilo:anthropic/claude-sonnet-4.5", "Claude Sonnet 4.5 · Kilo"],
    ["kilo:nvidia/nemotron-3-ultra-550b-a55b:free", "Nemotron 3 Ultra · Kilo · Free"],
    ["groq:llama-3.3-70b-versatile", "Llama 3.3 70B · Groq"],
    ["together:meta-llama/Llama-3.3-70B-Instruct-Turbo", "Llama 3.3 70B Turbo · Together"],
    ["deepseek:deepseek-chat", "DeepSeek Chat"],
    ["deepseek:deepseek-reasoner", "DeepSeek Reasoner"],
    ["opencode:big-pickle", "Big Pickle · OpenCode Zen"],
  ] as const;
  const updateDraft = (key: keyof typeof draft, value: string) =>
    setDraft((previous) => ({ ...previous, [key]: value }));
  const saveSettings = () => {
    const { lovable: _lovable, ...withoutLovable } = apiKeys;
    setApiKeys({
      ...withoutLovable,
      ...draft,
      ...(preferredModel.trim() ? { preferredModel: preferredModel.trim() } : {}),
    });
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1800);
  };
  const addCustomModel = () => {
    const id = customModelId.trim();
    if (!id) return;
    const model = {
      id: id.includes(":") ? id : `${customProvider}:${id}`,
      label: customModelLabel.trim() || id,
      provider: customProvider,
    };
    setApiKeys({
      ...apiKeys,
      customModels: [...(apiKeys.customModels ?? []).filter((item) => item.id !== model.id), model],
    });
    setCustomModelId("");
    setCustomModelLabel("");
  };
  const removeCustomModel = (id: string) =>
    setApiKeys({
      ...apiKeys,
      customModels: (apiKeys.customModels ?? []).filter((item) => item.id !== id),
    });
  const providers = [
    ["OpenRouter", "openrouter", "openrouterFallback"],
    ["Kilo AI", "kilo", "kiloFallback"],
    ["Groq", "groq", "groqFallback"],
    ["Together AI", "together", "togetherFallback"],
    ["DeepSeek", "deepseek", "deepseekFallback"],
    ["OpenCode Zen", "opencode", "opencodeFallback"],
  ] as const;

  return (
    <div className="max-w-3xl space-y-4">
      <div className="rounded-2xl border border-border bg-card p-5">
        <p className="text-sm font-medium text-foreground">Equity market</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Switch indices, screeners, heatmaps and terminal context between US and India.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {(Object.keys(MARKETS) as MarketId[]).map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => setMarket(id)}
              className={cn(
                "rounded-lg border px-3 py-1.5 text-xs",
                market === id
                  ? "border-primary/50 bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {MARKETS[id].label}
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Current market:{" "}
          <span className="font-medium text-foreground">{MARKETS[market].label}</span>. Crypto and
          forex remain global.
        </p>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-foreground">AI providers</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Primary and fallback keys stay local to this browser. No Lovable field is used.
            </p>
          </div>
          <span className="rounded-full border border-positive/30 bg-positive/10 px-2.5 py-1 text-[10px] text-positive">
            Multi-provider routing
          </span>
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {providers.map(([label, primary, fallback]) => (
            <div key={primary} className="rounded-xl border border-border/70 bg-background/40 p-3">
              <p className="text-xs font-medium text-foreground">{label}</p>
              <label className="mt-2 block text-[11px] text-muted-foreground">
                Primary
                <input
                  value={draft[primary]}
                  onChange={(e) => updateDraft(primary, e.target.value)}
                  type="password"
                  placeholder="API key"
                  className={field}
                />
              </label>
              <label className="mt-2 block text-[11px] text-muted-foreground">
                Fallback
                <input
                  value={draft[fallback]}
                  onChange={(e) => updateDraft(fallback, e.target.value)}
                  type="password"
                  placeholder="Optional fallback key"
                  className={field}
                />
              </label>
            </div>
          ))}
        </div>
        <label className="mt-4 block text-xs text-muted-foreground">
          TinyFish web-search key
          <input
            value={draft.tinyfish}
            onChange={(e) => updateDraft("tinyfish", e.target.value)}
            type="password"
            placeholder="Optional web-search provider key"
            className={field}
          />
        </label>
        <button
          type="button"
          onClick={saveSettings}
          className="mt-4 h-9 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground"
        >
          {saved ? "Saved" : "Save provider settings"}
        </button>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5">
        <p className="text-sm font-medium text-foreground">Preferred analyst model</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Choose the default model used when a new research chat starts.
        </p>
        <select
          value={preferredModel}
          onChange={(e) => setPreferredModel(e.target.value)}
          className={`${field} max-w-xl`}
        >
          {modelOptions.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
          {(apiKeys.customModels ?? []).map((item) => (
            <option key={item.id} value={item.id}>
              {item.label}
            </option>
          ))}
        </select>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5">
        <p className="text-sm font-medium text-foreground">Custom model registry</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Add any provider model ID and make it available in the Analyst picker.
        </p>
        <div className="mt-3 grid gap-2 md:grid-cols-[150px_1fr_1fr_auto]">
          <select
            value={customProvider}
            onChange={(e) => setCustomProvider(e.target.value as typeof customProvider)}
            className="h-9 rounded-lg border border-border bg-background px-2 text-xs text-foreground"
          >
            {providers.map(([label, id]) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </select>
          <input
            value={customModelId}
            onChange={(e) => setCustomModelId(e.target.value)}
            placeholder="provider model ID"
            className={field.replace("mt-1 ", "")}
          />
          <input
            value={customModelLabel}
            onChange={(e) => setCustomModelLabel(e.target.value)}
            placeholder="Display label"
            className={field.replace("mt-1 ", "")}
          />
          <button
            type="button"
            onClick={addCustomModel}
            className="h-9 rounded-lg border border-primary/40 px-3 text-xs text-primary"
          >
            Add
          </button>
        </div>
        {(apiKeys.customModels ?? []).length > 0 && (
          <div className="mt-3 space-y-2">
            {apiKeys.customModels?.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs"
              >
                <span className="font-medium text-foreground">{item.label}</span>
                <span className="truncate text-muted-foreground">{item.id}</span>
                <button
                  type="button"
                  onClick={() => removeCustomModel(item.id)}
                  className="ml-auto text-muted-foreground hover:text-negative"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-5">
          <p className="text-sm font-medium text-foreground">Live data refresh</p>
          <p className="mt-1 text-xs text-muted-foreground">
            How often quote tables re-poll market data.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {[30, 60, 120, 300].map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setRefreshSeconds(s)}
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
          <p className="text-sm font-medium text-foreground">Theme</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Switch between terminal, light and paper treatments.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {(["terminal", "light", "paper"] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setTheme(value)}
                className={cn(
                  "rounded-lg border px-3 py-1.5 text-xs capitalize",
                  theme === value
                    ? "border-primary/50 bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:text-foreground",
                )}
              >
                {value}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5">
        <p className="text-sm font-medium text-foreground">Saved screeners</p>
        {screeners.length === 0 ? (
          <p className="mt-1 text-xs text-muted-foreground">
            Build one in the Screener and save it — it appears under Screener Presets.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {screeners.map((s) => (
              <li key={s.id} className="flex items-center gap-2 text-sm text-foreground">
                <Star className="h-3.5 w-3.5 text-primary" />
                {s.name}
                <button
                  type="button"
                  onClick={() => deleteScreener(s.id)}
                  className="ml-auto text-muted-foreground hover:text-negative"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
