/**
 * POST /api/translate
 *
 * Body:    { segments: [{id, text}], targetLanguage?: string }
 * Returns: { translated: [{id, text}] }
 *
 * Uses Gemini 2.0 Flash via @google/generative-ai v0.21+
 * Free tier: 1,500 requests/day · 1M tokens/min
 */

import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI }        from "@google/generative-ai";

export const maxDuration = 60;

const MODEL      = "gemini-2.0-flash";
const BATCH_SIZE = 60;

const SYSTEM = `You are an expert video dubbing translator.
Translate the JSON array of transcript segments into natural, spoken Burmese (Myanmar language).

STRICT RULES:
1. Return ONLY a valid JSON array — no markdown fences, no explanation.
2. Every object must have exactly: "id" (integer, unchanged) and "text" (Burmese translation).
3. Keep phrasing natural and concise for spoken dubbing.
4. Preserve proper nouns and technical terms when no Burmese equivalent exists.
5. Do NOT add or remove segments.`;

export async function POST(req: NextRequest) {
  try {
    const apiKey =
      req.headers.get("x-gemini-api-key") || process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return NextResponse.json({ error: "Missing GEMINI_API_KEY" }, { status: 401 });
    }

    const body     = await req.json();
    const segments = (body.segments ?? []) as { id: number; text: string }[];

    if (!segments.length) {
      return NextResponse.json({ error: "No segments provided" }, { status: 400 });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: MODEL });

    const translated: { id: number; text: string }[] = [];

    for (let i = 0; i < segments.length; i += BATCH_SIZE) {
      const batch   = segments.slice(i, i + BATCH_SIZE);
      const payload = JSON.stringify(batch);
      const prompt  = `${SYSTEM}\n\nInput:\n${payload}`;

      let raw: string;
      try {
        const result = await model.generateContent(prompt);
        raw = result.response.text().trim();
      } catch (e) {
        throw new Error(`Gemini error on batch ${i}: ${String(e)}`);
      }

      // Strip markdown fences Gemini sometimes adds
      const clean = raw
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/\s*```$/, "")
        .trim();

      let parsed: { id: number; text: string }[];
      try {
        parsed = JSON.parse(clean);
      } catch {
        // Ask Gemini to self-heal
        const fix = await model.generateContent(
          `Fix this malformed JSON array and return ONLY the corrected array:\n${raw}`,
        );
        const fixedRaw = fix.response.text().trim()
          .replace(/^```(?:json)?\s*/i, "")
          .replace(/\s*```$/, "");
        parsed = JSON.parse(fixedRaw);
      }

      translated.push(...parsed);
    }

    return NextResponse.json({ translated });

  } catch (err: unknown) {
    console.error("[/api/translate]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
