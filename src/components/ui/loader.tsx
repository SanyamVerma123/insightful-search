import { cn } from "@/lib/utils";

export function TextShimmerLoader({ text, size = "md" }: { text: string; size?: "sm" | "md" }) {
  return (
    <span
      className={cn(
        "animate-pulse text-muted-foreground",
        size === "sm" ? "text-[11px]" : "text-xs",
      )}
      role="status"
      aria-live="polite"
    >
      {text}
    </span>
  );
}
