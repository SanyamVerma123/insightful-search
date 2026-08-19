import { memo, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { BarChart3, Code2, Table2 } from "lucide-react";
import { Mermaid } from "./Mermaid";
import { HtmlPreview } from "./HtmlPreview";
import { artifactTitle, type Artifact } from "./artifact-types";
import { cn } from "@/lib/utils";

function kindFor(language: string, code: string): Artifact["kind"] {
  if (language === "mermaid") return "mermaid";
  if (language === "html" || language === "svg") return "html";
  if (!language && code.trim().startsWith("|")) return "table";
  return "code";
}

function ArtifactCard({ artifact, onOpen }: { artifact: Artifact; onOpen: (a: Artifact) => void }) {
  const Icon = artifact.kind === "mermaid" ? BarChart3 : artifact.kind === "table" ? Table2 : Code2;
  return (
    <button
      type="button"
      onClick={() => onOpen(artifact)}
      className="group my-3 flex w-full items-center gap-3 rounded-xl border border-border bg-card p-3 text-left transition-colors hover:border-primary/50 hover:bg-accent/40"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-foreground">{artifact.title}</span>
        <span className="block text-xs text-muted-foreground">
          {artifact.content.split("\n").length} lines · click to open
        </span>
      </span>
      <span className="text-xs text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100">
        Open
      </span>
    </button>
  );
}

/** Markdown renderer with GFM (bold, tables, lists) plus Claude-style artifacts. */
export const Markdown = memo(function Markdown({
  content,
  messageId,
  onOpenArtifact,
  inlineDiagrams = true,
}: {
  content: string;
  messageId: string;
  onOpenArtifact?: (a: Artifact) => void;
  inlineDiagrams?: boolean;
}) {
  const components = useMemo(
    () => ({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      code({ inline, className, children, ...props }: any) {
        const raw = String(children ?? "").replace(/\n$/, "");
        const language = /language-(\w+)/.exec(className || "")?.[1] ?? "";
        if (inline || (!language && !raw.includes("\n"))) {
          return (
            <code
              className="rounded bg-muted px-1.5 py-0.5 font-mono text-[0.85em] text-foreground"
              {...props}
            >
              {children}
            </code>
          );
        }
        const kind = kindFor(language, raw);
        const artifact: Artifact = {
          id: `${messageId}-${raw.length}-${language}`,
          kind,
          title: artifactTitle(kind, language),
          language: language || "text",
          content: raw,
        };
        if ((kind === "html" || kind === "mermaid") && inlineDiagrams && kind === "html") {
          return <HtmlPreview title={artifact.title} content={raw} compact={raw.length < 900} />;
        }
        if (kind === "mermaid" && inlineDiagrams) {
          return (
            <div className="my-3 rounded-xl border border-border bg-card p-4">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">Diagram</span>
                {onOpenArtifact && (
                  <button
                    type="button"
                    onClick={() => onOpenArtifact(artifact)}
                    className="text-xs text-primary hover:underline"
                  >
                    Open in panel
                  </button>
                )}
              </div>
              <Mermaid code={raw} />
            </div>
          );
        }
        if (onOpenArtifact && raw.split("\n").length > 4) {
          return <ArtifactCard artifact={artifact} onOpen={onOpenArtifact} />;
        }
        return (
          <pre className="my-3 overflow-x-auto rounded-xl border border-border bg-muted/40 p-3">
            <code className="font-mono text-xs text-foreground">{raw}</code>
          </pre>
        );
      },
      table: ({ children }: { children?: React.ReactNode }) => (
        <div className="my-3 overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">{children}</table>
        </div>
      ),
      thead: ({ children }: { children?: React.ReactNode }) => (
        <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
          {children}
        </thead>
      ),
      th: ({ children }: { children?: React.ReactNode }) => (
        <th className="border-b border-border px-3 py-2 text-left font-medium">{children}</th>
      ),
      td: ({ children }: { children?: React.ReactNode }) => (
        <td className="tabular border-b border-border px-3 py-2 text-foreground last:border-0">
          {children}
        </td>
      ),
      a: ({ children, href }: { children?: React.ReactNode; href?: string }) => (
        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          className="text-primary underline underline-offset-2"
        >
          {children}
        </a>
      ),
      ul: ({ children }: { children?: React.ReactNode }) => (
        <ul className="my-2 list-disc space-y-1 pl-5">{children}</ul>
      ),
      ol: ({ children }: { children?: React.ReactNode }) => (
        <ol className="my-2 list-decimal space-y-1 pl-5">{children}</ol>
      ),
      h1: ({ children }: { children?: React.ReactNode }) => (
        <h1 className="mt-4 mb-2 text-lg font-semibold text-foreground">{children}</h1>
      ),
      h2: ({ children }: { children?: React.ReactNode }) => (
        <h2 className="mt-4 mb-2 text-base font-semibold text-foreground">{children}</h2>
      ),
      h3: ({ children }: { children?: React.ReactNode }) => (
        <h3 className="mt-3 mb-1.5 text-sm font-semibold text-foreground">{children}</h3>
      ),
      p: ({ children }: { children?: React.ReactNode }) => (
        <p className="my-2 leading-relaxed">{children}</p>
      ),
      strong: ({ children }: { children?: React.ReactNode }) => (
        <strong className="font-semibold text-foreground">{children}</strong>
      ),
      blockquote: ({ children }: { children?: React.ReactNode }) => (
        <blockquote className="my-3 border-l-2 border-primary/50 pl-3 text-muted-foreground">
          {children}
        </blockquote>
      ),
      hr: () => <hr className="my-4 border-border" />,
    }),
    [messageId, onOpenArtifact, inlineDiagrams],
  );

  return (
    <div className={cn("text-[15px] leading-relaxed text-foreground")}>
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components as any}>
        {content}
      </ReactMarkdown>
    </div>
  );
});
