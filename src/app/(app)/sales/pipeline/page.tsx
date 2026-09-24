import Link from "next/link";
import { and, desc, eq, inArray, isNotNull } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireRole, STAFF } from "@/lib/auth";
import { formatDate, today } from "@/lib/dates";
import { STAGES } from "@/lib/calls/labels";
import { formatPhone } from "@/lib/calls/phone";
import { listStaff } from "@/lib/queries";
import { LinkPending } from "@/components/loading";
import { LeadControls } from "../sales-client";

export default async function PipelinePage() {
  const user = await requireRole(STAFF);
  const now = today();
  const [leads, staff] = await Promise.all([
    db.select().from(schema.leads).where(eq(schema.leads.companyId, user.companyId)).orderBy(desc(schema.leads.updatedAt)),
    listStaff(user.companyId),
  ]);
  const lastCalls = leads.length
    ? await db
        .selectDistinctOn([schema.calls.leadId], { leadId: schema.calls.leadId, id: schema.calls.id })
        .from(schema.calls)
        .where(and(isNotNull(schema.calls.leadId), inArray(schema.calls.leadId, leads.map((l) => l.id))))
        .orderBy(schema.calls.leadId, desc(schema.calls.startedAt))
    : [];
  const people = staff.filter((s) => s.active && s.role !== "cleaner");

  return (
    <>
      <p className="mb-4 text-sm text-slate-500">
        Leads are created and moved automatically from call analysis. You can always override the stage or owner.
      </p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {STAGES.map((stage) => {
          const col = leads.filter((l) => l.stage === stage.key);
          return (
            <section key={stage.key} className="min-w-0 rounded-xl bg-slate-100/70 p-2">
              <h3 className="flex items-center justify-between px-2 py-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                {stage.label}
                <span className="rounded-full bg-white px-2 py-0.5 text-slate-600">{col.length}</span>
              </h3>
              <ul className="space-y-2">
                {col.length === 0 && <li className="px-2 py-4 text-center text-xs text-slate-400">No leads</li>}
                {col.map((l) => {
                  const overdue = l.nextStepDue && l.nextStepDue < now;
                  const lastCall = lastCalls.find((c) => c.leadId === l.id);
                  return (
                    <li key={l.id} className="rounded-lg border border-slate-200 bg-white p-3 text-sm shadow-sm">
                      <p className="font-medium">{l.name}</p>
                      <p className="text-xs text-slate-400">{formatPhone(l.phone)}</p>
                      {l.serviceRequested && <p className="mt-1 text-xs text-slate-600">{l.serviceRequested}</p>}
                      {l.nextStep && (
                        <p className={overdue ? "mt-1 text-xs font-medium text-red-600" : "mt-1 text-xs text-slate-500"}>
                          {l.nextStep}
                          {l.nextStepDue && ` · ${overdue ? "overdue" : "due"} ${formatDate(l.nextStepDue)}`}
                        </p>
                      )}
                      {lastCall && (
                        <Link href={`/sales/calls/${lastCall.id}`} className="mt-1 inline-flex items-center gap-1 text-xs text-brand-700 hover:underline">
                          Last call <LinkPending collapse className="h-3" />
                        </Link>
                      )}
                      <LeadControls leadId={l.id} stage={l.stage} ownerId={l.ownerId} staff={people} />
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>
    </>
  );
}
