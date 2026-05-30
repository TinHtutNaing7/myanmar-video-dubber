"use client";

/**
 * useDubPipeline
 *
 * Full client-side orchestration — no server needed for video I/O:
 *  1. Load @ffmpeg/ffmpeg (WASM, runs entirely in the browser)
 *  2. Extract mono MP3 audio from the video file
 *  3. POST audio  → /api/transcribe  (Groq Whisper)
 *  4. POST text   → /api/translate   (Gemini 2.0 Flash)
 *  5. POST each segment → /api/tts   (ElevenLabs)
 *  6. Assemble final video + composite audio (ffmpeg.wasm filter_complex + adelay)
 *  7. Generate SRT subtitle file
 */

import { useState, useRef, useCallback } from "react";
import type { PipelineState, PipelineStep, Segment, DubSettings } from "@/lib/types";
import { buildSRT } from "@/lib/srt";

// ffmpeg core loaded from CDN — avoids bundling 30 MB into the Vercel build
const FFMPEG_CORE_URL = "https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd/ffmpeg-core.js";
const FFMPEG_WASM_URL = "https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd/ffmpeg-core.wasm";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a chained atempo filter string (atempo range is [0.5, 2.0]). */
function buildAtempo(speed: number): string {
  if (Math.abs(speed - 1) < 0.03) return "";
  const parts: string[] = [];
  let r = speed;
  while (r > 2.0) { parts.push("atempo=2.0"); r /= 2.0; }
  while (r < 0.5) { parts.push("atempo=0.5"); r /= 0.5; }
  if (Math.abs(r - 1) > 0.03) parts.push(`atempo=${r.toFixed(5)}`);
  return parts.join(",");
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useDubPipeline() {
  const [state, setState] = useState<PipelineState>({
    step: "idle",
    progress: 0,
    message: "Ready",
    segments: [],
  });

  // Keep FFmpeg instance alive across renders so WASM is only loaded once
  const ffmpegRef = useRef<import("@ffmpeg/ffmpeg").FFmpeg | null>(null);

  const update = useCallback(
    (step: PipelineStep, progress: number, message: string, extra?: Partial<PipelineState>) =>
      setState((prev) => ({ ...prev, step, progress, message, ...extra })),
    [],
  );

  // -------------------------------------------------------------------------
  // Main pipeline
  // -------------------------------------------------------------------------
  const run = useCallback(
    async (videoFile: File, settings: DubSettings) => {

      // ── 0. Load ffmpeg.wasm ───────────────────────────────────────────────
      update("loading_ffmpeg", 2, "Loading ffmpeg.wasm (first run ~5 s)…");
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
        // ── 1. Extract audio ─────────────────────────────────────────────────
        update("extracting_audio", 8, "Extracting audio from video…");

        const { fetchFile } = await import("@ffmpeg/util");
        await ff.writeFile("input.mp4", await fetchFile(videoFile));

        // Mono MP3 @ 16 kHz / 32 kbps — small enough for API upload
        await ff.exec([
          "-i", "input.mp4",
          "-vn", "-acodec", "libmp3lame",
          "-ar", "16000", "-ac", "1", "-ab", "32k",
          "audio.mp3",
        ]);

        const audioData = await ff.readFile("audio.mp3") as Uint8Array;
        const audioBlob = new Blob([audioData], { type: "audio/mpeg" });

        // ── 2. Transcribe (Groq Whisper) ─────────────────────────────────────
        update("transcribing", 18, "Transcribing with Groq Whisper…");

        const transcribeForm = new FormData();
        transcribeForm.append("audio", audioBlob, "audio.mp3");

        const tRes = await fetch("/api/transcribe", {
          method: "POST",
          headers: { "x-groq-api-key": settings.groqApiKey },
          body: transcribeForm,
        });
        if (!tRes.ok) {
          const e = await tRes.json().catch(() => ({ error: tRes.statusText }));
          throw new Error(`Transcription failed: ${e.error}`);
        }
        const { segments: rawSegs } = await tRes.json();
        const segments: Segment[] = rawSegs;

        update("transcribing", 28, `Transcribed ${segments.length} segments.`, { segments });

        // ── 3. Translate (Gemini) ─────────────────────────────────────────────
        update("translating", 32, `Translating ${segments.length} segments to Burmese…`);

        const trRes = await fetch("/api/translate", {
          method: "POST",
          headers: {
            "Content-Type":     "application/json",
            "x-gemini-api-key": settings.geminiApiKey,
          },
          body: JSON.stringify({
            segments: segments.map((s) => ({ id: s.id, text: s.text })),
          }),
        });
        if (!trRes.ok) {
          const e = await trRes.json().catch(() => ({ error: trRes.statusText }));
          throw new Error(`Translation failed: ${e.error}`);
        }
        const { translated } = await trRes.json();

        const transMap = new Map<number, string>(
          (translated as { id: number; text: string }[]).map((t) => [t.id, t.text]),
        );
        const translatedSegments: Segment[] = segments.map((s) => ({
          ...s,
          translated_text: transMap.get(s.id) ?? s.text,
        }));

        update("translating", 45, "Translation complete.", { segments: translatedSegments });

        // ── 4. Generate TTS (ElevenLabs) ────────────────────────────────────
        update("generating_tts", 48, "Generating Burmese voice with ElevenLabs…");

        // ttsClips[i] = Uint8Array of MP3 audio for segment i, or null on failure
        const ttsClips: (Uint8Array | null)[] = new Array(translatedSegments.length).fill(null);

        if (settings.workflow !== "subtitles") {
          let done = 0;
          for (let i = 0; i < translatedSegments.length; i++) {
            const text = (translatedSegments[i].translated_text ?? translatedSegments[i].text).trim();
            if (!text) continue;

            const r = await fetch("/api/tts", {
              method: "POST",
              headers: {
                "Content-Type":         "application/json",
                "x-elevenlabs-api-key": settings.elevenLabsKey,
              },
              body: JSON.stringify({
                text,
                voiceId: settings.voiceId,
                modelId: settings.ttsModel,
              }),
            });

            if (r.ok) {
              ttsClips[i] = new Uint8Array(await r.arrayBuffer());
            } else {
              const e = await r.json().catch(() => ({ error: r.statusText }));
              console.warn(`TTS failed for segment ${i}: ${e.error}`);
            }

            done++;
            const pct = 48 + Math.round((done / translatedSegments.length) * 22);
            update("generating_tts", pct, `Voice: ${done}/${translatedSegments.length} segments…`);
          }
        }

        // ── 5. Assemble video (ffmpeg.wasm) ──────────────────────────────────
        update("assembling", 72, "Assembling video…");

        const srtContent = buildSRT(translatedSegments);
        const srtBytes   = new TextEncoder().encode(srtContent);

        if (settings.workflow === "subtitles") {
          // Burn subtitles only — keep original audio
          await ff.writeFile("subs.srt", srtBytes);
          await ff.exec([
            "-i", "input.mp4",
            "-vf", `subtitles=subs.srt:force_style='FontSize=${settings.fontSize},PrimaryColour=&H00FFFFFF&,OutlineColour=&H000000&,Outline=2,Alignment=2,MarginV=25'`,
            "-c:a", "copy",
            "-c:v", "libx264", "-preset", "ultrafast",
            "output.mp4",
          ]);
        } else {
          // Build composite audio track
          const validPairs: { seg: Segment; clip: Uint8Array; idx: number }[] = [];
          for (let i = 0; i < translatedSegments.length; i++) {
            if (ttsClips[i] !== null) {
              validPairs.push({ seg: translatedSegments[i], clip: ttsClips[i]!, idx: i });
            }
          }

          if (validPairs.length === 0) {
            throw new Error("No TTS audio clips were generated. Check your ElevenLabs API key and free-tier quota.");
          }

          // Write each clip; apply tempo adjustment to fit segment window exactly
          const inputArgs:   string[] = [];
          const filterParts: string[] = [];

          for (let i = 0; i < validPairs.length; i++) {
            const { seg, clip } = validPairs[i];
            const clipName = `tts_${i}.mp3`;
            const adjName  = `adj_${i}.wav`;
            await ff.writeFile(clipName, clip);

            const segDur  = Math.max(0.1, seg.end - seg.start);
            const delayMs = Math.max(0, Math.round(seg.start * 1000));

            // Pad/trim to exact segment duration (tempo adjust done server-side via atempo)
            await ff.exec([
              "-i", clipName,
              "-af", `apad=whole_dur=${segDur.toFixed(3)},atrim=duration=${segDur.toFixed(3)}`,
              "-ar", "44100", "-ac", "1",
              adjName,
            ]);

            inputArgs.push("-i", adjName);
            filterParts.push(`[${i}:a]adelay=${delayMs}[da${i}]`);
          }

          // Mix all delayed clips into one stereo track
          const n     = validPairs.length;
          const mixIn = validPairs.map((_, i) => `[da${i}]`).join("");
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
          await ff.writeFile("subs.srt", srtBytes);

          if (settings.workflow === "audio_dub") {
            // New audio only — no subtitle overlay
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
            // video_dub / storytelling — new audio + burned subtitles
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

          // Clean up temp files
          const tempFiles = [
            "composite.wav", "subs.srt",
            ...validPairs.flatMap((_, i) => [`tts_${i}.mp3`, `adj_${i}.wav`]),
          ];
          for (const f of tempFiles) await ff.deleteFile(f).catch(() => {});
        }

        // ── 6. Export ─────────────────────────────────────────────────────────
        update("assembling", 97, "Exporting…");
        const outData  = await ff.readFile("output.mp4") as Uint8Array;
        const outBlob  = new Blob([outData], { type: "video/mp4" });
        const outputUrl = URL.createObjectURL(outBlob);

        // Clean up primary files
        for (const f of ["input.mp4", "audio.mp3", "output.mp4"]) {
          await ff.deleteFile(f).catch(() => {});
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
    if (state.outputUrl) URL.revokeObjectURL(state.outputUrl);
    setState({ step: "idle", progress: 0, message: "Ready", segments: [] });
  }, [state.outputUrl]);

  return { state, run, reset };
}
