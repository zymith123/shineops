import { and, asc, desc, eq, gte, lt } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { CalendarDays, LogOut } from "lucide-react";
import { db, schema } from "@/db";
import { requireRole } from "@/lib/auth";
import { logout } from "@/app/login/actions";
import { formatDate, formatMoney, today } from "@/lib/dates";
import { Card, CardHeader, Empty, Stars } from "@/components/ui";
import { Logo } from "@/components/logo";
import { RateVisit, RequestForm } from "./portal-forms";

export default async function PortalPage() {
  const user = await requireRole(["client"]);
  const clientId = user.clientId!;
  const now = today();
  const cleaner = alias(schema.users, "cleaner");

  const [[plan], upcoming, past] = await Promise.all([
    db.select().from(schema.servicePlans).where(eq(schema.servicePlans.clientId, clientId)),
    db
      .select({ id: schema.visits.id, date: schema.visits.scheduledDate, cleaner: cleaner.name })
      .from(schema.visits)
      .leftJoin(cleaner, eq(cleaner.id, schema.visits.cleanerId))
      .where(and(eq(schema.visits.clientId, clientId), eq(schema.visits.status, "scheduled"), gte(schema.visits.scheduledDate, now)))
      .orderBy(asc(schema.visits.scheduledDate))
      .limit(4),
    db
      .select({
        id: schema.visits.id,
        date: schema.visits.scheduledDate,
        cleaner: cleaner.name,
        rating: schema.feedback.rating,
        comment: schema.feedback.comment,
      })
      .from(schema.visits)
      .leftJoin(cleaner, eq(cleaner.id, schema.visits.cleanerId))
      .leftJoin(schema.feedback, eq(schema.feedback.visitId, schema.visits.id))
      .where(and(eq(schema.visits.clientId, clientId), eq(schema.visits.status, "completed"), lt(schema.visits.scheduledDate, now)))
      .orderBy(desc(schema.visits.scheduledDate))
      .limit(6),
  ]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-brand-50 to-slate-50">
      <header className="border-b border-slate-200 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between p-4">
          <Logo />
          <form action={logout}>
            <button className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800">
              <LogOut className="h-3.5 w-3.5" /> Sign out
            </button>
          </form>
        </div>
      </header>
      <main className="mx-auto max-w-3xl space-y-6 p-4 py-8">
        <div>
          <h1 className="text-2xl font-semibold">Welcome back, {user.name.split(" ")[0]}</h1>
          <p className="mt-1 text-sm text-slate-500">
            {user.companyName}
            {plan && ` · ${plan.frequency} cleaning · ${formatMoney(plan.priceCents)} per visit`}
          </p>
        </div>

        <Card>
          <CardHeader title="Upcoming cleans" />
          {upcoming.length === 0 ? (
            <Empty>No cleans scheduled.</Empty>
          ) : (
            <ul className="divide-y divide-slate-100">
              {upcoming.map((v, i) => (
                <li key={v.id} className="flex items-center gap-3 px-5 py-3 text-sm">
                  <CalendarDays className={`h-4 w-4 ${i === 0 ? "text-brand-600" : "text-slate-300"}`} />
                  <span className={i === 0 ? "font-semibold" : ""}>{formatDate(v.date)}</span>
                  <span className="text-slate-500">with {v.cleaner ?? "your cleaning team"}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader title="Rate your recent cleans" />
          {past.length === 0 ? (
            <Empty>No completed cleans yet.</Empty>
          ) : (
            <ul className="divide-y divide-slate-100">
              {past.map((v) => (
                <li key={v.id} className="px-5 py-4 text-sm">
                  <p className="font-medium">
                    {formatDate(v.date)} <span className="font-normal text-slate-500">· {v.cleaner ?? "Team"}</span>
                  </p>
                  {v.rating ? (
                    <p className="mt-1 text-slate-500">
                      <Stars rating={v.rating} /> {v.comment && <>&ldquo;{v.comment}&rdquo;</>}
                    </p>
                  ) : (
                    <RateVisit visitId={v.id} />
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader title="Need something?" />
          <div className="p-5">
            <RequestForm />
          </div>
        </Card>
      </main>
    </div>
  );
}
