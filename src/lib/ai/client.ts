import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { z } from "zod";

/**
 * Model for every AI feature. Defaults to Claude Haiku 4.5: fast and costs a
 * fraction of a cent per call analysis. Set ANTHROPIC_MODEL (e.g.
 * "claude-sonnet-5" or "claude-opus-5") when accuracy matters more than cost.
 */
export const AI_MODEL = process.env.ANTHROPIC_MODEL || "claude-haiku-4-5";

export function aiEnabled() {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

let client: Anthropic | null = null;

/**
 * One structured-output request. Returns the parsed object, or null when the
 * model refuses or the output is cut off, so callers can fall back to rules.
 */
export async function generateStructured<S extends z.ZodType>(opts: {
  schema: S;
  system: string;
  prompt: string;
  maxTokens?: number;
}): Promise<z.infer<S> | null> {
  client ??= new Anthropic();
  const response = await client.messages.parse({
    model: AI_MODEL,
    max_tokens: opts.maxTokens ?? 4000,
    system: opts.system,
    messages: [{ role: "user", content: opts.prompt }],
    output_config: { format: zodOutputFormat(opts.schema) },
  });
  if (response.stop_reason === "refusal" || response.stop_reason === "max_tokens") return null;
  return (response.parsed_output as z.infer<S> | null) ?? null;
}
