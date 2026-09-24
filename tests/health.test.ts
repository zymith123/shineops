import { describe, expect, it } from "vitest";
import { computeSignals, detectThemes, type VisitInput } from "@/lib/health/signals";
import { scoreWithRules } from "@/lib/health/rules";

const NOW = "2026-09-24";
const visits = (cleaners: string[]): VisitInput[] =>
  cleaners.map((c, i) => ({ date: `2026-09-${String(20 - i * 3).padStart(2, "0")}`, status: "completed", cleanerId: c }));

describe("detectThemes", () => {
  it("maps client language to complaint themes", () => {
    expect(detectThemes("Thinking about switching to another company")).toContain("cancellation intent");
    expect(detectThemes("Different cleaner every time")).toContain("inconsistent cleaner");
    expect(detectThemes("Baseboards skipped again")).toContain("quality");
    expect(detectThemes("Spotless, thank you!")).toEqual([]);
  });
});

describe("health rules", () => {
  it("scores a consistently happy client as healthy with no task", () => {
    const s = computeSignals(
      [
        { rating: 5, comment: "Spotless", date: "2026-09-21" },
        { rating: 5, comment: "", date: "2026-08-10" },
      ],
      visits(["a", "a", "a", "a", "a"]),
      NOW,
    );
    const a = scoreWithRules(s, "Emily");
    expect(a.status).toBe("healthy");
    expect(a.reasons).toEqual([]);
    expect(a.taskTitle).toBe("");
  });

  it("flags explicit cancellation intent as critical and leads with it", () => {
    const s = computeSignals(
      [
        { rating: 2, comment: "Thinking about switching to another company", date: "2026-09-20" },
        { rating: 2, comment: "Floors still dirty", date: "2026-09-10" },
        { rating: 5, comment: "", date: "2026-07-15" },
      ],
      visits(["a", "a", "a"]),
      NOW,
    );
    const a = scoreWithRules(s, "Olivia");
    expect(a.status).toBe("critical");
    expect(a.recommendedAction).toMatch(/retention offer/);
  });

  it("detects cleaner churn from visit history even without complaints", () => {
    const s = computeSignals([], visits(["a", "b", "c", "d", "a"]), NOW);
    expect(s.distinctCleanersLast5).toBe(4);
    const a = scoreWithRules(s, "Nguyen");
    expect(a.reasons[0].signal).toBe("Inconsistent cleaner");
  });

  it("treats a cancellation phone call as critical even without bad ratings", () => {
    const s = computeSignals(
      [{ rating: 5, comment: "", date: "2026-09-01" }],
      visits(["a", "a", "a"]),
      NOW,
      [{ date: "2026-09-22", type: "cancellation", summary: "Wants to cancel weekly service" }],
    );
    expect(s.cancellationCalls60d).toBe(1);
    expect(s.recentCalls[0]).toMatch(/cancellation/);
    const a = scoreWithRules(s, "Olivia");
    expect(a.reasons[0].signal).toBe("Called about cancelling");
    expect(a.status).not.toBe("healthy");
  });

  it("ignores feedback older than 90 days for the 30-day average", () => {
    const s = computeSignals([{ rating: 1, comment: "bad", date: "2026-05-01" }], [], NOW);
    expect(s.avgRating30d).toBeNull();
    expect(s.lowRatings60d).toBe(0);
  });
});
