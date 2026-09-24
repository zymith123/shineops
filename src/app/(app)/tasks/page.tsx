import Link from "next/link";
import clsx from "clsx";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireRole, STAFF } from "@/lib/auth";
import { formatDate, today } from "@/lib/dates";
import { listStaff } from "@/lib/queries";
import { createTask } from "@/lib/actions/tasks";
import { Badge, Card, CardHeader, Empty, Field, inputClass, PageHeader } from "@/components/ui";
import { ActionForm } from "@/components/client-form";
import { TaskAssignee, TaskToggle } from "./task-actions";
import { LinkPending } from "@/components/loading";

const SOURCE = {
  ai: { label: "Health alert", tone: "amber" },
  client_request: { label: "Client request", tone: "blue" },
  manual: { label: "Manual", tone: "slate" },
} as const;

export default async function TasksPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const user = await requireRole(STAFF);
  const { view = "open" } = await searchParams;
  const now = today();

  const where =
    view === "done"
      ? and(eq(schema.tasks.companyId, user.companyId), eq(schema.tasks.status, "done"))
      : view === "mine"
        ? and(eq(schema.tasks.companyId, user.companyId), eq(schema.tasks.status, "open"), eq(schema.tasks.assigneeId, user.id))
        : and(eq(schema.tasks.companyId, user.companyId), eq(schema.tasks.status, "open"));

  const [tasks, staff, clients] = await Promise.all([
    db
      .select({ task: schema.tasks, clientName: schema.clients.name })
      .from(schema.tasks)
      .leftJoin(schema.clients, eq(schema.clients.id, schema.tasks.clientId))
      .where(where)
      .orderBy(
        view === "done" ? desc(schema.tasks.completedAt) : sql`${schema.tasks.dueDate} asc nulls last`,
        asc(schema.tasks.createdAt),
      )
      .limit(100),
    listStaff(user.companyId),
    db
      .select({ id: schema.clients.id, name: schema.clients.name })
      .from(schema.clients)
      .where(and(eq(schema.clients.companyId, user.companyId), eq(schema.clients.status, "active")))
      .orderBy(schema.clients.name),
  ]);
  const assignable = staff.filter((s) => s.active && s.role !== "cleaner");

  return (
    <>
      <PageHeader title="Tasks" subtitle="Follow-ups from health alerts, client requests, and your team." />
      <div className="grid gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <div className="mb-3 flex gap-1">
            {[
              { key: "open", label: "Open" },
              { key: "mine", label: "Assigned to me" },
              { key: "done", label: "Done" },
            ].map((t) => (
              <Link
                key={t.key}
                href={`/tasks?view=${t.key}`}
                className={clsx(
                  "inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium",
                  view === t.key ? "bg-slate-900 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50",
                )}
              >
                {t.label}
                <LinkPending collapse className="-mr-1" />
              </Link>
            ))}
          </div>
          <Card>
            {tasks.length === 0 ? (
              <Empty>{view === "done" ? "No completed tasks yet." : "All caught up. 🎉"}</Empty>
            ) : (
              <ul className="divide-y divide-slate-100">
                {tasks.map(({ task, clientName }) => {
                  const overdue = task.status === "open" && task.dueDate && task.dueDate < now;
                  return (
                    <li key={task.id} className="flex gap-3 px-5 py-4">
                      <TaskToggle taskId={task.id} done={task.status === "done"} />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className={clsx("font-medium", task.status === "done" && "text-slate-400 line-through")}>{task.title}</p>
                          <Badge tone={SOURCE[task.source].tone}>{SOURCE[task.source].label}</Badge>
                        </div>
                        {task.description && <p className="mt-1 whitespace-pre-line text-sm text-slate-500">{task.description}</p>}
                        <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                          {task.clientId && (
                            <Link href={`/clients/${task.clientId}`} className="inline-flex items-center gap-1 font-medium text-brand-700 hover:underline">
                              {clientName}
                              <LinkPending className="h-3 w-3" />
                            </Link>
                          )}
                          {task.dueDate && (
                            <span className={clsx(overdue && "font-medium text-red-600")}>
                              {overdue ? "Overdue · " : "Due "}
                              {formatDate(task.dueDate)}
                            </span>
                          )}
                          <TaskAssignee taskId={task.id} assigneeId={task.assigneeId} staff={assignable} />
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </div>

        <Card className="h-fit">
          <CardHeader title="New task" />
          <div className="p-5">
            <ActionForm action={createTask} submitLabel="Add task">
              <Field label="Title">
                <input name="title" required className={inputClass} />
              </Field>
              <Field label="Details">
                <textarea name="description" rows={2} className={inputClass} />
              </Field>
              <Field label="Client (optional)">
                <select name="clientId" defaultValue="" className={inputClass}>
                  <option value="">—</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Assignee">
                  <select name="assigneeId" defaultValue={user.id} className={inputClass}>
                    <option value="">Unassigned</option>
                    {assignable.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Due">
                  <input name="dueDate" type="date" defaultValue={now} className={inputClass} />
                </Field>
              </div>
            </ActionForm>
          </div>
        </Card>
      </div>
    </>
  );
}
