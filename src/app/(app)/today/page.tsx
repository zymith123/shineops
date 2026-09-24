import { and, asc, desc, eq, gte, inArray, lte } from "drizzle-orm";
import { AlertTriangle, Dog, KeyRound, MapPin } from "lucide-react";
import { db, schema } from "@/db";
import { requireRole } from "@/lib/auth";
import { addDays, formatDate, today } from "@/lib/dates";
import { Badge, Card, CardHeader, Empty, PageHeader, Stars } from "@/components/ui";
import { FinishVisit } from "./finish-visit";

export default async function TodayPage() {
  const user = await requireRole(["cleaner"]);
  const now = today();

  const visits = await db
    .select({
      id: schema.visits.id,
      date: schema.visits.scheduledDate,
      status: schema.visits.status,
      notes: schema.visits.notes,
      client: schema.clients,
    })
    .from(schema.visits)
    .innerJoin(schema.clients, eq(schema.clients.id, schema.visits.clientId))
    .where(
      and(
        eq(schema.visits.cleanerId, user.id),
        gte(schema.visits.scheduledDate, now),
        lte(schema.visits.scheduledDate, addDays(now, 7)),
      ),
    )
    .orderBy(asc(schema.visits.scheduledDate), asc(schema.clients.name));

  const todays = visits.filter((v) => v.date === now);
  const later = visits.filter((v) => v.date > now);

  // Surface each client's latest feedback so the cleaner knows what to get right today.
  const clientIds = todays.map((v) => v.client.id);
  const recentFeedback = clientIds.length
    ? await db
        .selectDistinctOn([schema.feedback.clientId], {
          clientId: schema.feedback.clientId,
          rating: schema.feedback.rating,
          comment: schema.feedback.comment,
        })
        .from(schema.feedback)
        .where(inArray(schema.feedback.clientId, clientIds))
        .orderBy(schema.feedback.clientId, desc(schema.feedback.createdAt))
    : [];

  return (
    <>
      <PageHeader title={`Hi ${user.name.split(" ")[0]} 👋`} subtitle={`${formatDate(now)} · ${todays.length} clean${todays.length === 1 ? "" : "s"} today`} />

      <div className="space-y-4">
        {todays.length === 0 && (
          <Card>
            <Empty>No cleans scheduled for you today.</Empty>
          </Card>
        )}
        {todays.map((v) => {
          const fb = recentFeedback.find((f) => f.clientId === v.client.id);
          return (
            <Card key={v.id}>
              <div className="space-y-3 p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-lg font-semibold">{v.client.name}</h2>
                  <Badge tone={v.status === "completed" ? "green" : v.status === "scheduled" ? "blue" : "slate"}>{v.status}</Badge>
                </div>
                <div className="grid gap-2 text-sm text-slate-600 sm:grid-cols-2">
                  <p className="flex items-start gap-2">
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                    <a className="hover:underline" href={`https://maps.google.com/?q=${encodeURIComponent(v.client.address)}`} target="_blank" rel="noreferrer">
                      {v.client.address}
                    </a>
                  </p>
                  <p className="flex items-start gap-2">
                    <KeyRound className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                    {v.client.entryNotes || "No entry notes"}
                  </p>
                  <p className="flex items-start gap-2">
                    <Dog className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                    {v.client.bedrooms} bd / {v.client.bathrooms} ba{v.client.pets ? ` · ${v.client.pets}` : ""}
                  </p>
                </div>
                {fb && fb.rating <= 3 && (
                  <div className="flex gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>
                      <b>Heads up:</b> last visit was rated <Stars rating={fb.rating} />
                      {fb.comment && <> — &ldquo;{fb.comment}&rdquo;</>}
                    </span>
                  </div>
                )}
                {v.status === "scheduled" ? (
                  <FinishVisit visitId={v.id} />
                ) : (
                  v.notes && <p className="text-sm text-slate-500">Notes: {v.notes}</p>
                )}
              </div>
            </Card>
          );
        })}
      </div>

      <Card className="mt-6">
        <CardHeader title="Coming up this week" />
        {later.length === 0 ? (
          <Empty>Nothing else scheduled this week.</Empty>
        ) : (
          <ul className="divide-y divide-slate-100">
            {later.map((v) => (
              <li key={v.id} className="flex justify-between gap-3 px-5 py-2.5 text-sm">
                <span className="font-medium">{v.client.name}</span>
                <span className="text-slate-500">{formatDate(v.date)}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
