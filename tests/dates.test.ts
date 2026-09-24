import { describe, expect, it } from "vitest";
import { monthlyValueCents, planDates } from "@/lib/dates";

describe("planDates", () => {
  it("steps biweekly plans from the start date and skips to the window", () => {
    // Jan 5, Jan 19, Feb 2, Feb 16, Mar 2 → only the two inside the window
    expect(planDates("2026-01-05", "biweekly", "2026-02-01", "2026-03-01")).toEqual(["2026-02-02", "2026-02-16"]);
  });

  it("includes the window's first day when it lands on a service date", () => {
    expect(planDates("2026-01-05", "weekly", "2026-01-12", "2026-01-26")).toEqual(["2026-01-12", "2026-01-19", "2026-01-26"]);
  });

  it("clamps monthly plans to the end of short months", () => {
    expect(planDates("2026-01-31", "monthly", "2026-01-01", "2026-04-30")).toEqual([
      "2026-01-31",
      "2026-02-28",
      "2026-03-31",
      "2026-04-30",
    ]);
  });

  it("returns nothing for a window before the plan starts", () => {
    expect(planDates("2026-06-01", "weekly", "2026-01-01", "2026-05-31")).toEqual([]);
  });
});

describe("monthlyValueCents", () => {
  it("normalizes each frequency to a monthly amount", () => {
    expect(monthlyValueCents(10000, "weekly")).toBe(43333);
    expect(monthlyValueCents(10000, "biweekly")).toBe(21667);
    expect(monthlyValueCents(10000, "monthly")).toBe(10000);
  });
});
