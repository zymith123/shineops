import Link from "next/link";
import { requireRole, STAFF } from "@/lib/auth";
import { addDays, today } from "@/lib/dates";
import { RUBRIC } from "@/lib/calls/ai";
import { formatCallTime } from "@/lib/calls/labels";
import { formatPhone } from "@/lib/calls/phone";
import { callsWithPeople } from "@/lib/sales-queries";
import { Card, CardHeader, Empty } from "@/components/ui";
import { BarList, CallTypeBadge, ScoreBadge } from "@/components/sales";
import { LinkPending } from "@/components/loading";

export default async function CoachingPage() {
  const user = await requireRole(STAFF);
  const calls = await callsWithPeople(user.companyId, new Date(`${addDays(today(), -30)}T00:00:00Z`));
  const scored = calls.filter((c) => c.score != null && c.rubric?.length);

  if (scored.length === 0) {
    return (
      <Card>
        <Empty>No scored calls yet. Click “Analyze calls with AI” to score every call against the coaching rubric.</Empty>
      </Card>
    );
  }

  const reps = [...Map.groupBy(scored, (c) => c.repName ?? "Unassigned").entries()]
    .map(([name, rc]) => {
      const leadCalls = calls.filter((c) => (c.repName ?? "Unassigned") === name && (c.type === "new_lead" || c.type === "booking"));
      const criteria = RUBRIC.map((criterion) => {
        const s = rc.flatMap((c) => c.rubric!.filter((r) => r.criterion === criterion).map((r) => r.score));
        return { criterion, avg: s.length ? s.reduce((a, b) => a + b, 0) / s.length : null };
      }).filter((c) => c.avg !== null);
      const weakest = criteria.sort((a, b) => a.avg! - b.avg!)[0];
      return {
        name,
        calls: rc.length,
        avg: Math.round(rc.reduce((s, c) => s + c.score!, 0) / rc.length),
        booked: leadCalls.filter((c) => c.outcome === "booked").length,
        leadCalls: leadCalls.length,
        weakest: weakest?.criterion ?? "—",
      };
    })
    .sort((a, b) => a.avg - b.avg);

  const team = RUBRIC.map((criterion) => {
    const s = scored.flatMap((c) => c.rubric!.filter((r) => r.criterion === criterion).map((r) => r.score));
    const avg = s.length ? s.reduce((a, b) => a + b, 0) / s.length : 0;
    return { label: criterion, value: Math.round(avg * 25), hint: "/ 100" };
  });

  // Worst calls first, plus any call with a missed opportunity.
  const queue = scored
    .filter((c) => c.score! < 60 || c.missedOpportunity)
    .sort((a, b) => a.score! - b.score!)
    .slice(0, 8);

  return (
    <div className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-5">
        <Card className="xl:col-span-3">
          <CardHeader title="Reps (last 30 days)" />
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-slate-500">
                <tr>
                  <th className="px-5 py-2 font-medium">Rep</th>
                  <th className="px-5 py-2 text-right font-medium">Scored calls</th>
                  <th className="px-5 py-2 text-right font-medium">Avg score</th>
                  <th className="px-5 py-2 text-right font-medium">Booked</th>
                  <th className="px-5 py-2 font-medium">Coach on</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {reps.map((r) => (
                  <tr key={r.name}>
                    <td className="px-5 py-2.5 font-medium">{r.name}</td>
                    <td className="px-5 py-2.5 text-right tabular-nums">{r.calls}</td>
                    <td className="px-5 py-2.5 text-right">
                      <ScoreBadge score={r.avg} />
                    </td>
                    <td className="px-5 py-2.5 text-right tabular-nums">
                      {r.leadCalls ? `${r.booked}/${r.leadCalls}` : "—"}
                    </td>
                    <td className="px-5 py-2.5 text-slate-600">{r.weakest}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
        <Card className="xl:col-span-2">
          <CardHeader title="Team skills (avg across scored calls)" />
          <div className="p-5">
            <BarList rows={team} max={100} />
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader title="Coaching queue: calls to review with the rep" />
        {queue.length === 0 ? (
          <Empty>Nothing urgent: no low-scoring calls or missed opportunities.</Empty>
        ) : (
          <ul className="divide-y divide-slate-100">
            {queue.map((c) => (
              <li key={c.id}>
                <Link href={`/sales/calls/${c.id}`} className="block px-5 py-3.5 text-sm hover:bg-slate-50">
                  <div className="flex flex-wrap items-center gap-2">
                    <ScoreBadge score={c.score} />
                    <span className="font-medium">{c.repName ?? "Unassigned"}</span>
                    <span className="text-slate-400">with {c.callerName || formatPhone(c.callerPhone)}</span>
                    <CallTypeBadge type={c.type} />
                    <span className="text-xs text-slate-400">{formatCallTime(c.startedAt)}</span>
                    <LinkPending className="ml-auto" />
                  </div>
                  {c.coachingTip && <p className="mt-1.5 text-slate-700">{c.coachingTip}</p>}
                  {c.missedOpportunity && <p className="mt-1 text-amber-800">Missed: {c.missedOpportunity}</p>}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
