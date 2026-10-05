import "server-only";
import { AssemblyAI } from "assemblyai";
import { labelUtterances } from "./speakers";

/** Speech-to-text for uploaded call recordings (AssemblyAI). */
export function transcriptionEnabled() {
  return Boolean(process.env.ASSEMBLYAI_API_KEY);
}

let client: AssemblyAI | null = null;
function aai() {
  client ??= new AssemblyAI({
    apiKey: process.env.ASSEMBLYAI_API_KEY!,
    // Only set for local testing against a stand-in server.
    ...(process.env.ASSEMBLYAI_BASE_URL ? { baseUrl: process.env.ASSEMBLYAI_BASE_URL } : {}),
  });
  return client;
}

/** Uploads the audio and queues a transcription job. Returns the job id. */
export async function startTranscription(audio: Uint8Array): Promise<string> {
  const job = await aai().transcripts.submit({ audio, speaker_labels: true, speakers_expected: 2 });
  return job.id;
}

export type TranscriptionResult =
  | { status: "processing" }
  | { status: "error"; error: string }
  | { status: "completed"; transcript: string; durationSec: number };

export async function checkTranscription(jobId: string, firstSpeaker: "rep" | "caller"): Promise<TranscriptionResult> {
  const t = await aai().transcripts.get(jobId);
  if (t.status === "queued" || t.status === "processing") return { status: "processing" };
  if (t.status === "error") return { status: "error", error: t.error ?? "Transcription failed" };

  const transcript = t.utterances?.length ? labelUtterances(t.utterances, firstSpeaker) : (t.text ?? "").trim();
  if (!transcript) return { status: "error", error: "No speech was detected in the recording." };
  return { status: "completed", transcript, durationSec: Math.round(t.audio_duration ?? 0) };
}

/** Removes the transcript and audio from AssemblyAI once we've stored the text. */
export async function deleteTranscription(jobId: string) {
  try {
    await aai().transcripts.delete(jobId);
  } catch (err) {
    console.warn("Could not delete transcription job", jobId, err);
  }
}
