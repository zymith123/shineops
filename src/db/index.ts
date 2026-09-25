import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set");

// On Vercel every function instance opens its own pool, and Supabase's session
// pooler allows only ~15 clients in total. Keep each instance small and release
// idle connections quickly; queries beyond the limit wait instead of failing.
const serverless = Boolean(process.env.VERCEL);
const max = Number(process.env.DATABASE_POOL_MAX) || (serverless ? 3 : 10);

if (serverless && /:5432\//.test(url) && /pooler\.supabase\.com/.test(url)) {
  console.warn(
    "DATABASE_URL uses Supabase's session pooler (port 5432). On Vercel use the transaction pooler (port 6543) to avoid 'max clients reached' errors.",
  );
}

// Reuse one pool across hot reloads in dev.
const globalForDb = globalThis as unknown as { pg?: ReturnType<typeof postgres> };
// prepare: false keeps this compatible with Supabase's transaction pooler.
const pg = globalForDb.pg ?? postgres(url, { prepare: false, max, idle_timeout: serverless ? 5 : 30 });
if (process.env.NODE_ENV !== "production") globalForDb.pg = pg;

export const db = drizzle(pg, { schema });
export { schema };
