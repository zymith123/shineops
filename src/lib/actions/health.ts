"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireRole, STAFF } from "@/lib/auth";
import { assessClient } from "@/lib/health/service";
import { aiEnabled } from "@/lib/ai/client";

export async function reanalyzeClient(clientId: string) {
  const user = await requireRole(STAFF);
  await assessClient(user.companyId, clientId);
  revalidatePath(`/clients/${clientId}`);
}

export async function reanalyzeAll(): Promise<{ count: number; ai: boolean }> {
  const user = await requireRole(STAFF);
  const rows = await db
    .select({ id: schema.clients.id })
    .from(schema.clients)
    .where(and(eq(schema.clients.companyId, user.companyId), eq(schema.clients.status, "active")));

  // Small worker pool: fast enough for a demo-sized book, gentle on API rate limits.
  const queue = [...rows];
  await Promise.all(
    Array.from({ length: 4 }, async () => {
      for (let next = queue.shift(); next; next = queue.shift()) await assessClient(user.companyId, next.id);
    }),
  );
  revalidatePath("/", "layout");
  return { count: rows.length, ai: aiEnabled() };
}
