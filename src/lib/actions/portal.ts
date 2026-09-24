"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { requireRole } from "@/lib/auth";
import { assessClient } from "@/lib/health/service";
import { addDays, today } from "@/lib/dates";
import type { FormState } from "./clients";

async function requireClient() {
  const user = await requireRole(["client"]);
  if (!user.clientId) throw new Error("Portal login is not linked to a client");
  return { ...user, clientId: user.clientId };
}

export async function rateVisit(visitId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireClient();
  const parsed = z
    .object({ rating: z.coerce.number().int().min(1).max(5), comment: z.string().trim().max(2000).default("") })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Choose a star rating." };

  // Clients can only rate their own completed visits, once.
  const [visit] = await db
    .select({ id: schema.visits.id })
    .from(schema.visits)
    .where(and(eq(schema.visits.id, visitId), eq(schema.visits.clientId, user.clientId), eq(schema.visits.status, "completed")));
  if (!visit) return { error: "Visit not found." };
  const [already] = await db.select({ id: schema.feedback.id }).from(schema.feedback).where(eq(schema.feedback.visitId, visitId));
  if (already) return { error: "You've already rated this visit." };

  await db.insert(schema.feedback).values({
    companyId: user.companyId,
    clientId: user.clientId,
    visitId,
    source: "portal",
    ...parsed.data,
  });
  await assessClient(user.companyId, user.clientId);
  revalidatePath("/portal");
  return { ok: parsed.data.rating >= 4 ? "Thank you! We'll pass that on to your cleaner." : "Thank you. We're sorry — the owner will reach out shortly." };
}

const REQUEST_TITLES = {
  reschedule: "Client request: reschedule a visit",
  deep_clean: "Client request: add a deep clean",
  pause: "Client request: pause service",
  other: "Client request",
} as const;

export async function submitRequest(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireClient();
  const parsed = z
    .object({
      type: z.enum(["reschedule", "deep_clean", "pause", "other"]),
      message: z.string().trim().min(3, "Tell us a bit more.").max(2000),
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const [manager] = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(and(eq(schema.users.companyId, user.companyId), eq(schema.users.role, "manager"), eq(schema.users.active, true)))
    .limit(1);
  await db.insert(schema.tasks).values({
    companyId: user.companyId,
    clientId: user.clientId,
    assigneeId: manager?.id ?? null,
    title: REQUEST_TITLES[parsed.data.type],
    description: `From ${user.name} via the client portal: "${parsed.data.message}"`,
    source: "client_request",
    dueDate: addDays(today(), 1),
  });
  return { ok: "Request sent. We'll confirm within one business day." };
}
