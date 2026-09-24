import "server-only";
import { and, desc, eq, gte } from "drizzle-orm";
import { db, schema } from "@/db";
import { addDays, daysBetween, formatMoney, today, toISODate } from "@/lib/dates";
import { computeSignals } from "./signals";
import { scoreWithRules, type Assessment } from "./rules";
import { aiEnabled } from "@/lib/ai/client";
import { scoreWithAI } from "./ai";

/**
 * Recomputes one client's health, stores the assessment, and keeps a single open
 * AI follow-up task per client in sync with the latest recommendation.
 */
export async function assessClient(companyId: string, clientId: string, opts: { useAI?: boolean } = {}) {
  const now = today();
  const since = addDays(now, -90);

  const [client] = await db
    .select()
    .from(schema.clients)
    .where(and(eq(schema.clients.id, clientId), eq(schema.clients.companyId, companyId)));
  if (!client) throw new Error("Client not found");

  const [plan] = await db.select().from(schema.servicePlans).where(eq(schema.servicePlans.clientId, clientId));
  const feedbackRows = await db
    .select()
    .from(schema.feedback)
    .where(and(eq(schema.feedback.clientId, clientId), gte(schema.feedback.createdAt, new Date(`${since}T00:00:00Z`))));
  const visitRows = await db
    .select()
    .from(schema.visits)
    .where(and(eq(schema.visits.clientId, clientId), gte(schema.visits.scheduledDate, since)));

  const callRows = await db
    .select({ startedAt: schema.calls.startedAt, type: schema.calls.type, summary: schema.calls.summary })
    .from(schema.calls)
    .where(and(eq(schema.calls.clientId, clientId), gte(schema.calls.startedAt, new Date(`${since}T00:00:00Z`))));

  const signals = computeSignals(
    feedbackRows.map((f) => ({ rating: f.rating, comment: f.comment, date: toISODate(f.createdAt) })),
    visitRows.map((v) => ({ date: v.scheduledDate, status: v.status, cleanerId: v.cleanerId })),
    now,
    callRows.flatMap((c) => (c.type ? [{ date: toISODate(c.startedAt), type: c.type, summary: c.summary ?? "" }] : [])),
  );

  let assessment: Assessment | null = null;
  let generatedBy = "rules";
  if ((opts.useAI ?? true) && aiEnabled()) {
    try {
      assessment = await scoreWithAI(signals, {
        clientName: client.name,
        planDescription: plan ? `${plan.frequency} clean, ${formatMoney(plan.priceCents)} per visit` : "no active plan",
        monthsAsClient: Math.max(0, Math.round(daysBetween(toISODate(client.createdAt), now) / 30)),
      });
      if (assessment) generatedBy = "ai";
    } catch (err) {
      console.error("AI health scoring failed, falling back to rules", err);
    }
  }
  assessment ??= scoreWithRules(signals, client.name);

  const [saved] = await db
    .insert(schema.healthAssessments)
    .values({ companyId, clientId, generatedBy, ...assessment })
    .returning();

  await syncFollowUpTask(companyId, clientId, assessment);
  return saved;
}

async function syncFollowUpTask(companyId: string, clientId: string, a: Assessment) {
  const [existing] = await db
    .select()
    .from(schema.tasks)
    .where(
      and(
        eq(schema.tasks.clientId, clientId),
        eq(schema.tasks.source, "ai"),
        eq(schema.tasks.status, "open"),
      ),
    )
    .orderBy(desc(schema.tasks.createdAt))
    .limit(1);

  if (a.status === "healthy" || !a.taskTitle) return; // leave any open task for a human to close

  const values = {
    title: a.taskTitle,
    description: `${a.summary}\n\nRecommended: ${a.recommendedAction}`,
    // Critical clients get handled today; at-risk within 3 days.
    dueDate: addDays(today(), a.status === "critical" ? 0 : 3),
  };
  if (existing) {
    await db.update(schema.tasks).set(values).where(eq(schema.tasks.id, existing.id));
  } else {
    const [owner] = await db
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(and(eq(schema.users.companyId, companyId), eq(schema.users.role, "owner"), eq(schema.users.active, true)))
      .limit(1);
    await db.insert(schema.tasks).values({ companyId, clientId, source: "ai", assigneeId: owner?.id ?? null, ...values });
  }
}
