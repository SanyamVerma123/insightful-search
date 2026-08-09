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
          themeVariables: {
            background: "transparent",
            primaryColor: "#0f766e",
            primaryTextColor: "#e6e8ea",
            lineColor: "#5b6570",
            fontFamily: "Inter, ui-sans-serif, system-ui",
          },
        });
        const { svg } = await mermaid.render(`m${id}`, code);
        if (!cancelled && ref.current) {
          ref.current.innerHTML = svg;
          setError(null);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Diagram could not be rendered");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [code, id]);

  if (error) {
    return (
      <div className="rounded-lg border border-border bg-muted/30 p-3">
        <p className="text-xs text-negative">Diagram error: {error}</p>
        <pre className="mt-2 overflow-x-auto text-[11px] text-muted-foreground">{code}</pre>
      </div>
    );
  }
  return <div ref={ref} className="mermaid-host flex w-full justify-center overflow-x-auto [&_svg]:max-w-full" />;
}
