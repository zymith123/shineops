import Link from "next/link";
import { and, eq, gte, lt, lte, sql } from "drizzle-orm";
import { AlertTriangle, ArrowRight, DollarSign, Star, CalendarCheck, ListTodo } from "lucide-react";
import { db, schema } from "@/db";
import { requireRole, STAFF } from "@/lib/auth";
import { latestHealthQuery, listClients } from "@/lib/queries";
import { addDays, formatMoney, monthlyValueCents, parseISODate, today } from "@/lib/dates";
import { Card, CardHeader, Empty, HealthBadge, PageHeader } from "@/components/ui";
import { RatingTrend } from "@/components/rating-trend";
import { ReanalyzeAllButton } from "./reanalyze-all";

export default async function DashboardPage() {
  const user = await requireRole(STAFF);
  const cid = user.companyId;
  const now = today();
  const weekStart = addDays(now, -((parseISODate(now).getUTCDay() + 6) % 7)); // Monday

  const clients = await listClients(cid);
  const active = clients.filter((c) => c.status === "active" && c.planActive && c.priceCents && c.frequency);
  const mrr = active.reduce((sum, c) => sum + monthlyValueCents(c.priceCents!, c.frequency!), 0);
  const atRisk = active.filter((c) => c.healthStatus === "at_risk" || c.healthStatus === "critical");
  const mrrAtRisk = atRisk.reduce((sum, c) => sum + monthlyValueCents(c.priceCents!, c.frequency!), 0);

  const health = latestHealthQuery(cid);
  const attention = await db
    .select({
      clientId: schema.clients.id,
      name: schema.clients.name,
      status: health.status,
      score: health.score,
      action: health.recommendedAction,
    })
    .from(health)
    .innerJoin(schema.clients, eq(schema.clients.id, health.clientId))
    .where(and(sql`${health.status} <> 'healthy'`, eq(schema.clients.status, "active")))
    .orderBy(health.score)
    .limit(6);

  // 8 weeks of ratings, bucketed by Monday-start week.
  const trendStart = addDays(weekStart, -7 * 7);
  const ratingRows = await db
    .select({
      week: sql<string>`to_char(date_trunc('week', ${schema.feedback.createdAt} at time zone 'UTC'), 'YYYY-MM-DD')`,
      avg: sql<number>`avg(${schema.feedback.rating})::float`,
      count: sql<number>`count(*)::int`,
    })
    .from(schema.feedback)
    .where(and(eq(schema.feedback.companyId, cid), gte(schema.feedback.createdAt, new Date(`${trendStart}T00:00:00Z`))))
    .groupBy(sql`1`);
  const weeks = Array.from({ length: 8 }, (_, i) => {
    const start = addDays(trendStart, i * 7);
    const row = ratingRows.find((r) => r.week === start);
    const label = parseISODate(start).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
    return { label, avg: row?.avg ?? null, count: row?.count ?? 0 };
  });
  const last30 = await ratingAvg(cid, addDays(now, -30), now);
  const prev30 = await ratingAvg(cid, addDays(now, -60), addDays(now, -30));

  const [visitStats] = await db
    .select({
      done: sql<number>`count(*) filter (where ${schema.visits.status} = 'completed')::int`,
      total: sql<number>`count(*) filter (where ${schema.visits.status} <> 'cancelled')::int`,
    })
    .from(schema.visits)
    .where(
      and(
        eq(schema.visits.companyId, cid),
        gte(schema.visits.scheduledDate, weekStart),
        lt(schema.visits.scheduledDate, addDays(weekStart, 7)),
      ),
    );
  const [taskStats] = await db
    .select({
      open: sql<number>`count(*)::int`,
      overdue: sql<number>`count(*) filter (where ${schema.tasks.dueDate} < ${now})::int`,
    })
    .from(schema.tasks)
    .where(and(eq(schema.tasks.companyId, cid), eq(schema.tasks.status, "open")));

  const scorecard = await db
    .select({
      id: schema.users.id,
      name: schema.users.name,
      visits: sql<number>`count(distinct ${schema.visits.id}) filter (where ${schema.visits.status} = 'completed')::int`,
      avg: sql<number | null>`avg(${schema.feedback.rating})::float`,
      low: sql<number>`count(${schema.feedback.id}) filter (where ${schema.feedback.rating} <= 3)::int`,
    })
    .from(schema.users)
    .leftJoin(
      schema.visits,
      and(eq(schema.visits.cleanerId, schema.users.id), gte(schema.visits.scheduledDate, addDays(now, -30)), lte(schema.visits.scheduledDate, now)),
    )
    .leftJoin(schema.feedback, eq(schema.feedback.visitId, schema.visits.id))
    .where(and(eq(schema.users.companyId, cid), eq(schema.users.role, "cleaner"), eq(schema.users.active, true)))
    .groupBy(schema.users.id, schema.users.name)
    .orderBy(sql`4 desc nulls last`);

  const ratingDelta = last30 !== null && prev30 !== null ? last30 - prev30 : null;

  return (
    <>
      <PageHeader
        title={`Good ${greeting()}, ${user.name.split(" ")[0]}`}
        subtitle={`${user.companyName} · ${active.length} active recurring clients`}
        action={<ReanalyzeAllButton />}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat icon={DollarSign} label="Recurring revenue / mo" value={formatMoney(mrr)} sub={`${active.length} active plans`} />
        <Stat
          icon={AlertTriangle}
          label="Revenue at risk / mo"
          value={formatMoney(mrrAtRisk)}
          sub={`${atRisk.length} client${atRisk.length === 1 ? "" : "s"} at risk · ${mrr ? Math.round((mrrAtRisk / mrr) * 100) : 0}% of revenue`}
          tone={mrrAtRisk > 0 ? "warn" : undefined}
        />
        <Stat
          icon={Star}
          label="Avg rating (30 days)"
          value={last30 !== null ? `${last30.toFixed(2)}★` : "—"}
          sub={ratingDelta !== null ? `${ratingDelta >= 0 ? "▲" : "▼"} ${Math.abs(ratingDelta).toFixed(2)} vs previous 30 days` : "Not enough data"}
        />
        <Stat
          icon={CalendarCheck}
          label="Visits this week"
          value={`${visitStats.done} / ${visitStats.total}`}
          sub={
            <Link href="/tasks" className="inline-flex items-center gap-1 hover:text-slate-700">
              <ListTodo className="h-3 w-3" /> {taskStats.open} open tasks
              {taskStats.overdue > 0 && <span className="text-red-600">· {taskStats.overdue} overdue</span>}
            </Link>
          }
        />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-5">
        <Card className="xl:col-span-3">
          <CardHeader
            title="Clients needing attention"
            action={
              <Link href="/clients" className="text-xs text-brand-700 hover:underline">
                All clients
              </Link>
            }
          />
          {attention.length === 0 ? (
            <Empty>Every client looks healthy. 🎉</Empty>
          ) : (
            <ul className="divide-y divide-slate-100">
              {attention.map((a) => (
                <li key={a.clientId}>
                  <Link href={`/clients/${a.clientId}`} className="flex items-start gap-4 px-5 py-3.5 hover:bg-slate-50">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{a.name}</span>
                        <HealthBadge status={a.status} score={a.score} />
                      </div>
                      <p className="mt-1 text-sm text-slate-500">{a.action}</p>
                    </div>
                    <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-slate-300" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="xl:col-span-2">
          <CardHeader title="Average client rating by week" />
          <div className="p-5">
            <RatingTrend weeks={weeks} />
          </div>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader title="Cleaner scorecard (last 30 days)" />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-slate-500">
              <tr>
                <th className="px-5 py-2 font-medium">Cleaner</th>
                <th className="px-5 py-2 text-right font-medium">Visits completed</th>
                <th className="px-5 py-2 text-right font-medium">Avg rating</th>
                <th className="px-5 py-2 text-right font-medium">Ratings ≤ 3★</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {scorecard.map((c) => (
                <tr key={c.id}>
                  <td className="px-5 py-2.5 font-medium">{c.name}</td>
                  <td className="px-5 py-2.5 text-right tabular-nums">{c.visits}</td>
                  <td className="px-5 py-2.5 text-right tabular-nums">{c.avg !== null ? `${c.avg.toFixed(2)}★` : "—"}</td>
                  <td className={`px-5 py-2.5 text-right tabular-nums ${c.low > 0 ? "font-medium text-red-600" : ""}`}>{c.low}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}

async function ratingAvg(companyId: string, from: string, to: string) {
  const [row] = await db
    .select({ avg: sql<number | null>`avg(${schema.feedback.rating})::float` })
    .from(schema.feedback)
    .where(
      and(
        eq(schema.feedback.companyId, companyId),
        gte(schema.feedback.createdAt, new Date(`${from}T00:00:00Z`)),
        lt(schema.feedback.createdAt, new Date(`${to}T00:00:00Z`)),
      ),
    );
  return row.avg;
}

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "morning" : h < 18 ? "afternoon" : "evening";
}

function Stat({
  icon: Icon,
  label,
  value,
  sub,
  tone,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  sub: React.ReactNode;
  tone?: "warn";
}) {
  return (
    <Card className="p-5">
      <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
        <Icon className={`h-4 w-4 ${tone === "warn" ? "text-amber-500" : "text-brand-600"}`} />
        {label}
      </div>
      <p className="mt-2 text-2xl font-semibold tabular-nums">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{sub}</p>
    </Card>
  );
}
