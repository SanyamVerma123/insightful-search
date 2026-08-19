import { useState } from "react";

export function HtmlPreview({
  content,
  title = "Generated visual",
  compact = false,
}: {
  content: string;
  title?: string | undefined;
  compact?: boolean | undefined;
}) {
  const [loaded, setLoaded] = useState(false);
  const [showSource, setShowSource] = useState(false);

  return (
    <div className="my-3 overflow-hidden rounded-xl border border-border/80 bg-card shadow-sm">
      <div className="flex items-center justify-between gap-2 border-b border-border/70 px-3 py-2">
        <div className="min-w-0">
          <p className="truncate text-xs font-medium text-foreground">{title}</p>
          <p className="text-[10px] text-muted-foreground">Sandboxed HTML preview</p>
        </div>
        <button
          type="button"
          onClick={() => setShowSource((value) => !value)}
          className="shrink-0 rounded-md border border-border/70 px-2 py-1 text-[10px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          {showSource ? "Preview" : "Source"}
        </button>
      </div>
      {showSource ? (
        <pre className="max-h-72 overflow-auto whitespace-pre-wrap bg-background/40 p-3 text-[11px] leading-5 text-muted-foreground">
          <code>{content}</code>
        </pre>
      ) : (
        <div className={compact ? "h-44" : "h-64 sm:h-80"}>
          {!loaded && (
            <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
              Preparing visual preview…
            </div>
          )}
          <iframe
            title={title}
            sandbox="allow-scripts"
            srcDoc={content}
            onLoad={() => setLoaded(true)}
            className={`h-full w-full border-0 bg-white ${loaded ? "block" : "hidden"}`}
            referrerPolicy="no-referrer"
          />
        </div>
      )}
    </div>
  );
}
