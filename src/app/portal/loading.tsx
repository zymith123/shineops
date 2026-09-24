import { Bone } from "@/components/skeleton";

export default function Loading() {
  return (
    <div role="status" aria-label="Loading" className="mx-auto max-w-3xl space-y-6 p-4 py-12">
      <Bone className="h-7 w-72" />
      <Bone className="h-4 w-56" />
      {[3, 4, 2].map((rows, i) => (
        <div key={i} className="space-y-3 rounded-xl border border-slate-200 bg-white p-5">
          <Bone className="h-4 w-40" />
          {Array.from({ length: rows }, (_, j) => (
            <Bone key={j} className="h-5 w-full" />
          ))}
        </div>
      ))}
    </div>
  );
}
