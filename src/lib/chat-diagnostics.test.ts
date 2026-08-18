import { describe, expect, it } from "vitest";
import {
  classifyChatError,
  createChatDiagnostic,
  parseChatDiagnostic,
  serializeChatDiagnostic,
} from "./chat-diagnostics";

describe("chat diagnostics", () => {
  it("classifies missing provider configuration", () => {
    const diagnostic = classifyChatError("No configured AI provider is available", {
      requestId: "req-missing",
    });
    expect(diagnostic.category).toBe("missing_configuration");
    expect(diagnostic.code).toBe("PROVIDER_KEY_MISSING");
    expect(diagnostic.requestId).toBe("req-missing");
  });

  it("classifies authentication and access rejection", () => {
    expect(classifyChatError(Object.assign(new Error("Forbidden"), { status: 403 })).category).toBe(
      "authentication",
    );
    expect(classifyChatError(Object.assign(new Error("Unauthorized"), { status: 401 })).category).toBe(
      "authentication",
    );
  });

  it("classifies rate limits and preserves a retry hint", () => {
    const diagnostic = classifyChatError(Object.assign(new Error("Too many requests; retry-after 12"), { status: 429 }));
    expect(diagnostic.category).toBe("rate_limit");
    expect(diagnostic.retryAfterSeconds).toBe(12);
    expect(diagnostic.retryable).toBe(true);
  });

  it("classifies credits and unsupported requests", () => {
    expect(classifyChatError(Object.assign(new Error("Payment Required"), { status: 402 })).category).toBe(
      "credits",
    );
    expect(classifyChatError("model rejected reasoning_effort and tools").category).toBe("unsupported_request");
  });

  it("classifies network, interrupted, and tool failures", () => {
    expect(classifyChatError(new Error("fetch failed: gateway timeout")).category).toBe("network");
    expect(classifyChatError(new Error("stream ended prematurely")).category).toBe("interrupted");
    expect(classifyChatError(new Error("tool execution failed")).category).toBe("tool_failure");
  });

  it("round-trips only the safe diagnostic envelope", () => {
    const original = createChatDiagnostic("authentication", {
      provider: "Kilo AI",
      model: "nvidia/nemotron-3-ultra-550b-a55b:free",
      requestId: "req-safe",
    });
    const parsed = parseChatDiagnostic(new Error(serializeChatDiagnostic(original)));
    expect(parsed).toMatchObject({
      type: "chat-diagnostic",
      category: "authentication",
      requestId: "req-safe",
    });
    expect(serializeChatDiagnostic(original)).not.toContain("Authorization");
    expect(serializeChatDiagnostic(original)).not.toContain("apiKey");
  });

  it("does not parse arbitrary raw provider text as a diagnostic", () => {
    expect(parseChatDiagnostic(new Error("Forbidden raw provider stack trace"))).toBeNull();
  });
});
