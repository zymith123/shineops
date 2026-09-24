"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useTransition } from "react";
import clsx from "clsx";
import { Sparkles } from "lucide-react";
import { analyzeAllCalls, assignLead, reanalyzeCall, setLeadStage } from "@/lib/actions/sales";
import { STAGES } from "@/lib/calls/labels";
import { Button, inputClass } from "@/components/ui";
import { InlineSpinner, LinkPending } from "@/components/loading";

const TABS = [
  { href: "/sales", label: "Overview" },
  { href: "/sales/calls", label: "Calls" },
  { href: "/sales/pipeline", label: "Pipeline" },
  { href: "/sales/coaching", label: "Coaching" },
];

export function SalesTabs() {
  const pathname = usePathname();
  return (
    <div className="flex gap-1 overflow-x-auto border-b border-slate-200">
      {TABS.map((t) => {
        const active = t.href === "/sales" ? pathname === "/sales" : pathname.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            className={clsx(
              "-mb-px inline-flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium",
              active ? "border-brand-600 text-brand-700" : "border-transparent text-slate-500 hover:text-slate-800",
            )}
          >
            {t.label}
            <LinkPending collapse />
          </Link>
        );
      })}
    </div>
  );
}

export function AnalyzeCallsButton({ ai }: { ai: boolean }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState("");
  return (
    <div className="flex items-center gap-3">
      {msg && <span className="text-xs text-slate-500">{msg}</span>}
      <Button
        loading={pending}
        onClick={() =>
          start(async () => {
            setMsg("");
            try {
              const r = await analyzeAllCalls();
              setMsg(r.count ? `Analyzed ${r.count} call${r.count === 1 ? "" : "s"}${r.ai ? " with Claude" : " with keyword rules"}` : "All calls already analyzed by AI");
            } catch {
              setMsg("Analysis failed. Check the server logs and your API key.");
            }
          })
        }
      >
        <Sparkles className="h-4 w-4" />
        {pending ? "Analyzing calls…" : ai ? "Analyze calls with AI" : "Re-run call rules"}
      </Button>
    </div>
  );
}

export function ReanalyzeCallButton({ callId }: { callId: string }) {
  const [pending, start] = useTransition();
  return (
    <Button size="sm" variant="secondary" loading={pending} onClick={() => start(() => reanalyzeCall(callId))}>
      <Sparkles className="h-3.5 w-3.5" />
      {pending ? "Analyzing…" : "Re-analyze"}
    </Button>
  );
}

export function LeadControls({
  leadId,
  stage,
  ownerId,
  staff,
}: {
  leadId: string;
  stage: string;
  ownerId: string | null;
  staff: { id: string; name: string }[];
}) {
  const [pending, start] = useTransition();
  return (
    <div className="mt-2 space-y-1.5">
      <select
        aria-label="Stage"
        defaultValue={stage}
        disabled={pending}
        onChange={(e) => start(() => setLeadStage(leadId, e.target.value))}
        className={clsx(inputClass, "px-2 py-1 text-xs")}
      >
        {STAGES.map((s) => (
          <option key={s.key} value={s.key}>
            {s.label}
          </option>
        ))}
      </select>
      <div className="flex items-center gap-1.5">
        <select
          aria-label="Owner"
          defaultValue={ownerId ?? ""}
          disabled={pending}
          onChange={(e) => start(() => assignLead(leadId, e.target.value))}
          className={clsx(inputClass, "min-w-0 flex-1 px-2 py-1 text-xs", !ownerId && "border-amber-300 bg-amber-50")}
        >
          <option value="">Unassigned</option>
          {staff.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <InlineSpinner show={pending} />
      </div>
    </div>
  );
}
