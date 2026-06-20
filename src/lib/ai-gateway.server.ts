import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

export type ClusterLlmProvider = "openai" | "custom" | "lovable";

export type ClusterLlmConfig = {
  provider?: ClusterLlmProvider;
  model?: string;
  apiKey?: string;
  baseURL?: string;
};

const DEFAULT_OPENAI_MODEL = "gpt-5.5";
const DEFAULT_LOVABLE_MODEL = "google/gemini-3-flash-preview";

export function createLovableAiGatewayProvider(apiKey: string) {
  return createOpenAICompatible({
    name: "lovable-ai-gateway",
    baseURL: "https://ai.gateway.lovable.dev/v1",
    headers: { "Lovable-API-Key": apiKey },
  });
}

export function createClusterLlmProvider(config: ClusterLlmConfig = {}) {
  const provider = config.provider ?? "openai";

  if (provider === "openai") {
    const apiKey = config.apiKey?.trim() || process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("Missing OPENAI_API_KEY");

    return {
      model: config.model?.trim() || process.env.OPENAI_MODEL || DEFAULT_OPENAI_MODEL,
      gateway: createOpenAICompatible({
        name: "openai",
        baseURL: "https://api.openai.com/v1",
        apiKey,
        supportsStructuredOutputs: true,
      }),
    };
  }

  if (provider === "custom") {
    const apiKey = config.apiKey?.trim() || process.env.OPENAI_COMPATIBLE_API_KEY;
    const baseURL = config.baseURL?.trim() || process.env.OPENAI_COMPATIBLE_BASE_URL;
    const model = config.model?.trim() || process.env.OPENAI_COMPATIBLE_MODEL;
    if (!apiKey) throw new Error("Missing OPENAI_COMPATIBLE_API_KEY");
    if (!baseURL) throw new Error("Missing OPENAI_COMPATIBLE_BASE_URL");
    if (!model) throw new Error("Missing OPENAI_COMPATIBLE_MODEL");

    return {
      model,
      gateway: createOpenAICompatible({
        name: "custom-openai-compatible",
        baseURL,
        apiKey,
        supportsStructuredOutputs: true,
      }),
    };
  }

  const apiKey = config.apiKey?.trim() || process.env.LOVABLE_API_KEY;
  if (!apiKey) throw new Error("Missing LOVABLE_API_KEY");

  return {
    model: config.model?.trim() || process.env.LOVABLE_MODEL || DEFAULT_LOVABLE_MODEL,
    gateway: createLovableAiGatewayProvider(apiKey),
  };
}
