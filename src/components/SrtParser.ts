export interface SrtSegment {
  index:   number;
  startMs: number;
  endMs:   number;
  text:    string;
}

/**
 * Parse SRT timestamp "HH:MM:SS,mmm" to milliseconds.
 */
function tsToMs(ts: string): number {
  const [hms, ms] = ts.trim().split(",");
  const [h, m, s] = hms.split(":").map(Number);
  return h * 3_600_000 + m * 60_000 + s * 1_000 + Number(ms ?? 0);
}

/**
 * Parse a full SRT string into an array of SrtSegments.
 * Tolerates Windows line endings and extra whitespace.
 */
export function parseSrt(srt: string): SrtSegment[] {
  const blocks = srt
    .replace(/\r\n/g, "\n")
    .trim()
    .split(/\n\s*\n/);

  const segments: SrtSegment[] = [];

  for (const block of blocks) {
    const lines = block.trim().split("\n");
    if (lines.length < 2) continue;

    const indexLine = lines[0].trim();
    const timeLine  = lines[1].trim();
    const textLines = lines.slice(2);

    const index = parseInt(indexLine, 10);
    if (isNaN(index)) continue;

    const arrowIdx = timeLine.indexOf("-->");
    if (arrowIdx === -1) continue;

    const startMs = tsToMs(timeLine.slice(0, arrowIdx));
    const endMs   = tsToMs(timeLine.slice(arrowIdx + 3));

    // Strip HTML-like tags (e.g. <i>, <b>) from subtitle text
    const text = textLines
      .join(" ")
      .replace(/<[^>]+>/g, "")
      .trim();

    if (text && endMs > startMs) {
      segments.push({ index, startMs, endMs, text });
    }
  }

  return segments;
}

/** Format milliseconds as SRT timestamp */
export function msToTs(ms: number): string {
  const h   = Math.floor(ms / 3_600_000);
  const m   = Math.floor((ms % 3_600_000) / 60_000);
  const s   = Math.floor((ms % 60_000) / 1_000);
  const rem = ms % 1_000;
  return `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")},${String(rem).padStart(3,"0")}`;
}
