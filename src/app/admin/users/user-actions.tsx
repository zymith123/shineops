"use client";

import { useActionState, useState, useTransition } from "react";
import { addUser, adminChangeRole, adminResetPassword, adminSetActive, type CreatedLogin } from "@/lib/actions/admin";
import type { Role } from "@/db/schema";
import { Badge, Button, Field, inputClass } from "@/components/ui";
import { TempPassword } from "@/components/temp-password";

type Row = {
  id: string;
  name: string;
  email: string;
  role: Role;
  active: boolean;
  clientId: string | null;
  companyName: string | null;
};

export function UserRow({ user, isSelf }: { user: Row; isSelf: boolean }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const [reset, setReset] = useState<{ email: string; tempPassword: string } | null>(null);
  const [role, setRole] = useState(user.role);
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

  // Admins and client portal logins have fixed roles; staff roles can be changed here.
  const isStaff = !user.clientId && user.role !== "admin";

  return (
    <tr className={user.active ? "" : "bg-slate-50 text-slate-400"}>
      <td className="px-5 py-3">
        <p className="font-medium">
          {user.name} {isSelf && <span className="text-xs font-normal text-slate-400">(you)</span>}
        </p>
        <p className="text-xs text-slate-400">{user.email}</p>
        {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
        {reset && (
          <div className="mt-2">
            <TempPassword email={reset.email} password={reset.tempPassword} />
          </div>
        )}
      </td>
      <td className="px-5 py-3">{user.companyName ?? <Badge tone="amber">Platform</Badge>}</td>
      <td className="px-5 py-3">
        {isStaff ? (
          <select
            aria-label={`Role for ${user.name}`}
            value={role}
            disabled={pending}
            onChange={(e) => {
              const next = e.target.value as Role;
              setRole(next);
              run(() => adminChangeRole(user.id, next), () => setRole(user.role));
            }}
            className={`${inputClass} w-32 py-1.5`}
          >
            <option value="owner">Owner</option>
            <option value="manager">Manager</option>
            <option value="cleaner">Cleaner</option>
          </select>
        ) : (
          <span className="capitalize">{user.role}</span>
        )}
        {!user.active && (
          <span className="ml-2">
            <Badge tone="red">Deactivated</Badge>
          </span>
        )}
      </td>
      <td className="px-5 py-3">
        {user.role !== "admin" && (
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="secondary" disabled={pending} onClick={() => run(async () => setReset(await adminResetPassword(user.id)))}>
              Reset password
            </Button>
            <Button
              size="sm"
              variant={user.active ? "danger" : "secondary"}
              disabled={pending}
              onClick={() => run(() => adminSetActive(user.id, !user.active))}
            >
              {user.active ? "Deactivate" : "Reactivate"}
            </Button>
          </div>
        )}
      </td>
    </tr>
  );
}

export function AddUserForm({ companies, defaultCompanyId }: { companies: { id: string; name: string }[]; defaultCompanyId: string }) {
  const [state, action, pending] = useActionState<CreatedLogin, FormData>(addUser, {});
  return (
    <form action={action} className="space-y-3">
      <Field label="Company">
        <select name="companyId" required defaultValue={defaultCompanyId} className={inputClass}>
          <option value="" disabled>
            Choose a company…
          </option>
          {companies.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Name">
        <input name="name" required className={inputClass} />
      </Field>
      <Field label="Email">
        <input name="email" type="email" required className={inputClass} />
      </Field>
      <Field label="Role">
        <select name="role" defaultValue="cleaner" className={inputClass}>
          <option value="owner">Owner</option>
          <option value="manager">Manager</option>
          <option value="cleaner">Cleaner</option>
        </select>
      </Field>
      <Button type="submit" disabled={pending}>
        {pending ? "Adding…" : "Add user"}
      </Button>
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state.created && (
        <TempPassword email={state.created.email} password={state.created.tempPassword} note={`Added to ${state.created.companyName}.`} />
      )}
    </form>
  );
}
