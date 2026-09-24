"use server";

import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { createSession, deleteSession } from "@/lib/session";
import { homeFor } from "@/lib/auth";

export type LoginState = { error?: string };

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) return { error: "Enter your email and password." };

  const [user] = await db.select().from(schema.users).where(eq(schema.users.email, email));
  // Same message for unknown email and wrong password, so we don't reveal which accounts exist.
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) return { error: "Invalid email or password." };
  if (!user.active) return { error: "This account has been deactivated. Contact your manager." };

  await createSession({ userId: user.id, companyId: user.companyId, role: user.role });
  redirect(homeFor(user.role));
}

export async function logout() {
  await deleteSession();
  redirect("/login");
}
