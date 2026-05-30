/**
 * POST /api/tts
 *
 * Body:    { text: string, voiceId: string, modelId?: string }
 * Returns: audio/mpeg stream
 *
 * ElevenLabs SDK v1.59 — textToSpeech.convertAsStream() returns
 * an async-iterable of Buffer chunks.
 */

import { NextRequest, NextResponse } from "next/server";
import { ElevenLabsClient } from "elevenlabs";

export const maxDuration = 30;

const DEFAULT_VOICE = process.env.ELEVENLABS_DEFAULT_VOICE_ID ?? "21m00Tcm4TlvDq8ikWAM";
const DEFAULT_MODEL = "eleven_multilingual_v2";

export async function POST(req: NextRequest) {
  try {
    const apiKey =
      req.headers.get("x-elevenlabs-api-key") || process.env.ELEVENLABS_API_KEY;

    if (!apiKey) {
      return NextResponse.json({ error: "Missing ELEVENLABS_API_KEY" }, { status: 401 });
    }

    const body    = await req.json();
    const text    = (body.text    as string)?.trim();
    const voiceId = (body.voiceId as string) || DEFAULT_VOICE;
    const modelId = (body.modelId as string) || DEFAULT_MODEL;

    if (!text) {
      return NextResponse.json({ error: "No text provided" }, { status: 400 });
    }
    if (text.length > 2500) {
      return NextResponse.json({ error: "Text too long (max 2500 chars)" }, { status: 400 });
    }

    const client = new ElevenLabsClient({ apiKey });

    // v1.x returns an async-iterable stream of Buffer/Uint8Array chunks
    const audioStream = await client.textToSpeech.convertAsStream(voiceId, {
      text,
      model_id:      modelId,
      output_format: "mp3_44100_128",
      voice_settings: {
        stability:         0.45,
        similarity_boost:  0.80,
        style:             0.20,
        use_speaker_boost: true,
      },
    });

    // Pipe async-iterable → Web ReadableStream for Next.js Response
    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of audioStream) {
            controller.enqueue(
              chunk instanceof Uint8Array
                ? chunk
                : new Uint8Array(Buffer.from(chunk as Buffer)),
            );
          }
          controller.close();
        } catch (e) {
          controller.error(e);
        }
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
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
