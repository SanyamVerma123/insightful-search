import { useEffect, useRef } from "react";

function tradingViewSymbol(symbol: string) {
  if (symbol.endsWith(".NS")) return `NSE:${symbol.replace(/\.NS$/i, "")}`;
  if (symbol.endsWith(".BO")) return `BSE:${symbol.replace(/\.BO$/i, "")}`;
  if (symbol.endsWith("-USD")) return `COINBASE:${symbol.replace(/-USD$/i, "USD")}`;
  return `NASDAQ:${symbol}`;
}

export function TradingViewResearchChart({ symbol }: { symbol: string }) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const host = ref.current;
    if (!host) return;
    host.innerHTML = "";
    const widget = document.createElement("div");
    widget.className = "tradingview-widget-container__widget";
    widget.style.height = "100%";
    widget.style.width = "100%";
    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
    script.type = "text/javascript";
    script.async = true;
    script.textContent = JSON.stringify({
      autosize: true,
      symbol: tradingViewSymbol(symbol),
      interval: "D",
      timezone: "Etc/UTC",
      theme: "light",
      style: "1",
      locale: "en",
      enable_publishing: false,
      allow_symbol_change: false,
      calendar: false,
      hide_side_toolbar: false,
      hide_top_toolbar: false,
      save_image: false,
      support_host: "https://www.tradingview.com",
    });
    host.append(widget, script);
    return () => {
      host.innerHTML = "";
    };
  }, [symbol]);

  return (
    <div
      className="tradingview-widget-container h-[420px] min-h-[320px] w-full overflow-hidden rounded-xl border border-border bg-background/30"
      ref={ref}
    />
  );
}
