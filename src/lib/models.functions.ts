import { createServerFn } from "@tanstack/react-start";

export type ChatProvider = "openrouter" | "kilo" | "groq" | "together" | "deepseek" | "opencode";

export type ChatModel = {
  id: string;
  label: string;
  provider: ChatProvider;
  note?: string;
};

type OpenRouterModel = { id?: string; name?: string };

type CatalogInput = {
  openrouterKey?: string;
  kiloKey?: string;
  groqKey?: string;
  togetherKey?: string;
  deepseekKey?: string;
  opencodeKey?: string;
};

const CURATED_MODELS: ChatModel[] = [
  {
    id: "openrouter:openai/gpt-4o-mini",
    label: "GPT-4o Mini",
    provider: "openrouter",
    note: "Fast",
  },
  {
    id: "kilo:anthropic/claude-sonnet-4.5",
    label: "Claude Sonnet 4.5",
    provider: "kilo",
    note: "Deep research",
  },
  {
    id: "kilo:nvidia/nemotron-3-ultra-550b-a55b:free",
    label: "Nemotron 3 Ultra · Free · 550B",
    provider: "kilo",
    note: "Free",
  },
  {
    id: "groq:llama-3.3-70b-versatile",
    label: "Llama 3.3 70B",
    provider: "groq",
    note: "Fast open model",
  },
  {
    id: "together:meta-llama/Llama-3.3-70B-Instruct-Turbo",
    label: "Llama 3.3 70B Turbo",
    provider: "together",
    note: "Balanced",
  },
  { id: "deepseek:deepseek-chat", label: "DeepSeek Chat", provider: "deepseek", note: "General" },
  {
    id: "deepseek:deepseek-reasoner",
    label: "DeepSeek Reasoner",
    provider: "deepseek",
    note: "Reasoning",
  },
  { id: "opencode:big-pickle", label: "Big Pickle · Zen", provider: "opencode", note: "General" },
];

function keyAvailable(value: string | undefined, envName: string) {
  return Boolean(value?.trim() || process.env[envName]);
}

export const listChatModels = createServerFn({ method: "GET" })
  .inputValidator((d: CatalogInput) => d)
  .handler(async ({ data }) => {
    const configuredProviders: Record<ChatProvider, boolean> = {
      openrouter: keyAvailable(data.openrouterKey, "OPENROUTER_API_KEY"),
      kilo: keyAvailable(data.kiloKey, "KILO_API_KEY"),
      groq: keyAvailable(data.groqKey, "GROQ_API_KEY"),
      together: keyAvailable(data.togetherKey, "TOGETHER_API_KEY"),
      deepseek: keyAvailable(data.deepseekKey, "DEEPSEEK_API_KEY"),
      opencode: keyAvailable(data.opencodeKey, "OPENCODE_ZEN_API_KEY"),
    };
    let openrouter: ChatModel[] = [];
    if (configuredProviders.openrouter) {
      try {
        const response = await fetch("https://openrouter.ai/api/v1/models");
        const json = (await response.json()) as { data?: OpenRouterModel[] };
        openrouter = (json.data ?? [])
          .filter((item): item is { id: string; name?: string } => typeof item.id === "string")
          .slice(0, 80)
          .map((item) => ({
            id: `openrouter:${item.id}`,
            label: item.name ?? item.id,
            provider: "openrouter" as const,
          }))
          .sort((a, b) => a.label.localeCompare(b.label));
      } catch {
        openrouter = [];
      }
    }
    return {
      models: [...CURATED_MODELS, ...openrouter],
      configuredProviders,
    };
  });
