"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { requireRole, STAFF } from "@/lib/auth";
import type { FormState } from "./clients";

async function assertInCompany(companyId: string, table: typeof schema.users | typeof schema.clients, id: string | null) {
  if (!id) return;
  const [row] = await db.select({ id: table.id }).from(table).where(and(eq(table.id, id), eq(table.companyId, companyId)));
  if (!row) throw new Error("Not found");
}

const TaskInput = z.object({
  title: z.string().trim().min(3, "Give the task a title"),
  description: z.string().trim().default(""),
  clientId: z.string().uuid().or(z.literal("")).transform((v) => v || null),
  assigneeId: z.string().uuid().or(z.literal("")).transform((v) => v || null),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).or(z.literal("")).transform((v) => v || null),
});

export async function createTask(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireRole(STAFF);
  const parsed = TaskInput.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  await assertInCompany(user.companyId, schema.clients, parsed.data.clientId);
  await assertInCompany(user.companyId, schema.users, parsed.data.assigneeId);
  await db.insert(schema.tasks).values({ companyId: user.companyId, source: "manual", ...parsed.data });
  revalidatePath("/tasks");
  return { ok: "Task added" };
}

export async function setTaskStatus(taskId: string, status: "open" | "done") {
  const user = await requireRole(STAFF);
  await db
    .update(schema.tasks)
    .set({ status, completedAt: status === "done" ? new Date() : null })
    .where(and(eq(schema.tasks.id, taskId), eq(schema.tasks.companyId, user.companyId)));
  revalidatePath("/tasks");
}

export async function assignTask(taskId: string, assigneeId: string) {
  const user = await requireRole(STAFF);
  await assertInCompany(user.companyId, schema.users, assigneeId || null);
  await db
    .update(schema.tasks)
    .set({ assigneeId: assigneeId || null })
    .where(and(eq(schema.tasks.id, taskId), eq(schema.tasks.companyId, user.companyId)));
  revalidatePath("/tasks");
}
