"use client";

import { useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeftRight } from "lucide-react";
import { checkUploadedCall, swapCallSpeakers } from "@/lib/actions/sales";
import { Button } from "@/components/ui";
import { Spinner } from "@/components/loading";

/** Keeps checking a recording that's being transcribed and refreshes the page when it's done. */
export function TranscriptionPoller({ callId }: { callId: string }) {
  const router = useRouter();
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      const result = await checkUploadedCall(callId);
      if (cancelled) return;
      if (result.status === "processing") timer = setTimeout(tick, 3000);
      else router.refresh();
    };
    timer = setTimeout(tick, 3000);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [callId, router]);
  return <Spinner className="text-sky-700" />;
}

/** For recordings where the speakers were labelled the wrong way round. */
export function SwapSpeakersButton({ callId }: { callId: string }) {
  const [pending, start] = useTransition();
  return (
    <Button
      size="sm"
      variant="secondary"
      loading={pending}
      title="Use this if the rep and caller are labelled the wrong way round"
      onClick={() => start(() => swapCallSpeakers(callId))}
    >
      <ArrowLeftRight className="h-3.5 w-3.5" /> {pending ? "Swapping…" : "Swap speakers"}
    </Button>
  );
}
