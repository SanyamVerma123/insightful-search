import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

/** Lovable AI Gateway provider — server-only; the key never reaches the client. */
export function createLovableAiGatewayProvider(apiKey: string) {
  return createOpenAICompatible({
    name: "lovable",
    baseURL: "https://ai.gateway.lovable.dev/v1",
    headers: { "Lovable-API-Key": apiKey },
  });
}
