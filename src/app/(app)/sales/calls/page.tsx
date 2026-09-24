import Link from "next/link";
import clsx from "clsx";
import { ArrowDownLeft, ArrowUpRight } from "lucide-react";
import type { CallType } from "@/db/schema";
import { requireRole, STAFF } from "@/lib/auth";
import { CALL_TYPES, formatCallTime, formatDuration, OUTCOMES } from "@/lib/calls/labels";
import { formatPhone } from "@/lib/calls/phone";
import { callsWithPeople } from "@/lib/sales-queries";
import { Card, Empty } from "@/components/ui";
import { CallTypeBadge, ScoreBadge } from "@/components/sales";
import { LinkPending } from "@/components/loading";

export default async function CallsPage({ searchParams }: { searchParams: Promise<{ type?: string }> }) {
  const user = await requireRole(STAFF);
  const { type = "" } = await searchParams;
  const all = await callsWithPeople(user.companyId).limit(300);
  const valid = type in CALL_TYPES ? (type as CallType) : null;
  const calls = valid ? all.filter((c) => c.type === valid) : all;
  const unanalyzed = all.filter((c) => !c.type).length;

  const pills = [
    { key: "", label: "All", n: all.length },
    ...(Object.keys(CALL_TYPES) as CallType[]).map((t) => ({ key: t, label: CALL_TYPES[t].label, n: all.filter((c) => c.type === t).length })),
  ].filter((p) => p.key === "" || p.n > 0 || p.key === type);

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-1">
        {pills.map((p) => (
          <Link
            key={p.key || "all"}
            href={p.key ? `/sales/calls?type=${p.key}` : "/sales/calls"}
            className={clsx(
              "inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium",
              type === p.key ? "bg-slate-900 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50",
            )}
          >
            {p.label} <span className="opacity-60">{p.n}</span>
            <LinkPending collapse className="-mr-1" />
          </Link>
        ))}
        {unanalyzed > 0 && <span className="ml-2 text-xs text-amber-700">{unanalyzed} not analyzed yet</span>}
      </div>
      <Card>
        {calls.length === 0 ? (
          <Empty>No calls{valid ? ` of type "${CALL_TYPES[valid].label}"` : ""} yet.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-100 text-left text-xs text-slate-500">
                <tr>
                  <th className="px-5 py-2.5 font-medium">When</th>
                  <th className="px-5 py-2.5 font-medium">Caller</th>
                  <th className="px-5 py-2.5 font-medium">Rep</th>
                  <th className="px-5 py-2.5 font-medium">Type</th>
                  <th className="px-5 py-2.5 font-medium">Summary</th>
                  <th className="px-5 py-2.5 font-medium">Score</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {calls.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50">
                    <td className="whitespace-nowrap px-5 py-3 text-slate-500">
                      <span className="inline-flex items-center gap-1">
                        {c.direction === "inbound" ? (
                          <ArrowDownLeft className="h-3.5 w-3.5 text-slate-400" aria-label="Inbound" />
                        ) : (
                          <ArrowUpRight className="h-3.5 w-3.5 text-slate-400" aria-label="Outbound" />
                        )}
                        {formatCallTime(c.startedAt)}
                      </span>
                      <p className="text-xs text-slate-400">{formatDuration(c.durationSec)}</p>
                    </td>
                    <td className="px-5 py-3">
                      <Link href={`/sales/calls/${c.id}`} className="inline-flex items-center gap-1.5 font-medium hover:text-brand-700 hover:underline">
                        {c.callerName || formatPhone(c.callerPhone)}
                        <LinkPending />
                      </Link>
                      <p className="text-xs text-slate-400">
                        {c.clientId ? "Client" : c.leadId ? "Lead" : formatPhone(c.callerPhone)}
                      </p>
                    </td>
                    <td className="whitespace-nowrap px-5 py-3 text-slate-600">{c.repName ?? "—"}</td>
                    <td className="whitespace-nowrap px-5 py-3">
                      <CallTypeBadge type={c.type} confidence={c.typeConfidence} />
                    </td>
                    <td className="min-w-64 px-5 py-3 text-slate-600">
                      <p className="line-clamp-2">{c.summary ?? "—"}</p>
                      {c.outcome && <p className="mt-0.5 text-xs text-slate-400">{OUTCOMES[c.outcome]}</p>}
                    </td>
                    <td className="px-5 py-3">
                      <ScoreBadge score={c.score} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}

