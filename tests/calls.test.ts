import { describe, expect, it } from "vitest";
import { advanceStage, isLeadCall, stageFromCall } from "@/lib/calls/pipeline";
import { analyzeWithRules } from "@/lib/calls/rules";
import { normalizeCall } from "@/lib/calls/normalize";
import { formatPhone, normalizePhone } from "@/lib/calls/phone";

describe("phone numbers", () => {
  it("normalizes formats to 10 digits", () => {
    expect(normalizePhone("+1 (512) 555-0101")).toBe("5125550101");
    expect(normalizePhone("512.555.0101")).toBe("5125550101");
    expect(formatPhone("5125550101")).toBe("(512) 555-0101");
  });
});

describe("pipeline stages", () => {
  it("derives a stage from a single call", () => {
    expect(stageFromCall("booked", false)).toBe("booked");
    expect(stageFromCall("follow_up_needed", true)).toBe("quoted");
    expect(stageFromCall("follow_up_needed", false)).toBe("contacted");
    expect(stageFromCall("lost", true)).toBe("lost");
  });

  it("only moves leads forward", () => {
    expect(advanceStage("quoted", "contacted")).toBe("quoted");
    expect(advanceStage("contacted", "quoted")).toBe("quoted");
    expect(advanceStage(null, "contacted")).toBe("contacted");
  });

  it("never marks a booked lead lost, but revives lost leads", () => {
    expect(advanceStage("booked", "lost")).toBe("booked");
    expect(advanceStage("quoted", "lost")).toBe("lost");
    expect(advanceStage("lost", "contacted")).toBe("contacted");
  });

  it("treats prospects and bookings as lead calls, not billing", () => {
    expect(isLeadCall("new_lead", "follow_up_needed")).toBe(true);
    expect(isLeadCall("billing", "resolved")).toBe(false);
    expect(isLeadCall("other", "booked")).toBe(true);
  });
});

describe("rules fallback classifier", () => {
  const t = (caller: string, rep = "Thanks for calling Sparkle & Co.") => `Rep: ${rep}\nCaller: ${caller}`;

  it("prioritizes cancellation over complaint", () => {
    expect(analyzeWithRules(t("The bathrooms were still dirty again and honestly I want to cancel.")).type).toBe("cancellation");
  });

  it("classifies common intents from what the caller says", () => {
    expect(analyzeWithRules(t("Hi, how much would a biweekly clean be for a 3 bedroom?")).type).toBe("new_lead");
    expect(analyzeWithRules(t("I need to reschedule Thursday's clean.")).type).toBe("reschedule");
    expect(analyzeWithRules(t("I was charged twice on my card this month.")).type).toBe("billing");
    expect(analyzeWithRules(t("Is this the pizza place?")).type).toBe("other");
    expect(analyzeWithRules(t("I'm getting quotes for a four bedroom.")).type).toBe("new_lead");
    expect(analyzeWithRules(t("I need a move-out clean for my deposit.")).type).toBe("new_lead");
  });

  it("ignores the rep's words when classifying", () => {
    expect(analyzeWithRules(t("Hi, just calling about my appointment.", "Do you want to cancel or reschedule?")).type).not.toBe("cancellation");
  });

  it("extracts name, price and a booking from the transcript", () => {
    const facts = analyzeWithRules(
      "Rep: Thanks for calling.\nCaller: Hi, my name is Dana Lopez, I'd like a quote.\nRep: That's $165 per visit. You're all set for Tuesday!",
    );
    expect(facts.callerName).toBe("Dana Lopez");
    expect(facts.priceQuoted).toBe(true);
    expect(facts.outcome).toBe("booked");
  });
});

describe("normalizeCall", () => {
  it("accepts call-tracking payloads with utterances", () => {
    const r = normalizeCall({
      id: 991,
      customer_name: null,
      customer_phone_number: "+15125550199",
      agent_email: "Rachel@Sparkleco.demo",
      start_time: "2026-09-20T15:00:00Z",
      duration: 184,
      transcription: [
        { speaker: "Agent", text: "Sparkle and Co, this is Rachel." },
        { speaker: "Customer", text: "Hi, do you do move-out cleans?" },
      ],
    });
    expect(r.ok && r.data).toMatchObject({
      externalId: "ct:991",
      callerPhone: "5125550199",
      repEmail: "rachel@sparkleco.demo",
      transcript: "Rep: Sparkle and Co, this is Rachel.\nCaller: Hi, do you do move-out cleans?",
    });
  });

  it("accepts the native format and rejects junk with a useful error", () => {
    expect(
      normalizeCall({ caller_phone: "512-555-0101", started_at: "2026-09-20T15:00:00Z", duration_sec: 60, transcript: "Caller: hi" }).ok,
    ).toBe(true);
    const bad = normalizeCall({ hello: "world" });
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.error).toMatch(/caller_phone/);
  });
});
