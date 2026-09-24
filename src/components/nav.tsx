"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { LayoutDashboard, Users, CalendarDays, ListTodo, UserCog, Settings, Sun, Building2, ShieldCheck } from "lucide-react";
import type { Role } from "@/db/schema";

const ITEMS: { href: string; label: string; icon: React.ElementType; roles: Role[] }[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, roles: ["owner", "manager"] },
  { href: "/clients", label: "Clients", icon: Users, roles: ["owner", "manager"] },
  { href: "/schedule", label: "Schedule", icon: CalendarDays, roles: ["owner", "manager"] },
  { href: "/tasks", label: "Tasks", icon: ListTodo, roles: ["owner", "manager"] },
  { href: "/today", label: "My day", icon: Sun, roles: ["cleaner"] },
  { href: "/team", label: "Team", icon: UserCog, roles: ["owner"] },
  { href: "/settings", label: "Integrations", icon: Settings, roles: ["owner"] },
  { href: "/admin/companies", label: "Companies", icon: Building2, roles: ["admin"] },
  { href: "/admin/users", label: "All users", icon: ShieldCheck, roles: ["admin"] },
];

export function Nav({ role, openTasks = 0, dark = false }: { role: Role; openTasks?: number; dark?: boolean }) {
  const pathname = usePathname();
  return (
    <nav className="flex gap-1 overflow-x-auto md:flex-col">
      {ITEMS.filter((i) => i.roles.includes(role)).map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            className={clsx(
              "flex shrink-0 items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition",
              dark
                ? active
                  ? "bg-slate-800 text-white"
                  : "text-slate-300 hover:bg-slate-800"
                : active
                  ? "bg-brand-50 text-brand-700"
                  : "text-slate-600 hover:bg-slate-100",
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
            {href === "/tasks" && openTasks > 0 && (
              <span className="ml-auto rounded-full bg-red-500 px-1.5 text-[10px] font-semibold text-white">{openTasks}</span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
