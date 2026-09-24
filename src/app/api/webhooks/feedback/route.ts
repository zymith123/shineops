import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { normalizeFeedback } from "@/lib/webhooks/normalize";
import { assessClient } from "@/lib/health/service";

/**
 * Inbound feedback from external systems (review platforms, survey tools, other CRMs).
 * Auth: X-ShineOps-Secret header = the company's webhook secret.
 * Idempotent: re-sending the same external id returns 200 without a duplicate row.
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

  const parsed = normalizeFeedback(body);
  if (!parsed.ok) return Response.json({ error: parsed.error }, { status: 422 });
  const fb = parsed.data;

  const [client] = await db
    .select({ id: schema.clients.id })
    .from(schema.clients)
    .where(and(eq(schema.clients.companyId, company.id), eq(schema.clients.email, fb.clientEmail)));
  if (!client) return Response.json({ error: `No client with email ${fb.clientEmail}` }, { status: 404 });

  const [inserted] = await db
    .insert(schema.feedback)
    .values({
      companyId: company.id,
      clientId: client.id,
      rating: fb.rating,
      comment: fb.comment,
      source: "webhook",
      externalId: fb.externalId,
    })
    .onConflictDoNothing({ target: [schema.feedback.companyId, schema.feedback.externalId] })
    .returning({ id: schema.feedback.id });

  if (!inserted) return Response.json({ status: "duplicate", clientId: client.id }, { status: 200 });

  // New feedback can change a client's health, so re-score right away.
  const health = await assessClient(company.id, client.id);
  return Response.json(
    {
      status: "created",
      feedbackId: inserted.id,
      clientId: client.id,
      normalized: fb,
      health: { status: health.status, score: health.score, recommendedAction: health.recommendedAction },
    },
    { status: 201 },
  );
}
