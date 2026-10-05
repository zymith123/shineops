import { describe, expect, it } from "vitest";
import { isAudioFile, labelUtterances } from "@/lib/calls/speakers";

const utts = [
  { speaker: "A", text: "Sparkle and Co, this is Kim." },
  { speaker: "B", text: "Hi, how much is a biweekly clean?" },
  { speaker: "B", text: "It's a three bedroom." },
  { speaker: "A", text: "That's $165 a visit." },
];

describe("labelUtterances", () => {
  it("treats the first speaker as the rep on inbound calls and merges consecutive lines", () => {
    expect(labelUtterances(utts, "rep")).toBe(
      "Rep: Sparkle and Co, this is Kim.\nCaller: Hi, how much is a biweekly clean? It's a three bedroom.\nRep: That's $165 a visit.",
    );
  });

  it("treats the first speaker as the customer on outbound calls", () => {
    expect(labelUtterances(utts, "caller").split("\n")[0]).toBe("Caller: Sparkle and Co, this is Kim.");
  });

  it("puts extra speakers on the caller side and skips empty lines", () => {
    const t = labelUtterances(
      [
        { speaker: "A", text: "Hello?" },
        { speaker: "B", text: " " },
        { speaker: "C", text: "Hi, it's her husband." },
      ],
      "rep",
    );
    expect(t).toBe("Rep: Hello?\nCaller: Hi, it's her husband.");
  });

  it("returns an empty transcript when nothing was said", () => {
    expect(labelUtterances([], "rep")).toBe("");
  });
});

describe("isAudioFile", () => {
  it("accepts audio by type or extension", () => {
    expect(isAudioFile("call.mp3", "")).toBe(true);
    expect(isAudioFile("call.M4A", "application/octet-stream")).toBe(true);
    expect(isAudioFile("x", "audio/wav")).toBe(true);
    expect(isAudioFile("notes.pdf", "application/pdf")).toBe(false);
  });
});
