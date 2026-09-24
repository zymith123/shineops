import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { ArrowLeft, Bot, Calculator, Lightbulb, TrendingDown } from "lucide-react";
import clsx from "clsx";
import { db, schema } from "@/db";
import { requireRole, STAFF } from "@/lib/auth";
import { formatCallTime, formatDuration, OUTCOMES, STAGES } from "@/lib/calls/labels";
import { formatPhone } from "@/lib/calls/phone";
import { callsWithPeople } from "@/lib/sales-queries";
import { Badge, Card, CardHeader, Empty } from "@/components/ui";
import { CallTypeBadge, ScoreBadge } from "@/components/sales";
import { LinkPending } from "@/components/loading";
import { ReanalyzeCallButton } from "../../sales-client";

export default async function CallPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireRole(STAFF);
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const [call] = await callsWithPeople(user.companyId).where(and(eq(schema.calls.companyId, user.companyId), eq(schema.calls.id, id)));
  if (!call) notFound();
  const [{ transcript }] = await db.select({ transcript: schema.calls.transcript }).from(schema.calls).where(eq(schema.calls.id, id));
  const [lead] = call.leadId ? await db.select().from(schema.leads).where(eq(schema.leads.id, call.leadId)) : [];

  const lines = transcript.split("\n").map((l) => {
    const m = /^(Rep|Caller):\s*(.*)$/i.exec(l.trim());
    return m ? { who: m[1].toLowerCase() as "rep" | "caller", text: m[2] } : { who: "note" as const, text: l };
  });

  return (
    <>
      <Link href="/sales/calls" className="mb-3 inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800">
        <ArrowLeft className="h-3 w-3" /> All calls <LinkPending className="h-3 w-3" />
      </Link>
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <h2 className="text-xl font-semibold">{call.callerName || formatPhone(call.callerPhone)}</h2>
        <CallTypeBadge type={call.type} confidence={call.typeConfidence} />
        <span className="text-sm text-slate-500">
          {call.direction === "inbound" ? "Inbound" : "Outbound"} · {formatCallTime(call.startedAt)} · {formatDuration(call.durationSec)} ·{" "}
          {call.repName ?? "No rep"} · {formatPhone(call.callerPhone)}
        </span>
      </div>

      <div className="grid gap-6 xl:grid-cols-5">
        <Card className="xl:col-span-3">
          <CardHeader title="Transcript" />
          <ol className="space-y-2.5 p-5">
            {lines.map((l, i) => (
              <li key={i} className={clsx("flex", l.who === "rep" ? "justify-start" : l.who === "caller" ? "justify-end" : "justify-center")}>
                <div
                  className={clsx(
                    "max-w-[85%] rounded-2xl px-3.5 py-2 text-sm",
                    l.who === "rep" && "rounded-bl-sm bg-slate-100",
                    l.who === "caller" && "rounded-br-sm bg-brand-50 text-slate-800",
                    l.who === "note" && "text-xs italic text-slate-400",
                  )}
                >
                  {l.who !== "note" && (
                    <p className="mb-0.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                      {l.who === "rep" ? call.repName ?? "Rep" : "Caller"}
                    </p>
                  )}
                  {l.text}
                </div>
              </li>
            ))}
          </ol>
        </Card>

        <div className="space-y-6 xl:col-span-2">
          <Card>
            <CardHeader title="Analysis" action={<ReanalyzeCallButton callId={call.id} />} />
            {!call.type ? (
              <Empty>Not analyzed yet.</Empty>
            ) : (
              <div className="space-y-3 p-5 text-sm">
                <p className="inline-flex items-center gap-1 text-xs text-slate-400">
                  {call.analyzedBy === "ai" ? <Bot className="h-3.5 w-3.5" /> : <Calculator className="h-3.5 w-3.5" />}
                  {call.analyzedBy === "ai" ? "Analyzed by Claude" : "Keyword rules (no coaching score)"}
                </p>
                <p>{call.summary}</p>
                <dl className="grid grid-cols-[110px_1fr] gap-y-1.5 text-sm">
                  <dt className="text-slate-500">Outcome</dt>
                  <dd>{call.outcome ? OUTCOMES[call.outcome] : "—"}</dd>
                  {call.clientId && (
                    <>
                      <dt className="text-slate-500">Client</dt>
                      <dd>
                        <Link href={`/clients/${call.clientId}`} className="inline-flex items-center gap-1 text-brand-700 hover:underline">
                          {call.callerName} <LinkPending className="h-3 w-3" />
                        </Link>
                      </dd>
                    </>
                  )}
                  {lead && (
                    <>
                      <dt className="text-slate-500">Lead</dt>
                      <dd>
                        <Link href="/sales/pipeline" className="inline-flex items-center gap-1 text-brand-700 hover:underline">
                          {lead.name} · {STAGES.find((s) => s.key === lead.stage)?.label}
                          <LinkPending className="h-3 w-3" />
                        </Link>
                        {lead.serviceRequested && <p className="text-xs text-slate-500">{lead.serviceRequested}</p>}
                        {lead.nextStep && <p className="text-xs text-slate-500">Next: {lead.nextStep}</p>}
                      </dd>
                    </>
                  )}
                </dl>
              </div>
            )}
          </Card>

          <Card>
            <CardHeader title="Coaching" action={<ScoreBadge score={call.score} />} />
            {!call.rubric?.length ? (
              <Empty>
                {call.analyzedBy === "ai"
                  ? "Not a scorable conversation (wrong number, voicemail or too short)."
                  : "Coaching scores need AI analysis."}
              </Empty>
            ) : (
              <div className="space-y-4 p-5">
                <ul className="space-y-3">
                  {call.rubric.map((r) => (
                    <li key={r.criterion} className="text-sm">
                      <div className="mb-1 flex items-center justify-between gap-3">
                        <span className="font-medium">{r.criterion}</span>
                        <span className="text-xs tabular-nums text-slate-500">{r.score}/4</span>
                      </div>
                      <div className="mb-1 flex gap-1" aria-hidden>
                        {[1, 2, 3, 4].map((n) => (
                          <span key={n} className={clsx("h-1.5 flex-1 rounded-full", n <= r.score ? (r.score <= 1 ? "bg-red-400" : r.score === 2 ? "bg-amber-400" : "bg-brand-500") : "bg-slate-100")} />
                        ))}
                      </div>
                      <p className="text-slate-600">{r.feedback}</p>
                    </li>
                  ))}
                </ul>
                {call.coachingTip && (
                  <div className="flex gap-2 rounded-lg bg-brand-50 px-3 py-2.5 text-sm">
                    <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-brand-700" />
                    <p>
                      <b className="text-brand-700">Next time: </b>
                      {call.coachingTip}
                    </p>
                  </div>
                )}
                {call.missedOpportunity && (
                  <div className="flex gap-2 rounded-lg bg-amber-50 px-3 py-2.5 text-sm text-amber-900">
                    <TrendingDown className="mt-0.5 h-4 w-4 shrink-0" />
                    <p>
                      <b>Missed opportunity: </b>
                      {call.missedOpportunity}
                    </p>
                  </div>
                )}
              </div>
            )}
          </Card>
          {call.analyzedBy === "rules" && (
            <p className="px-1 text-xs text-slate-400">
              <Badge tone="amber">Tip</Badge> Keyword rules only see words, not intent. AI analysis also scores the rep and finds missed
              opportunities.
            </p>
          )}
        </div>
      </div>
    </>
  );
}
