import "server-only";
import { and, desc, eq, gte, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db, schema } from "@/db";

/** Calls with the display name of whoever called (client, lead, phone system, or the number). */
export function callsWithPeople(companyId: string, since?: Date) {
  const rep = alias(schema.users, "rep");
  return db
    .select({
      id: schema.calls.id,
      startedAt: schema.calls.startedAt,
      direction: schema.calls.direction,
      durationSec: schema.calls.durationSec,
      callerPhone: schema.calls.callerPhone,
      callerName: sql<string>`coalesce(${schema.clients.name}, nullif(${schema.leads.name}, 'Unknown caller'), nullif(${schema.calls.callerName}, ''), '')`,
      clientId: schema.calls.clientId,
      leadId: schema.calls.leadId,
      repId: schema.calls.repId,
      repName: rep.name,
      type: schema.calls.type,
      typeConfidence: schema.calls.typeConfidence,
      summary: schema.calls.summary,
      outcome: schema.calls.outcome,
      score: schema.calls.score,
      rubric: schema.calls.rubric,
      coachingTip: schema.calls.coachingTip,
      missedOpportunity: schema.calls.missedOpportunity,
      analyzedBy: schema.calls.analyzedBy,
    })
    .from(schema.calls)
    .leftJoin(rep, eq(rep.id, schema.calls.repId))
    .leftJoin(schema.clients, eq(schema.clients.id, schema.calls.clientId))
    .leftJoin(schema.leads, eq(schema.leads.id, schema.calls.leadId))
    .where(and(eq(schema.calls.companyId, companyId), since ? gte(schema.calls.startedAt, since) : undefined))
    .orderBy(desc(schema.calls.startedAt))
    .$dynamic();
}

export type CallRow = Awaited<ReturnType<typeof callsWithPeople>>[number];
