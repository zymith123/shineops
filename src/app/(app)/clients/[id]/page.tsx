import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, desc, eq, gte, lt } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { ArrowLeft, Bot, Calculator } from "lucide-react";
import { db, schema } from "@/db";
import { requireRole, STAFF } from "@/lib/auth";
import { addFeedback, updateClient, updatePlan } from "@/lib/actions/clients";
import { formatDate, formatMoney, monthlyValueCents, today } from "@/lib/dates";
import { Badge, Card, CardHeader, Empty, Field, HealthBadge, inputClass, PageHeader, Stars } from "@/components/ui";
import { ActionForm, ClientFields, PlanFields } from "@/components/client-form";
import { ClientStatusMenu, PortalAccess, ReanalyzeButton } from "./client-actions";
import { LinkPending } from "@/components/loading";

export default async function ClientPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireRole(STAFF);
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const cid = user.companyId;

  const [client] = await db
    .select()
    .from(schema.clients)
    .where(and(eq(schema.clients.id, id), eq(schema.clients.companyId, cid)));
  if (!client) notFound();

  const now = today();
  const cleaner = alias(schema.users, "cleaner");
  const [plan, [health], upcoming, past, feedback, tasks, cleaners, [portalUser]] = await Promise.all([
    db.select().from(schema.servicePlans).where(eq(schema.servicePlans.clientId, id)).then((r) => r[0]),
    db
      .select()
      .from(schema.healthAssessments)
      .where(eq(schema.healthAssessments.clientId, id))
      .orderBy(desc(schema.healthAssessments.createdAt))
      .limit(1),
    db
      .select({ id: schema.visits.id, date: schema.visits.scheduledDate, status: schema.visits.status, cleaner: cleaner.name })
      .from(schema.visits)
      .leftJoin(cleaner, eq(cleaner.id, schema.visits.cleanerId))
      .where(and(eq(schema.visits.clientId, id), gte(schema.visits.scheduledDate, now)))
      .orderBy(asc(schema.visits.scheduledDate))
      .limit(4),
    db
      .select({ id: schema.visits.id, date: schema.visits.scheduledDate, status: schema.visits.status, cleaner: cleaner.name })
      .from(schema.visits)
      .leftJoin(cleaner, eq(cleaner.id, schema.visits.cleanerId))
      .where(and(eq(schema.visits.clientId, id), lt(schema.visits.scheduledDate, now)))
      .orderBy(desc(schema.visits.scheduledDate))
      .limit(8),
    db.select().from(schema.feedback).where(eq(schema.feedback.clientId, id)).orderBy(desc(schema.feedback.createdAt)).limit(10),
    db
      .select()
      .from(schema.tasks)
      .where(and(eq(schema.tasks.clientId, id), eq(schema.tasks.status, "open")))
      .orderBy(asc(schema.tasks.dueDate)),
    db
      .select({ id: schema.users.id, name: schema.users.name })
      .from(schema.users)
      .where(and(eq(schema.users.companyId, cid), eq(schema.users.role, "cleaner"), eq(schema.users.active, true))),
    db.select({ email: schema.users.email }).from(schema.users).where(eq(schema.users.clientId, id)),
  ]);

  return (
    <>
      <Link href="/clients" className="mb-3 inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800">
        <ArrowLeft className="h-3 w-3" /> Clients
        <LinkPending className="h-3 w-3" />
      </Link>
      <PageHeader
        title={client.name}
        subtitle={[
          client.address,
          plan ? `${plan.frequency} · ${formatMoney(plan.priceCents)}/visit · ${formatMoney(monthlyValueCents(plan.priceCents, plan.frequency))}/mo` : null,
        ]
          .filter(Boolean)
          .join(" · ")}
        action={<ClientStatusMenu clientId={id} status={client.status} />}
      />

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <Card className={health?.status === "critical" ? "ring-2 ring-red-200" : health?.status === "at_risk" ? "ring-2 ring-amber-200" : ""}>
            <CardHeader title="Client health" action={<ReanalyzeButton clientId={id} />} />
            {health ? (
              <div className="space-y-4 p-5">
                <div className="flex flex-wrap items-center gap-3">
                  <HealthBadge status={health.status} score={health.score} />
                  <span className="inline-flex items-center gap-1 text-xs text-slate-400">
                    {health.generatedBy === "ai" ? <Bot className="h-3.5 w-3.5" /> : <Calculator className="h-3.5 w-3.5" />}
                    {health.generatedBy === "ai" ? "Analyzed by Claude" : "Rules-based score"} ·{" "}
                    {health.createdAt.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}
                  </span>
                </div>
                <p className="text-sm">{health.summary}</p>
                {health.reasons.length > 0 && (
                  <ul className="space-y-1.5">
                    {health.reasons.map((r, i) => (
                      <li key={i} className="text-sm">
                        <span className="font-medium">{r.signal}:</span> <span className="text-slate-600">{r.detail}</span>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="rounded-lg bg-brand-50 px-4 py-3 text-sm">
                  <span className="font-semibold text-brand-700">Recommended action: </span>
                  {health.recommendedAction}
                </div>
              </div>
            ) : (
              <Empty>Not scored yet.</Empty>
            )}
          </Card>

          <Card>
            <CardHeader title="Visits" />
            <div className="grid divide-y divide-slate-100 md:grid-cols-2 md:divide-x md:divide-y-0">
              <VisitList title="Upcoming" visits={upcoming} empty="Nothing scheduled. Generate the schedule from the Schedule page." />
              <VisitList title="Recent" visits={past} empty="No past visits." />
            </div>
          </Card>

          <Card>
            <CardHeader title="Feedback" />
            {feedback.length === 0 ? (
              <Empty>No feedback yet.</Empty>
            ) : (
              <ul className="divide-y divide-slate-100">
                {feedback.map((f) => (
                  <li key={f.id} className="px-5 py-3">
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                      <Stars rating={f.rating} />
                      <span>{f.createdAt.toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
                      <Badge>{f.source}</Badge>
                    </div>
                    {f.comment && <p className="mt-1 text-sm">{f.comment}</p>}
                  </li>
                ))}
              </ul>
            )}
            <div className="border-t border-slate-100 p-5">
              <p className="mb-3 text-xs font-medium text-slate-500">Log feedback from a call or text</p>
              <ActionForm action={addFeedback.bind(null, id)} submitLabel="Log feedback">
                <div className="grid gap-3 sm:grid-cols-[120px_1fr]">
                  <Field label="Rating">
                    <select name="rating" defaultValue="5" className={inputClass}>
                      {[5, 4, 3, 2, 1].map((r) => (
                        <option key={r} value={r}>
                          {r} ★
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Comment">
                    <input name="comment" placeholder="What did the client say?" className={inputClass} />
                  </Field>
                </div>
              </ActionForm>
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title={`Open tasks (${tasks.length})`} />
            {tasks.length === 0 ? (
              <Empty>No open tasks.</Empty>
            ) : (
              <ul className="divide-y divide-slate-100">
                {tasks.map((t) => (
                  <li key={t.id} className="px-5 py-3 text-sm">
                    <p className="font-medium">{t.title}</p>
                    {t.dueDate && <p className="text-xs text-slate-400">Due {formatDate(t.dueDate)}</p>}
                  </li>
                ))}
                <li className="px-5 py-2">
                  <Link href="/tasks" className="inline-flex items-center gap-1 text-xs text-brand-700 hover:underline">
                    Open task queue →
                    <LinkPending className="h-3 w-3" />
                  </Link>
                </li>
              </ul>
            )}
          </Card>

          <Card>
            <CardHeader title="Client details" />
            <div className="p-5">
              <ActionForm action={updateClient.bind(null, id)} submitLabel="Save details">
                <ClientFields values={client} />
              </ActionForm>
            </div>
          </Card>

          <Card>
            <CardHeader title="Recurring plan" />
            <div className="p-5">
              <ActionForm action={updatePlan.bind(null, id)} submitLabel="Save plan">
                <PlanFields
                  cleaners={cleaners}
                  values={
                    plan
                      ? {
                          frequency: plan.frequency,
                          price: plan.priceCents / 100,
                          preferredCleanerId: plan.preferredCleanerId ?? "",
                          startDate: plan.startDate,
                        }
                      : { startDate: now }
                  }
                />
              </ActionForm>
            </div>
          </Card>

          <Card>
            <CardHeader title="Client portal" />
            <div className="p-5">
              <PortalAccess clientId={id} hasLogin={Boolean(portalUser)} email={client.email} />
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}

function VisitList({
  title,
  visits,
  empty,
}: {
  title: string;
  visits: { id: string; date: string; status: string; cleaner: string | null }[];
  empty: string;
}) {
  const tone = { completed: "green", scheduled: "blue", skipped: "amber", cancelled: "slate" } as const;
  return (
    <div className="p-5">
      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">{title}</p>
      {visits.length === 0 ? (
        <p className="text-sm text-slate-400">{empty}</p>
      ) : (
        <ul className="space-y-2">
          {visits.map((v) => (
            <li key={v.id} className="flex items-center justify-between gap-2 text-sm">
              <span>
                {formatDate(v.date)} <span className="text-slate-400">· {v.cleaner ?? "Unassigned"}</span>
              </span>
              <Badge tone={tone[v.status as keyof typeof tone]}>{v.status}</Badge>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
