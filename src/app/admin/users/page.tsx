import { asc } from "drizzle-orm";
import { db, schema } from "@/db";
import type { Role } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { listAllUsers } from "@/lib/admin-queries";
import { buttonClass, Card, CardHeader, Empty, inputClass, PageHeader } from "@/components/ui";
import { AddUserForm, UserRow } from "./user-actions";

const ROLES: Role[] = ["owner", "manager", "cleaner", "client", "admin"];

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; company?: string; role?: string }>;
}) {
  const admin = await requireAdmin();
  const { q = "", company = "", role = "" } = await searchParams;
  const roleFilter = ROLES.includes(role as Role) ? (role as Role) : undefined;

  const [users, companies] = await Promise.all([
    listAllUsers({ q: q.trim(), companyId: company || undefined, role: roleFilter }),
    db.select({ id: schema.companies.id, name: schema.companies.name }).from(schema.companies).orderBy(asc(schema.companies.name)),
  ]);
  const companyName = companies.find((c) => c.id === company)?.name;

  return (
    <>
      <PageHeader
        title={companyName ? `Users · ${companyName}` : "All users"}
        subtitle={`${users.length} login${users.length === 1 ? "" : "s"}${users.length === 500 ? " (showing first 500)" : ""}`}
      />

      <form className="mb-4 grid gap-2 sm:grid-cols-[minmax(0,1fr)_14rem_10rem_auto]">
        <input name="q" defaultValue={q} placeholder="Search name or email…" className={inputClass} />
        <select name="company" defaultValue={company} className={inputClass} aria-label="Company">
          <option value="">All companies</option>
          <option value="platform">Platform admins</option>
          {companies.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select name="role" defaultValue={role} className={inputClass} aria-label="Role">
          <option value="">All roles</option>
          {ROLES.map((r) => (
            <option key={r} value={r} className="capitalize">
              {r}
            </option>
          ))}
        </select>
        <button className={buttonClass("secondary")}>Filter</button>
      </form>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          {users.length === 0 ? (
            <Empty>No users match.</Empty>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-slate-100 text-left text-xs text-slate-500">
                  <tr>
                    <th className="px-5 py-2.5 font-medium">User</th>
                    <th className="px-5 py-2.5 font-medium">Company</th>
                    <th className="px-5 py-2.5 font-medium">Role</th>
                    <th className="px-5 py-2.5 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {users.map((u) => (
                    <UserRow key={u.id} user={u} isSelf={u.id === admin.id} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card className="h-fit">
          <CardHeader title="Add a user to a company" />
          <div className="p-5">
            <AddUserForm companies={companies} defaultCompanyId={companyName ? company : ""} />
          </div>
        </Card>
      </div>
    </>
  );
}
