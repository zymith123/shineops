import Link from "next/link";
import Form from "next/form";
import clsx from "clsx";
import { Plus, Search } from "lucide-react";
import { requireRole, STAFF } from "@/lib/auth";
import { listClients } from "@/lib/queries";
import { formatMoney, monthlyValueCents } from "@/lib/dates";
import { Badge, buttonClass, Card, Empty, HealthBadge, inputClass, PageHeader, Stars } from "@/components/ui";
import { FormPending, LinkPending } from "@/components/loading";

const FILTERS = [
  { key: "all", label: "All" },
  { key: "attention", label: "Needs attention" },
  { key: "healthy", label: "Healthy" },
  { key: "inactive", label: "Paused / cancelled" },
] as const;

export default async function ClientsPage({ searchParams }: { searchParams: Promise<{ q?: string; filter?: string }> }) {
  const user = await requireRole(STAFF);
  const { q = "", filter = "all" } = await searchParams;
  const all = await listClients(user.companyId);

  const needle = q.trim().toLowerCase();
  const clients = all.filter((c) => {
    if (needle && ![c.name, c.email, c.address].some((f) => f.toLowerCase().includes(needle))) return false;
    if (filter === "attention") return c.status === "active" && (c.healthStatus === "at_risk" || c.healthStatus === "critical");
    if (filter === "healthy") return c.status === "active" && c.healthStatus === "healthy";
    if (filter === "inactive") return c.status !== "active";
    return true;
  });

  return (
    <>
      <PageHeader
        title="Clients"
        subtitle={`${all.filter((c) => c.status === "active").length} active · sorted by health, most at-risk first`}
        action={
          <Link href="/clients/new" className={buttonClass()}>
            <Plus className="h-4 w-4" /> Add client
            <LinkPending collapse className="[&_svg]:text-white" />
          </Link>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Form action="/clients" className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input name="q" defaultValue={q} placeholder="Search name, email, address…" className={clsx(inputClass, "pl-9 pr-9")} />
          <input type="hidden" name="filter" value={filter} />
          <FormPending className="absolute right-3 top-2.5" />
        </Form>
        <div className="flex flex-wrap gap-1">
          {FILTERS.map((f) => (
            <Link
              key={f.key}
              href={{ pathname: "/clients", query: { ...(q ? { q } : {}), filter: f.key } }}
              className={clsx(
                "inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium",
                filter === f.key ? "bg-slate-900 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50",
              )}
            >
              {f.label}
              <LinkPending collapse className="-mr-1" />
            </Link>
          ))}
        </div>
      </div>

      <Card>
        {clients.length === 0 ? (
          <Empty>No clients match.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-100 text-left text-xs text-slate-500">
                <tr>
                  <th className="px-5 py-2.5 font-medium">Client</th>
                  <th className="px-5 py-2.5 font-medium">Plan</th>
                  <th className="px-5 py-2.5 text-right font-medium">Value / mo</th>
                  <th className="px-5 py-2.5 font-medium">Last rating</th>
                  <th className="px-5 py-2.5 font-medium">Health</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {clients.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50">
                    <td className="px-5 py-3">
                      <Link href={`/clients/${c.id}`} className="inline-flex items-center gap-1.5 font-medium hover:text-brand-700 hover:underline">
                        {c.name}
                        <LinkPending />
                      </Link>
                      <p className="text-xs text-slate-400">{c.address}</p>
                    </td>
                    <td className="px-5 py-3 capitalize">
                      {c.status !== "active" ? (
                        <Badge tone="slate">{c.status}</Badge>
                      ) : c.frequency ? (
                        `${c.frequency} · ${formatMoney(c.priceCents!)}`
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-5 py-3 text-right tabular-nums">
                      {c.status === "active" && c.frequency ? formatMoney(monthlyValueCents(c.priceCents!, c.frequency)) : "—"}
                    </td>
                    <td className="px-5 py-3">{c.lastRating ? <Stars rating={c.lastRating} /> : <span className="text-slate-300">—</span>}</td>
                    <td className="px-5 py-3">
                      <HealthBadge status={c.healthStatus} score={c.healthScore} />
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
