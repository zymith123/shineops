import Link from "next/link";
import { and, asc, eq, gte, lte } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireRole, STAFF } from "@/lib/auth";
import { addDays, formatDate, formatMoney, today } from "@/lib/dates";
import { Badge, Card, CardHeader, Empty, PageHeader } from "@/components/ui";
import { AssignSelect, GenerateButton } from "./schedule-actions";
import { LinkPending } from "@/components/loading";

export default async function SchedulePage() {
  const user = await requireRole(STAFF);
  const from = today();
  const to = addDays(from, 13);

  const [visits, cleaners] = await Promise.all([
    db
      .select({
        id: schema.visits.id,
        date: schema.visits.scheduledDate,
        status: schema.visits.status,
        cleanerId: schema.visits.cleanerId,
        priceCents: schema.visits.priceCents,
        clientId: schema.clients.id,
        clientName: schema.clients.name,
        address: schema.clients.address,
      })
      .from(schema.visits)
      .innerJoin(schema.clients, eq(schema.clients.id, schema.visits.clientId))
      .where(
        and(
          eq(schema.visits.companyId, user.companyId),
          gte(schema.visits.scheduledDate, from),
          lte(schema.visits.scheduledDate, to),
        ),
      )
      .orderBy(asc(schema.visits.scheduledDate), asc(schema.clients.name)),
    db
      .select({ id: schema.users.id, name: schema.users.name })
      .from(schema.users)
      .where(and(eq(schema.users.companyId, user.companyId), eq(schema.users.role, "cleaner"), eq(schema.users.active, true))),
  ]);

  const byDate = Map.groupBy(visits, (v) => v.date);
  const unassigned = visits.filter((v) => !v.cleanerId && v.status === "scheduled").length;

  return (
    <>
      <PageHeader
        title="Schedule"
        subtitle={`Next 14 days · ${visits.length} visits${unassigned ? ` · ${unassigned} unassigned` : ""}`}
        action={<GenerateButton />}
      />
      {visits.length === 0 ? (
        <Card>
          <Empty>No visits in the next 14 days. Generate the schedule from your clients&apos; recurring plans.</Empty>
        </Card>
      ) : (
        <div className="space-y-4">
          {[...byDate.entries()].map(([date, dayVisits]) => (
            <Card key={date}>
              <CardHeader
                title={`${formatDate(date)}${date === from ? " · Today" : ""}`}
                action={<span className="text-xs text-slate-400">{formatMoney(dayVisits.reduce((s, v) => s + v.priceCents, 0))}</span>}
              />
              <ul className="divide-y divide-slate-100">
                {dayVisits.map((v) => (
                  <li key={v.id} className="flex flex-wrap items-center gap-3 px-5 py-2.5 text-sm">
                    <div className="min-w-0 flex-1">
                      <Link href={`/clients/${v.clientId}`} className="inline-flex items-center gap-1.5 font-medium hover:underline">
                        {v.clientName}
                        <LinkPending />
                      </Link>
                      <p className="truncate text-xs text-slate-400">{v.address}</p>
                    </div>
                    {v.status !== "scheduled" && <Badge tone={v.status === "completed" ? "green" : "slate"}>{v.status}</Badge>}
                    <AssignSelect visitId={v.id} cleanerId={v.cleanerId} cleaners={cleaners} disabled={v.status !== "scheduled"} />
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
