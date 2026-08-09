import { useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { Loader2 } from "lucide-react";
import { PromptInput } from "@/components/ui/ai-chat-input";
import { Markdown } from "@/components/chat/Markdown";
import { ArtifactPanel } from "@/components/chat/ArtifactPanel";
import type { Artifact } from "@/components/chat/artifact-types";
import { cn } from "@/lib/utils";

const SUGGESTIONS = [
  "Compare TCS and Infosys on margins and valuation",
  "Draw a mermaid flowchart of NVIDIA's revenue drivers",
  "Build a table of the Magnificent 7 with P/E and 1Y growth",
  "What moved Reliance today and why?",
];

export function AIView() {
  const [error, setError] = useState<string | null>(null);
  const [artifact, setArtifact] = useState<Artifact | null>(null);
  const { messages, sendMessage, status, stop } = useChat({
    transport: new DefaultChatTransport({ api: "/api/chat" }),
    onError: (e) => setError(e.message),
  });
  const busy = status === "submitted" || status === "streaming";

  return (
    <div className="flex h-full min-h-0">
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
          <div className="mx-auto w-full max-w-3xl space-y-6">
            {messages.length === 0 && (
              <div className="py-10 text-center">
                <h1 className="text-2xl font-semibold tracking-tight text-foreground">AI market analyst</h1>
                <p className="mx-auto mt-2 max-w-lg text-sm text-muted-foreground">
                  Every answer is grounded in live quotes, fundamentals, analyst data and news. Ask for a table or a
                  mermaid diagram and it opens as an artifact.
                </p>
                <div className="mx-auto mt-6 grid max-w-xl gap-2 sm:grid-cols-2">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => void sendMessage({ text: s })}
                      className="rounded-xl border border-border bg-card p-3 text-left text-[13px] text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m) => (
              <div key={m.id} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
                <div
                  className={cn(
                    "max-w-[88%]",
                    m.role === "user"
                      ? "rounded-2xl bg-primary px-4 py-2.5 text-[15px] text-primary-foreground"
                      : "w-full",
                  )}
                >
                  {m.role === "user"
                    ? m.parts.map((p, i) => (p.type === "text" ? <span key={i}>{p.text}</span> : null))
                    : m.parts.map((p, i) =>
                        p.type === "text" ? (
                          <Markdown
                            key={i}
                            content={p.text}
                            messageId={`${m.id}-${i}`}
                            onOpenArtifact={setArtifact}
                          />
                        ) : p.type.startsWith("tool-") ? (
                          <span
                            key={i}
                            className="mr-1 mb-1 inline-flex items-center gap-1.5 rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground"
                          >
                            <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                            {p.type.replace("tool-", "").replace(/_/g, " ")}
                          </span>
                        ) : null,
                      )}
                </div>
              </div>
            ))}

            {status === "submitted" && (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Pulling live data…
              </p>
            )}
            {error && <p className="text-sm text-negative">{error}</p>}
          </div>
        </div>

        <div className="shrink-0 px-6 pb-6">
          <div className="mx-auto w-full max-w-3xl">
            <PromptInput
              autoFocus
              isStreaming={busy}
              onStop={() => void stop()}
              onSubmit={(text) => {
                setError(null);
                void sendMessage({ text });
              }}
            />
          </div>
        </div>
      </div>

      {artifact && (
        <div className="hidden w-[440px] shrink-0 lg:block">
          <ArtifactPanel artifact={artifact} onClose={() => setArtifact(null)} />
        </div>
      )}
    </div>
  );
}
