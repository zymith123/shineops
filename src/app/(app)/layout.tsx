import { and, count, eq } from "drizzle-orm";
import { LogOut } from "lucide-react";
import { db, schema } from "@/db";
import { requireRole } from "@/lib/auth";
import { logout } from "@/app/login/actions";
import { Logo } from "@/components/logo";
import { Nav } from "@/components/nav";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRole(["owner", "manager", "cleaner"]);
  const [{ open }] = await db
    .select({ open: count() })
    .from(schema.tasks)
    .where(and(eq(schema.tasks.companyId, user.companyId), eq(schema.tasks.status, "open")));

  return (
    <div className="min-h-screen md:flex">
      <aside className="border-b border-slate-200 bg-white p-4 md:sticky md:top-0 md:flex md:h-screen md:w-60 md:shrink-0 md:flex-col md:border-b-0 md:border-r">
        <div className="mb-4 flex items-center justify-between md:mb-6 md:block">
          <Logo />
          <form action={logout} className="md:hidden">
            <button className="flex items-center gap-1.5 text-xs text-slate-500">
              <LogOut className="h-3.5 w-3.5" /> Sign out
            </button>
          </form>
          <p className="hidden text-xs text-slate-400 md:mt-1 md:block">{user.companyName}</p>
        </div>
        <Nav role={user.role} openTasks={open} />
        <div className="mt-4 hidden border-t border-slate-100 pt-4 md:mt-auto md:block">
          <p className="text-sm font-medium">{user.name}</p>
          <p className="text-xs capitalize text-slate-400">{user.role}</p>
          <form action={logout}>
            <button className="mt-3 flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800">
              <LogOut className="h-3.5 w-3.5" /> Sign out
            </button>
          </form>
        </div>
      </aside>
      <main className="min-w-0 flex-1 p-4 md:p-8">{children}</main>
    </div>
  );
}
