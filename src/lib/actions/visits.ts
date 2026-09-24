"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireRole, STAFF } from "@/lib/auth";
import { addDays, planDates, today } from "@/lib/dates";

/** Creates visits for every active plan over the next N weeks. Safe to run repeatedly. */
export async function generateSchedule(weeks = 4): Promise<{ created: number }> {
  const user = await requireRole(STAFF);
  const from = today();
  const to = addDays(from, weeks * 7);
  const plans = await db
    .select({ plan: schema.servicePlans })
    .from(schema.servicePlans)
    .innerJoin(schema.clients, eq(schema.clients.id, schema.servicePlans.clientId))
    .where(
      and(
        eq(schema.servicePlans.companyId, user.companyId),
        eq(schema.servicePlans.active, true),
        eq(schema.clients.status, "active"),
      ),
    );

  const rows = plans.flatMap(({ plan }) =>
    planDates(plan.startDate, plan.frequency, from, to).map((date) => ({
      companyId: user.companyId,
      clientId: plan.clientId,
      cleanerId: plan.preferredCleanerId,
      scheduledDate: date,
      priceCents: plan.priceCents,
    })),
  );
  if (!rows.length) return { created: 0 };
  // The (client_id, scheduled_date) unique index makes re-runs skip existing visits.
  const inserted = await db
    .insert(schema.visits)
    .values(rows)
    .onConflictDoNothing({ target: [schema.visits.clientId, schema.visits.scheduledDate] })
    .returning({ id: schema.visits.id });
  revalidatePath("/schedule");
  return { created: inserted.length };
}

export async function assignVisit(visitId: string, cleanerId: string) {
  const user = await requireRole(STAFF);
  if (cleanerId) {
    const [cleaner] = await db
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(and(eq(schema.users.id, cleanerId), eq(schema.users.companyId, user.companyId), eq(schema.users.role, "cleaner")));
    if (!cleaner) throw new Error("Invalid cleaner");
  }
  await db
    .update(schema.visits)
    .set({ cleanerId: cleanerId || null })
    .where(and(eq(schema.visits.id, visitId), eq(schema.visits.companyId, user.companyId)));
  revalidatePath("/schedule");
}

/** Cleaners can only close out their own visits. */
export async function finishVisit(visitId: string, outcome: "completed" | "skipped", notes: string) {
  const user = await requireRole(["cleaner", "owner", "manager"]);
  const scope =
    user.role === "cleaner"
      ? and(eq(schema.visits.id, visitId), eq(schema.visits.cleanerId, user.id))
      : and(eq(schema.visits.id, visitId), eq(schema.visits.companyId, user.companyId));
  const updated = await db
    .update(schema.visits)
    .set({ status: outcome, notes: notes.trim().slice(0, 2000), completedAt: outcome === "completed" ? new Date() : null })
    .where(and(scope, eq(schema.visits.status, "scheduled")))
    .returning({ id: schema.visits.id, clientId: schema.visits.clientId });
  if (!updated.length) throw new Error("Visit not found or already closed");

  if (outcome === "skipped") {
    await db.insert(schema.tasks).values({
      companyId: user.companyId,
      clientId: updated[0].clientId,
      title: "Visit couldn't be completed — reschedule",
      description: `Reported by ${user.name}: ${notes.trim() || "no details"}`,
      source: "manual",
      dueDate: today(),
    });
  }
  revalidatePath("/today");
  revalidatePath("/schedule");
}
