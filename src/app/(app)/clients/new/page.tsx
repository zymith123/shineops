import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireRole, STAFF } from "@/lib/auth";
import { createClient } from "@/lib/actions/clients";
import { today } from "@/lib/dates";
import { Card, CardHeader, PageHeader } from "@/components/ui";
import { ActionForm, ClientFields, PlanFields } from "@/components/client-form";

export default async function NewClientPage() {
  const user = await requireRole(STAFF);
  const cleaners = await db
    .select({ id: schema.users.id, name: schema.users.name })
    .from(schema.users)
    .where(and(eq(schema.users.companyId, user.companyId), eq(schema.users.role, "cleaner"), eq(schema.users.active, true)));

  return (
    <div className="max-w-3xl">
      <PageHeader title="Add client" subtitle="Client details and their recurring cleaning plan." />
      <ActionForm action={createClient} submitLabel="Create client">
        <Card>
          <CardHeader title="Client" />
          <div className="p-5">
            <ClientFields />
          </div>
        </Card>
        <Card>
          <CardHeader title="Recurring plan" />
          <div className="p-5">
            <PlanFields cleaners={cleaners} values={{ startDate: today() }} />
          </div>
        </Card>
      </ActionForm>
    </div>
  );
}
