// Pure, client-safe helpers that normalize the trader MCP server's
// row-oriented JSON payloads into arrays the UI can chart and tabulate.

export type Candle = { t: string; o: number; h: number; l: number; c: number; v: number };
export type SeriesPoint = { t: string; c: number };

export function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

export function num(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v))) return Number(v);
  return null;
}

export function str(v: unknown): string | null {
  if (typeof v === "string" && v.length > 0) return v;
  if (typeof v === "number") return String(v);
  return null;
}

export function rows(raw: unknown): Record<string, unknown>[] {
  return Array.isArray(raw) ? raw.filter(isRecord) : [];
}

/** `[{ Date, Open, High, Low, Close, Volume }]` -> candles. */
export function toCandles(raw: unknown): Candle[] {
  return rows(raw)
    .map((r) => ({
      t: str(r["Date"]) ?? str(r["Datetime"]) ?? str(r["index"]) ?? "",
      o: num(r["Open"]) ?? 0,
      h: num(r["High"]) ?? 0,
      l: num(r["Low"]) ?? 0,
      c: num(r["Close"]) ?? 0,
      v: num(r["Volume"]) ?? 0,
    }))
    .filter((d) => d.c > 0 && d.t)
    .sort((a, b) => a.t.localeCompare(b.t));
}

export function toSeries(raw: unknown, valueKey: string): SeriesPoint[] {
  return rows(raw)
    .map((r) => ({
      t: str(r["Date"]) ?? str(r["index"]) ?? "",
      c: num(r[valueKey]) ?? 0,
    }))
    .filter((d) => d.c !== 0 && d.t)
    .sort((a, b) => a.t.localeCompare(b.t));
}

export type StatementTable = {
  columns: string[];
  rows: { label: string; values: (number | null)[] }[];
};

/**
 * `[{ index: "Total Revenue", "2025-09-30 00:00:00": 1234, ... }]`
 * -> table with newest period first and the preferred line items on top.
 */
export function toStatementTable(raw: unknown, preferred: string[]): StatementTable {
  const list = rows(raw);
  if (list.length === 0) return { columns: [], rows: [] };

  const periodSet = new Set<string>();
  for (const r of list) {
    for (const k of Object.keys(r)) if (k !== "index") periodSet.add(k);
  }
  const columns = [...periodSet].sort().reverse().slice(0, 5);

  const byLabel = new Map<string, Record<string, unknown>>();
  for (const r of list) {
    const label = str(r["index"]);
    if (label) byLabel.set(label, r);
  }
  const labels = [...byLabel.keys()];
  const ordered = [
    ...preferred.filter((p) => byLabel.has(p)),
    ...labels.filter((l) => !preferred.includes(l)).sort(),
  ];

  return {
    columns: columns.map((c) => c.slice(0, 10)),
    rows: ordered
      .map((label) => ({
        label,
        values: columns.map((c) => num(byLabel.get(label)?.[c])),
      }))
      .filter((r) => r.values.some((v) => v !== null)),
  };
}

/** Generic table for any list of records: infers columns from the rows. */
export type GenericTable = { columns: string[]; rows: Record<string, string>[] };

export function toGenericTable(raw: unknown, limit = 50, drop: string[] = ["index"]): GenericTable {
  const list = rows(raw).slice(0, limit);
  const columns: string[] = [];
  for (const r of list) {
    for (const k of Object.keys(r)) if (!drop.includes(k) && !columns.includes(k)) columns.push(k);
  }
  return {
    columns,
    rows: list.map((r) => {
      const out: Record<string, string> = {};
      for (const c of columns) {
        const v = r[c];
        out[c] =
          v === null || v === undefined
            ? "—"
            : typeof v === "number"
              ? Number.isInteger(v)
                ? v.toLocaleString()
                : v.toLocaleString(undefined, { maximumFractionDigits: 4 })
              : String(v).slice(0, 120);
      }
      return out;
    }),
  };
}
