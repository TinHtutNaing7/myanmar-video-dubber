import type { Segment } from "./types";

/**
 * Convert seconds to SRT timestamp format: HH:MM:SS,mmm
 */
export function secsToSRT(s: number): string {
  const h  = Math.floor(s / 3600);
  const m  = Math.floor((s % 3600) / 60);
  const sc = Math.floor(s % 60);
  const ms = Math.round((s % 1) * 1000);
  return `${pad(h)}:${pad(m)}:${pad(sc)},${pad(ms, 3)}`;
}

function pad(n: number, len = 2): string {
  return String(n).padStart(len, "0");
}

/**
 * Generate a full SRT file string from translated segments.
 * Uses `translated_text` when available; falls back to `text`.
 */
export function buildSRT(segments: Segment[]): string {
  const lines: string[] = [];
  let counter = 1;

  for (const seg of segments) {
    const text = (seg.translated_text ?? seg.text ?? "").trim();
    if (!text) continue;

    lines.push(String(counter));
    lines.push(`${secsToSRT(seg.start)} --> ${secsToSRT(seg.end)}`);
    lines.push(text);
    lines.push("");

    counter++;
  }

  return lines.join("\n");
}

/**
 * Trigger a browser download of the SRT content.
 */
export function downloadSRT(content: string, filename = "subtitles_burmese.srt"): void {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Trigger a browser download of a Blob URL.
 */
export function downloadBlob(url: string, filename: string): void {
  const a    = document.createElement("a");
  a.href     = url;
  a.download = filename;
  a.click();
}
