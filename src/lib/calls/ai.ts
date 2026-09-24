import "server-only";
import { z } from "zod";
import { generateStructured } from "@/lib/ai/client";
import type { RubricItem } from "@/db/schema";
import type { CallFacts } from "./rules";

export const RUBRIC = [
  "Greeting & rapport",
  "Discovery",
  "Handling concerns",
  "Asked for the booking / resolved the issue",
  "Clear next step",
] as const;

export const CallAnalysisSchema = z.object({
  type: z
    .enum(["new_lead", "booking", "reschedule", "complaint", "cancellation", "billing", "service_question", "other"])
    .describe("The caller's main reason for calling."),
  typeConfidence: z.number().int().min(0).max(100).describe("How sure you are about `type`, 0-100."),
  summary: z.string().describe("One sentence an owner can scan: who called, what they wanted, what happened."),
  callerName: z.string().describe("Caller's name if said on the call, else empty string. Never guess."),
  address: z.string().describe("Service address if given, else empty string."),
  serviceRequested: z.string().describe('Short phrase, e.g. "biweekly clean, 3 bed / 2 bath". Empty if none.'),
  priceQuoted: z.boolean().describe("True if the rep gave the caller a price or price range."),
  outcome: z.enum(["booked", "follow_up_needed", "resolved", "lost", "no_action"]),
  scorable: z
    .boolean()
    .describe("False for wrong numbers, spam, voicemails and calls too short to judge the rep. True otherwise."),
  rubric: z
    .array(
      z.object({
        criterion: z.enum(RUBRIC),
        score: z.number().int().min(0).max(4),
        feedback: z.string().describe("One sentence citing what the rep actually said or failed to say."),
      }),
    )
    .describe("Exactly one entry per rubric criterion when scorable; empty array when not scorable."),
  coachingTip: z.string().describe("The single most valuable thing this rep should do differently next time. Empty if not scorable."),
  missedOpportunity: z
    .string()
    .describe("Revenue the rep left on the table (didn't ask for the booking, didn't offer recurring, didn't save a cancelling client). Empty if none."),
  nextStep: z.string().describe("What should happen next, e.g. \"Call back Thursday with a quote\". Empty if nothing."),
  nextStepDueInDays: z.number().int().min(0).max(30).describe("Days from today the next step is due. 0 if today or none."),
});

export type CallAnalysis = z.infer<typeof CallAnalysisSchema>;

const SYSTEM = `You analyze phone calls for a residential cleaning company. Reps answer the phone; callers are new prospects or existing recurring clients.

Classify the call by the caller's main purpose:
- new_lead: a prospect asking about pricing, availability or services, not yet booked
- booking: a caller (new or existing) who books or tries to book a clean on this call
- reschedule: moving or skipping an existing appointment
- complaint: unhappy with a clean, a cleaner, timing or damage, without asking to cancel
- cancellation: wants to cancel or pause service, or says they're switching companies
- billing: charges, invoices, payment methods, refunds
- service_question: questions about how the service works (products, pets, insurance, keys)
- other: wrong numbers, spam, vendors, job seekers, voicemails
If a complaint turns into "I want to cancel", the type is cancellation.

Score the rep on each criterion from 0 to 4:
4 = excellent, would use as a training example; 3 = solid; 2 = acceptable but clearly improvable; 1 = weak; 0 = missing entirely.
Be calibrated: most real calls land at 2-3. Reserve 4 for genuinely great moments and give 0-1 when a step is skipped.
For complaints and cancellations, "Asked for the booking / resolved the issue" means the rep resolved the problem or tried to save the client.

Ground every judgement in the transcript and quote short phrases as evidence. Never invent details that aren't in the transcript.`;

export async function analyzeWithAI(input: {
  transcript: string;
  direction: "inbound" | "outbound";
  durationSec: number;
  knownClient: string | null;
}): Promise<{ facts: CallFacts; score: number | null; rubric: RubricItem[]; coachingTip: string; missedOpportunity: string; address: string; serviceRequested: string; nextStep: string; nextStepDueInDays: number } | null> {
  const out = await generateStructured({
    schema: CallAnalysisSchema,
    system: SYSTEM,
    maxTokens: 3000,
    prompt: `Direction: ${input.direction}
Duration: ${Math.round(input.durationSec / 60)} min ${input.durationSec % 60} s
Caller is an existing client: ${input.knownClient ? `yes (${input.knownClient})` : "no / unknown"}

Transcript:
${input.transcript}`,
  });
  if (!out) return null;

  const rubric = out.scorable ? out.rubric : [];
  // Score = share of available rubric points, so it stays 0-100 even if a criterion is missing.
  const score = rubric.length ? Math.round((rubric.reduce((s, r) => s + r.score, 0) / (rubric.length * 4)) * 100) : null;
  return {
    facts: {
      type: out.type,
      typeConfidence: out.typeConfidence,
      summary: out.summary,
      outcome: out.outcome,
      callerName: out.callerName,
      priceQuoted: out.priceQuoted,
    },
    score,
    rubric,
    coachingTip: out.coachingTip,
    missedOpportunity: out.missedOpportunity,
    address: out.address,
    serviceRequested: out.serviceRequested,
    nextStep: out.nextStep,
    nextStepDueInDays: out.nextStepDueInDays,
  };
}
