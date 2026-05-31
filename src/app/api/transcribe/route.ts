/**
 * POST /api/transcribe
 *
 * Accepts multipart form with an "audio" file field.
 * Returns: { segments: [{id, start, end, text}], language, duration }
 *
 * groq-sdk v1.x types the transcription response as `Transcription` (text-only)
 * even when response_format is "verbose_json". The segments array exists at
 * runtime but is absent from the SDK TypeScript types, so we cast via a local
 * VerboseTranscription interface rather than using `any`.
 */

import { NextRequest, NextResponse } from "next/server";
import Groq from "groq-sdk";

export const maxDuration = 60;

// Local type that reflects the actual runtime shape of a verbose_json response
interface VerboseSegment {
  id?:   number;
  start: number;
  end:   number;
  text:  string;
}

interface VerboseTranscription {
  text:      string;
  language?: string;
  duration?: number;
  segments?: VerboseSegment[];
}

export async function POST(req: NextRequest) {
  try {
    const apiKey =
      req.headers.get("x-groq-api-key") || process.env.GROQ_API_KEY;

    if (!apiKey) {
      return NextResponse.json({ error: "Missing GROQ_API_KEY" }, { status: 401 });
    }

    const formData  = await req.formData();
    const audioFile = formData.get("audio") as File | null;

    if (!audioFile) {
      return NextResponse.json({ error: "No audio file provided" }, { status: 400 });
    }

    const groq = new Groq({ apiKey });

    // Cast to VerboseTranscription — segments exist at runtime but are missing
    // from the SDK's TypeScript Transcription type when verbose_json is used.
    const transcription = (await groq.audio.transcriptions.create({
      file:                    audioFile,
      model:                   "whisper-large-v3-turbo",
      response_format:         "verbose_json",
      timestamp_granularities: ["segment"],
      language:                "auto",
    })) as unknown as VerboseTranscription;

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
        { error: "No speech detected. Check audio quality." },
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
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}