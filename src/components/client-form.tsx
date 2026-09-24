"use client";

import { useActionState } from "react";
import type { FormState } from "@/lib/actions/clients";
import { Button, Field, inputClass } from "@/components/ui";

type ClientValues = {
  name: string;
  email: string;
  phone: string;
  address: string;
  bedrooms: number;
  bathrooms: number;
  pets: string;
  entryNotes: string;
};
type PlanValues = { frequency: string; price: number; preferredCleanerId: string; startDate: string };

export function ClientFields({ values }: { values?: Partial<ClientValues> }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Name">
        <input name="name" required defaultValue={values?.name} className={inputClass} />
      </Field>
      <Field label="Email">
        <input name="email" type="email" required defaultValue={values?.email} className={inputClass} />
      </Field>
      <Field label="Phone">
        <input name="phone" defaultValue={values?.phone} className={inputClass} />
      </Field>
      <Field label="Address">
        <input name="address" required defaultValue={values?.address} className={inputClass} />
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Bedrooms">
          <input name="bedrooms" type="number" min={0} defaultValue={values?.bedrooms ?? 2} className={inputClass} />
        </Field>
        <Field label="Bathrooms">
          <input name="bathrooms" type="number" min={0} defaultValue={values?.bathrooms ?? 1} className={inputClass} />
        </Field>
      </div>
      <Field label="Pets">
        <input name="pets" placeholder="e.g. 2 dogs" defaultValue={values?.pets} className={inputClass} />
      </Field>
      <div className="sm:col-span-2">
        <Field label="Entry instructions" hint="Visible to the assigned cleaner.">
          <textarea name="entryNotes" rows={2} defaultValue={values?.entryNotes} className={inputClass} />
        </Field>
      </div>
    </div>
  );
}

export function PlanFields({ values, cleaners }: { values?: Partial<PlanValues>; cleaners: { id: string; name: string }[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Frequency">
        <select name="frequency" defaultValue={values?.frequency ?? "biweekly"} className={inputClass}>
          <option value="weekly">Weekly</option>
          <option value="biweekly">Every 2 weeks</option>
          <option value="monthly">Monthly</option>
        </select>
      </Field>
      <Field label="Price per visit (USD)">
        <input name="price" type="number" min={1} step="0.01" required defaultValue={values?.price ?? 150} className={inputClass} />
      </Field>
      <Field label="Preferred cleaner" hint="Same cleaner every visit is the #1 driver of retention.">
        <select name="preferredCleanerId" defaultValue={values?.preferredCleanerId ?? ""} className={inputClass}>
          <option value="">Unassigned</option>
          {cleaners.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="First visit">
        <input name="startDate" type="date" required defaultValue={values?.startDate} className={inputClass} />
      </Field>
    </div>
  );
}

/** Wraps a server action (bound or not) with pending + result messaging. */
export function ActionForm({
  action,
  children,
  submitLabel,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  children: React.ReactNode;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  return (
    <form action={formAction} className="space-y-4">
      {children}
      <div className="flex items-center gap-3">
        <Button type="submit" loading={pending}>
          {pending ? "Saving…" : submitLabel}
        </Button>
        {state.error && <p className="text-sm text-red-600">{state.error}</p>}
        {state.ok && <p className="text-sm text-emerald-700">{state.ok}</p>}
      </div>
    </form>
  );
}
