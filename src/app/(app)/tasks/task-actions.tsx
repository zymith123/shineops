"use client";

import { useTransition } from "react";
import clsx from "clsx";
import { Check } from "lucide-react";
import { assignTask, setTaskStatus } from "@/lib/actions/tasks";

export function TaskToggle({ taskId, done }: { taskId: string; done: boolean }) {
  const [pending, start] = useTransition();
  return (
    <button
      aria-label={done ? "Reopen task" : "Mark task done"}
      disabled={pending}
      onClick={() => start(() => setTaskStatus(taskId, done ? "open" : "done"))}
      className={clsx(
        "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition",
        done ? "border-brand-600 bg-brand-600 text-white" : "border-slate-300 hover:border-brand-500",
        pending && "opacity-50",
      )}
    >
      {(done || pending) && <Check className="h-3 w-3" />}
    </button>
  );
}

export function TaskAssignee({
  taskId,
  assigneeId,
  staff,
}: {
  taskId: string;
  assigneeId: string | null;
  staff: { id: string; name: string }[];
}) {
  const [pending, start] = useTransition();
  return (
    <select
      aria-label="Assignee"
      defaultValue={assigneeId ?? ""}
      disabled={pending}
      onChange={(e) => start(() => assignTask(taskId, e.target.value))}
      className="rounded border-0 bg-transparent py-0 pl-0 text-xs text-slate-500 hover:text-slate-800 focus:ring-0"
    >
      <option value="">Unassigned</option>
      {staff.map((s) => (
        <option key={s.id} value={s.id}>
          → {s.name}
        </option>
      ))}
    </select>
  );
}
