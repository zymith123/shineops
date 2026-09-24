import { daysBetween } from "@/lib/dates";

export type FeedbackInput = { rating: number; comment: string; date: string };
export type VisitInput = { date: string; status: "scheduled" | "completed" | "skipped" | "cancelled"; cleanerId: string | null };
/** An analyzed phone call from this client. */
export type CallInput = { date: string; type: string; summary: string };

export type HealthSignals = {
  avgRating30d: number | null;
  avgRatingPrior60d: number | null; // days 31–90, the baseline we compare against
  lowRatings60d: number; // ratings of 3 or below
  complaintThemes: string[];
  skippedOrCancelled60d: number;
  distinctCleanersLast5: number;
  completedVisits60d: number;
  daysSinceLastCompleted: number | null;
  cancellationCalls60d: number;
  complaintCalls60d: number;
  recentComments: string[];
  recentCalls: string[];
};

// Keyword → theme. Cheap and explainable; the AI pass reads the raw comments too.
const THEMES: [RegExp, string][] = [
  [/different (cleaner|team|person)|new (cleaner|team)|never the same/i, "inconsistent cleaner"],
  [/late|no.?show|didn'?t show|missed (the|our) (appointment|visit)|rescheduled/i, "reliability"],
  [/missed|skipped|forgot|dust|dirty|streak|baseboard|not clean|sloppy/i, "quality"],
  [/rude|attitude|unprofessional/i, "staff conduct"],
  [/broke|broken|damage|scratch/i, "property damage"],
  [/expensive|price|cost|too much|cheaper/i, "price"],
  [/cancel|switch|another company|looking elsewhere/i, "cancellation intent"],
];

export function detectThemes(comment: string): string[] {
  return THEMES.filter(([re]) => re.test(comment)).map(([, theme]) => theme);
}

function avg(xs: number[]): number | null {
  return xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10 : null;
}

export function computeSignals(feedback: FeedbackInput[], visits: VisitInput[], now: string, calls: CallInput[] = []): HealthSignals {
  const age = (d: string) => daysBetween(d, now);
  const last30 = feedback.filter((f) => age(f.date) <= 30);
  const prior = feedback.filter((f) => age(f.date) > 30 && age(f.date) <= 90);
  const last60 = feedback.filter((f) => age(f.date) <= 60);

  const themes = new Set<string>();
  for (const f of last60) if (f.rating <= 3 || f.comment) detectThemes(f.comment).forEach((t) => themes.add(t));

  const pastVisits = visits.filter((v) => v.date <= now).sort((a, b) => (a.date < b.date ? 1 : -1));
  const completed = pastVisits.filter((v) => v.status === "completed");
  const last5Cleaners = new Set(completed.slice(0, 5).map((v) => v.cleanerId).filter(Boolean));

  const calls60 = calls.filter((c) => age(c.date) <= 60);

  return {
    avgRating30d: avg(last30.map((f) => f.rating)),
    avgRatingPrior60d: avg(prior.map((f) => f.rating)),
    lowRatings60d: last60.filter((f) => f.rating <= 3).length,
    complaintThemes: [...themes],
    skippedOrCancelled60d: pastVisits.filter(
      (v) => age(v.date) <= 60 && (v.status === "skipped" || v.status === "cancelled"),
    ).length,
    distinctCleanersLast5: last5Cleaners.size,
    completedVisits60d: completed.filter((v) => age(v.date) <= 60).length,
    daysSinceLastCompleted: completed[0] ? age(completed[0].date) : null,
    cancellationCalls60d: calls60.filter((c) => c.type === "cancellation").length,
    complaintCalls60d: calls60.filter((c) => c.type === "complaint").length,
    recentComments: [...feedback]
      .sort((a, b) => (a.date < b.date ? 1 : -1))
      .filter((f) => f.comment.trim())
      .slice(0, 8)
      .map((f) => `[${f.date}, ${f.rating}★] ${f.comment}`),
    recentCalls: [...calls60]
      .sort((a, b) => (a.date < b.date ? 1 : -1))
      .slice(0, 5)
      .map((c) => `[${c.date}, ${c.type}] ${c.summary}`),
  };
}
