import "server-only";
import { and, asc, eq, ilike, isNull, or, sql, type SQL } from "drizzle-orm";
import { db, schema } from "@/db";
import type { Role } from "@/db/schema";
import { monthlyValueCents } from "@/lib/dates";
import { latestHealthQuery } from "@/lib/queries";

export async function listCompaniesWithStats() {
  const companies = await db.select().from(schema.companies).orderBy(asc(schema.companies.name));
  const userCounts = await db
    .select({
      companyId: schema.users.companyId,
      staff: sql<number>`count(*) filter (where ${schema.users.clientId} is null and ${schema.users.active})::int`,
      owners: sql<number>`count(*) filter (where ${schema.users.role} = 'owner' and ${schema.users.active})::int`,
    })
    .from(schema.users)
    .groupBy(schema.users.companyId);
  const plans = await db
    .select({
      companyId: schema.servicePlans.companyId,
      clientId: schema.servicePlans.clientId,
      priceCents: schema.servicePlans.priceCents,
      frequency: schema.servicePlans.frequency,
    })
    .from(schema.servicePlans)
    .innerJoin(schema.clients, eq(schema.clients.id, schema.servicePlans.clientId))
    .where(and(eq(schema.servicePlans.active, true), eq(schema.clients.status, "active")));

  return Promise.all(
    companies.map(async (c) => {
      const health = latestHealthQuery(c.id);
      const atRisk = await db
        .select({ clientId: health.clientId })
        .from(health)
        .where(sql`${health.status} <> 'healthy'`);
      const riskIds = new Set(atRisk.map((r) => r.clientId));
      const companyPlans = plans.filter((p) => p.companyId === c.id);
      const counts = userCounts.find((u) => u.companyId === c.id);
      return {
        id: c.id,
        name: c.name,
        createdAt: c.createdAt,
        activeClients: companyPlans.length,
        mrrCents: companyPlans.reduce((s, p) => s + monthlyValueCents(p.priceCents, p.frequency), 0),
        atRiskClients: companyPlans.filter((p) => riskIds.has(p.clientId)).length,
        staff: counts?.staff ?? 0,
        owners: counts?.owners ?? 0,
      };
    }),
  );
}

export async function listAllUsers(filters: { q?: string; companyId?: string; role?: Role }) {
  const conditions: SQL[] = [];
  if (filters.q) {
    const like = `%${filters.q.replace(/[%_\\]/g, "\\$&")}%`;
    conditions.push(or(ilike(schema.users.name, like), ilike(schema.users.email, like))!);
  }
  if (filters.companyId === "platform") conditions.push(isNull(schema.users.companyId));
  else if (filters.companyId) conditions.push(eq(schema.users.companyId, filters.companyId));
  if (filters.role) conditions.push(eq(schema.users.role, filters.role));

  return db
    .select({
      id: schema.users.id,
      name: schema.users.name,
      email: schema.users.email,
      role: schema.users.role,
      active: schema.users.active,
      clientId: schema.users.clientId,
      createdAt: schema.users.createdAt,
      companyId: schema.users.companyId,
      companyName: schema.companies.name,
    })
    .from(schema.users)
    .leftJoin(schema.companies, eq(schema.companies.id, schema.users.companyId))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(sql`${schema.companies.name} asc nulls first`, asc(schema.users.role), asc(schema.users.name))
    .limit(500);
}
