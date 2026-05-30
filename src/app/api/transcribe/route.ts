/**
 * POST /api/transcribe
 *
 * Accepts a multipart form with an "audio" file field.
 * Returns: { segments: [{id, start, end, text}], language, duration }
 *
 * Uses Groq's whisper-large-v3-turbo — free tier, very fast (~5× real-time).
 * Free limits: 7,200 audio seconds / hour; no daily cap.
 */

import { NextRequest, NextResponse } from "next/server";
import Groq from "groq-sdk";

export const maxDuration = 60; // seconds (requires Vercel Pro for >10s)

export async function POST(req: NextRequest) {
  try {
    const apiKey = req.headers.get("x-groq-api-key") || process.env.GROQ_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "Missing GROQ_API_KEY" }, { status: 401 });
    }

    const groq     = new Groq({ apiKey });
    const formData = await req.formData();
    const audioFile = formData.get("audio") as File | null;

    if (!audioFile) {
      return NextResponse.json({ error: "No audio file provided" }, { status: 400 });
    }

    // Groq SDK needs a File-like object; pass it directly
    const transcription = await groq.audio.transcriptions.create({
      file:                      audioFile,
      model:                     "whisper-large-v3-turbo",
      response_format:           "verbose_json",
      timestamp_granularities:   ["segment"],
      language:                  "auto",   // auto-detect; set "my" to force Burmese input
    });

    // Normalise to our Segment shape
    const segments = (transcription.segments ?? [])
      .filter((s) => s.text?.trim())
      .map((s, i) => ({
        id:    i,
        start: Number(s.start ?? 0),
        end:   Number(s.end   ?? 0),
        text:  s.text.trim(),
      }));

    if (segments.length === 0) {
      return NextResponse.json(
        { error: "No speech detected. Check audio quality or content." },
        { status: 422 },
      );
    }

    return NextResponse.json({
      segments,
      language: transcription.language ?? "unknown",
      duration: transcription.duration ?? null,
    });
  } catch (err: unknown) {
    console.error("[/api/transcribe]", err);
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
