/**
 * POST /api/tts
 *
 * Body:    { text: string, voiceId: string, modelId?: string }
 * Returns: audio/mpeg stream
 *
 * Updated for elevenlabs SDK v1.x  (breaking change from 0.x)
 * - Import is now:  import { ElevenLabsClient } from "elevenlabs"
 * - convertAsStream() returns a Node.js Readable in v1.x
 */

import { NextRequest, NextResponse } from "next/server";
import { ElevenLabsClient } from "elevenlabs";
import { Readable } from "stream";

export const maxDuration = 30;

const DEFAULT_VOICE_ID = process.env.ELEVENLABS_DEFAULT_VOICE_ID ?? "21m00Tcm4TlvDq8ikWAM";
const DEFAULT_MODEL    = "eleven_multilingual_v2";

export async function POST(req: NextRequest) {
  try {
    const apiKey =
      req.headers.get("x-elevenlabs-api-key") || process.env.ELEVENLABS_API_KEY;

    if (!apiKey) {
      return NextResponse.json({ error: "Missing ELEVENLABS_API_KEY" }, { status: 401 });
    }

    const body    = await req.json();
    const text    = (body.text    as string)?.trim();
    const voiceId = (body.voiceId as string)  || DEFAULT_VOICE_ID;
    const modelId = (body.modelId as string)  || DEFAULT_MODEL;

    if (!text) {
      return NextResponse.json({ error: "No text provided" }, { status: 400 });
    }
    if (text.length > 2500) {
      return NextResponse.json({ error: "Text exceeds 2500 chars per request" }, { status: 400 });
    }

    const client = new ElevenLabsClient({ apiKey });

    // SDK v1.x: convertAsStream returns a Node.js Readable stream
    const nodeStream = await client.textToSpeech.convertAsStream(voiceId, {
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

    // Convert Node.js Readable → Web ReadableStream for Next.js Response
    const webStream = new ReadableStream({
      start(controller) {
        // Handle both async iterable (v1.x) and Node Readable (older v1)
        if (Symbol.asyncIterator in nodeStream) {
          (async () => {
            try {
              for await (const chunk of nodeStream as AsyncIterable<Buffer>) {
                controller.enqueue(new Uint8Array(chunk));
              }
              controller.close();
            } catch (e) {
              controller.error(e);
            }
          })();
        } else {
          const readable = nodeStream as Readable;
          readable.on("data",  (chunk: Buffer) => controller.enqueue(new Uint8Array(chunk)));
          readable.on("end",   ()              => controller.close());
          readable.on("error", (e: Error)      => controller.error(e));
        }
      },
    });

    return new Response(webStream, {
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
