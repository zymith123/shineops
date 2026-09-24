import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import type { HealthSignals } from "./signals";
import { statusForScore, type Assessment } from "./rules";

const AssessmentSchema = z.object({
  score: z.number().int().min(0).max(100).describe("0 = about to cancel, 100 = very happy"),
  summary: z.string().describe("One or two sentences an owner can read at a glance."),
  reasons: z
    .array(z.object({ signal: z.string(), detail: z.string() }))
    .describe("The specific evidence behind the score, most important first. Empty if healthy."),
  recommendedAction: z.string().describe("One concrete next step for the owner or manager."),
  taskTitle: z.string().describe("Short task title (under 60 chars) for the action. Empty if no action needed."),
});

const SYSTEM = `You are a customer-retention analyst for a residential cleaning company.
You receive computed signals and recent feedback for one recurring client and assess how likely they are to cancel.

Scoring guide: 75-100 healthy, 50-74 at risk, 0-49 critical.
- Weigh recent evidence (last 30 days) above older evidence, and explicit cancellation intent above everything.
- Base every reason on the data provided; quote or paraphrase the client's own words where possible. Never invent facts.
- The recommended action must be specific and doable this week (who does what), not generic advice like "improve service".
- If there are no warning signs, say so, return an empty reasons list and an empty taskTitle.`;

export function aiEnabled() {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

let client: Anthropic | null = null;

/** Returns null if the model refuses or the output can't be parsed, so callers fall back to rules. */
export async function scoreWithAI(
  signals: HealthSignals,
  context: { clientName: string; planDescription: string; monthsAsClient: number },
): Promise<Assessment | null> {
  client ??= new Anthropic();
  const response = await client.beta.messages.parse({
    model: "claude-opus-5",
    max_tokens: 8000,
    // On a policy decline, the API retries the request on a fallback model within the same call.
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "medium", format: betaZodOutputFormat(AssessmentSchema) },
    system: SYSTEM,
    messages: [
      {
        role: "user",
        content: `Client: ${context.clientName}
Plan: ${context.planDescription}
Client for: ${context.monthsAsClient} months

Signals:
${JSON.stringify({ ...signals, recentComments: undefined }, null, 2)}

Recent feedback (newest first):
${signals.recentComments.join("\n") || "(none)"}`,
      },
    ],
  });

  if (response.stop_reason === "refusal" || !response.parsed_output) return null;
  const out = response.parsed_output;
  return { ...out, status: statusForScore(out.score) };
}
