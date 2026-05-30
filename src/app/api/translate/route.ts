/**
 * POST /api/translate
 *
 * Body: { segments: [{id, text}], targetLanguage?: string }
 * Returns: { translated: [{id, text}] }
 *
 * Uses Gemini 2.0 Flash — free tier includes generous RPM & daily token quota.
 * Processes in batches of 60 to stay well within single-request limits.
 */

import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

export const maxDuration = 60;

const GEMINI_MODEL = "gemini-2.0-flash";
const BATCH_SIZE   = 60;

const SYSTEM_PROMPT = `You are an expert video dubbing translator.
Translate the given JSON array of transcript segments into natural, spoken Burmese (Myanmar language).

STRICT RULES:
1. Return ONLY a valid JSON array — no markdown fences, no explanations, nothing else.
2. Every object must have exactly two fields: "id" (integer, unchanged) and "text" (Burmese translation).
3. Keep phrasing natural and concise for spoken dubbing — avoid overly literary style.
4. Preserve proper nouns, numbers, and technical terms when no standard Burmese equivalent exists.
5. Do NOT add or remove segments.`;

export async function POST(req: NextRequest) {
  try {
    const apiKey = req.headers.get("x-gemini-api-key") || process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "Missing GEMINI_API_KEY" }, { status: 401 });
    }

    const body = await req.json();
    const segments: { id: number; text: string }[] = body.segments ?? [];
    const targetLanguage: string = body.targetLanguage ?? "natural spoken Burmese (Myanmar)";

    if (!segments.length) {
      return NextResponse.json({ error: "No segments provided" }, { status: 400 });
    }

    const genAI  = new GoogleGenerativeAI(apiKey);
    const model  = genAI.getGenerativeModel({ model: GEMINI_MODEL });

    const translated: { id: number; text: string }[] = [];

    // Process in batches to stay within token limits
    for (let i = 0; i < segments.length; i += BATCH_SIZE) {
      const batch   = segments.slice(i, i + BATCH_SIZE);
      const payload = JSON.stringify(batch, null, 0);

      const prompt = `${SYSTEM_PROMPT}\nTarget language: ${targetLanguage}\n\nInput:\n${payload}`;

      let raw: string;
      try {
        const result = await model.generateContent(prompt);
        raw = result.response.text().trim();
      } catch (apiErr: unknown) {
        throw new Error(`Gemini API error on batch ${i}: ${String(apiErr)}`);
      }

      // Strip accidental markdown fences
      const clean = raw
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/\s*```$/,           "")
        .trim();

      let parsed: { id: number; text: string }[];
      try {
        parsed = JSON.parse(clean);
      } catch {
        // Retry: ask Gemini to fix its own output
        const fix = await model.generateContent(
          `The following text is supposed to be a JSON array but is malformed. Fix it and return ONLY the corrected JSON array:\n${raw}`,
        );
        parsed = JSON.parse(fix.response.text().trim().replace(/^```(?:json)?\s*/i,"").replace(/\s*```$/,""));
      }

      translated.push(...parsed);
    }

    return NextResponse.json({ translated });
  } catch (err: unknown) {
    console.error("[/api/translate]", err);
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
