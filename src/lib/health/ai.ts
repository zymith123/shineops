import "server-only";
import { z } from "zod";
import { generateStructured } from "@/lib/ai/client";
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
You receive computed signals, recent feedback and recent phone calls for one recurring client and assess how likely they are to cancel.

Scoring guide: 75-100 healthy, 50-74 at risk, 0-49 critical.
- Weigh recent evidence (last 30 days) above older evidence, and explicit cancellation intent above everything.
- Base every reason on the data provided; quote or paraphrase the client's own words where possible. Never invent facts.
- The recommended action must be specific and doable this week (who does what), not generic advice like "improve service".
- If there are no warning signs, say so, return an empty reasons list and an empty taskTitle.`;

/** Returns null if the model refuses or the output can't be parsed, so callers fall back to rules. */
export async function scoreWithAI(
  signals: HealthSignals,
  context: { clientName: string; planDescription: string; monthsAsClient: number },
): Promise<Assessment | null> {
  const out = await generateStructured({
    schema: AssessmentSchema,
    system: SYSTEM,
    maxTokens: 2000,
    prompt: `Client: ${context.clientName}
Plan: ${context.planDescription}
Client for: ${context.monthsAsClient} months

Signals:
${JSON.stringify({ ...signals, recentComments: undefined, recentCalls: undefined }, null, 2)}

Recent feedback (newest first):
${signals.recentComments.join("\n") || "(none)"}

Recent phone calls (newest first):
${signals.recentCalls.join("\n") || "(none)"}`,
  });
  return out ? { ...out, status: statusForScore(out.score) } : null;
}
