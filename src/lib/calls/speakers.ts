export type Utterance = { speaker: string; text: string };

/**
 * Speech-to-text labels speakers "A", "B", … in order of appearance. We turn
 * that into the "Rep:" / "Caller:" transcript the analysis expects: whoever
 * speaks first is the rep (they answer inbound calls) unless told otherwise.
 * Anyone beyond the first two speakers (transfers, a second person on the
 * line) is treated as the caller side.
 */
export function labelUtterances(utterances: Utterance[], firstSpeaker: "rep" | "caller" = "rep"): string {
  const lines = utterances.filter((u) => u.text.trim());
  if (!lines.length) return "";
  const first = lines[0].speaker;
  const other = lines.find((u) => u.speaker !== first)?.speaker;
  const rep = firstSpeaker === "rep" ? first : other;

  // Merge consecutive lines from the same speaker so the transcript reads naturally.
  const merged: Utterance[] = [];
  for (const u of lines) {
    const last = merged.at(-1);
    if (last && last.speaker === u.speaker) last.text = `${last.text} ${u.text.trim()}`;
    else merged.push({ speaker: u.speaker, text: u.text.trim() });
  }
  return merged.map((u) => `${u.speaker === rep ? "Rep" : "Caller"}: ${u.text}`).join("\n");
}

export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024; // stays under Vercel's 4.5 MB request limit
export const AUDIO_EXTENSIONS = [".mp3", ".m4a", ".wav", ".ogg", ".webm", ".aac", ".flac", ".mp4"];

export function isAudioFile(name: string, type: string) {
  return type.startsWith("audio/") || AUDIO_EXTENSIONS.some((ext) => name.toLowerCase().endsWith(ext));
}
