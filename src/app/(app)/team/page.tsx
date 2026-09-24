import { requireRole } from "@/lib/auth";
import { listStaff } from "@/lib/queries";
import { Card, CardHeader, PageHeader } from "@/components/ui";
import { InviteForm, MemberRow } from "./team-actions";

export default async function TeamPage() {
  const user = await requireRole(["owner"]);
  const staff = await listStaff(user.companyId);
  return (
    <>
      <PageHeader title="Team" subtitle="Who can log in, and what they can see." />
      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title={`${staff.filter((s) => s.active).length} active members`} />
          <ul className="divide-y divide-slate-100">
            {staff.map((m) => (
              <MemberRow key={m.id} member={m} isSelf={m.id === user.id} />
            ))}
          </ul>
        </Card>
        <div className="space-y-6">
          <Card>
            <CardHeader title="Invite a team member" />
            <div className="p-5">
              <InviteForm />
            </div>
          </Card>
          <Card className="p-5 text-sm text-slate-600">
            <p className="mb-2 font-semibold text-slate-800">Roles</p>
            <ul className="space-y-1.5">
              <li><b>Owner</b>: everything, including team and integrations.</li>
              <li><b>Manager</b>: clients, schedule, tasks and the dashboard.</li>
              <li><b>Cleaner</b>: only their own visits for the day.</li>
              <li><b>Client</b>: the client portal (invite from a client&apos;s page).</li>
            </ul>
          </Card>
        </div>
      </div>
    </>
  );
}
