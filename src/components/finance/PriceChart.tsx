import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { Candle } from "@/lib/finance-types";
import { fmtPrice } from "@/lib/format";

type Props = {
  candles: Candle[];
  currency?: string | null;
  height?: number;
  compact?: boolean;
};

export function PriceChart({ candles, currency, height = 320, compact = false }: Props) {
  if (candles.length < 2) {
    return (
      <div
        className="flex items-center justify-center rounded-xl border border-border bg-surface text-sm text-muted-foreground"
        style={{ height }}
      >
        No price data for this range
      </div>
    );
  }

  const first = candles[0]!.c;
  const last = candles[candles.length - 1]!.c;
  const up = last >= first;
  const color = up ? "var(--positive)" : "var(--negative)";
  const values = candles.map((c) => c.c);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const pad = (max - min) * 0.08 || max * 0.02;

  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={candles} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="priceFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.3} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          {!compact && <CartesianGrid stroke="var(--border)" strokeDasharray="2 6" vertical={false} />}
          <XAxis
            dataKey="t"
            hide={compact}
            tickLine={false}
            axisLine={false}
            minTickGap={48}
            tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
            tickFormatter={(v: string) =>
              new Date(v.replace(" ", "T")).toLocaleDateString(undefined, { month: "short", day: "numeric" })
            }
          />
          <YAxis
            hide={compact}
            orientation="right"
            domain={[min - pad, max + pad]}
            tickLine={false}
            axisLine={false}
            width={64}
            tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
            tickFormatter={(v: number) => v.toFixed(v > 1000 ? 0 : 2)}
          />
          <Tooltip
            cursor={{ stroke: "var(--muted-foreground)", strokeDasharray: "3 3" }}
            contentStyle={{
              background: "var(--popover)",
              border: "1px solid var(--border)",
              borderRadius: 12,
              fontSize: 12,
            }}
            labelStyle={{ color: "var(--muted-foreground)" }}
            labelFormatter={(v: string) => new Date(v.replace(" ", "T")).toLocaleString()}
            formatter={(v: number) => [fmtPrice(v, currency), "Close"]}
          />
          <Area
            type="monotone"
            dataKey="c"
            stroke={color}
            strokeWidth={2}
            fill="url(#priceFill)"
            dot={false}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
