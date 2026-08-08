// Pure, client-safe helpers that normalize pandas-style column dicts from the
// YFinance MCP server into arrays the UI can chart and tabulate.

export type Candle = { t: string; o: number; h: number; l: number; c: number; v: number };
export type SeriesPoint = { t: string; c: number };

type ColumnMap = Record<string, Record<string, number | null>>;

export function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

export function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

export function str(v: unknown): string | null {
  return typeof v === "string" && v.length > 0 ? v : null;
}

/** `{ Open: { "2026-07-08 ...": 311 }, ... }` -> sorted candles. */
export function toCandles(raw: unknown): Candle[] {
  if (!isRecord(raw)) return [];
  const cols = raw as unknown as ColumnMap;
  const close = cols["Close"] ?? cols["close"];
  if (!close) return [];
  const keys = Object.keys(close).sort();
  const pick = (col: Record<string, number | null> | undefined, k: string) => num(col?.[k]) ?? 0;
  return keys
    .map((k) => ({
      t: k,
      o: pick(cols["Open"], k),
      h: pick(cols["High"], k),
      l: pick(cols["Low"], k),
      c: pick(close, k),
      v: pick(cols["Volume"], k),
    }))
    .filter((d) => d.c > 0);
}

/** `{ "2026-07-08": 313.39 }` -> sorted series. */
export function toSeries(raw: unknown): SeriesPoint[] {
  if (!isRecord(raw)) return [];
  return Object.keys(raw)
    .sort()
    .map((k) => ({ t: k, c: num((raw as Record<string, unknown>)[k]) ?? 0 }))
    .filter((d) => d.c > 0);
}

export type StatementTable = { columns: string[]; rows: { label: string; values: (number | null)[] }[] };

/** `{ "2025-09-30": { "Net Income": 1, ... } }` -> table with newest column first. */
export function toStatementTable(raw: unknown, preferred: string[]): StatementTable {
  if (!isRecord(raw)) return { columns: [], rows: [] };
  const columns = Object.keys(raw).sort().reverse().slice(0, 5);
  const labels = new Set<string>();
  for (const col of columns) {
    const entry = raw[col];
    if (isRecord(entry)) Object.keys(entry).forEach((l) => labels.add(l));
  }
  const ordered = [
    ...preferred.filter((p) => labels.has(p)),
    ...[...labels].filter((l) => !preferred.includes(l)).sort(),
  ];
  const rows = ordered
    .map((label) => ({
      label,
      values: columns.map((col) => {
        const entry = raw[col];
        return isRecord(entry) ? num(entry[label]) : null;
      }),
    }))
    .filter((r) => r.values.some((v) => v !== null));
  return { columns, rows };
}

/** `{ Firm: { ts: "JP Morgan" }, ToGrade: {...} }` -> row objects, newest first. */
export function toRecords(raw: unknown, limit = 25): Record<string, string>[] {
  if (!isRecord(raw)) return [];
  const cols = Object.keys(raw);
  const first = cols[0] ? raw[cols[0]] : undefined;
  if (!isRecord(first)) return [];
  const keys = Object.keys(first).sort().reverse().slice(0, limit);
  return keys.map((k) => {
    const row: Record<string, string> = { date: k };
    for (const col of cols) {
      const entry = raw[col];
      if (isRecord(entry)) {
        const v = entry[k];
        row[col] = v === null || v === undefined ? "" : String(v);
      }
    }
    return row;
  });
}
