"use server";

import { revalidatePath } from "next/cache";
import { and, eq, isNull } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { db, schema } from "@/db";
import { requireRole } from "@/lib/auth";

export type InviteState = { error?: string; invited?: { email: string; tempPassword: string } };

const StaffRole = z.enum(["owner", "manager", "cleaner"]);

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

  const tempPassword = crypto.randomUUID().slice(0, 8);
  await db.insert(schema.users).values({
    companyId: user.companyId,
    ...parsed.data,
    passwordHash: await bcrypt.hash(tempPassword, 10),
  });
  revalidatePath("/team");
  return { invited: { email: parsed.data.email, tempPassword } };
}

async function assertNotLastOwner(companyId: string, memberId: string) {
  const owners = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(and(eq(schema.users.companyId, companyId), eq(schema.users.role, "owner"), eq(schema.users.active, true)));
  if (owners.length === 1 && owners[0].id === memberId) throw new Error("A company needs at least one active owner.");
}

export async function changeRole(memberId: string, role: string) {
  const user = await requireRole(["owner"]);
  const newRole = StaffRole.parse(role);
  if (newRole !== "owner") await assertNotLastOwner(user.companyId, memberId);
  await db
    .update(schema.users)
    .set({ role: newRole })
    // Never touch client portal logins from here.
    .where(and(eq(schema.users.id, memberId), eq(schema.users.companyId, user.companyId), isNull(schema.users.clientId)));
  revalidatePath("/team");
}

export async function setMemberActive(memberId: string, active: boolean) {
  const user = await requireRole(["owner"]);
  if (!active) {
    if (memberId === user.id) throw new Error("You can't deactivate yourself.");
    await assertNotLastOwner(user.companyId, memberId);
  }
  await db
    .update(schema.users)
    .set({ active })
    .where(and(eq(schema.users.id, memberId), eq(schema.users.companyId, user.companyId)));
  revalidatePath("/team");
}
