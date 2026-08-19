import { useEffect, useId, useRef, useState } from "react";

/** Renders a mermaid diagram. Mermaid is loaded lazily in the browser only. */
export function Mermaid({ code }: { code: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const id = useId().replace(/[^a-zA-Z0-9]/g, "");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const mermaid = (await import("mermaid")).default;
        mermaid.initialize({
          startOnLoad: false,
          theme: "dark",
          securityLevel: "strict",
          suppressErrorRendering: true,
          themeVariables: {
            background: "transparent",
            primaryColor: "#0f766e",
            primaryTextColor: "#e6e8ea",
            lineColor: "#5b6570",
            fontFamily: "Inter, ui-sans-serif, system-ui",
          },
        });
        mermaid.setParseErrorHandler(() => undefined);
        const parsed = await mermaid.parse(code, { suppressErrors: true });
        if (!parsed) throw new Error("Diagram syntax could not be validated");
        const { svg } = await mermaid.render(`m${id}`, code);
        if (!cancelled && ref.current) {
          ref.current.replaceChildren();
          ref.current.insertAdjacentHTML("beforeend", svg);
          setError(null);
        }
      } catch {
        if (!cancelled) {
          ref.current?.replaceChildren();
          setError("Diagram could not be rendered");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [code, id]);

  if (error) {
    return (
      <div className="rounded-xl border border-border/80 bg-muted/20 p-4">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <span className="h-2 w-2 rounded-full bg-primary" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground">Visual preview unavailable</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              The analyst returned a diagram that could not be drawn in this browser. The research
              response is still available below, and you can open the source from the artifact
              panel.
            </p>
          </div>
        </div>
        <details className="mt-3 rounded-lg border border-border/70 bg-background/35 p-2">
          <summary className="cursor-pointer text-[11px] font-medium text-muted-foreground">
            View diagram source
          </summary>
          <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap text-[11px] text-muted-foreground">
            {code}
          </pre>
        </details>
      </div>
    );
  }
  return (
    <div
      ref={ref}
      className="mermaid-host flex w-full justify-center overflow-x-auto [&_svg]:max-w-full"
    />
  );
}
