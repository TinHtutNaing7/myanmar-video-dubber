/**
 * GET /api/voices
 * Returns the caller's available ElevenLabs voices so the UI can show real names.
 * Falls back to a curated static list when no API key is provided.
 */

import { NextRequest, NextResponse } from "next/server";

const STATIC_VOICES = [
  { voice_id: "21m00Tcm4TlvDq8ikWAM", name: "Rachel",  labels: { description: "Calm, warm"          } },
  { voice_id: "pNInz6obpgDQGcFmaJgB", name: "Adam",    labels: { description: "Deep, authoritative" } },
  { voice_id: "ErXwobaYiN019PkySvjV", name: "Antoni",  labels: { description: "Well-rounded"        } },
  { voice_id: "29vD33N1lfxlmkjXQ9yp", name: "Drew",    labels: { description: "Conversational"      } },
  { voice_id: "D38z5RcWu1voky8WS1ja", name: "Fin",     labels: { description: "Smooth, engaging"    } },
  { voice_id: "EXAVITQu4vr4xnSDxMaL", name: "Sarah",   labels: { description: "Gentle, clear"       } },
  { voice_id: "MF3mGyEYCl7XYWbV9V6O", name: "Elli",    labels: { description: "Upbeat, friendly"    } },
  { voice_id: "TxGEqnHWrfWFTfGW9XjX", name: "Josh",    labels: { description: "Deep, engaging"      } },
];

export async function GET(req: NextRequest) {
  const apiKey =
    req.headers.get("x-elevenlabs-api-key") || process.env.ELEVENLABS_API_KEY;

  if (!apiKey) {
    // Return curated static list — no key required
    return NextResponse.json({ voices: STATIC_VOICES });
  }

  try {
    const res = await fetch("https://api.elevenlabs.io/v1/voices", {
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json",
      },
      next: { revalidate: 300 }, // cache for 5 minutes
    });

    if (!res.ok) {
      return NextResponse.json({ voices: STATIC_VOICES });
    }

    const data = await res.json();
    const voices = (data.voices ?? []).map((v: {
      voice_id: string;
      name: string;
      labels?: Record<string, string>;
    }) => ({
      voice_id: v.voice_id,
      name:     v.name,
      labels:   v.labels ?? {},
    }));

    return NextResponse.json({ voices });
  } catch {
    return NextResponse.json({ voices: STATIC_VOICES });
  }
}
