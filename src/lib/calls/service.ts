import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import type { LeadStage } from "@/db/schema";
import { aiEnabled } from "@/lib/ai/client";
import { assessClient } from "@/lib/health/service";
import { addDays } from "@/lib/dates";
import { analyzeWithAI } from "./ai";
import { analyzeWithRules } from "./rules";
import { advanceStage, isLeadCall, stageFromCall } from "./pipeline";

/**
 * Analyzes one call (Claude when available, keyword rules otherwise), saves the
 * result, then applies its effects:
 *  - existing client → linked to the call; complaint/cancellation calls re-score their health
 *  - new prospect → lead created or moved forward in the pipeline
 */
export async function analyzeCall(companyId: string, callId: string, opts: { useAI?: boolean } = {}) {
  const [call] = await db
    .select()
    .from(schema.calls)
    .where(and(eq(schema.calls.id, callId), eq(schema.calls.companyId, companyId)));
  if (!call) throw new Error("Call not found");

  const client = await findClientByPhone(companyId, call.callerPhone);

  let ai: Awaited<ReturnType<typeof analyzeWithAI>> = null;
  if ((opts.useAI ?? true) && aiEnabled()) {
    try {
      ai = await analyzeWithAI({
        transcript: call.transcript,
        direction: call.direction,
        durationSec: call.durationSec,
        knownClient: client?.name ?? null,
      });
    } catch (err) {
      console.error("AI call analysis failed, falling back to rules", err);
    }
  }
  const facts = ai?.facts ?? analyzeWithRules(call.transcript);

  await db
    .update(schema.calls)
    .set({
      type: facts.type,
      typeConfidence: facts.typeConfidence,
      summary: facts.summary,
      outcome: facts.outcome,
      score: ai?.score ?? null,
      rubric: ai?.rubric ?? null,
      coachingTip: ai?.coachingTip || null,
      missedOpportunity: ai?.missedOpportunity || null,
      analyzedBy: ai ? "ai" : "rules",
      analyzedAt: new Date(),
      clientId: client?.id ?? null,
    })
    .where(eq(schema.calls.id, call.id));

  if (client) {
    if (facts.type === "cancellation" || facts.type === "complaint") await assessClient(companyId, client.id, opts);
    return;
  }

  if (isLeadCall(facts.type, facts.outcome)) {
    const leadId = await upsertLead(companyId, {
      phone: call.callerPhone,
      name: facts.callerName || call.callerName,
      address: ai?.address ?? "",
      serviceRequested: ai?.serviceRequested ?? "",
      stage: stageFromCall(facts.outcome, facts.priceQuoted),
      ownerId: call.repId,
      nextStep: ai?.nextStep ?? (facts.outcome === "follow_up_needed" ? "Call back to follow up" : ""),
      nextStepDue:
        facts.outcome === "follow_up_needed" ? addDays(toDate(call.startedAt), ai?.nextStepDueInDays ?? 1) : null,
    });
    await db.update(schema.calls).set({ leadId }).where(eq(schema.calls.id, call.id));
  }
}

function toDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

async function findClientByPhone(companyId: string, phone: string) {
  if (!phone) return null;
  const [client] = await db
    .select({ id: schema.clients.id, name: schema.clients.name })
    .from(schema.clients)
    .where(
      and(
        eq(schema.clients.companyId, companyId),
        // Stored phones are formatted, e.g. "(512) 555-1037"; compare digits only.
        sql`right(regexp_replace(${schema.clients.phone}, '\\D', '', 'g'), 10) = ${phone.slice(-10)}`,
      ),
    )
    .limit(1);
  return client ?? null;
}

async function upsertLead(
  companyId: string,
  input: {
    phone: string;
    name: string;
    address: string;
    serviceRequested: string;
    stage: LeadStage;
    ownerId: string | null;
    nextStep: string;
    nextStepDue: string | null;
  },
) {
  const [existing] = await db
    .select()
    .from(schema.leads)
    .where(and(eq(schema.leads.companyId, companyId), eq(schema.leads.phone, input.phone)));

  if (!existing) {
    const [lead] = await db
      .insert(schema.leads)
      .values({ companyId, ...input, name: input.name || "Unknown caller" })
      .returning({ id: schema.leads.id });
    return lead.id;
  }

  const stage = advanceStage(existing.stage, input.stage);
  await db
    .update(schema.leads)
    .set({
      // Never overwrite something we know with a blank.
      name: existing.name === "Unknown caller" && input.name ? input.name : existing.name,
      address: existing.address || input.address,
      serviceRequested: input.serviceRequested || existing.serviceRequested,
      stage,
      ownerId: existing.ownerId ?? input.ownerId,
      nextStep: stage === "booked" || stage === "lost" ? "" : input.nextStep || existing.nextStep,
      nextStepDue: stage === "booked" || stage === "lost" ? null : input.nextStepDue ?? existing.nextStepDue,
      updatedAt: new Date(),
    })
    .where(eq(schema.leads.id, existing.id));
  return existing.id;
}

/**
 * (Re-)analyzes a company's calls. Calls from the same phone number run in
 * time order so a lead moves through the pipeline as the conversation did;
 * different callers run in parallel.
 */
export async function analyzeCalls(companyId: string, opts: { onlyMissingAI?: boolean; useAI?: boolean } = {}) {
  const rows = await db
    .select({ id: schema.calls.id, phone: schema.calls.callerPhone, analyzedBy: schema.calls.analyzedBy })
    .from(schema.calls)
    .where(eq(schema.calls.companyId, companyId))
    .orderBy(schema.calls.startedAt);
  const todo = rows.filter((r) => !opts.onlyMissingAI || r.analyzedBy !== "ai");

  const queue = [...Map.groupBy(todo, (r) => r.phone).values()];
  await Promise.all(
    Array.from({ length: 6 }, async () => {
      for (let group = queue.shift(); group; group = queue.shift()) {
        for (const call of group) await analyzeCall(companyId, call.id, { useAI: opts.useAI });
      }
    }),
  );
  return { count: todo.length };
}
