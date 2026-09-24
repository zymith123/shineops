import "server-only";
import { and, desc, eq, sql } from "drizzle-orm";
import { db, schema } from "@/db";

/** Latest health assessment per client, for one company. */
export function latestHealthQuery(companyId: string) {
  return db
    .selectDistinctOn([schema.healthAssessments.clientId], {
      clientId: schema.healthAssessments.clientId,
      status: schema.healthAssessments.status,
      score: schema.healthAssessments.score,
      summary: schema.healthAssessments.summary,
      recommendedAction: schema.healthAssessments.recommendedAction,
      createdAt: schema.healthAssessments.createdAt,
    })
    .from(schema.healthAssessments)
    .where(eq(schema.healthAssessments.companyId, companyId))
    .orderBy(schema.healthAssessments.clientId, desc(schema.healthAssessments.createdAt))
    .as("latest_health");
}

export async function listClients(companyId: string) {
  const health = latestHealthQuery(companyId);
  const lastRating = db
    .selectDistinctOn([schema.feedback.clientId], {
      clientId: schema.feedback.clientId,
      rating: schema.feedback.rating,
    })
    .from(schema.feedback)
    .where(eq(schema.feedback.companyId, companyId))
    .orderBy(schema.feedback.clientId, desc(schema.feedback.createdAt))
    .as("last_rating");

  return db
    .select({
      id: schema.clients.id,
      name: schema.clients.name,
      email: schema.clients.email,
      address: schema.clients.address,
      status: schema.clients.status,
      frequency: schema.servicePlans.frequency,
      priceCents: schema.servicePlans.priceCents,
      planActive: schema.servicePlans.active,
      healthStatus: health.status,
      healthScore: health.score,
      lastRating: lastRating.rating,
    })
    .from(schema.clients)
    .leftJoin(schema.servicePlans, eq(schema.servicePlans.clientId, schema.clients.id))
    .leftJoin(health, eq(health.clientId, schema.clients.id))
    .leftJoin(lastRating, eq(lastRating.clientId, schema.clients.id))
    .where(eq(schema.clients.companyId, companyId))
    .orderBy(sql`coalesce(${health.score}, 101)`, schema.clients.name);
}

export async function listStaff(companyId: string) {
  return db
    .select({ id: schema.users.id, name: schema.users.name, role: schema.users.role, active: schema.users.active })
    .from(schema.users)
    .where(and(eq(schema.users.companyId, companyId), sql`${schema.users.role} <> 'client'`))
    .orderBy(schema.users.name);
}
