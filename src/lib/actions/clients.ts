"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, gte } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { db, schema } from "@/db";
import { requireRole, STAFF } from "@/lib/auth";
import { assessClient } from "@/lib/health/service";
import { today } from "@/lib/dates";

export type FormState = { error?: string; ok?: string };

const ClientInput = z.object({
  name: z.string().trim().min(2, "Name is required"),
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  phone: z.string().trim().default(""),
  address: z.string().trim().min(5, "Address is required"),
  bedrooms: z.coerce.number().int().min(0).max(20),
  bathrooms: z.coerce.number().int().min(0).max(20),
  pets: z.string().trim().default(""),
  entryNotes: z.string().trim().default(""),
});

const PlanInput = z.object({
  frequency: z.enum(["weekly", "biweekly", "monthly"]),
  price: z.coerce.number().min(1, "Price must be at least $1").max(10000),
  preferredCleanerId: z.string().uuid().or(z.literal("")).transform((v) => v || null),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a start date"),
});

function firstError(err: z.ZodError) {
  return err.issues[0]?.message ?? "Invalid input";
}

/** Throws if the cleaner id isn't an active cleaner in this company (prevents cross-tenant ids). */
async function assertCleaner(companyId: string, cleanerId: string | null) {
  if (!cleanerId) return;
  const [row] = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(and(eq(schema.users.id, cleanerId), eq(schema.users.companyId, companyId), eq(schema.users.role, "cleaner")));
  if (!row) throw new Error("Invalid cleaner");
}

export async function createClient(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireRole(STAFF);
  const data = Object.fromEntries(formData);
  const client = ClientInput.safeParse(data);
  if (!client.success) return { error: firstError(client.error) };
  const plan = PlanInput.safeParse(data);
  if (!plan.success) return { error: firstError(plan.error) };
  await assertCleaner(user.companyId, plan.data.preferredCleanerId);

  const [dupe] = await db
    .select({ id: schema.clients.id })
    .from(schema.clients)
    .where(and(eq(schema.clients.companyId, user.companyId), eq(schema.clients.email, client.data.email)));
  if (dupe) return { error: "A client with this email already exists." };

  const created = await db.transaction(async (tx) => {
    const [c] = await tx.insert(schema.clients).values({ companyId: user.companyId, ...client.data }).returning();
    await tx.insert(schema.servicePlans).values({
      companyId: user.companyId,
      clientId: c.id,
      frequency: plan.data.frequency,
      priceCents: Math.round(plan.data.price * 100),
      preferredCleanerId: plan.data.preferredCleanerId,
      startDate: plan.data.startDate,
    });
    return c;
  });
  await assessClient(user.companyId, created.id, { useAI: false });
  redirect(`/clients/${created.id}`);
}

export async function updateClient(clientId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireRole(STAFF);
  const parsed = ClientInput.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: firstError(parsed.error) };
  try {
    const updated = await db
      .update(schema.clients)
      .set(parsed.data)
      .where(and(eq(schema.clients.id, clientId), eq(schema.clients.companyId, user.companyId)))
      .returning({ id: schema.clients.id });
    if (!updated.length) return { error: "Client not found." };
  } catch {
    return { error: "Another client already uses this email." };
  }
  revalidatePath(`/clients/${clientId}`);
  return { ok: "Saved" };
}

export async function updatePlan(clientId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireRole(STAFF);
  const parsed = PlanInput.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: firstError(parsed.error) };
  await assertCleaner(user.companyId, parsed.data.preferredCleanerId);
  const [client] = await db
    .select({ id: schema.clients.id })
    .from(schema.clients)
    .where(and(eq(schema.clients.id, clientId), eq(schema.clients.companyId, user.companyId)));
  if (!client) return { error: "Client not found." };

  const values = {
    frequency: parsed.data.frequency,
    priceCents: Math.round(parsed.data.price * 100),
    preferredCleanerId: parsed.data.preferredCleanerId,
    startDate: parsed.data.startDate,
  };
  await db
    .insert(schema.servicePlans)
    .values({ companyId: user.companyId, clientId, ...values })
    .onConflictDoUpdate({ target: schema.servicePlans.clientId, set: values });
  revalidatePath(`/clients/${clientId}`);
  return { ok: "Plan updated. Future visits will use it the next time you generate the schedule." };
}

/** Pause / cancel / reactivate. Cancelling also drops the client's future scheduled visits. */
export async function setClientStatus(clientId: string, status: "active" | "paused" | "cancelled") {
  const user = await requireRole(STAFF);
  await db.transaction(async (tx) => {
    const updated = await tx
      .update(schema.clients)
      .set({ status })
      .where(and(eq(schema.clients.id, clientId), eq(schema.clients.companyId, user.companyId)))
      .returning({ id: schema.clients.id });
    if (!updated.length) throw new Error("Client not found");
    await tx.update(schema.servicePlans).set({ active: status === "active" }).where(eq(schema.servicePlans.clientId, clientId));
    if (status !== "active") {
      await tx
        .update(schema.visits)
        .set({ status: "cancelled" })
        .where(and(eq(schema.visits.clientId, clientId), eq(schema.visits.status, "scheduled"), gte(schema.visits.scheduledDate, today())));
    }
  });
  revalidatePath(`/clients/${clientId}`);
  revalidatePath("/clients");
}

export async function addFeedback(clientId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireRole(STAFF);
  const parsed = z
    .object({ rating: z.coerce.number().int().min(1).max(5), comment: z.string().trim().default("") })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Pick a rating from 1 to 5." };
  const [client] = await db
    .select({ id: schema.clients.id })
    .from(schema.clients)
    .where(and(eq(schema.clients.id, clientId), eq(schema.clients.companyId, user.companyId)));
  if (!client) return { error: "Client not found." };
  await db.insert(schema.feedback).values({ companyId: user.companyId, clientId, source: "manual", ...parsed.data });
  await assessClient(user.companyId, clientId);
  revalidatePath(`/clients/${clientId}`);
  return { ok: "Feedback logged and health re-scored." };
}

/** Creates (or resets) the client's portal login and returns a one-time temporary password. */
export async function grantPortalAccess(clientId: string): Promise<{ email: string; tempPassword: string } | { error: string }> {
  const user = await requireRole(STAFF);
  const [client] = await db
    .select()
    .from(schema.clients)
    .where(and(eq(schema.clients.id, clientId), eq(schema.clients.companyId, user.companyId)));
  if (!client) return { error: "Client not found." };

  const tempPassword = crypto.randomUUID().slice(0, 8);
  const passwordHash = await bcrypt.hash(tempPassword, 10);
  const [existing] = await db.select().from(schema.users).where(eq(schema.users.email, client.email));
  if (existing && existing.clientId !== client.id) return { error: "That email is already used by another login." };
  if (existing) {
    await db.update(schema.users).set({ passwordHash, active: true }).where(eq(schema.users.id, existing.id));
  } else {
    await db.insert(schema.users).values({
      companyId: user.companyId,
      clientId: client.id,
      name: client.name,
      email: client.email,
      role: "client",
      passwordHash,
    });
  }
  revalidatePath(`/clients/${clientId}`);
  return { email: client.email, tempPassword };
}
