import { Area, AreaChart, ResponsiveContainer } from "recharts";
import type { SeriesPoint } from "@/lib/finance-types";

export function Sparkline({ points, up }: { points: SeriesPoint[]; up: boolean }) {
  if (points.length < 2) return <div className="h-10 w-full" />;
  const color = up ? "var(--positive)" : "var(--negative)";
  const id = `spark-${up ? "up" : "down"}`;

  return (
    <div className="h-10 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={points} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.35} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="c"
            stroke={color}
            strokeWidth={1.5}
            fill={`url(#${id})`}
            isAnimationActive={false}
            dot={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
