import { describe, expect, it } from "vitest";
import { normalizeFeedback, npsToStars } from "@/lib/webhooks/normalize";

describe("normalizeFeedback", () => {
  it("accepts the generic format and lowercases the email", () => {
    const r = normalizeFeedback({ client_email: "Robert.Chen@Example.com", rating: "2", comment: " sticky floor " });
    expect(r).toEqual({
      ok: true,
      data: { clientEmail: "robert.chen@example.com", rating: 2, comment: "sticky floor", externalId: null, source: "generic" },
    });
  });

  it("maps review-platform events and namespaces their ids", () => {
    const r = normalizeFeedback({ event: "review.created", review: { id: 7, reviewer: { email: "a@b.co" }, stars: 4.6, body: "Nice" } });
    expect(r.ok && r.data).toMatchObject({ rating: 5, externalId: "review:7", source: "review" });
  });

  it("converts NPS survey scores to stars", () => {
    const r = normalizeFeedback({ type: "survey_response", response_id: "x", respondent_email: "a@b.co", nps: 6 });
    expect(r.ok && r.data.rating).toBe(3);
    expect([0, 2, 3, 5, 7, 9, 10].map(npsToStars)).toEqual([1, 1, 2, 3, 4, 5, 5]);
  });

  it("rejects payloads it can't understand with a useful error", () => {
    const r = normalizeFeedback({ rating: 9 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/client_email/);
  });
});
