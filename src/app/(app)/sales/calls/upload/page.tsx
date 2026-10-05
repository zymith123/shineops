import Link from "next/link";
import { and, eq } from "drizzle-orm";
import { ArrowLeft } from "lucide-react";
import { db, schema } from "@/db";
import { requireRole, STAFF } from "@/lib/auth";
import { transcriptionEnabled } from "@/lib/calls/transcribe";
import { aiEnabled } from "@/lib/ai/client";
import { listStaff } from "@/lib/queries";
import { Card, CardHeader } from "@/components/ui";
import { LinkPending } from "@/components/loading";
import { UploadCallForm } from "./upload-form";

export default async function UploadCallPage() {
  const user = await requireRole(STAFF);
  const [clients, staff] = await Promise.all([
    db
      .select({ id: schema.clients.id, name: schema.clients.name })
      .from(schema.clients)
      .where(and(eq(schema.clients.companyId, user.companyId), eq(schema.clients.status, "active")))
      .orderBy(schema.clients.name),
    listStaff(user.companyId),
  ]);

  return (
    <div className="max-w-2xl">
      <Link href="/sales/calls" className="mb-3 inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800">
        <ArrowLeft className="h-3 w-3" /> All calls <LinkPending className="h-3 w-3" />
      </Link>
      <Card>
        <CardHeader title="Upload a call recording" />
        <div className="p-5">
          {transcriptionEnabled() ? (
            <>
              <p className="mb-5 text-sm text-slate-600">
                The recording is turned into a written transcript, then analyzed like any other call: what it was about, how the rep
                handled it, and what should happen next.{" "}
                {!aiEnabled() && "AI analysis isn't configured, so it will be classified with keyword rules (no coaching score)."}
              </p>
              <UploadCallForm
                clients={clients}
                reps={staff.filter((s) => s.active && s.role !== "cleaner").map((s) => ({ id: s.id, name: s.name }))}
                defaultRepId={user.id}
              />
            </>
          ) : (
            <p className="text-sm text-slate-600">
              Call transcription isn&apos;t set up yet. The account owner needs to add an AssemblyAI API key
              (<code className="rounded bg-slate-100 px-1">ASSEMBLYAI_API_KEY</code>) to the app&apos;s settings.
            </p>
          )}
        </div>
      </Card>
    </div>
  );
}
