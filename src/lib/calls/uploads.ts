import "server-only";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { analyzeCall } from "./service";
import { normalizePhone } from "./phone";
import { checkTranscription, deleteTranscription, startTranscription } from "./transcribe";

/** Inbound: the rep picks up and speaks first. Outbound: the customer answers first. */
export function firstSpeakerFor(direction: "inbound" | "outbound") {
  return direction === "inbound" ? "rep" : "caller";
}

export async function createUploadedCall(input: {
  companyId: string;
  audio: Uint8Array;
  fileName: string;
  direction: "inbound" | "outbound";
  callerPhone: string;
  clientId: string | null;
  repId: string | null;
  startedAt: Date;
}) {
  let phone = normalizePhone(input.callerPhone);
  if (input.clientId) {
    const [client] = await db
      .select({ phone: schema.clients.phone })
      .from(schema.clients)
      .where(and(eq(schema.clients.id, input.clientId), eq(schema.clients.companyId, input.companyId)));
    if (!client) throw new Error("Client not found");
    phone = normalizePhone(client.phone);
  }
  if (input.repId) {
    const [rep] = await db
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(and(eq(schema.users.id, input.repId), eq(schema.users.companyId, input.companyId)));
    if (!rep) throw new Error("Rep not found");
  }

  const jobId = await startTranscription(input.audio);
  const [call] = await db
    .insert(schema.calls)
    .values({
      companyId: input.companyId,
      externalId: `upload:${jobId}`,
      direction: input.direction,
      callerPhone: phone,
      repId: input.repId,
      startedAt: input.startedAt,
      durationSec: 0,
      transcript: "",
      audioFileName: input.fileName,
      transcriptionStatus: "processing",
      transcriptionJobId: jobId,
    })
    .returning({ id: schema.calls.id });
  return call.id;
}

/**
 * Checks on a recording that's being transcribed. When the transcript is
 * ready it's saved, the call is analyzed like any other, and the audio is
 * deleted from the transcription service.
 */
export async function advanceUploadedCall(companyId: string, callId: string) {
  const [call] = await db
    .select()
    .from(schema.calls)
    .where(and(eq(schema.calls.id, callId), eq(schema.calls.companyId, companyId)));
  if (!call) throw new Error("Call not found");
  if (call.transcriptionStatus !== "processing" || !call.transcriptionJobId) {
    return { status: (call.transcriptionStatus ?? "completed") as "completed" | "error", error: call.transcriptionError };
  }

  const result = await checkTranscription(call.transcriptionJobId, firstSpeakerFor(call.direction));
  if (result.status === "processing") return { status: "processing" as const, error: null };

  if (result.status === "error") {
    await db
      .update(schema.calls)
      .set({ transcriptionStatus: "error", transcriptionError: result.error })
      .where(eq(schema.calls.id, call.id));
    return { status: "error" as const, error: result.error };
  }

  // Claim the job so two concurrent checks don't both analyze it.
  const claimed = await db
    .update(schema.calls)
    .set({ transcript: result.transcript, durationSec: result.durationSec, transcriptionStatus: "completed" })
    .where(and(eq(schema.calls.id, call.id), eq(schema.calls.transcriptionStatus, "processing")))
    .returning({ id: schema.calls.id });
  if (claimed.length) {
    await analyzeCall(companyId, call.id);
    await deleteTranscription(call.transcriptionJobId);
  }
  return { status: "completed" as const, error: null };
}

/** Fixes a transcript where the speech-to-text guessed the speakers the wrong way round. */
export async function swapSpeakers(companyId: string, callId: string) {
  const [call] = await db
    .select({ id: schema.calls.id, transcript: schema.calls.transcript })
    .from(schema.calls)
    .where(and(eq(schema.calls.id, callId), eq(schema.calls.companyId, companyId)));
  if (!call) throw new Error("Call not found");
  const swapped = call.transcript
    .split("\n")
    .map((l) => (l.startsWith("Rep: ") ? `Caller: ${l.slice(5)}` : l.startsWith("Caller: ") ? `Rep: ${l.slice(8)}` : l))
    .join("\n");
  await db.update(schema.calls).set({ transcript: swapped }).where(eq(schema.calls.id, call.id));
  await analyzeCall(companyId, call.id);
}
