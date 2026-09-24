import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import type { Role } from "@/db/schema";
import { readSession } from "./session";

export type CurrentUser = {
  id: string;
  companyId: string;
  companyName: string;
  name: string;
  email: string;
  role: Role;
  clientId: string | null;
};

// Re-checks the user against the DB on every request, so deactivating a user
// or changing their role takes effect immediately instead of when the JWT expires.
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
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
    .innerJoin(schema.companies, eq(schema.companies.id, schema.users.companyId))
    .where(and(eq(schema.users.id, session.userId), eq(schema.users.companyId, session.companyId)));
  if (!row || !row.active) return null;
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

export const STAFF: Role[] = ["owner", "manager"];

export function homeFor(role: Role) {
  if (role === "cleaner") return "/today";
  if (role === "client") return "/portal";
  return "/dashboard";
}

/** Use at the top of every page and server action. Redirects if not allowed. */
export async function requireRole(roles: Role[]): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!roles.includes(user.role)) redirect(homeFor(user.role));
  return user;
}
