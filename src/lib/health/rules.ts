import type { HealthReason, HealthStatus } from "@/db/schema";
import type { HealthSignals } from "./signals";

export type Assessment = {
  status: HealthStatus;
  score: number;
  summary: string;
  reasons: HealthReason[];
  recommendedAction: string;
  taskTitle: string;
};

export function statusForScore(score: number): HealthStatus {
  if (score >= 75) return "healthy";
  if (score >= 50) return "at_risk";
  return "critical";
}

/** Deterministic scorer. Used when no AI key is configured or the AI call fails. */
export function scoreWithRules(s: HealthSignals, clientName: string): Assessment {
  let score = 100;
  const reasons: (HealthReason & { weight: number; action: string })[] = [];
  const add = (weight: number, signal: string, detail: string, action: string) => {
    score -= weight;
    reasons.push({ signal, detail, weight, action });
  };

  if (s.avgRating30d !== null && s.avgRating30d < 4) {
    add(
      s.avgRating30d < 3 ? 30 : 15,
      "Low recent ratings",
      `Average rating ${s.avgRating30d}★ over the last 30 days.`,
      `Call ${clientName} personally to hear what's going wrong and offer a free re-clean.`,
    );
  }
  if (s.avgRating30d !== null && s.avgRatingPrior60d !== null && s.avgRatingPrior60d - s.avgRating30d >= 0.8) {
    add(
      15,
      "Ratings dropping",
      `Down from ${s.avgRatingPrior60d}★ to ${s.avgRating30d}★.`,
      `Review the last few visits for ${clientName} with the assigned cleaner.`,
    );
  }
  if (s.complaintThemes.includes("cancellation intent")) {
    add(
      35, // always outranks other signals: stated intent to leave beats everything
      "Mentions cancelling",
      "Recent feedback mentions cancelling or switching companies.",
      `Owner should call ${clientName} today with a retention offer.`,
    );
  }
  if (s.cancellationCalls60d > 0) {
    add(
      40, // a phone call about cancelling is the strongest signal we have
      "Called about cancelling",
      `${s.cancellationCalls60d} call${s.cancellationCalls60d === 1 ? "" : "s"} about cancelling in the last 60 days.`,
      `Owner should call ${clientName} back today: acknowledge the issue and offer a fix before they cancel.`,
    );
  }
  if (s.complaintCalls60d > 0) {
    add(
      15,
      "Complaint call",
      `${s.complaintCalls60d} complaint call${s.complaintCalls60d === 1 ? "" : "s"} in the last 60 days.`,
      `Follow up with ${clientName} on their complaint call and confirm it's resolved.`,
    );
  }
  if (s.distinctCleanersLast5 >= 3 || s.complaintThemes.includes("inconsistent cleaner")) {
    add(
      20,
      "Inconsistent cleaner",
      `${s.distinctCleanersLast5} different cleaners across the last 5 visits.`,
      `Assign one consistent cleaner to ${clientName} and let them know.`,
    );
  }
  if (s.skippedOrCancelled60d >= 2) {
    add(
      10,
      "Skipped visits",
      `${s.skippedOrCancelled60d} visits skipped or cancelled in 60 days.`,
      `Confirm ${clientName}'s schedule still works for them.`,
    );
  }
  for (const theme of ["quality", "reliability", "property damage", "staff conduct"]) {
    if (s.complaintThemes.includes(theme)) {
      add(
        theme === "property damage" ? 25 : 8,
        `Complaints: ${theme}`,
        `Feedback in the last 60 days mentions ${theme}.`,
        `Follow up with ${clientName} about the ${theme} complaint.`,
      );
    }
  }

  score = Math.max(0, Math.min(100, score));
  const status = statusForScore(score);
  reasons.sort((a, b) => b.weight - a.weight);
  const top = reasons[0];

  return {
    status,
    score,
    summary:
      status === "healthy"
        ? `${clientName} looks healthy — no warning signs in recent feedback or visits.`
        : `${clientName} shows ${reasons.length} warning sign${reasons.length === 1 ? "" : "s"}, led by: ${top.signal.toLowerCase()}.`,
    reasons: reasons.map(({ signal, detail }) => ({ signal, detail })),
    recommendedAction: top?.action ?? "No action needed. Keep up the good work.",
    taskTitle: top ? `${top.signal}: ${clientName}` : "",
  };
}
