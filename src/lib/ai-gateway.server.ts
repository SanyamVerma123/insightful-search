import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

type CompatibleProviderOptions = {
  name: string;
  baseURL: string;
  headers?: Record<string, string>;
};

/** Generic server-only factory for providers that implement OpenAI-compatible chat completions. */
export function createCompatibleProvider({ name, baseURL, headers }: CompatibleProviderOptions) {
  return createOpenAICompatible({
    name,
    baseURL,
    ...(headers ? { headers } : {}),
  });
}

/** OpenRouter — full catalog, routed through an OpenAI-compatible endpoint. */
export function createOpenRouterProvider(apiKey: string) {
  return createCompatibleProvider({
    name: "openrouter",
    baseURL: "https://openrouter.ai/api/v1",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "HTTP-Referer": "https://insightful-search.app",
      "X-Title": "Insightful Search Terminal",
    },
  });
}

/** Kilo AI Gateway — one key for hundreds of models. */
export function createKiloProvider(apiKey: string) {
  return createCompatibleProvider({
    name: "kilo",
    baseURL: "https://api.kilo.ai/api/gateway",
    headers: { Authorization: `Bearer ${apiKey}` },
  });
}

/** Groq — low-latency OpenAI-compatible inference. */
export function createGroqProvider(apiKey: string) {
  return createCompatibleProvider({
    name: "groq",
    baseURL: "https://api.groq.com/openai/v1",
    headers: { Authorization: `Bearer ${apiKey}` },
  });
}

/** Together AI — OpenAI-compatible hosted open models. */
export function createTogetherProvider(apiKey: string) {
  return createCompatibleProvider({
    name: "together",
    baseURL: "https://api.together.xyz/v1",
    headers: { Authorization: `Bearer ${apiKey}` },
  });
}

/** DeepSeek — OpenAI-compatible chat API. */
export function createDeepSeekProvider(apiKey: string) {
  return createCompatibleProvider({
    name: "deepseek",
    baseURL: "https://api.deepseek.com/v1",
    headers: { Authorization: `Bearer ${apiKey}` },
  });
}

/** OpenCode Zen — curated OpenAI-compatible gateway. */
export function createOpenCodeProvider(apiKey: string) {
  return createCompatibleProvider({
    name: "opencode",
    baseURL: "https://opencode.ai/zen/v1",
    headers: { Authorization: `Bearer ${apiKey}` },
  });
}
