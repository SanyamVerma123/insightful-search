import { createServerFn } from "@tanstack/react-start";

export type ChatModel = {
  id: string;
  label: string;
  provider: "lovable" | "openrouter";
  note?: string;
};

const LOVABLE_MODELS: ChatModel[] = [
  { id: "lovable:openai/gpt-5.6-sol", label: "GPT-5.6 Sol", provider: "lovable", note: "Flagship reasoning" },
  { id: "lovable:openai/gpt-5.6-terra", label: "GPT-5.6 Terra", provider: "lovable", note: "Balanced" },
  { id: "lovable:openai/gpt-5.6-luna", label: "GPT-5.6 Luna", provider: "lovable", note: "Fast" },
  { id: "lovable:google/gemini-3.6-flash", label: "Gemini 3.6 Flash", provider: "lovable", note: "Fast" },
  { id: "lovable:google/gemini-3.1-pro-preview", label: "Gemini 3.1 Pro", provider: "lovable", note: "Deep" },
];

type OpenRouterModel = { id?: string; name?: string };

/** Model catalog for the chat picker: Lovable AI plus the live OpenRouter list. */
export const listChatModels = createServerFn({ method: "GET" }).handler(async () => {
  const hasOpenRouter = Boolean(process.env["OPENROUTER_API_KEY"]);
  let openrouter: ChatModel[] = [];

  if (hasOpenRouter) {
    try {
      const res = await fetch("https://openrouter.ai/api/v1/models");
      const json = (await res.json()) as { data?: OpenRouterModel[] };
      openrouter = (json.data ?? [])
        .filter((m): m is { id: string; name?: string } => typeof m.id === "string")
        .map((m) => ({
          id: `openrouter:${m.id}`,
          label: m.name ?? m.id,
          provider: "openrouter" as const,
        }))
        .sort((a, b) => a.label.localeCompare(b.label));
    } catch {
      openrouter = [];
    }
  }

  return { models: [...LOVABLE_MODELS, ...openrouter], hasOpenRouter };
});
