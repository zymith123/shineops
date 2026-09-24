/**
 * Single-series weekly average rating. Y axis fixed to 1–5 stars so small
 * dips aren't exaggerated. Hover shows the exact value and sample size.
 */
export function RatingTrend({ weeks }: { weeks: { label: string; avg: number | null; count: number }[] }) {
  const min = 1;
  const max = 5;
  return (
    <div>
      <div className="relative flex h-40 items-end gap-2 border-b border-slate-200 pl-7">
        {[5, 4, 3, 2].map((v) => (
          <div
            key={v}
            className="pointer-events-none absolute left-7 right-0 border-t border-dashed border-slate-100"
            style={{ bottom: `${((v - min) / (max - min)) * 100}%` }}
          >
            <span className="absolute -left-7 -top-2 w-5 text-right text-[10px] text-slate-400">{v}★</span>
          </div>
        ))}
        {weeks.map((w) => (
          <div key={w.label} className="group relative flex h-full flex-1 items-end justify-center">
            {w.avg !== null ? (
              <div
                className="w-full max-w-9 rounded-t bg-brand-500 transition group-hover:bg-brand-700"
                style={{ height: `${((w.avg - min) / (max - min)) * 100}%` }}
              />
            ) : (
              <div className="h-px w-full max-w-9 bg-slate-200" />
            )}
            <div className="pointer-events-none absolute bottom-full z-10 mb-1 hidden whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 text-xs text-white shadow group-hover:block">
              {w.label}: {w.avg !== null ? `${w.avg.toFixed(2)}★` : "no ratings"} · {w.count} rating{w.count === 1 ? "" : "s"}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex gap-2 pl-7">
        {weeks.map((w) => (
          <span key={w.label} className="flex-1 text-center text-[10px] text-slate-400">
            {w.label}
          </span>
        ))}
      </div>
    </div>
  );
}
