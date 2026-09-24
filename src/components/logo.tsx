import { Sparkles } from "lucide-react";
import clsx from "clsx";

export function Logo({ size = "md" }: { size?: "md" | "lg" }) {
  return (
    <span className={clsx("inline-flex items-center gap-2 font-semibold tracking-tight", size === "lg" ? "text-2xl" : "text-lg")}>
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-white">
        <Sparkles className="h-4 w-4" />
      </span>
      ShineOps
    </span>
  );
}
