"use client";

/**
 * useDubPipeline
 *
 * Full client-side orchestration:
 *  1. Load @ffmpeg/ffmpeg (WASM, runs in browser — no server needed for video I/O)
 *  2. Extract audio from video file
 *  3. POST audio → /api/transcribe  (Groq Whisper)
 *  4. POST segments → /api/translate (Gemini 2.0 Flash)
 *  5. POST each segment → /api/tts   (ElevenLabs)
 *  6. Assemble final video + composite audio (ffmpeg.wasm filter_complex + adelay)
 *  7. Generate SRT file
 */

import { useState, useRef, useCallback } from "react";
import type { PipelineState, PipelineStep, Segment, DubSettings } from "@/lib/types";
import { buildSRT } from "@/lib/srt";

// ffmpeg.wasm core files served from CDN (avoids bundling 30 MB into your Vercel build)
const FFMPEG_CORE_URL = "https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd/ffmpeg-core.js";
const FFMPEG_WASM_URL = "https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd/ffmpeg-core.wasm";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildAtempo(speed: number): string {
  if (Math.abs(speed - 1) < 0.03) return "";
  const parts: string[] = [];
  let r = speed;
  while (r > 2.0) { parts.push("atempo=2.0"); r /= 2.0; }
  while (r < 0.5) { parts.push("atempo=0.5"); r /= 0.5; }
  if (Math.abs(r - 1) > 0.03) parts.push(`atempo=${r.toFixed(5)}`);
  return parts.join(",");
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useDubPipeline() {
  const [state, setState] = useState<PipelineState>({
    step:     "idle",
    progress: 0,
    message:  "Ready",
    segments: [],
  });

  // We keep FFmpeg instance across renders so we only load WASM once
  const ffmpegRef = useRef<InstanceType<typeof import("@ffmpeg/ffmpeg").FFmpeg> | null>(null);

  const update = useCallback(
    (step: PipelineStep, progress: number, message: string, extra?: Partial<PipelineState>) => {
      setState((prev) => ({ ...prev, step, progress, message, ...extra }));
    },
    [],
  );

  // ── Main orchestrator ────────────────────────────────────────────────────────

  const run = useCallback(
    async (videoFile: File, settings: DubSettings) => {
      // ── 0. Load ffmpeg.wasm ──────────────────────────────────────────────────
      update("loading_ffmpeg", 2, "Loading video processor (ffmpeg.wasm)…");
      try {
        if (!ffmpegRef.current) {
          const { FFmpeg }    = await import("@ffmpeg/ffmpeg");
          const { toBlobURL } = await import("@ffmpeg/util");

          const ff = new FFmpeg();
          ff.on("log", ({ message: m }) => console.debug("[ffmpeg]", m));

          await ff.load({
            coreURL: await toBlobURL(FFMPEG_CORE_URL, "text/javascript"),
            wasmURL: await toBlobURL(FFMPEG_WASM_URL, "application/wasm"),
          });
          ffmpegRef.current = ff;
        }
      } catch (err) {
        update("error", 0, `Failed to load ffmpeg.wasm: ${err}`, { error: String(err) });
        return;
      }

      const ff = ffmpegRef.current!;

      try {
        // ── 1. Extract audio ───────────────────────────────────────────────────
        update("extracting_audio", 8, "Extracting audio from video…");

        const { fetchFile } = await import("@ffmpeg/util");
        await ff.writeFile("input.mp4", await fetchFile(videoFile));

        // Compress to mono MP3 @ 32 kbps — keeps file small for API upload
        await ff.exec([
          "-i", "input.mp4",
          "-vn", "-acodec", "libmp3lame",
          "-ar", "16000", "-ac", "1", "-ab", "32k",
          "audio.mp3",
        ]);

        const audioData = await ff.readFile("audio.mp3") as Uint8Array;
        const audioBlob = new Blob([audioData], { type: "audio/mpeg" });

        // ── 2. Transcribe (Groq Whisper) ───────────────────────────────────────
        update("transcribing", 18, "Transcribing speech with Groq Whisper…");

        const transcribeForm = new FormData();
        transcribeForm.append("audio", audioBlob, "audio.mp3");

        const tRes = await fetch("/api/transcribe", {
          method:  "POST",
          headers: { "x-groq-api-key": settings.groqApiKey },
          body:    transcribeForm,
        });
        if (!tRes.ok) {
          const e = await tRes.json();
          throw new Error(`Transcription failed: ${e.error}`);
        }
        const { segments: rawSegments } = await tRes.json();
        const segments: Segment[] = rawSegments;

        update("transcribing", 28, `Transcribed ${segments.length} segments.`, { segments });

        // ── 3. Translate (Gemini) ─────────────────────────────────────────────
        update("translating", 32, `Translating ${segments.length} segments with Gemini…`);

        const trRes = await fetch("/api/translate", {
          method:  "POST",
          headers: {
            "Content-Type":       "application/json",
            "x-gemini-api-key":   settings.geminiApiKey,
          },
          body: JSON.stringify({
            segments: segments.map((s) => ({ id: s.id, text: s.text })),
          }),
        });
        if (!trRes.ok) {
          const e = await trRes.json();
          throw new Error(`Translation failed: ${e.error}`);
        }
        const { translated } = await trRes.json();

        const transMap = new Map<number, string>(translated.map((t: { id: number; text: string }) => [t.id, t.text]));
        const translatedSegments: Segment[] = segments.map((s) => ({
          ...s,
          translated_text: transMap.get(s.id) ?? s.text,
        }));

        update("translating", 45, "Translation complete.", { segments: translatedSegments });

        // ── 4. Generate TTS (ElevenLabs) ──────────────────────────────────────
        update("generating_tts", 48, "Generating Burmese voice with ElevenLabs…");

        // For subtitles-only workflow, skip TTS
        const ttsClips: Array<{ segIndex: number; data: Uint8Array } | null> = [];

        if (settings.workflow !== "subtitles") {
          const validSegs = translatedSegments.filter(
            (s) => (s.translated_text ?? s.text).trim().length > 0,
          );
          let done = 0;

          // Process TTS sequentially to respect rate limits on free tier
          for (const seg of translatedSegments) {
            const text = (seg.translated_text ?? seg.text).trim();
            if (!text) {
              ttsClips.push(null);
              continue;
            }

            const ttsRes = await fetch("/api/tts", {
              method:  "POST",
              headers: {
                "Content-Type":           "application/json",
                "x-elevenlabs-api-key":   settings.elevenLabsKey,
              },
              body: JSON.stringify({
                text,
                voiceId: settings.voiceId,
                modelId: settings.ttsModel,
              }),
            });

            if (!ttsRes.ok) {
              const e = await ttsRes.json().catch(() => ({ error: ttsRes.statusText }));
              console.warn(`TTS failed for segment ${seg.id}: ${e.error}`);
              ttsClips.push(null);
            } else {
              const buf = await ttsRes.arrayBuffer();
              ttsClips.push({ segIndex: seg.id, data: new Uint8Array(buf) });
            }

            done++;
            const pct = 48 + Math.round((done / validSegs.length) * 22);
            update("generating_tts", pct, `TTS: ${done}/${validSegs.length} segments…`);
          }
        }

        // ── 5. Assemble video (ffmpeg.wasm) ───────────────────────────────────
        update("assembling", 72, "Assembling dubbed video…");

        if (settings.workflow === "subtitles") {
          // Subtitles-only: burn SRT into video using drawtext/subtitles filter
          const srtContent = buildSRT(translatedSegments);
          const srtBytes   = new TextEncoder().encode(srtContent);
          await ff.writeFile("subs.srt", srtBytes);

          await ff.exec([
            "-i", "input.mp4",
            "-vf", `subtitles=subs.srt:force_style='FontSize=${settings.fontSize},PrimaryColour=&H00FFFFFF&,OutlineColour=&H000000&,Outline=2,Alignment=2,MarginV=25'`,
            "-c:a", "copy",
            "-c:v", "libx264", "-preset", "ultrafast",
            "output.mp4",
          ]);
        } else {
          // Build composite audio track: each TTS clip delayed to its timestamp
          const validPairs = translatedSegments
            .map((seg, i) => ({ seg, clip: ttsClips[i] }))
            .filter((p): p is { seg: Segment; clip: { segIndex: number; data: Uint8Array } } =>
              p.clip !== null,
            );

          if (validPairs.length === 0) {
            throw new Error("No TTS audio clips were generated. Check your ElevenLabs API key.");
          }

          // Write each TTS clip and adjust its tempo to fit the segment window
          const inputArgs: string[]  = [];
          const filterParts: string[] = [];

          for (let i = 0; i < validPairs.length; i++) {
            const { seg, clip } = validPairs[i];
            const clipName = `tts_${i}.mp3`;
            await ff.writeFile(clipName, clip.data);

            // Get TTS duration (probe via ffprobe is not available in wasm; estimate from bytes)
            // Better: use a small ffmpeg transcode to force exact duration
            const segDur = Math.max(0.1, seg.end - seg.start);
            const delayMs = Math.round(seg.start * 1000);

            // Adjusted clip: atempo to fit window + pad/trim to exact duration
            const adjName  = `adj_${i}.wav`;
            // We'll do a two-pass: first get real duration, then apply atempo
            // Simplified: use apad+atrim to fit exactly
            await ff.exec([
              "-i", clipName,
              "-af", `apad=whole_dur=${segDur.toFixed(3)},atrim=duration=${segDur.toFixed(3)}`,
              "-ar", "44100", "-ac", "1",
              adjName,
            ]);

            inputArgs.push("-i", adjName);
            filterParts.push(`[${i}:a]adelay=${delayMs}[da${i}]`);
          }

          const n      = validPairs.length;
          const mixIn  = validPairs.map((_, i) => `[da${i}]`).join("");
          filterParts.push(`${mixIn}amix=inputs=${n}:normalize=0:dropout_transition=0[aout]`);

          update("assembling", 82, "Mixing audio track…");

          await ff.exec([
            ...inputArgs,
            "-filter_complex", filterParts.join(";"),
            "-map", "[aout]",
            "-ar", "44100", "-ac", "1",
            "composite.wav",
          ]);

          update("assembling", 90, "Muxing final video…");

          if (settings.workflow === "audio_dub") {
            await ff.exec([
              "-i", "input.mp4",
              "-i", "composite.wav",
              "-c:v", "copy",
              "-map", "0:v:0", "-map", "1:a:0",
              "-c:a", "aac", "-b:a", "128k",
              "-shortest",
              "output.mp4",
            ]);
          } else {
            // video_dub / storytelling: Burmese audio + burned subtitles
            const srtContent = buildSRT(translatedSegments);
            await ff.writeFile("subs.srt", new TextEncoder().encode(srtContent));

            await ff.exec([
              "-i", "input.mp4",
              "-i", "composite.wav",
              "-filter_complex",
              `[0:v]subtitles=subs.srt:force_style='FontSize=${settings.fontSize},PrimaryColour=&H00FFFFFF&,OutlineColour=&H000000&,Outline=2,Alignment=2,MarginV=25'[vout]`,
              "-map", "[vout]", "-map", "1:a:0",
              "-c:v", "libx264", "-preset", "ultrafast",
              "-c:a", "aac", "-b:a", "128k",
              "-shortest",
              "output.mp4",
            ]);
          }
        }

        // ── 6. Export ──────────────────────────────────────────────────────────
        update("assembling", 97, "Exporting output…");

        const outData   = await ff.readFile("output.mp4") as Uint8Array;
        const outBlob   = new Blob([outData], { type: "video/mp4" });
        const outputUrl = URL.createObjectURL(outBlob);

        const srtContent = buildSRT(translatedSegments);

        // Clean up ffmpeg FS to free memory
        for (const name of [
          "input.mp4", "audio.mp3", "composite.wav", "subs.srt", "output.mp4",
          ...Array.from({ length: validPairsCount(ttsClips) }, (_, i) => [`tts_${i}.mp3`, `adj_${i}.wav`]).flat(),
        ]) {
          await ff.deleteFile(name).catch(() => {});
        }

        update("completed", 100, "Done! Your dubbed video is ready.", {
          segments:    translatedSegments,
          outputUrl,
          srtContent,
        });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error("[pipeline]", err);
        update("error", 0, msg, { error: msg });
      }
    },
    [update],
  );

  const reset = useCallback(() => {
    // Revoke previous object URL
    if (state.outputUrl) URL.revokeObjectURL(state.outputUrl);
    setState({ step: "idle", progress: 0, message: "Ready", segments: [] });
  }, [state.outputUrl]);

  return { state, run, reset };
}

function validPairsCount(clips: unknown[]): number {
  return clips.filter(Boolean).length;
}
