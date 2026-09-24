import { randomBytes } from "node:crypto";
import type { Role } from "@/db/schema";

/** Staff roles that can be granted from the Team page or the admin console. */
export const STAFF_ROLES = ["owner", "manager", "cleaner"] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];

/** 12-character one-time password, shown once to whoever creates the account. */
export function generateTempPassword() {
  return randomBytes(9).toString("base64url");
}

type Member = { id: string; role: Role; active: boolean };

/**
 * Returns an error message if applying `change` to `memberId` would leave the
 * company with no active owner, otherwise null.
 */
export function lastOwnerViolation(members: Member[], memberId: string, change: { role?: Role; active?: boolean }) {
  const after = members.map((m) => (m.id === memberId ? { ...m, ...change } : m));
  const hadOwner = members.some((m) => m.role === "owner" && m.active);
  const hasOwner = after.some((m) => m.role === "owner" && m.active);
  return hadOwner && !hasOwner ? "A company needs at least one active owner." : null;
}
