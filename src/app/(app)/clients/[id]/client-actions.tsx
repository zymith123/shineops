"use client";

import { useState, useTransition } from "react";
import { Sparkles } from "lucide-react";
import { grantPortalAccess, setClientStatus } from "@/lib/actions/clients";
import { reanalyzeClient } from "@/lib/actions/health";
import { Badge, Button } from "@/components/ui";

export function ReanalyzeButton({ clientId }: { clientId: string }) {
  const [pending, start] = useTransition();
  return (
    <Button size="sm" variant="secondary" disabled={pending} onClick={() => start(() => reanalyzeClient(clientId))}>
      <Sparkles className="h-3.5 w-3.5" />
      {pending ? "Analyzing…" : "Re-analyze"}
    </Button>
  );
}

export function ClientStatusMenu({ clientId, status }: { clientId: string; status: "active" | "paused" | "cancelled" }) {
  const [pending, start] = useTransition();
  const set = (s: typeof status, confirmText?: string) => {
    if (confirmText && !confirm(confirmText)) return;
    start(() => setClientStatus(clientId, s));
  };
  return (
    <div className="flex items-center gap-2">
      <Badge tone={status === "active" ? "green" : "slate"}>{status}</Badge>
      {status === "active" ? (
        <>
          <Button size="sm" variant="secondary" disabled={pending} onClick={() => set("paused", "Pause this client? Upcoming visits will be cancelled.")}>
            Pause
          </Button>
          <Button size="sm" variant="danger" disabled={pending} onClick={() => set("cancelled", "Mark this client as cancelled? Upcoming visits will be cancelled.")}>
            Cancel service
          </Button>
        </>
      ) : (
        <Button size="sm" disabled={pending} onClick={() => set("active")}>
          Reactivate
        </Button>
      )}
    </div>
  );
}

export function PortalAccess({ clientId, hasLogin, email }: { clientId: string; hasLogin: boolean; email: string }) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<{ email: string; tempPassword: string } | { error: string } | null>(null);
  return (
    <div className="space-y-3 text-sm">
      <p className="text-slate-600">
        {hasLogin
          ? `${email} can log in to see upcoming cleans, rate visits, and send requests.`
          : "Give this client a login to rate visits and request changes themselves."}
      </p>
      <Button size="sm" variant="secondary" disabled={pending} onClick={() => start(async () => setResult(await grantPortalAccess(clientId)))}>
        {hasLogin ? "Reset password" : "Invite to portal"}
      </Button>
      {result && "error" in result && <p className="text-red-600">{result.error}</p>}
      {result && "tempPassword" in result && (
        <p className="rounded-lg bg-slate-50 p-3 text-xs">
          Share with the client: <b>{result.email}</b> / temporary password <code className="font-mono font-semibold">{result.tempPassword}</code>
        </p>
      )}
    </div>
  );
}
