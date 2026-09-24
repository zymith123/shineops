import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { listCompaniesWithStats } from "@/lib/admin-queries";
import { formatMoney } from "@/lib/dates";
import { Badge, Card, CardHeader, Empty, PageHeader } from "@/components/ui";
import { CreateCompanyForm } from "./create-company-form";

export default async function CompaniesPage() {
  await requireAdmin();
  const companies = await listCompaniesWithStats();
  const totals = {
    clients: companies.reduce((s, c) => s + c.activeClients, 0),
    mrr: companies.reduce((s, c) => s + c.mrrCents, 0),
    staff: companies.reduce((s, c) => s + c.staff, 0),
  };

  return (
    <>
      <PageHeader title="Companies" subtitle="Every cleaning business on ShineOps." />
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Companies" value={String(companies.length)} />
        <Stat label="Active clients (all companies)" value={String(totals.clients)} />
        <Stat label="Client revenue managed / mo" value={formatMoney(totals.mrr)} />
        <Stat label="Active staff logins" value={String(totals.staff)} />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="All companies" />
          {companies.length === 0 ? (
            <Empty>No companies yet. Create the first one.</Empty>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-slate-100 text-left text-xs text-slate-500">
                  <tr>
                    <th className="px-5 py-2.5 font-medium">Company</th>
                    <th className="px-5 py-2.5 text-right font-medium">Active clients</th>
                    <th className="px-5 py-2.5 text-right font-medium">Revenue / mo</th>
                    <th className="px-5 py-2.5 text-right font-medium">At risk</th>
                    <th className="px-5 py-2.5 text-right font-medium">Staff</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {companies.map((c) => (
                    <tr key={c.id} className="hover:bg-slate-50">
                      <td className="px-5 py-3">
                        <Link href={`/admin/users?company=${c.id}`} className="font-medium hover:text-brand-700 hover:underline">
                          {c.name}
                        </Link>
                        <p className="text-xs text-slate-400">
                          Joined {c.createdAt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                          {c.owners === 0 && (
                            <>
                              {" · "}
                              <span className="font-medium text-red-600">no active owner</span>
                            </>
                          )}
                        </p>
                      </td>
                      <td className="px-5 py-3 text-right tabular-nums">{c.activeClients}</td>
                      <td className="px-5 py-3 text-right tabular-nums">{formatMoney(c.mrrCents)}</td>
                      <td className="px-5 py-3 text-right">
                        {c.atRiskClients > 0 ? <Badge tone="amber">{c.atRiskClients}</Badge> : <span className="text-slate-300">0</span>}
                      </td>
                      <td className="px-5 py-3 text-right tabular-nums">{c.staff}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card className="h-fit">
          <CardHeader title="Onboard a new company" />
          <div className="p-5">
            <CreateCompanyForm />
          </div>
        </Card>
      </div>
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card className="p-5">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold tabular-nums">{value}</p>
    </Card>
  );
}
