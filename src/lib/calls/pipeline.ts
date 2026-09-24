import type { CallOutcome, CallType, LeadStage } from "@/db/schema";

const ORDER: Record<Exclude<LeadStage, "lost">, number> = { new: 0, contacted: 1, quoted: 2, booked: 3 };

/** Call types that represent a (potential) new customer and should create or update a lead. */
export function isLeadCall(type: CallType, outcome: CallOutcome) {
  return type === "new_lead" || type === "booking" || outcome === "booked";
}

/** The stage a single call implies on its own. */
export function stageFromCall(outcome: CallOutcome, priceQuoted: boolean): LeadStage {
  if (outcome === "booked") return "booked";
  if (outcome === "lost") return "lost";
  return priceQuoted ? "quoted" : "contacted";
}

/**
 * Leads only move forward: a later "just asking" call never drags a quoted
 * lead back to contacted, and a booked lead is never marked lost. A lead
 * marked lost can be revived by any new conversation.
 */
export function advanceStage(current: LeadStage | null, next: LeadStage): LeadStage {
  if (!current) return next;
  if (current === "booked") return "booked";
  if (next === "lost") return "lost";
  if (current === "lost") return next;
  return ORDER[next] > ORDER[current] ? next : current;
}
