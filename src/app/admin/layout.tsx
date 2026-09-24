import { LogOut } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { logout } from "@/app/login/actions";
import { Logo } from "@/components/logo";
import { Nav } from "@/components/nav";
import { Badge } from "@/components/ui";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAdmin();
  return (
    <div className="min-h-screen md:flex">
      <aside className="border-b border-slate-200 bg-slate-900 p-4 text-slate-100 md:sticky md:top-0 md:flex md:h-screen md:w-60 md:shrink-0 md:flex-col md:border-b-0">
        <div className="mb-4 flex items-center justify-between md:mb-6 md:block">
          <Logo />
          <form action={logout} className="md:hidden">
            <button className="flex items-center gap-1.5 text-xs text-slate-400">
              <LogOut className="h-3.5 w-3.5" /> Sign out
            </button>
          </form>
          <div className="hidden md:mt-2 md:block">
            <Badge tone="amber">Platform admin</Badge>
          </div>
        </div>
        <Nav role={user.role} dark />
        <div className="mt-4 hidden border-t border-slate-800 pt-4 md:mt-auto md:block">
          <p className="text-sm font-medium">{user.name}</p>
          <p className="text-xs text-slate-400">{user.email}</p>
          <form action={logout}>
            <button className="mt-3 flex items-center gap-1.5 text-xs text-slate-400 hover:text-white">
              <LogOut className="h-3.5 w-3.5" /> Sign out
            </button>
          </form>
        </div>
      </aside>
      <main className="min-w-0 flex-1 p-4 md:p-8">{children}</main>
    </div>
  );
}
