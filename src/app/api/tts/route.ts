import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

function buildWavHeader(pcmLen: number, sampleRate = 24000, channels = 1, bitDepth = 16): Buffer {
  const header = Buffer.alloc(44);
  const byteRate   = sampleRate * channels * (bitDepth / 8);
  const blockAlign = channels * (bitDepth / 8);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + pcmLen, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitDepth, 34);
  header.write("data", 36);
  header.writeUInt32LE(pcmLen, 40);
  return header;
}

const STYLE_PROMPTS: Record<string, string> = {
  normal:        "Say naturally and clearly",
  excited:       "Say enthusiastically and with high energy",
  whispers:      "Say in a quiet, intimate, gentle whisper",
  "news-anchor": "Say in a formal, authoritative news anchor style",
  calm:          "Say softly, calmly, and peacefully",
  cheerful:      "Say in a highly cheerful, warm, and positive voice",
  sad:           "Say with a somber, melancholic, and emotional tone",
};

const SAMPLE_RATE = 24000;
const BIT_DEPTH   = 16;
const CHANNELS    = 1;
const BYTES_PER_SAMPLE = BIT_DEPTH / 8;
const BYTES_PER_SEC    = SAMPLE_RATE * CHANNELS * BYTES_PER_SAMPLE;

/** Generate silence PCM buffer for a given number of milliseconds */
function silencePcm(ms: number): Buffer {
  const bytes = Math.floor((ms / 1000) * BYTES_PER_SEC);
  return Buffer.alloc(bytes, 0);
}

/** Generate TTS audio for a single segment, returns raw PCM Buffer */
async function generateSegmentPcm(
  text: string,
  style: string,
  voice: string,
  apiKey: string
): Promise<Buffer> {
  const stylePrefix = STYLE_PROMPTS[style] ?? STYLE_PROMPTS.normal;
  const prompt      = `${stylePrefix}: ${text.trim()}`;
  const ai          = new GoogleGenAI({ apiKey });

  const response = await ai.models.generateContent({
    model:    "gemini-2.5-flash-preview-tts",
    contents: [{ parts: [{ text: prompt }] }],
    config: {
      responseModalities: ["AUDIO"],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: voice },
        },
      },
    },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const inlineData = (response as any).candidates?.[0]?.content?.parts?.[0]?.inlineData;
  if (!inlineData?.data) {
    throw new Error(`Gemini returned no audio for segment: "${text.slice(0, 40)}"`);
  }
  return Buffer.from(inlineData.data, "base64");
}

/** Trim or pad PCM to exact target duration (ms) */
function fitPcmToMs(pcm: Buffer, targetMs: number): Buffer {
  const targetBytes = Math.floor((targetMs / 1000) * BYTES_PER_SEC);
  if (pcm.length >= targetBytes) {
    // Trim: ensure alignment to sample boundary
    const aligned = Math.floor(targetBytes / BYTES_PER_SAMPLE) * BYTES_PER_SAMPLE;
    return pcm.subarray(0, aligned);
  }
  // Pad with silence
  const pad = Buffer.alloc(targetBytes - pcm.length, 0);
  return Buffer.concat([pcm, pad]);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const {
      text, style = "normal", voice = "Kore", apiKey,
      // SRT-timeline mode
      segments, targetDurationMs,
    } = body as {
      text?:            string;
      style?:           string;
      voice?:           string;
      apiKey?:          string;
      segments?:        Array<{ text: string; startMs: number; endMs: number }>;
      targetDurationMs?: number;
    };

    const resolvedKey = apiKey?.trim() || process.env.GEMINI_API_KEY || "";
    if (!resolvedKey) {
      return NextResponse.json({ error: "No API key provided." }, { status: 401 });
    }
    if (!resolvedKey.startsWith("AIza")) {
      return NextResponse.json({ error: "Invalid API key format. Keys start with 'AIza'." }, { status: 401 });
    }

    /* ── Single-segment mode (backward-compatible) ─────────────────────── */
    if (!segments || segments.length === 0) {
      if (!text?.trim()) {
        return NextResponse.json({ error: "Text cannot be empty." }, { status: 400 });
      }
      if (text.length > 4000) {
        return NextResponse.json({ error: "Text exceeds 4,000 character limit." }, { status: 400 });
      }
      const pcm = await generateSegmentPcm(text, style, voice, resolvedKey);
      const wav = Buffer.concat([buildWavHeader(pcm.length), pcm]);
      return new NextResponse(wav, {
        status: 200,
        headers: {
          "Content-Type":        "audio/wav",
          "Content-Length":      String(wav.length),
          "Content-Disposition": 'inline; filename="myanmar-voice.wav"',
          "Cache-Control":       "no-store",
        },
      });
    }

    /* ── SRT-timeline stitch mode ──────────────────────────────────────── */
    if (segments.length > 50) {
      return NextResponse.json({ error: "Maximum 50 SRT segments per request." }, { status: 400 });
    }

    const totalDurationMs = targetDurationMs ?? Math.max(...segments.map(s => s.endMs));

    // Generate all segment PCMs in parallel (with concurrency cap)
    const CONCURRENCY = 4;
    const segmentPcms: Buffer[] = new Array(segments.length);
    for (let i = 0; i < segments.length; i += CONCURRENCY) {
      const batch = segments.slice(i, i + CONCURRENCY);
      const results = await Promise.all(
        batch.map((seg) => generateSegmentPcm(seg.text, style, voice, resolvedKey))
      );
      for (let j = 0; j < results.length; j++) {
        segmentPcms[i + j] = results[j];
      }
    }

    // Build the full timeline buffer
    const totalBytes = Math.floor((totalDurationMs / 1000) * BYTES_PER_SEC);
    const timeline   = Buffer.alloc(totalBytes, 0); // pre-filled with silence

    for (let i = 0; i < segments.length; i++) {
      const seg      = segments[i];
      const slotMs   = seg.endMs - seg.startMs;
      const fitted   = fitPcmToMs(segmentPcms[i], slotMs);
      const startByte = Math.floor((seg.startMs / 1000) * BYTES_PER_SEC);

      const copyLen = Math.min(fitted.length, totalBytes - startByte);
      if (copyLen > 0) {
        fitted.copy(timeline, startByte, 0, copyLen);
      }
    }

    const wav = Buffer.concat([buildWavHeader(timeline.length), timeline]);

    return new NextResponse(wav, {
      status: 200,
      headers: {
        "Content-Type":        "audio/wav",
        "Content-Length":      String(wav.length),
        "Content-Disposition": 'inline; filename="myanmar-tts-timeline.wav"',
        "Cache-Control":       "no-store",
        "X-Timeline-Duration": String(totalDurationMs),
        "X-Segment-Count":     String(segments.length),
      },
    });

  } catch (err: unknown) {
    // Log the full raw error so we can see exactly what Gemini returns
    console.error("[/api/tts] raw error:", JSON.stringify(err, Object.getOwnPropertyNames(err)));

    const msg    = err instanceof Error ? err.message : String(err);
    const upper  = msg.toUpperCase();

    // Quota / rate-limit — Gemini uses RESOURCE_EXHAUSTED, not "quota" or 429 in the message
    if (
      upper.includes("RESOURCE_EXHAUSTED") ||
      upper.includes("QUOTA") ||
      upper.includes("TOO MANY REQUESTS") ||
      upper.includes("RATE_LIMIT") ||
      upper.includes("429")
    ) {
      return NextResponse.json(
        { error: "Gemini API quota exceeded. Wait a moment and try again, or enable billing at aistudio.google.com." },
        { status: 429 }
      );
    }

    // Auth errors
    if (
      upper.includes("API_KEY_INVALID") ||
      upper.includes("INVALID_ARGUMENT") ||
      upper.includes("UNAUTHENTICATED") ||
      upper.includes("401")
    ) {
      return NextResponse.json({ error: "Invalid API key. Please check and try again." }, { status: 401 });
    }

    // Permission / billing not enabled
    if (upper.includes("PERMISSION_DENIED") || upper.includes("403")) {
      return NextResponse.json(
        { error: "API key lacks TTS permission. Enable the Gemini API at aistudio.google.com." },
        { status: 403 }
      );
    }

    return NextResponse.json({ error: msg || "Unexpected server error." }, { status: 500 });
  }
}
