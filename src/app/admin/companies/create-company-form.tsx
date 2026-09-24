"use client";

import { useActionState } from "react";
import { createCompany, type CreatedLogin } from "@/lib/actions/admin";
import { Button, Field, inputClass } from "@/components/ui";
import { TempPassword } from "@/components/temp-password";

export function CreateCompanyForm() {
  const [state, action, pending] = useActionState<CreatedLogin, FormData>(createCompany, {});
  return (
    <form action={action} className="space-y-3">
      <Field label="Company name">
        <input name="companyName" required placeholder="e.g. FreshNest Home Cleaning" className={inputClass} />
      </Field>
      <Field label="Owner name">
        <input name="ownerName" required className={inputClass} />
      </Field>
      <Field label="Owner email" hint="They log in with this and see only their own company.">
        <input name="ownerEmail" type="email" required className={inputClass} />
      </Field>
      <Button type="submit" disabled={pending}>
        {pending ? "Creating…" : "Create company"}
      </Button>
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state.created && (
        <TempPassword email={state.created.email} password={state.created.tempPassword} note={`${state.created.companyName} is ready.`} />
      )}
    </form>
  );
}
