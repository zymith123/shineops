"use client";

import { useActionState, useState } from "react";
import clsx from "clsx";
import { rateVisit, submitRequest } from "@/lib/actions/portal";
import type { FormState } from "@/lib/actions/clients";
import { Button, Field, inputClass } from "@/components/ui";

export function RateVisit({ visitId }: { visitId: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(rateVisit.bind(null, visitId), {});
  const [rating, setRating] = useState(0);
  if (state.ok) return <p className="mt-2 text-emerald-700">{state.ok}</p>;
  return (
    <form action={action} className="mt-2 space-y-2">
      <input type="hidden" name="rating" value={rating || ""} />
      <div className="flex gap-1" role="radiogroup" aria-label="Rating">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={rating === n}
            aria-label={`${n} star${n > 1 ? "s" : ""}`}
            onClick={() => setRating(n)}
            className={clsx("text-2xl leading-none transition", n <= rating ? "text-amber-500" : "text-slate-300 hover:text-amber-300")}
          >
            ★
          </button>
        ))}
      </div>
      {rating > 0 && (
        <>
          <textarea
            name="comment"
            rows={2}
            placeholder={rating >= 4 ? "Anything you loved? (optional)" : "What could we have done better?"}
            className={inputClass}
          />
          <Button type="submit" size="sm" disabled={pending}>
            {pending ? "Sending…" : "Submit rating"}
          </Button>
        </>
      )}
      {state.error && <p className="text-red-600">{state.error}</p>}
    </form>
  );
}

export function RequestForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(submitRequest, {});
  return (
    <form action={action} className="space-y-3">
      <Field label="Request type">
        <select name="type" defaultValue="reschedule" className={inputClass}>
          <option value="reschedule">Reschedule a clean</option>
          <option value="deep_clean">Add a deep clean</option>
          <option value="pause">Pause service</option>
          <option value="other">Something else</option>
        </select>
      </Field>
      <Field label="Details">
        <textarea name="message" rows={3} required className={inputClass} />
      </Field>
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Sending…" : "Send request"}
        </Button>
        {state.error && <p className="text-sm text-red-600">{state.error}</p>}
        {state.ok && <p className="text-sm text-emerald-700">{state.ok}</p>}
      </div>
    </form>
  );
}
