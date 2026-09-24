"use client";

import { useState, useTransition } from "react";
import clsx from "clsx";
import { CalendarPlus } from "lucide-react";
import { assignVisit, generateSchedule } from "@/lib/actions/visits";
import { Button, inputClass } from "@/components/ui";
import { InlineSpinner } from "@/components/loading";

export function GenerateButton() {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState("");
  return (
    <div className="flex items-center gap-3">
      {msg && <span className="text-xs text-slate-500">{msg}</span>}
      <Button
        loading={pending}
        onClick={() =>
          start(async () => {
            const { created } = await generateSchedule(4);
            setMsg(created ? `Added ${created} visits` : "Schedule already up to date");
          })
        }
      >
        <CalendarPlus className="h-4 w-4" />
        {pending ? "Generating…" : "Generate next 4 weeks"}
      </Button>
    </div>
  );
}

export function AssignSelect({
  visitId,
  cleanerId,
  cleaners,
  disabled,
}: {
  visitId: string;
  cleanerId: string | null;
  cleaners: { id: string; name: string }[];
  disabled?: boolean;
}) {
  const [pending, start] = useTransition();
  return (
    <span className="inline-flex items-center gap-1.5">
      <select
        aria-label="Assigned cleaner"
        defaultValue={cleanerId ?? ""}
        disabled={disabled || pending}
        onChange={(e) => start(() => assignVisit(visitId, e.target.value))}
        className={clsx(inputClass, "w-44 py-1.5", !cleanerId && "border-amber-300 bg-amber-50")}
      >
        <option value="">Unassigned</option>
        {cleaners.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
      <InlineSpinner show={pending} />
    </span>
  );
}
