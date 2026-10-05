import { z } from "zod";
import { getCurrentUser, STAFF } from "@/lib/auth";
import { transcriptionEnabled } from "@/lib/calls/transcribe";
import { createUploadedCall } from "@/lib/calls/uploads";
import { isAudioFile, MAX_UPLOAD_BYTES } from "@/lib/calls/speakers";

// Uploading to the transcription service can take a few seconds for larger files.
export const maxDuration = 60;

const Fields = z.object({
  direction: z.enum(["inbound", "outbound"]).default("inbound"),
  callerPhone: z.string().trim().default(""),
  clientId: z.string().uuid().or(z.literal("")).transform((v) => v || null),
  repId: z.string().uuid().or(z.literal("")).transform((v) => v || null),
  startedAt: z.string().trim().default(""),
});

/** Staff upload a call recording; it's transcribed in the background, then analyzed. */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user || user.role === "admin" || !user.companyId || !STAFF.includes(user.role)) {
    return Response.json({ error: "Not allowed" }, { status: 403 });
  }
  if (!transcriptionEnabled()) {
    return Response.json({ error: "Call transcription isn't configured (missing ASSEMBLYAI_API_KEY)." }, { status: 503 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return Response.json({ error: "The upload was too large or incomplete. Recordings must be under 4 MB." }, { status: 413 });
  }
  const file = form.get("audio");
  if (!(file instanceof File) || file.size === 0) return Response.json({ error: "Choose a recording to upload." }, { status: 400 });
  if (!isAudioFile(file.name, file.type)) return Response.json({ error: "That file doesn't look like an audio recording." }, { status: 400 });
  if (file.size > MAX_UPLOAD_BYTES) return Response.json({ error: "Recordings must be under 4 MB." }, { status: 413 });

  const fields = Fields.safeParse(Object.fromEntries([...form.entries()].filter(([k]) => k !== "audio")));
  if (!fields.success) return Response.json({ error: fields.error.issues[0].message }, { status: 400 });
  const { direction, callerPhone, clientId, repId, startedAt } = fields.data;
  const when = startedAt ? new Date(startedAt) : new Date();
  if (Number.isNaN(when.getTime())) return Response.json({ error: "Invalid call date." }, { status: 400 });

  try {
    const callId = await createUploadedCall({
      companyId: user.companyId,
      audio: new Uint8Array(await file.arrayBuffer()),
      fileName: file.name,
      direction,
      callerPhone,
      clientId,
      repId,
      startedAt: when,
    });
    return Response.json({ callId }, { status: 201 });
  } catch (err) {
    console.error("Call upload failed", err);
    return Response.json({ error: "Couldn't send the recording for transcription. Please try again." }, { status: 502 });
  }
}
