"use client";

import { useLinkStatus } from "next/link";
import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import clsx from "clsx";

export function Spinner({ className }: { className?: string }) {
  return <Loader2 aria-hidden className={clsx("spinner h-4 w-4 shrink-0 animate-spin", className)} />;
}

/**
 * Spinner that fades in while `show` is true. By default it keeps its space so
 * toggling never shifts the layout; `collapse` takes no space until shown
 * (for tight spots like pills and buttons).
 */
export function InlineSpinner({ show, collapse = false, className }: { show: boolean; collapse?: boolean; className?: string }) {
  return (
    <span
      role="status"
      aria-live="polite"
      className={clsx(
        "inline-flex h-4 shrink-0 items-center justify-center overflow-hidden transition-[width]",
        collapse && !show ? "w-0" : "w-4",
        className,
      )}
    >
      <Spinner className={clsx("h-3.5 w-3.5 text-slate-400 transition-opacity", show ? "opacity-100" : "opacity-0")} />
      {show && <span className="sr-only">Loading</span>}
    </span>
  );
}

/** Place inside a <Link>: spins while that link's navigation is pending. */
export function LinkPending({ className, collapse }: { className?: string; collapse?: boolean }) {
  const { pending } = useLinkStatus();
  return <InlineSpinner show={pending} collapse={collapse} className={className} />;
}

/** Place inside a <form>: spins while the form is submitting or navigating. */
export function FormPending({ className }: { className?: string }) {
  const { pending } = useFormStatus();
  return <InlineSpinner show={pending} className={className} />;
}
