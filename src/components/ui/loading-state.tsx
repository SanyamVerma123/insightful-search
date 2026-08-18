import { cn } from "@/lib/utils";

export function InlineLoading({
  label,
  variant = "pulse-dot",
}: {
  label: string;
  variant?: "pulse-dot" | "wave";
}) {
  return (
    <span
      className="inline-flex items-center gap-2 text-[11px] text-muted-foreground"
      role="status"
      aria-live="polite"
    >
      <span
        className={cn("inline-flex items-center gap-0.5", variant === "wave" && "animate-pulse")}
        aria-hidden="true"
      >
        <span className="tool-dot h-1.5 w-1.5 rounded-full bg-primary" />
        <span className="tool-dot tool-dot-delay-1 h-1.5 w-1.5 rounded-full bg-primary" />
        <span className="tool-dot tool-dot-delay-2 h-1.5 w-1.5 rounded-full bg-primary" />
      </span>
      {label}
    </span>
  );
}
