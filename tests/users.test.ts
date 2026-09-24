import { describe, expect, it } from "vitest";
import { generateTempPassword, lastOwnerViolation } from "@/lib/users";

const team = [
  { id: "o1", role: "owner" as const, active: true },
  { id: "m1", role: "manager" as const, active: true },
  { id: "c1", role: "cleaner" as const, active: true },
];

describe("lastOwnerViolation", () => {
  it("blocks demoting the only owner", () => {
    expect(lastOwnerViolation(team, "o1", { role: "manager" })).toMatch(/at least one active owner/);
  });

  it("blocks deactivating the only owner", () => {
    expect(lastOwnerViolation(team, "o1", { active: false })).toMatch(/at least one active owner/);
  });

  it("allows it once there is a second active owner", () => {
    const twoOwners = [...team, { id: "o2", role: "owner" as const, active: true }];
    expect(lastOwnerViolation(twoOwners, "o1", { role: "cleaner" })).toBeNull();
    expect(lastOwnerViolation(twoOwners, "o1", { active: false })).toBeNull();
  });

  it("doesn't count a deactivated owner as the backup", () => {
    const inactiveBackup = [...team, { id: "o2", role: "owner" as const, active: false }];
    expect(lastOwnerViolation(inactiveBackup, "o1", { active: false })).not.toBeNull();
  });

  it("allows changes to non-owners and promoting someone to owner", () => {
    expect(lastOwnerViolation(team, "c1", { active: false })).toBeNull();
    expect(lastOwnerViolation(team, "m1", { role: "owner" })).toBeNull();
  });
});

describe("generateTempPassword", () => {
  it("is 12 URL-safe characters and different every time", () => {
    const a = generateTempPassword();
    expect(a).toMatch(/^[A-Za-z0-9_-]{12}$/);
    expect(generateTempPassword()).not.toBe(a);
  });
});
