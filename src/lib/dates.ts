import type { Frequency } from "@/db/schema";

// All schedule math is done on "YYYY-MM-DD" strings in UTC to avoid timezone drift.
export function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function parseISODate(s: string): Date {
  return new Date(`${s}T00:00:00Z`);
}

export function addDays(s: string, days: number): string {
  const d = parseISODate(s);
  d.setUTCDate(d.getUTCDate() + days);
  return toISODate(d);
}

export function daysBetween(a: string, b: string): number {
  return Math.round((parseISODate(b).getTime() - parseISODate(a).getTime()) / 86_400_000);
}

export function today(): string {
  return toISODate(new Date());
}

/** Monthly-equivalent revenue for a plan price. */
export function monthlyValueCents(priceCents: number, frequency: Frequency): number {
  const perYear = { weekly: 52, biweekly: 26, monthly: 12 }[frequency];
  return Math.round((priceCents * perYear) / 12);
}

/**
 * Service dates for a recurring plan within [from, to] inclusive.
 * Weekly/biweekly step from the start date; monthly keeps the start date's day
 * of month, clamped to the month's last day (a plan starting Jan 31 → Feb 28).
 */
export function planDates(startDate: string, frequency: Frequency, from: string, to: string): string[] {
  const out: string[] = [];
  if (frequency === "monthly") {
    const start = parseISODate(startDate);
    const day = start.getUTCDate();
    for (let i = 0; ; i++) {
      const y = start.getUTCFullYear();
      const m = start.getUTCMonth() + i;
      const lastDay = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
      const date = toISODate(new Date(Date.UTC(y, m, Math.min(day, lastDay))));
      if (date > to) break;
      if (date >= from) out.push(date);
    }
    return out;
  }
  const step = frequency === "weekly" ? 7 : 14;
  let date = startDate;
  if (date < from) {
    // Jump straight to the first occurrence on/after `from`.
    const skip = Math.ceil(daysBetween(date, from) / step);
    date = addDays(date, skip * step);
  }
  for (; date <= to; date = addDays(date, step)) out.push(date);
  return out;
}

export function formatMoney(cents: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(
    cents / 100,
  );
}

export function formatDate(s: string): string {
  return parseISODate(s).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
}
