import clsx from "clsx";
import type { CallType } from "@/db/schema";
import { CALL_TYPES, scoreTone } from "@/lib/calls/labels";
import { Badge } from "./ui";

export function CallTypeBadge({ type, confidence }: { type: CallType | null; confidence?: number | null }) {
  if (!type) return <Badge>Not analyzed</Badge>;
  const t = CALL_TYPES[type];
  return (
    <span className="inline-flex items-center gap-1.5">
      <Badge tone={t.tone}>{t.label}</Badge>
      {confidence != null && <span className="text-[11px] tabular-nums text-slate-400">{confidence}%</span>}
    </span>
  );
}

export function ScoreBadge({ score }: { score: number | null }) {
  if (score == null) return <span className="text-slate-300">—</span>;
  return <Badge tone={scoreTone(score)}>{score}</Badge>;
}

/** Horizontal bar list: one hue, labels and values always visible. */
export function BarList({ rows, max }: { rows: { label: string; value: number; hint?: string }[]; max?: number }) {
  const top = max ?? Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="space-y-2.5">
      {rows.map((r) => (
        <li key={r.label} className="group">
          <div className="mb-1 flex justify-between gap-3 text-sm">
            <span className="text-slate-700">{r.label}</span>
            <span className="tabular-nums text-slate-500">
              {r.value}
              {r.hint && <span className="ml-1 text-xs text-slate-400">{r.hint}</span>}
            </span>
          </div>
          <div className="h-2 rounded-full bg-slate-100">
            <div
              className={clsx("h-2 rounded-full bg-brand-500 transition-all group-hover:bg-brand-700", r.value === 0 && "hidden")}
              style={{ width: `${Math.max(2, (r.value / top) * 100)}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
