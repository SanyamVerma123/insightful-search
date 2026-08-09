import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { SiteHeader } from "@/components/finance/SiteHeader";
import { PromptInput } from "@/components/ui/ai-chat-input";
import { Markdown } from "@/components/chat/Markdown";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/chat")({
  head: () => ({
    meta: [
      { title: "AI Market Analyst — Screener" },
      {
        name: "description",
        content: "Ask an AI analyst about any stock; it reads live quotes, financials, analyst targets and news.",
      },
      { property: "og:title", content: "AI Market Analyst — Screener" },
      { property: "og:description", content: "Live-data answers about companies, valuation and market moves." },
    ],
  }),
  component: ChatPage,
});

function ChatPage() {
  const [error, setError] = useState<string | null>(null);
  const { messages, sendMessage, status, stop } = useChat({
    transport: new DefaultChatTransport({ api: "/api/chat" }),
    onError: (e) => setError(e.message),
  });
  const busy = status === "submitted" || status === "streaming";

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 py-8">
        <div className="flex-1 space-y-6">
          {messages.length === 0 && (
            <div className="py-16 text-center">
              <h1 className="text-3xl font-semibold tracking-tight text-foreground">AI market analyst</h1>
              <p className="mt-3 text-sm text-muted-foreground">
                Ask about valuation, margins, analyst targets or today's move — answers come with live numbers.
              </p>
            </div>
          )}

          {messages.map((m) => (
            <div key={m.id} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
              <div
                className={cn(
                  "max-w-[85%] text-[15px] leading-relaxed",
                  m.role === "user"
                    ? "rounded-2xl bg-primary px-4 py-2.5 text-primary-foreground"
                    : "text-foreground",
                )}
              >
                {m.parts.map((p, i) =>
                  p.type === "text" ? (
                    m.role === "user" ? (
                      <span key={i}>{p.text}</span>
                    ) : (
                      <Markdown key={i} content={p.text} messageId={`${m.id}-${i}`} />
                    )
                  ) : p.type.startsWith("tool-") ? (
                    <span
                      key={i}
                      className="mr-1 inline-block rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground"
                    >
                      {p.type.replace("tool-", "")}
                    </span>
                  ) : null,
                )}
              </div>
            </div>
          ))}

          {status === "submitted" && <p className="animate-pulse text-sm text-muted-foreground">Thinking…</p>}
          {error && <p className="text-sm text-negative">{error}</p>}
        </div>

        <div className="sticky bottom-4 mt-8">
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
      </main>
    </div>
  );
}
