/**
 * POST /api/tts
 *
 * Body: { text: string, voiceId: string, modelId?: string }
 * Returns: audio/mpeg stream  (MP3 @ 44.1 kHz, 128 kbps)
 *
 * Uses ElevenLabs — free tier: 10,000 chars/month.
 * eleven_multilingual_v2 is the best model for Burmese text.
 *
 * Note: For dedicated Burmese voices, consider creating a Voice Clone on ElevenLabs
 * using native Burmese speaker audio, or use the professional_voice_clone API.
 */

import { NextRequest, NextResponse } from "next/server";
import { ElevenLabsClient }         from "elevenlabs";

export const maxDuration = 30;

const DEFAULT_VOICE_ID = process.env.ELEVENLABS_DEFAULT_VOICE_ID ?? "21m00Tcm4TlvDq8ikWAM";
const DEFAULT_MODEL    = "eleven_multilingual_v2";

export async function POST(req: NextRequest) {
  try {
    const apiKey = req.headers.get("x-elevenlabs-api-key") || process.env.ELEVENLABS_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "Missing ELEVENLABS_API_KEY" }, { status: 401 });
    }

    const body    = await req.json();
    const text    = (body.text    as string)?.trim();
    const voiceId = (body.voiceId as string) || DEFAULT_VOICE_ID;
    const modelId = (body.modelId as string) || DEFAULT_MODEL;

    if (!text) {
      return NextResponse.json({ error: "No text provided" }, { status: 400 });
    }
    if (text.length > 2500) {
      return NextResponse.json({ error: "Text exceeds 2500 chars per request" }, { status: 400 });
    }

    const client = new ElevenLabsClient({ apiKey });

    // Use streaming to avoid buffering the entire audio in memory
    const audioStream = await client.textToSpeech.convertAsStream(voiceId, {
      text,
      model_id:      modelId,
      output_format: "mp3_44100_128",
      voice_settings: {
        stability:        0.45,   // Lower = more expressive
        similarity_boost: 0.80,
        style:            0.20,
        use_speaker_boost: true,
      },
    });

    // Convert async-iterable → ReadableStream for Next.js response
    const readable = new ReadableStream({
      async start(controller) {
        for await (const chunk of audioStream) {
          controller.enqueue(
            chunk instanceof Uint8Array ? chunk : new Uint8Array(Buffer.from(chunk)),
          );
        }
        controller.close();
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type":  "audio/mpeg",
        "Cache-Control": "no-store",
      },
    });
  } catch (err: unknown) {
    console.error("[/api/tts]", err);
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
