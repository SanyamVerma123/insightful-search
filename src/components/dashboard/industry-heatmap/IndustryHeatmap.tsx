import { useMemo, useState } from "react";
export type IndustryTable = {
  columns: string[];
  rows: Record<string, string>[];
};

type IndustryItem = {
  label: string;
  value: number;
};

type Tile = IndustryItem & {
  x: number;
  y: number;
  width: number;
  height: number;
  intensity: number;
};

const WIDTH = 1000;
const HEIGHT = 520;

function numeric(value: string | undefined) {
  if (!value) return null;
  const parsed = Number(String(value).replace(/[%,$₹,]/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function readItems(table: IndustryTable | undefined): IndustryItem[] {
  return (table?.rows ?? [])
    .map((row) => {
      const label =
        row["name"] ?? row["industry"] ?? row["key"] ?? Object.values(row)[0] ?? "Industry";
      const raw = row["market weight"] ?? row["marketWeight"] ?? row["weight"] ?? "";
      const parsed = numeric(raw);
      const value = parsed !== null && parsed <= 1 ? parsed * 100 : parsed;
      return value !== null ? { label, value: Math.max(value, 0.01) } : null;
    })
    .filter((item): item is IndustryItem => item !== null)
    .sort((a, b) => b.value - a.value)
    .slice(0, 18);
}

function layoutMosaic(items: IndustryItem[]): Tile[] {
  const total = items.reduce((sum, item) => sum + item.value, 0);
  const targetRowValue = total / Math.max(2, Math.ceil(Math.sqrt(items.length)));
  const rows: IndustryItem[][] = [];
  let current: IndustryItem[] = [];
  let currentValue = 0;

  for (const item of items) {
    current.push(item);
    currentValue += item.value;
    if (currentValue >= targetRowValue && rows.length < 3) {
      rows.push(current);
      current = [];
      currentValue = 0;
    }
  }
  if (current.length > 0) rows.push(current);

  let y = 0;
  return rows.flatMap((row) => {
    const rowValue = row.reduce((sum, item) => sum + item.value, 0);
    const rowHeight = (rowValue / total) * HEIGHT;
    let x = 0;
    const tiles = row.map((item) => {
      const width = (item.value / rowValue) * WIDTH;
      const tile: Tile = {
        ...item,
        x,
        y,
        width,
        height: rowHeight,
        intensity: Math.max(14, Math.min(90, 16 + (item.value / items[0]!.value) * 74)),
      };
      x += width;
      return tile;
    });
    y += rowHeight;
    return tiles;
  });
}

function shorten(label: string, length: number) {
  return label.length > length ? `${label.slice(0, Math.max(1, length - 1))}…` : label;
}

export function IndustryHeatmap({ table }: { table?: IndustryTable | undefined }) {
  const items = useMemo(() => readItems(table), [table]);
  const tiles = useMemo(() => layoutMosaic(items), [items]);
  const [hovered, setHovered] = useState<string | null>(null);

  if (items.length === 0) {
    return (
      <div className="flex min-h-40 items-center justify-center rounded-2xl border border-dashed border-border/80 bg-card/30 p-6 text-center">
        <div>
          <p className="text-sm font-medium text-foreground">No heatmap data yet</p>
          <p className="mt-1 text-xs text-muted-foreground">
            The provider has not returned numeric industry weights for this sector.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-hidden bg-background/20 p-2 sm:p-3">
      <div className="rounded-2xl border border-border/70 bg-card/45 p-1.5 shadow-inner shadow-primary/5 sm:p-2">
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          className="h-[238px] w-full sm:h-[320px] lg:h-[360px]"
          role="img"
          aria-label="Industry market weight heatmap"
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id="industryHeatmapGlow" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.18" />
              <stop offset="100%" stopColor="var(--primary)" stopOpacity="0.02" />
            </linearGradient>
          </defs>
          <rect width={WIDTH} height={HEIGHT} rx={22} fill="url(#industryHeatmapGlow)" />
          {tiles.map((tile) => {
            const active = hovered === tile.label;
            const inset = active ? 2 : 5;
            const canLabel = tile.width > 104 && tile.height > 60;
            const compactLabel = tile.width > 62 && tile.height > 34;
            return (
              <g
                key={tile.label}
                role="img"
                aria-label={`${tile.label}, ${tile.value.toFixed(2)} percent weight`}
                onMouseEnter={() => setHovered(tile.label)}
                onMouseLeave={() => setHovered(null)}
                className="cursor-default"
              >
                <title>{`${tile.label}: ${tile.value.toFixed(2)}% weight`}</title>
                <rect
                  x={tile.x + inset}
                  y={tile.y + inset}
                  width={Math.max(tile.width - inset * 2, 1)}
                  height={Math.max(tile.height - inset * 2, 1)}
                  rx={active ? 16 : 12}
                  fill={`color-mix(in oklab, var(--primary) ${tile.intensity}%, var(--muted))`}
                  stroke={active ? "var(--primary)" : "var(--border)"}
                  strokeWidth={active ? 3 : 1}
                  strokeOpacity={active ? 0.95 : 0.72}
                  opacity={hovered && !active ? 0.62 : 1}
                />
                {canLabel ? (
                  <>
                    <text
                      x={tile.x + 16}
                      y={tile.y + 30}
                      fill="var(--foreground)"
                      fontSize={15}
                      fontWeight={700}
                    >
                      {shorten(tile.label, 20)}
                    </text>
                    <text
                      x={tile.x + 16}
                      y={tile.y + 52}
                      fill="var(--muted-foreground)"
                      fontSize={12}
                    >
                      {tile.value.toFixed(2)}% weight
                    </text>
                  </>
                ) : compactLabel ? (
                  <text
                    x={tile.x + 10}
                    y={tile.y + Math.min(tile.height - 10, 24)}
                    fill="var(--foreground)"
                    fontSize={10}
                    fontWeight={600}
                  >
                    {shorten(tile.label, 12)}
                  </text>
                ) : null}
              </g>
            );
          })}
        </svg>
      </div>
      <div className="mt-2 flex items-center justify-between gap-2 px-1 text-[10px] text-muted-foreground">
        <span className="truncate">Tiles scale with industry weight</span>
        <span className="shrink-0 text-primary">Hover to spotlight</span>
      </div>
    </div>
  );
}
