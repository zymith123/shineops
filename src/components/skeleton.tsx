import clsx from "clsx";

export function Bone({ className }: { className?: string }) {
  return <div className={clsx("animate-pulse rounded-md bg-slate-200/80", className)} />;
}

/** Generic page placeholder shown by loading.tsx while a page's data loads. */
export function PageSkeleton({ stats = 4, rows = 6, side = true }: { stats?: number; rows?: number; side?: boolean }) {
  return (
    <div role="status" aria-label="Loading page" className="space-y-6">
      <div className="space-y-2">
        <Bone className="h-7 w-64" />
        <Bone className="h-4 w-80 max-w-full" />
      </div>
      {stats > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: stats }, (_, i) => (
            <div key={i} className="space-y-3 rounded-xl border border-slate-200 bg-white p-5">
              <Bone className="h-3 w-28" />
              <Bone className="h-7 w-24" />
              <Bone className="h-3 w-36" />
            </div>
          ))}
        </div>
      )}
      <div className={clsx("grid gap-6", side && "xl:grid-cols-3")}>
        <div className={clsx("rounded-xl border border-slate-200 bg-white", side && "xl:col-span-2")}>
          <div className="border-b border-slate-100 px-5 py-3">
            <Bone className="h-4 w-40" />
          </div>
          <div className="divide-y divide-slate-100">
            {Array.from({ length: rows }, (_, i) => (
              <div key={i} className="flex items-center gap-4 px-5 py-4">
                <div className="flex-1 space-y-2">
                  <Bone className="h-4 w-1/3" />
                  <Bone className="h-3 w-2/3" />
                </div>
                <Bone className="h-5 w-16 rounded-full" />
              </div>
            ))}
          </div>
        </div>
        {side && (
          <div className="h-fit space-y-4 rounded-xl border border-slate-200 bg-white p-5">
            <Bone className="h-4 w-32" />
            {Array.from({ length: 4 }, (_, i) => (
              <Bone key={i} className="h-9 w-full" />
            ))}
          </div>
        )}
      </div>
      <span className="sr-only">Loading…</span>
    </div>
  );
}
