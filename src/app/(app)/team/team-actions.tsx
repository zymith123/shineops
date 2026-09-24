"use client";

import { useActionState, useState, useTransition } from "react";
import { changeRole, inviteMember, setMemberActive, type InviteState } from "@/lib/actions/team";
import { Badge, Button, Field, inputClass } from "@/components/ui";

export function InviteForm() {
  const [state, action, pending] = useActionState<InviteState, FormData>(inviteMember, {});
  return (
    <form action={action} className="space-y-3">
      <Field label="Name">
        <input name="name" required className={inputClass} />
      </Field>
      <Field label="Email">
        <input name="email" type="email" required className={inputClass} />
      </Field>
      <Field label="Role">
        <select name="role" defaultValue="cleaner" className={inputClass}>
          <option value="cleaner">Cleaner</option>
          <option value="manager">Manager</option>
          <option value="owner">Owner</option>
        </select>
      </Field>
      <Button type="submit" disabled={pending}>
        {pending ? "Inviting…" : "Send invite"}
      </Button>
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state.invited && (
        <p className="rounded-lg bg-slate-50 p-3 text-xs">
          Created. Share: <b>{state.invited.email}</b> / temporary password{" "}
          <code className="font-mono font-semibold">{state.invited.tempPassword}</code>
        </p>
      )}
    </form>
  );
}

export function MemberRow({
  member,
  isSelf,
}: {
  member: { id: string; name: string; role: string; active: boolean };
  isSelf: boolean;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const [role, setRole] = useState(member.role);
  const run = (fn: () => Promise<unknown>, onError?: () => void) =>
    start(async () => {
      setError("");
      try {
        const result = await fn();
        if (result && typeof result === "object" && "error" in result && typeof result.error === "string") {
          onError?.();
          setError(result.error);
        }
      } catch {
        onError?.();
        setError("Something went wrong. Refresh and try again.");
      }
    });
  return (
    <li className="flex flex-wrap items-center gap-3 px-5 py-3">
      <div className="min-w-0 flex-1">
        <p className="font-medium">
          {member.name} {isSelf && <span className="text-xs text-slate-400">(you)</span>}
        </p>
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>
      {!member.active && <Badge tone="red">Deactivated</Badge>}
      <select
        aria-label="Role"
        value={role}
        disabled={pending || isSelf}
        onChange={(e) => {
          const next = e.target.value;
          setRole(next);
          run(() => changeRole(member.id, next), () => setRole(member.role));
        }}
        className={`${inputClass} w-32 py-1.5`}
      >
        <option value="owner">Owner</option>
        <option value="manager">Manager</option>
        <option value="cleaner">Cleaner</option>
      </select>
      {!isSelf && (
        <Button size="sm" variant={member.active ? "danger" : "secondary"} disabled={pending} onClick={() => run(() => setMemberActive(member.id, !member.active))}>
          {member.active ? "Deactivate" : "Reactivate"}
        </Button>
      )}
    </li>
  );
}
