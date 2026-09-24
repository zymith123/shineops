"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { requireRole, STAFF } from "@/lib/auth";
import { aiEnabled } from "@/lib/ai/client";
import { analyzeCall, analyzeCalls } from "@/lib/calls/service";

/** With an AI key: upgrades every call not yet analyzed by AI. Without: re-runs the keyword rules. */
export async function analyzeAllCalls(): Promise<{ count: number; ai: boolean }> {
  const user = await requireRole(STAFF);
  const ai = aiEnabled();
  const { count } = await analyzeCalls(user.companyId, { onlyMissingAI: ai });
  revalidatePath("/", "layout");
  return { count, ai };
}

export async function reanalyzeCall(callId: string) {
  const user = await requireRole(STAFF);
  await analyzeCall(user.companyId, callId);
  revalidatePath("/", "layout");
}

const Stage = z.enum(["new", "contacted", "quoted", "booked", "lost"]);

/** Manual override: people can always move a lead, whatever the AI decided. */
export async function setLeadStage(leadId: string, stage: string) {
  const user = await requireRole(STAFF);
  const next = Stage.parse(stage);
  const closed = next === "booked" || next === "lost";
  await db
    .update(schema.leads)
    .set({ stage: next, updatedAt: new Date(), ...(closed ? { nextStep: "", nextStepDue: null } : {}) })
    .where(and(eq(schema.leads.id, leadId), eq(schema.leads.companyId, user.companyId)));
  revalidatePath("/sales", "layout");
}

export async function assignLead(leadId: string, ownerId: string) {
  const user = await requireRole(STAFF);
  if (ownerId) {
    const [owner] = await db
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(and(eq(schema.users.id, ownerId), eq(schema.users.companyId, user.companyId)));
    if (!owner) throw new Error("Invalid user");
  }
  await db
    .update(schema.leads)
    .set({ ownerId: ownerId || null, updatedAt: new Date() })
    .where(and(eq(schema.leads.id, leadId), eq(schema.leads.companyId, user.companyId)));
  revalidatePath("/sales", "layout");
}
