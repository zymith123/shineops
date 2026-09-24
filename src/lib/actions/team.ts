"use server";

import { revalidatePath } from "next/cache";
import { and, eq, isNull } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { db, schema } from "@/db";
import { requireRole } from "@/lib/auth";
import { generateTempPassword, lastOwnerViolation, STAFF_ROLES } from "@/lib/users";

export type InviteState = { error?: string; invited?: { email: string; tempPassword: string } };

const StaffRole = z.enum(STAFF_ROLES);

export async function inviteMember(_prev: InviteState, formData: FormData): Promise<InviteState> {
  const user = await requireRole(["owner"]);
  const parsed = z
    .object({
      name: z.string().trim().min(2, "Name is required"),
      email: z.string().trim().toLowerCase().email("Enter a valid email"),
      role: StaffRole,
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const [existing] = await db.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.email, parsed.data.email));
  if (existing) return { error: "Someone already has a login with that email." };

  const tempPassword = generateTempPassword();
  await db.insert(schema.users).values({
    companyId: user.companyId,
    ...parsed.data,
    passwordHash: await bcrypt.hash(tempPassword, 10),
  });
  revalidatePath("/team");
  return { invited: { email: parsed.data.email, tempPassword } };
}

async function companyStaff(companyId: string) {
  return db
    .select({ id: schema.users.id, role: schema.users.role, active: schema.users.active })
    .from(schema.users)
    .where(and(eq(schema.users.companyId, companyId), isNull(schema.users.clientId)));
}

// Expected failures are returned, not thrown: Next.js hides thrown messages from the client in production.
export type ActionResult = { error?: string };

export async function changeRole(memberId: string, role: string): Promise<ActionResult> {
  const user = await requireRole(["owner"]);
  const newRole = StaffRole.parse(role);
  const violation = lastOwnerViolation(await companyStaff(user.companyId), memberId, { role: newRole });
  if (violation) return { error: violation };
  await db
    .update(schema.users)
    .set({ role: newRole })
    // Never touch client portal logins from here.
    .where(and(eq(schema.users.id, memberId), eq(schema.users.companyId, user.companyId), isNull(schema.users.clientId)));
  revalidatePath("/team");
  return {};
}

export async function setMemberActive(memberId: string, active: boolean): Promise<ActionResult> {
  const user = await requireRole(["owner"]);
  if (!active && memberId === user.id) return { error: "You can't deactivate yourself." };
  const violation = lastOwnerViolation(await companyStaff(user.companyId), memberId, { active });
  if (violation) return { error: violation };
  await db
    .update(schema.users)
    .set({ active })
    .where(and(eq(schema.users.id, memberId), eq(schema.users.companyId, user.companyId)));
  revalidatePath("/team");
  return {};
}
