import { z } from "zod";
import { normalizePhone } from "./phone";

/** The one call shape the app understands, whatever phone system sent it. */
export type NormalizedCall = {
  externalId: string | null;
  direction: "inbound" | "outbound";
  callerName: string;
  callerPhone: string;
  repEmail: string | null;
  startedAt: Date;
  durationSec: number;
  transcript: string;
  source: string;
};

const Direction = z.enum(["inbound", "outbound"]).catch("inbound");

// Our own documented format.
const Native = z.object({
  external_id: z.string().optional(),
  direction: Direction.optional().default("inbound"),
  caller_name: z.string().optional().default(""),
  caller_phone: z.string().min(7),
  rep_email: z.string().email().optional(),
  started_at: z.coerce.date(),
  duration_sec: z.coerce.number().int().min(0),
  transcript: z.string().min(1),
});

// CallRail-style webhook (call tracking platforms send something close to this).
const CallTracking = z.object({
  id: z.union([z.string(), z.number()]),
  direction: Direction.optional().default("inbound"),
  customer_name: z.string().nullable().optional(),
  customer_phone_number: z.string().min(7),
  agent_email: z.string().email().nullable().optional(),
  start_time: z.coerce.date(),
  duration: z.coerce.number().int().min(0),
  transcription: z.union([
    z.string().min(1),
    // Some systems send utterances instead of one text blob.
    z.array(z.object({ speaker: z.string(), text: z.string() })).min(1),
  ]),
});

function utterancesToText(t: string | { speaker: string; text: string }[]) {
  if (typeof t === "string") return t.trim();
  return t.map((u) => `${/agent|rep|employee/i.test(u.speaker) ? "Rep" : "Caller"}: ${u.text.trim()}`).join("\n");
}

export function normalizeCall(body: unknown): { ok: true; data: NormalizedCall } | { ok: false; error: string } {
  const tracking = CallTracking.safeParse(body);
  if (tracking.success) {
    const c = tracking.data;
    return {
      ok: true,
      data: {
        externalId: `ct:${c.id}`,
        direction: c.direction,
        callerName: (c.customer_name ?? "").trim(),
        callerPhone: normalizePhone(c.customer_phone_number),
        repEmail: c.agent_email?.toLowerCase() ?? null,
        startedAt: c.start_time,
        durationSec: c.duration,
        transcript: utterancesToText(c.transcription),
        source: "call_tracking",
      },
    };
  }
  const native = Native.safeParse(body);
  if (native.success) {
    const c = native.data;
    return {
      ok: true,
      data: {
        externalId: c.external_id ?? null,
        direction: c.direction,
        callerName: c.caller_name.trim(),
        callerPhone: normalizePhone(c.caller_phone),
        repEmail: c.rep_email?.toLowerCase() ?? null,
        startedAt: c.started_at,
        durationSec: c.duration_sec,
        transcript: c.transcript.trim(),
        source: "native",
      },
    };
  }
  return {
    ok: false,
    error: `Unrecognized payload. ${native.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`,
  };
}
