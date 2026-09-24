import type { CallOutcome, CallType, LeadStage } from "@/db/schema";

type Tone = "slate" | "green" | "amber" | "red" | "blue";

export const CALL_TYPES: Record<CallType, { label: string; tone: Tone }> = {
  new_lead: { label: "New lead", tone: "blue" },
  booking: { label: "Booking", tone: "green" },
  reschedule: { label: "Reschedule", tone: "slate" },
  complaint: { label: "Complaint", tone: "amber" },
  cancellation: { label: "Cancellation", tone: "red" },
  billing: { label: "Billing", tone: "slate" },
  service_question: { label: "Service question", tone: "slate" },
  other: { label: "Other", tone: "slate" },
};

export const OUTCOMES: Record<CallOutcome, string> = {
  booked: "Booked",
  follow_up_needed: "Follow-up needed",
  resolved: "Resolved",
  lost: "Lost",
  no_action: "No action",
};

export const STAGES: { key: LeadStage; label: string }[] = [
  { key: "new", label: "New" },
  { key: "contacted", label: "Contacted" },
  { key: "quoted", label: "Quoted" },
  { key: "booked", label: "Booked" },
  { key: "lost", label: "Lost" },
];

export function scoreTone(score: number): Tone {
  return score >= 75 ? "green" : score >= 50 ? "amber" : "red";
}

export function formatDuration(sec: number) {
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
}

export function formatCallTime(d: Date) {
  return d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}
