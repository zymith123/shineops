import Link from "next/link";
import { and, eq, isNotNull, lte, notInArray } from "drizzle-orm";
import { AlertTriangle, PhoneIncoming, Target, GraduationCap, CalendarClock } from "lucide-react";
import { db, schema } from "@/db";
import type { CallType } from "@/db/schema";
import { requireRole, STAFF } from "@/lib/auth";
import { addDays, formatDate, today } from "@/lib/dates";
import { CALL_TYPES, formatCallTime } from "@/lib/calls/labels";
import { formatPhone } from "@/lib/calls/phone";
import { callsWithPeople } from "@/lib/sales-queries";
import { Card, CardHeader, Empty } from "@/components/ui";
import { BarList, CallTypeBadge, ScoreBadge } from "@/components/sales";
import { LinkPending } from "@/components/loading";

export default async function SalesOverview() {
  const user = await requireRole(STAFF);
  const now = today();
  const since = new Date(`${addDays(now, -30)}T00:00:00Z`);
  const calls = await callsWithPeople(user.companyId, since);

  const analyzed = calls.filter((c) => c.type);
  const leadCalls = analyzed.filter((c) => c.type === "new_lead" || c.type === "booking");
  const booked = leadCalls.filter((c) => c.outcome === "booked").length;
  const scored = analyzed.filter((c) => c.score != null);
  const avgScore = scored.length ? Math.round(scored.reduce((s, c) => s + c.score!, 0) / scored.length) : null;
  const byRules = analyzed.filter((c) => c.analyzedBy === "rules").length;

  const followUps = await db
    .select()
    .from(schema.leads)
    .where(
      and(
        eq(schema.leads.companyId, user.companyId),
        isNotNull(schema.leads.nextStepDue),
        lte(schema.leads.nextStepDue, now),
        notInArray(schema.leads.stage, ["booked", "lost"]),
      ),
    )
    .orderBy(schema.leads.nextStepDue);

  const typeRows = (Object.keys(CALL_TYPES) as CallType[]).map((t) => {
    const n = analyzed.filter((c) => c.type === t).length;
    return { label: CALL_TYPES[t].label, value: n, hint: analyzed.length ? `${Math.round((n / analyzed.length) * 100)}%` : "" };
  });
  const saveCalls = analyzed.filter((c) => (c.type === "cancellation" || c.type === "complaint") && c.clientId).slice(0, 5);
  const missed = analyzed.filter((c) => c.missedOpportunity).slice(0, 5);

  return (
    <div className="space-y-6">
      {byRules > 0 && (
        <div className="flex gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            {byRules} call{byRules === 1 ? " was" : "s were"} classified with basic keyword rules, which can&apos;t score reps or read
            nuance. Use <b>Analyze calls with AI</b> for coaching scores, missed opportunities and next steps.
          </p>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat icon={PhoneIncoming} label="Calls (30 days)" value={String(calls.length)} sub={`${calls.length - analyzed.length} not yet analyzed`} />
        <Stat
          icon={Target}
          label="Lead calls → booked"
          value={leadCalls.length ? `${Math.round((booked / leadCalls.length) * 100)}%` : "—"}
          sub={`${booked} of ${leadCalls.length} lead calls booked on the call`}
        />
        <Stat
          icon={GraduationCap}
          label="Avg coaching score"
          value={avgScore != null ? String(avgScore) : "—"}
          sub={scored.length ? `${scored.length} scored calls` : "Needs AI analysis"}
        />
        <Stat
          icon={CalendarClock}
          label="Follow-ups due"
          value={String(followUps.length)}
          sub={followUps.length ? "Leads waiting on a callback" : "Nobody waiting"}
          warn={followUps.length > 0}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-5">
        <Card className="xl:col-span-2">
          <CardHeader title="Why people call (30 days)" />
          <div className="p-5">{analyzed.length ? <BarList rows={typeRows} /> : <Empty>No analyzed calls yet.</Empty>}</div>
        </Card>

        <div className="space-y-6 xl:col-span-3">
          <Card>
            <CardHeader title="Follow-ups due" action={<SeeAll href="/sales/pipeline" />} />
            {followUps.length === 0 ? (
              <Empty>No overdue follow-ups.</Empty>
            ) : (
              <ul className="divide-y divide-slate-100">
                {followUps.slice(0, 5).map((l) => (
                  <li key={l.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                    <div className="min-w-0">
                      <p className="font-medium">{l.name}</p>
                      <p className="truncate text-xs text-slate-500">{l.nextStep || "Follow up"} · {formatPhone(l.phone)}</p>
                    </div>
                    <span className={l.nextStepDue! < now ? "shrink-0 text-xs font-medium text-red-600" : "shrink-0 text-xs text-slate-500"}>
                      {l.nextStepDue! < now ? "Overdue · " : "Due "}
                      {formatDate(l.nextStepDue!)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <CardHeader title="Clients who called unhappy" />
            {saveCalls.length === 0 ? (
              <Empty>No complaint or cancellation calls from clients.</Empty>
            ) : (
              <CallList calls={saveCalls} />
            )}
          </Card>

          <Card>
            <CardHeader title="Missed opportunities" action={<SeeAll href="/sales/coaching" />} />
            {missed.length === 0 ? (
              <Empty>{scored.length ? "None found. Nice work." : "Run AI analysis to find missed opportunities."}</Empty>
            ) : (
              <ul className="divide-y divide-slate-100">
                {missed.map((c) => (
                  <li key={c.id}>
                    <Link href={`/sales/calls/${c.id}`} className="block px-5 py-3 text-sm hover:bg-slate-50">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{c.callerName || formatPhone(c.callerPhone)}</span>
                        <span className="text-xs text-slate-400">· {c.repName ?? "Unassigned"}</span>
                        <ScoreBadge score={c.score} />
                        <LinkPending className="ml-auto" />
                      </div>
                      <p className="mt-1 text-slate-600">{c.missedOpportunity}</p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

function CallList({ calls }: { calls: { id: string; callerName: string; callerPhone: string; startedAt: Date; type: CallType | null; summary: string | null; clientId: string | null }[] }) {
  return (
    <ul className="divide-y divide-slate-100">
      {calls.map((c) => (
        <li key={c.id}>
          <Link href={`/sales/calls/${c.id}`} className="block px-5 py-3 text-sm hover:bg-slate-50">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium">{c.callerName || formatPhone(c.callerPhone)}</span>
              <CallTypeBadge type={c.type} />
              <span className="text-xs text-slate-400">{formatCallTime(c.startedAt)}</span>
              <LinkPending className="ml-auto" />
            </div>
            {c.summary && <p className="mt-1 text-slate-600">{c.summary}</p>}
          </Link>
        </li>
      ))}
    </ul>
  );
}

function SeeAll({ href }: { href: string }) {
  return (
    <Link href={href} className="inline-flex items-center gap-1 text-xs text-brand-700 hover:underline">
      See all <LinkPending collapse className="h-3" />
    </Link>
  );
}

function Stat({ icon: Icon, label, value, sub, warn }: { icon: React.ElementType; label: string; value: string; sub: string; warn?: boolean }) {
  return (
    <Card className="p-5">
      <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
        <Icon className={warn ? "h-4 w-4 text-amber-500" : "h-4 w-4 text-brand-600"} />
        {label}
      </div>
      <p className="mt-2 text-2xl font-semibold tabular-nums">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{sub}</p>
    </Card>
  );
}
