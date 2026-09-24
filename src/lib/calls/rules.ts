import type { CallOutcome, CallType } from "@/db/schema";

export type CallFacts = {
  type: CallType;
  typeConfidence: number;
  summary: string;
  outcome: CallOutcome;
  callerName: string;
  priceQuoted: boolean;
};

// First match wins, so more specific / more urgent intents come first.
const TYPE_RULES: [CallType, RegExp][] = [
  ["cancellation", /\bcancel(l?ing|l?ed)?\b|stop (the )?service|switch(ing)? (to )?(another|a different) (company|service)/i],
  ["complaint", /not (happy|satisfied)|disappoint|complain|(was|were|still) (dirty|missed|skipped)|missed (the|a|our)|didn'?t (clean|do)|unacceptable|upset/i],
  ["reschedule", /reschedul|move (my|our|the) (clean|appointment|visit)|different day|push (it|the clean) back/i],
  ["billing", /\b(bill|billing|invoice|charged?|refund|card on file|autopay|payment)\b/i],
  ["booking", /\b(book|schedule|sign (me|us) up|get (me|us) on the calendar)\b/i],
  ["new_lead", /\b(quotes?|estimates?|how much|pricing|price|first time|never used|move.?out clean|commercial clean|looking for a (regular )?clean)/i],
  ["service_question", /\b(do you (bring|use|clean)|what (products|supplies)|are you (insured|bonded)|pets?)\b/i],
];

/** Lines spoken by the customer ("Caller: ..."). */
function callerLines(transcript: string) {
  return transcript
    .split("\n")
    .filter((l) => /^caller:/i.test(l.trim()))
    .map((l) => l.replace(/^caller:\s*/i, "").trim());
}

/**
 * Keyword fallback used when no AI key is configured. It only classifies and
 * pulls obvious facts; coaching scores need the AI.
 */
export function analyzeWithRules(transcript: string): CallFacts {
  const said = callerLines(transcript).join(" ");
  const text = said || transcript;
  const match = TYPE_RULES.find(([, re]) => re.test(text));
  const type = match?.[0] ?? "other";

  const name = /(?:my name is|this is|it'?s)\s+([A-Z][a-z]+(?:\s[A-Z][a-z]+)?)/.exec(said)?.[1] ?? "";
  const booked = /you'?re all set|you'?re booked|see you (on|next)|got you (down|booked|scheduled)/i.test(transcript);
  const priceQuoted = /\$\s?\d/.test(transcript);
  const firstLine = callerLines(transcript)[0] ?? "";

  return {
    type,
    typeConfidence: match ? 55 : 30,
    summary: firstLine ? `Caller: "${firstLine.length > 110 ? `${firstLine.slice(0, 107)}…` : firstLine}"` : "No caller speech in transcript.",
    outcome: booked ? "booked" : type === "new_lead" ? "follow_up_needed" : "no_action",
    callerName: name,
    priceQuoted,
  };
}
