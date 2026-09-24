"use server";

import { revalidatePath } from "next/cache";
import { randomBytes } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { db, schema } from "@/db";
import { requireAdmin } from "@/lib/auth";
import { generateTempPassword, lastOwnerViolation, STAFF_ROLES } from "@/lib/users";

export type CreatedLogin = { error?: string; created?: { email: string; tempPassword: string; companyName: string } };

const Person = {
  name: z.string().trim().min(2, "Name is required"),
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
};

async function emailTaken(email: string) {
  const [row] = await db.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.email, email));
  return Boolean(row);
}

/** Onboards a new customer: the company plus its first owner login, in one transaction. */
export async function createCompany(_prev: CreatedLogin, formData: FormData): Promise<CreatedLogin> {
  await requireAdmin();
  const parsed = z
    .object({ companyName: z.string().trim().min(2, "Company name is required"), ownerName: Person.name, ownerEmail: Person.email })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { companyName, ownerName, ownerEmail } = parsed.data;
  if (await emailTaken(ownerEmail)) return { error: "Someone already has a login with that email." };

  const tempPassword = generateTempPassword();
  const passwordHash = await bcrypt.hash(tempPassword, 10);
  await db.transaction(async (tx) => {
    const [company] = await tx
      .insert(schema.companies)
      .values({ name: companyName, webhookSecret: `whsec_${randomBytes(16).toString("hex")}` })
      .returning();
    await tx.insert(schema.users).values({ companyId: company.id, name: ownerName, email: ownerEmail, role: "owner", passwordHash });
  });
  revalidatePath("/admin", "layout");
  return { created: { email: ownerEmail, tempPassword, companyName } };
}

/** Adds a staff login (owner / manager / cleaner) to any company. */
export async function addUser(_prev: CreatedLogin, formData: FormData): Promise<CreatedLogin> {
  await requireAdmin();
  const parsed = z
    .object({ companyId: z.string().uuid("Pick a company"), role: z.enum(STAFF_ROLES), ...Person })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const [company] = await db.select().from(schema.companies).where(eq(schema.companies.id, parsed.data.companyId));
  if (!company) return { error: "Company not found." };
  if (await emailTaken(parsed.data.email)) return { error: "Someone already has a login with that email." };

  const tempPassword = generateTempPassword();
  await db.insert(schema.users).values({ ...parsed.data, passwordHash: await bcrypt.hash(tempPassword, 10) });
  revalidatePath("/admin", "layout");
  return { created: { email: parsed.data.email, tempPassword, companyName: company.name } };
}

/** Loads a company-bound user the admin is allowed to manage (never another admin). */
async function managedUser(userId: string) {
  const [user] = await db.select().from(schema.users).where(eq(schema.users.id, userId));
  if (!user || user.role === "admin" || !user.companyId) throw new Error("User not found");
  return { ...user, companyId: user.companyId };
}

async function staffOf(companyId: string) {
  return db
    .select({ id: schema.users.id, role: schema.users.role, active: schema.users.active })
    .from(schema.users)
    .where(and(eq(schema.users.companyId, companyId), isNull(schema.users.clientId)));
}

// Expected failures are returned, not thrown: Next.js hides thrown messages from the client in production.
export type ActionResult = { error?: string };

export async function adminChangeRole(userId: string, role: string): Promise<ActionResult> {
  await requireAdmin();
  const newRole = z.enum(STAFF_ROLES).parse(role);
  const user = await managedUser(userId);
  if (user.clientId) return { error: "Client portal logins can't be given a staff role." };
  const violation = lastOwnerViolation(await staffOf(user.companyId), userId, { role: newRole });
  if (violation) return { error: violation };
  await db.update(schema.users).set({ role: newRole }).where(eq(schema.users.id, userId));
  revalidatePath("/admin", "layout");
  return {};
}

export async function adminSetActive(userId: string, active: boolean): Promise<ActionResult> {
  await requireAdmin();
  const user = await managedUser(userId);
  const violation = lastOwnerViolation(await staffOf(user.companyId), userId, { active });
  if (violation) return { error: violation };
  await db.update(schema.users).set({ active }).where(eq(schema.users.id, userId));
  revalidatePath("/admin", "layout");
  return {};
}

export async function adminResetPassword(userId: string): Promise<{ email: string; tempPassword: string }> {
  await requireAdmin();
  const user = await managedUser(userId);
  const tempPassword = generateTempPassword();
  await db
    .update(schema.users)
    .set({ passwordHash: await bcrypt.hash(tempPassword, 10) })
    .where(eq(schema.users.id, userId));
  return { email: user.email, tempPassword };
}
