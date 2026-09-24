import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { normalizeCall } from "@/lib/calls/normalize";
import { analyzeCall } from "@/lib/calls/service";

// Analysis calls the AI model; give it room beyond the default function timeout.
export const maxDuration = 60;

/**
 * Inbound calls from a phone system (call tracking, VoIP, CRM).
 * Auth: X-ShineOps-Secret header = the company's webhook secret.
 * Idempotent on the phone system's call id.
 */
export async function POST(request: Request) {
  const secret = request.headers.get("x-shineops-secret");
  if (!secret) return Response.json({ error: "Missing X-ShineOps-Secret header" }, { status: 401 });
  const [company] = await db
    .select({ id: schema.companies.id })
    .from(schema.companies)
    .where(eq(schema.companies.webhookSecret, secret));
  if (!company) return Response.json({ error: "Invalid secret" }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Body must be JSON" }, { status: 400 });
  }
  const parsed = normalizeCall(body);
  if (!parsed.ok) return Response.json({ error: parsed.error }, { status: 422 });
  const call = parsed.data;

  // Unknown rep emails are fine: the call is stored unassigned.
  const [rep] = call.repEmail
    ? await db
        .select({ id: schema.users.id })
        .from(schema.users)
        .where(and(eq(schema.users.companyId, company.id), eq(schema.users.email, call.repEmail)))
    : [];

  const [inserted] = await db
    .insert(schema.calls)
    .values({
      companyId: company.id,
      externalId: call.externalId,
      direction: call.direction,
      callerName: call.callerName,
      callerPhone: call.callerPhone,
      repId: rep?.id ?? null,
      startedAt: call.startedAt,
      durationSec: call.durationSec,
      transcript: call.transcript,
    })
    .onConflictDoNothing({ target: [schema.calls.companyId, schema.calls.externalId] })
    .returning({ id: schema.calls.id });
  if (!inserted) return Response.json({ status: "duplicate" }, { status: 200 });

  await analyzeCall(company.id, inserted.id);
  const [analyzed] = await db
    .select({
      type: schema.calls.type,
      summary: schema.calls.summary,
      outcome: schema.calls.outcome,
      score: schema.calls.score,
      analyzedBy: schema.calls.analyzedBy,
      clientId: schema.calls.clientId,
      leadId: schema.calls.leadId,
    })
    .from(schema.calls)
    .where(eq(schema.calls.id, inserted.id));
  return Response.json({ status: "created", callId: inserted.id, source: call.source, analysis: analyzed }, { status: 201 });
}
