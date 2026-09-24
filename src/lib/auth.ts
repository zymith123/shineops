import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import type { Role } from "@/db/schema";
import { readSession } from "./session";

type SessionUser = {
  id: string;
  companyId: string | null;
  companyName: string | null;
  name: string;
  email: string;
  role: Role;
  clientId: string | null;
};

/** A user who belongs to a company (everyone except platform admins). */
export type CurrentUser = SessionUser & { companyId: string; companyName: string; role: Exclude<Role, "admin"> };
export type AdminUser = SessionUser & { role: "admin" };

// Re-checks the user against the DB on every request, so deactivating a user
// or changing their role takes effect immediately instead of when the JWT expires.
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const session = await readSession();
  if (!session) return null;
  const [row] = await db
    .select({
      id: schema.users.id,
      companyId: schema.users.companyId,
      companyName: schema.companies.name,
      name: schema.users.name,
      email: schema.users.email,
      role: schema.users.role,
      clientId: schema.users.clientId,
      active: schema.users.active,
    })
    .from(schema.users)
    .leftJoin(schema.companies, eq(schema.companies.id, schema.users.companyId))
    .where(eq(schema.users.id, session.userId));
  // A session is only valid for the company it was issued for.
  if (!row || !row.active || row.companyId !== session.companyId) return null;
  return {
    id: row.id,
    companyId: row.companyId,
    companyName: row.companyName,
    name: row.name,
    email: row.email,
    role: row.role,
    clientId: row.clientId,
  };
});

export const STAFF: Exclude<Role, "admin">[] = ["owner", "manager"];

export function homeFor(role: Role) {
  if (role === "admin") return "/admin";
  if (role === "cleaner") return "/today";
  if (role === "client") return "/portal";
  return "/dashboard";
}

/** Use at the top of every company page and server action. Redirects if not allowed. */
export async function requireRole(roles: Exclude<Role, "admin">[]): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role === "admin" || !user.companyId || !roles.includes(user.role)) redirect(homeFor(user.role));
  return user as CurrentUser;
}

/** Use at the top of every /admin page and admin server action. */
export async function requireAdmin(): Promise<AdminUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "admin") redirect(homeFor(user.role));
  return user as AdminUser;
}
