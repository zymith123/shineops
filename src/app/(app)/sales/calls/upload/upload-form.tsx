"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, FileAudio, Upload } from "lucide-react";
import clsx from "clsx";
import { checkUploadedCall } from "@/lib/actions/sales";
import { AUDIO_EXTENSIONS, isAudioFile, MAX_UPLOAD_BYTES } from "@/lib/calls/speakers";
import { Button, Field, inputClass } from "@/components/ui";
import { Spinner } from "@/components/loading";

type Stage = "idle" | "uploading" | "transcribing" | "done";
const POLL_MS = 3000;
const GIVE_UP_MS = 5 * 60 * 1000;

export function UploadCallForm({
  clients,
  reps,
  defaultRepId,
}: {
  clients: { id: string; name: string }[];
  reps: { id: string; name: string }[];
  defaultRepId: string;
}) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [clientId, setClientId] = useState("");
  const [stage, setStage] = useState<Stage>("idle");
  const [error, setError] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);

  function pickFile(f: File | null) {
    setError("");
    if (!f) return setFile(null);
    if (!isAudioFile(f.name, f.type)) return setError("That file doesn't look like an audio recording.");
    if (f.size > MAX_UPLOAD_BYTES) return setError(`That recording is ${(f.size / 1024 / 1024).toFixed(1)} MB. Recordings must be under 4 MB.`);
    setFile(f);
  }

  function poll(callId: string, startedAt: number) {
    timer.current = setTimeout(async () => {
      const result = await checkUploadedCall(callId);
      if (result.status === "completed") {
        setStage("done");
        router.push(`/sales/calls/${callId}`);
      } else if (result.status === "error") {
        setStage("idle");
        setError(`Transcription failed: ${result.error ?? "unknown error"}`);
      } else if (Date.now() - startedAt > GIVE_UP_MS) {
        setStage("idle");
        setError("This is taking longer than usual. The call will finish in the background. Check the Calls list in a few minutes.");
      } else {
        poll(callId, startedAt);
      }
    }, POLL_MS);
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!file) return setError("Choose a recording to upload.");
    setError("");
    setStage("uploading");
    const form = new FormData(e.currentTarget);
    form.set("audio", file);
    // datetime-local has no timezone; send an exact instant from the user's own clock.
    const local = String(form.get("startedAt") ?? "");
    form.set("startedAt", local ? new Date(local).toISOString() : "");
    try {
      const res = await fetch("/api/calls/upload", { method: "POST", body: form });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setStage("idle");
        return setError(body.error ?? (res.status === 413 ? "Recordings must be under 4 MB." : "Upload failed. Please try again."));
      }
      setStage("transcribing");
      poll(body.callId, Date.now());
    } catch {
      setStage("idle");
      setError("Upload failed. Check your connection and try again.");
    }
  }

  const busy = stage !== "idle";
  return (
    <form onSubmit={submit} className="space-y-4">
      <label
        className={clsx(
          "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-8 text-center text-sm transition",
          file ? "border-brand-500 bg-brand-50" : "border-slate-300 hover:border-brand-500 hover:bg-slate-50",
          busy && "pointer-events-none opacity-60",
        )}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          pickFile(e.dataTransfer.files[0] ?? null);
        }}
      >
        {file ? <FileAudio className="h-6 w-6 text-brand-600" /> : <Upload className="h-6 w-6 text-slate-400" />}
        {file ? (
          <span>
            <b>{file.name}</b> · {(file.size / 1024 / 1024).toFixed(1)} MB · <span className="text-brand-700 underline">change</span>
          </span>
        ) : (
          <span>
            <b className="text-brand-700">Choose a recording</b> or drag it here
            <span className="block text-xs text-slate-400">MP3, M4A, WAV and other audio formats · under 4 MB (about 4–8 minutes)</span>
          </span>
        )}
        <input
          type="file"
          accept={`audio/*,${AUDIO_EXTENSIONS.join(",")}`}
          className="sr-only"
          disabled={busy}
          onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
        />
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Call direction" hint="Inbound: the rep answers. Outbound: the rep called the customer.">
          <select name="direction" defaultValue="inbound" disabled={busy} className={inputClass}>
            <option value="inbound">Inbound (customer called us)</option>
            <option value="outbound">Outbound (we called them)</option>
          </select>
        </Field>
        <Field label="Rep on the call">
          <select name="repId" defaultValue={defaultRepId} disabled={busy} className={inputClass}>
            <option value="">Unknown</option>
            {reps.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Existing client (optional)">
          <select name="clientId" value={clientId} onChange={(e) => setClientId(e.target.value)} disabled={busy} className={inputClass}>
            <option value="">Not a client / new caller</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Caller's phone number" hint="Links a new caller to their lead in the pipeline.">
          <input
            name="callerPhone"
            type="tel"
            placeholder={clientId ? "Using the client's number" : "(512) 555-0123"}
            disabled={busy || Boolean(clientId)}
            className={inputClass}
          />
        </Field>
        <Field label="When was the call?">
          <input name="startedAt" type="datetime-local" disabled={busy} className={inputClass} />
        </Field>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {busy ? (
        <ol className="space-y-2 rounded-lg bg-slate-50 p-4 text-sm" aria-live="polite">
          <Step done={stage !== "uploading"} active={stage === "uploading"} label="Uploading the recording" />
          <Step done={stage === "done"} active={stage === "transcribing"} label="Transcribing and analyzing (usually 15–60 seconds)" />
          <Step done={false} active={stage === "done"} label="Opening the call" />
        </ol>
      ) : (
        <Button type="submit" disabled={!file}>
          <Upload className="h-4 w-4" /> Upload and analyze
        </Button>
      )}
    </form>
  );
}

function Step({ done, active, label }: { done: boolean; active: boolean; label: string }) {
  return (
    <li className={clsx("flex items-center gap-2", !done && !active && "text-slate-400")}>
      {done ? <CheckCircle2 className="h-4 w-4 text-brand-600" /> : active ? <Spinner className="text-brand-600" /> : <span className="h-4 w-4 rounded-full border border-slate-300" />}
      {label}
    </li>
  );
}
