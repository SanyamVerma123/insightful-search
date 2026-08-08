import { cn } from "@/lib/utils";

export function DeltaBadge({
  value,
  absolute,
  currency,
  className,
  size = "md",
}: {
  value: number | null | undefined;
  absolute?: number | null | undefined;
  currency?: string | null | undefined;
  className?: string | undefined;
  size?: "sm" | "md" | "lg" | undefined;
}) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return <span className={cn("text-muted-foreground", className)}>—</span>;
  }
  const up = value >= 0;
  const sizes = { sm: "text-xs", md: "text-sm", lg: "text-base" };
  const symbol = currency === "INR" ? "₹" : currency === "USD" ? "$" : "";

  return (
    <span
      className={cn(
        "tabular inline-flex items-center gap-1 font-medium",
        up ? "text-positive" : "text-negative",
        sizes[size],
        className,
      )}
    >
      <span aria-hidden="true">{up ? "▲" : "▼"}</span>
      {absolute !== null && absolute !== undefined && Number.isFinite(absolute) ? (
        <span>
          {symbol}
          {Math.abs(absolute).toFixed(2)}
        </span>
      ) : null}
      <span>
        ({up ? "+" : "−"}
        {Math.abs(value).toFixed(2)}%)
      </span>
    </span>
  );
}
