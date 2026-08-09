import { useState } from "react";
import { Check, Copy, Download, X } from "lucide-react";
import { Mermaid } from "./Mermaid";
import type { Artifact } from "./artifact-types";
import { cn } from "@/lib/utils";

export function ArtifactPanel({ artifact, onClose }: { artifact: Artifact; onClose: () => void }) {
  const [tab, setTab] = useState<"preview" | "code">(artifact.kind === "code" ? "code" : "preview");
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(artifact.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const download = () => {
    const ext = artifact.kind === "mermaid" ? "mmd" : artifact.language === "text" ? "txt" : artifact.language;
    const url = URL.createObjectURL(new Blob([artifact.content], { type: "text/plain" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `artifact.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <aside className="flex h-full w-full flex-col border-l border-border bg-card">
      <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border px-4">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-foreground">{artifact.title}</p>
          <p className="text-[11px] text-muted-foreground">{artifact.language}</p>
        </div>
        {artifact.kind !== "code" && (
          <div className="flex rounded-lg border border-border p-0.5">
            {(["preview", "code"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={cn(
                  "rounded-md px-2.5 py-1 text-xs capitalize transition-colors",
                  tab === t ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {t}
              </button>
            ))}
          </div>
        )}
        <button type="button" onClick={copy} className="rounded-md p-1.5 text-muted-foreground hover:text-foreground">
          {copied ? <Check className="h-4 w-4 text-positive" /> : <Copy className="h-4 w-4" />}
        </button>
        <button
          type="button"
          onClick={download}
          className="rounded-md p-1.5 text-muted-foreground hover:text-foreground"
        >
          <Download className="h-4 w-4" />
        </button>
        <button type="button" onClick={onClose} className="rounded-md p-1.5 text-muted-foreground hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
      </header>

      <div className="flex-1 overflow-auto p-4">
        {tab === "preview" && artifact.kind === "mermaid" && <Mermaid code={artifact.content} />}
        {tab === "preview" && artifact.kind === "html" && (
          <iframe
            title={artifact.title}
            sandbox=""
            srcDoc={artifact.content}
            className="h-full min-h-[420px] w-full rounded-lg border border-border bg-white"
          />
        )}
        {tab === "preview" && artifact.kind === "table" && (
          <pre className="whitespace-pre-wrap font-mono text-xs text-foreground">{artifact.content}</pre>
        )}
        {(tab === "code" || artifact.kind === "code") && (
          <pre className="overflow-x-auto rounded-lg border border-border bg-muted/30 p-3">
            <code className="font-mono text-xs leading-relaxed text-foreground">{artifact.content}</code>
          </pre>
        )}
      </div>
    </aside>
  );
}
