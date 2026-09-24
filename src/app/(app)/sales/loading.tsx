import { PageSkeleton } from "@/components/skeleton";

// Keeps the Sales header and tabs on screen while a tab's data loads.
export default function Loading() {
  return <PageSkeleton stats={0} rows={8} side={false} />;
}
