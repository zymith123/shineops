"use client";

import { useState, useTransition } from "react";
import { Sparkles } from "lucide-react";
import { reanalyzeAll } from "@/lib/actions/health";
import { Button } from "@/components/ui";

export function ReanalyzeAllButton() {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<string | null>(null);
  return (
    <div className="flex items-center gap-3">
      {result && <span className="text-xs text-slate-500">{result}</span>}
      <Button
        loading={pending}
        onClick={() =>
          start(async () => {
            const r = await reanalyzeAll();
            setResult(`Re-scored ${r.count} clients${r.ai ? " with Claude" : " (rules — add ANTHROPIC_API_KEY for AI)"}`);
          })
        }
      >
        <Sparkles className="h-4 w-4" />
        {pending ? "Analyzing clients…" : "Run health check"}
      </Button>
    </div>
  );
}
