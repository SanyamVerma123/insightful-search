const CURRENCY_SYMBOL: Record<string, string> = {
  USD: "$",
  INR: "₹",
  EUR: "€",
  GBP: "£",
  JPY: "¥",
};

export function currencySymbol(code?: string | null): string {
  if (!code) return "";
  return CURRENCY_SYMBOL[code] ?? `${code} `;
}

export function fmtPrice(value: number | null | undefined, code?: string | null): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return `${currencySymbol(code)}${value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function fmtNumber(value: number | null | undefined, digits = 2): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return value.toLocaleString(undefined, { maximumFractionDigits: digits });
}

export function fmtCompact(value: number | null | undefined, code?: string | null): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  const sym = currencySymbol(code);
  const units: [number, string][] = [
    [1e12, "T"],
    [1e9, "B"],
    [1e6, "M"],
    [1e3, "K"],
  ];
  for (const [size, suffix] of units) {
    if (abs >= size) return `${sign}${sym}${(abs / size).toFixed(2)}${suffix}`;
  }
  return `${sign}${sym}${abs.toFixed(2)}`;
}

export function fmtPercent(value: number | null | undefined, alreadyPercent = false): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  const pct = alreadyPercent ? value : value * 100;
  return `${pct >= 0 ? "+" : ""}${pct.toFixed(2)}%`;
}

export function fmtDate(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value.replace(" ", "T"));
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

export function fmtDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value.replace(" ", "T"));
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function timeAgo(value: string | null | undefined): string {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const mins = Math.round((Date.now() - d.getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

/** Humanizes yfinance statement labels that arrive as Title Case strings. */
export function labelize(label: string): string {
  return label.replace(/([a-z])([A-Z])/g, "$1 $2");
}
