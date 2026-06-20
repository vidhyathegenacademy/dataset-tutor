import { createServerFn } from "@tanstack/react-start";
import { generateText, Output } from "ai";
import { z } from "zod";

const FailureItem = z.object({
  id: z.string(),
  input: z.string().default(""),
  groundTruth: z.string().default(""),
  prediction: z.string().default(""),
  notes: z.string().default(""),
  reasons: z.array(z.string()).default([]),
});

const Input = z.object({
  failures: z.array(FailureItem).min(1),
  existingCategories: z
    .array(z.object({ id: z.string(), name: z.string(), description: z.string().optional() }))
    .default([]),
  maxCategories: z.number().int().min(2).max(10).default(5),
});

const OutputSchema = z.object({
  categories: z
    .array(
      z.object({
        name: z.string().describe("Short label, 2-5 words"),
        description: z.string().describe("Root-cause pattern these failures share, plus a fix hint"),
        failureIds: z.array(z.string()).describe("IDs of failure rows assigned to this category"),
      }),
    )
    .min(1),
});

export const clusterFailures = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Missing LOVABLE_API_KEY");

    const { createLovableAiGatewayProvider } = await import("./ai-gateway.server");
    const gateway = createLovableAiGatewayProvider(key);

    const trimmed = data.failures.map((f) => ({
      id: f.id,
      input: f.input.slice(0, 600),
      groundTruth: f.groundTruth.slice(0, 600),
      prediction: f.prediction.slice(0, 600),
      notes: f.notes.slice(0, 300),
      reasons: f.reasons.slice(0, 6),
    }));

    const prompt = [
      `You are an expert evaluator analyzing failed LLM predictions to discover recurring failure modes.`,
      `Group the following ${trimmed.length} failures into at most ${data.maxCategories} clearly-distinct failure categories based on the underlying root cause (not surface details).`,
      data.existingCategories.length
        ? `Reuse the names/descriptions of these existing categories where they fit:\n${data.existingCategories
            .map((c) => `- ${c.name}: ${c.description ?? ""}`)
            .join("\n")}`
        : "",
      `Every failure id MUST appear in exactly one category. Category names should be short and human-readable. Descriptions should explain the shared pattern AND a likely fix.`,
      ``,
      `FAILURES (JSON):`,
      JSON.stringify(trimmed),
    ]
      .filter(Boolean)
      .join("\n");

    const { experimental_output } = await generateText({
      model: gateway("google/gemini-3-flash-preview"),
      experimental_output: Output.object({ schema: OutputSchema }),
      prompt,
    });

    return experimental_output;
  });
