"use client";

import { useState, useTransition } from "react";
import { CheckCircle2 } from "lucide-react";
import { finishVisit } from "@/lib/actions/visits";
import { Button, inputClass } from "@/components/ui";

export function FinishVisit({ visitId }: { visitId: string }) {
  const [notes, setNotes] = useState("");
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const [clicked, setClicked] = useState<"completed" | "skipped" | null>(null);
  const submit = (outcome: "completed" | "skipped") => {
    if (outcome === "skipped" && !notes.trim()) {
      setError("Add a note explaining why the clean couldn't be done.");
      return;
    }
    setClicked(outcome);
    start(async () => {
      try {
        await finishVisit(visitId, outcome, notes);
      } catch {
        setError("Couldn't update this visit. Refresh and try again.");
      }
    });
  };
  return (
    <div className="space-y-2 border-t border-slate-100 pt-3">
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        rows={2}
        placeholder="Notes for the office (optional): supplies low, extra mess, anything to know next time…"
        className={inputClass}
      />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <Button disabled={pending} loading={pending && clicked === "completed"} onClick={() => submit("completed")}>
          <CheckCircle2 className="h-4 w-4" /> Mark complete
        </Button>
        <Button variant="secondary" disabled={pending} loading={pending && clicked === "skipped"} onClick={() => submit("skipped")}>
          Couldn&apos;t complete
        </Button>
      </div>
    </div>
  );
}
