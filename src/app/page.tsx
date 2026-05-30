"use client";

import { useState, useRef, useCallback } from "react";
import type { DubSettings, PipelineStep } from "@/lib/types";
import { useDubPipeline }                 from "@/hooks/useDubPipeline";
import { buildSRT, downloadBlob, downloadSRT } from "@/lib/srt";

// ─── Constants ─────────────────────────────────────────────────────────────────

const ELEVENLABS_VOICES = [
  { id: "21m00Tcm4TlvDq8ikWAM", name: "Rachel",  style: "Calm, warm"        },
  { id: "pNInz6obpgDQGcFmaJgB", name: "Adam",    style: "Deep, authoritative" },
  { id: "ErXwobaYiN019PkySvjV", name: "Antoni",  style: "Well-rounded"       },
  { id: "29vD33N1lfxlmkjXQ9yp", name: "Drew",    style: "Conversational"     },
  { id: "D38z5RcWu1voky8WS1ja", name: "Fin",     style: "Smooth, engaging"   },
  { id: "IKne3meq5aSn9XLyUdCD", name: "Charlie", style: "Casual, expressive" },
  { id: "EXAVITQu4vr4xnSDxMaL", name: "Sarah",   style: "Gentle, clear"      },
  { id: "MF3mGyEYCl7XYWbV9V6O", name: "Elli",    style: "Upbeat, friendly"   },
];

const ELEVENLABS_MODELS = [
  { id: "eleven_multilingual_v2", name: "Multilingual v2", desc: "Best for Burmese — recommended" },
  { id: "eleven_turbo_v2_5",      name: "Turbo v2.5",      desc: "Faster, slightly lower quality"  },
  { id: "eleven_flash_v2_5",      name: "Flash v2.5",      desc: "Fastest, ultra-low latency"       },
];

const WHISPER_MODELS = [
  { id: "whisper-large-v3-turbo", name: "Whisper Large v3 Turbo", desc: "Fastest — recommended", badge: "Free" },
  { id: "whisper-large-v3",       name: "Whisper Large v3",       desc: "Max accuracy",           badge: "Free" },
];

const WORKFLOWS = [
  { id: "video_dub",    icon: "🎙", name: "Video Dub",    desc: "Voice + Subtitles" },
  { id: "storytelling", icon: "✨", name: "Storytelling", desc: "Recap Narrator"    },
  { id: "audio_dub",    icon: "🔊", name: "Audio Dub",    desc: "Voice only"        },
  { id: "subtitles",    icon: "💬", name: "Subtitles",    desc: "Subs only"         },
];

const PIPELINE_STEPS: { id: PipelineStep; label: string; icon: string }[] = [
  { id: "loading_ffmpeg",   label: "Loading Video Processor", icon: "⚙"  },
  { id: "extracting_audio", label: "Extracting Audio",        icon: "🎵" },
  { id: "transcribing",     label: "Groq Whisper Transcription", icon: "📝" },
  { id: "translating",      label: "Gemini Translation",      icon: "🌐" },
  { id: "generating_tts",   label: "ElevenLabs Voice",        icon: "🔊" },
  { id: "assembling",       label: "Video Assembly",          icon: "🎬" },
  { id: "completed",        label: "Complete!",               icon: "✅" },
];

const DEFAULT_SETTINGS: DubSettings = {
  workflow:       "video_dub",
  voiceId:        "21m00Tcm4TlvDq8ikWAM",
  voiceName:      "Rachel",
  ttsModel:       "eleven_multilingual_v2",
  whisperModel:   "whisper-large-v3-turbo",
  outputLanguage: "Burmese (Myanmar)",
  subtitleStyle:  "outline_black",
  fontSize:       44,
  groqApiKey:     "",
  geminiApiKey:   "",
  elevenLabsKey:  "",
};

// ─── Sub-components ─────────────────────────────────────────────────────────────

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-[#1a2640] bg-[#0a1020]/90 backdrop-blur-sm p-4 ${className}`}>
      {children}
    </div>
  );
}

function SectionTitle({ icon, title, right }: { icon: string; title: string; right?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <span className="flex items-center gap-2 text-amber-400 font-semibold text-xs tracking-[0.12em] uppercase">
        <span>{icon}</span>{title}
      </span>
      {right}
    </div>
  );
}

function Pill({ children, color = "amber" }: { children: React.ReactNode; color?: "amber" | "green" | "blue" | "gray" }) {
  const cls = {
    amber: "text-amber-400 border-amber-400/30 bg-amber-400/10",
    green: "text-green-400 border-green-400/30 bg-green-400/10",
    blue:  "text-blue-400  border-blue-400/30  bg-blue-400/10",
    gray:  "text-gray-400  border-gray-600/30  bg-gray-700/20",
  }[color];
  return <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border tracking-wider ${cls}`}>{children}</span>;
}

function SelectOption({
  selected, onClick, children,
}: { selected: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={[
        "w-full text-left rounded-xl border px-3 py-2.5 transition-all duration-150 focus:outline-none",
        selected
          ? "border-amber-400 bg-amber-400/10 shadow-[0_0_14px_rgba(245,158,11,0.15)]"
          : "border-[#1e3055] hover:border-amber-400/40 hover:bg-[#111f35]",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

function ApiKeyInput({
  label, value, onChange, placeholder, hint,
}: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder: string; hint: React.ReactNode;
}) {
  const [show, setShow] = useState(false);
  return (
    <div>
      <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-1.5">{label}</p>
      <div className="relative">
        <input
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          spellCheck={false}
          className="w-full bg-[#0d1828] border border-[#1e3055] rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-amber-400/60 transition-colors pr-14 font-mono"
        />
        <button
          onClick={() => setShow(!show)}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-gray-500 hover:text-amber-400 transition-colors tracking-wider font-semibold"
        >
          {show ? "HIDE" : "SHOW"}
        </button>
      </div>
      <p className="text-[11px] text-gray-600 mt-1 leading-relaxed">{hint}</p>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function Home() {
  const [videoFile, setVideoFile]   = useState<File | null>(null);
  const [isDragging, setDragging]   = useState(false);
  const [settings, setSettings]     = useState<DubSettings>(DEFAULT_SETTINGS);
  const [showModels, setShowModels] = useState(false);
  const [tab, setTab]               = useState<"upload" | "url">("upload");
  const fileRef                     = useRef<HTMLInputElement>(null);

  const { state, run, reset } = useDubPipeline();

  const isIdle       = state.step === "idle";
  const isProcessing = !["idle", "completed", "error"].includes(state.step);
  const isCompleted  = state.step === "completed";
  const isFailed     = state.step === "error";
  const hasJob       = !isIdle;

  const set = <K extends keyof DubSettings>(key: K, val: DubSettings[K]) =>
    setSettings((s) => ({ ...s, [key]: val }));

  // ── Drag & Drop ──────────────────────────────────────────────────────────────
  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) setVideoFile(f);
  }, []);

  // ── Submit ───────────────────────────────────────────────────────────────────
  const handleStart = async () => {
    if (!videoFile) return;
    if (!settings.groqApiKey || !settings.geminiApiKey) {
      alert("Please enter your Groq and Gemini API keys.");
      return;
    }
    if (settings.workflow !== "subtitles" && !settings.elevenLabsKey) {
      alert("Please enter your ElevenLabs API key for voice generation.");
      return;
    }
    await run(videoFile, settings);
  };

  const handleReset = () => {
    setVideoFile(null);
    reset();
  };

  // ── Progress ─────────────────────────────────────────────────────────────────
  const currentStepIdx = PIPELINE_STEPS.findIndex((s) => s.id === state.step);

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#080d18] bg-grid text-white">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="border-b border-[#1a2640] px-5 py-3.5 sticky top-0 z-50 bg-[#080d18]/95 backdrop-blur">
        <div className="max-w-6xl mx-auto flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center text-black font-black text-sm bg-gradient-to-br from-amber-400 to-amber-600 select-none shrink-0">
            မြ
          </div>
          <div className="leading-tight">
            <h1 className="text-xs font-bold tracking-[0.18em] text-white uppercase">
              Myanmar Video Dubber
            </h1>
            <p className="text-[10px] text-gray-600 tracking-wider">
              Groq · Gemini · ElevenLabs · ffmpeg.wasm
            </p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Pill color="green">FREE TIER</Pill>
            <Pill color="blue">VERCEL</Pill>
            <a
              href="https://github.com"
              target="_blank"
              rel="noreferrer"
              className="text-gray-500 hover:text-amber-400 transition-colors text-xs tracking-wider"
            >
              GitHub ↗
            </a>
          </div>
        </div>
      </header>

      {/* ── Body ───────────────────────────────────────────────────────────── */}
      <main className="max-w-6xl mx-auto px-4 py-6 grid grid-cols-1 lg:grid-cols-[1fr_370px] gap-5">

        {/* ════════ LEFT: Upload / Progress ════════ */}
        <div className="space-y-4">

          {isIdle || !hasJob ? (
            <>
              {/* Upload card */}
              <Card>
                {/* Tab bar */}
                <div className="flex border-b border-[#1a2640] -mx-4 -mt-4 mb-4 rounded-t-2xl overflow-hidden">
                  {["upload", "url"].map((t) => (
                    <button
                      key={t}
                      onClick={() => setTab(t as "upload" | "url")}
                      className={[
                        "flex-1 py-3 text-[11px] font-semibold tracking-wider uppercase flex items-center justify-center gap-2 transition-colors",
                        tab === t
                          ? "bg-[#1a2640] text-white"
                          : "text-gray-500 hover:text-gray-300",
                      ].join(" ")}
                    >
                      {t === "upload" ? "↑ Upload File" : "♪ TikTok URL"}
                    </button>
                  ))}
                </div>

                {/* Dropzone */}
                <div
                  onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={onDrop}
                  onClick={() => fileRef.current?.click()}
                  className={[
                    "border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all duration-200 select-none",
                    isDragging   ? "border-amber-400 bg-amber-400/5 scale-[1.01]" :
                    videoFile    ? "border-green-500/60 bg-green-500/5" :
                    "border-[#1e3055] hover:border-amber-400/50 hover:bg-[#0e1830]",
                  ].join(" ")}
                >
                  <input
                    ref={fileRef}
                    type="file"
                    accept=".mp4,.mov,.webm,.avi,.mkv"
                    className="hidden"
                    onChange={(e) => e.target.files?.[0] && setVideoFile(e.target.files[0])}
                  />
                  {videoFile ? (
                    <div className="space-y-2">
                      <div className="text-4xl">✅</div>
                      <p className="text-sm font-semibold text-green-400 truncate max-w-xs mx-auto">
                        {videoFile.name}
                      </p>
                      <p className="text-xs text-gray-500">
                        {(videoFile.size / 1024 / 1024).toFixed(1)} MB
                      </p>
                      <button
                        onClick={(e) => { e.stopPropagation(); setVideoFile(null); }}
                        className="text-[11px] text-red-400 hover:text-red-300 underline underline-offset-2"
                      >
                        Remove
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="text-5xl opacity-30 mb-3">⬆</div>
                      <p className="text-sm font-semibold">Drop your video here or click to browse</p>
                      <p className="text-xs text-gray-500">MP4 · MOV · WebM · AVI · up to 512 MB</p>
                    </div>
                  )}
                </div>
              </Card>

              {/* Workflow */}
              <Card>
                <SectionTitle icon="⬡" title="Workflow" />
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {WORKFLOWS.map((wf) => (
                    <button
                      key={wf.id}
                      onClick={() => set("workflow", wf.id as DubSettings["workflow"])}
                      className={[
                        "rounded-xl border p-3 text-left transition-all duration-150 focus:outline-none",
                        settings.workflow === wf.id
                          ? "border-amber-400 bg-amber-400/10 shadow-[0_0_18px_rgba(245,158,11,0.12)]"
                          : "border-[#1e3055] hover:border-amber-400/40",
                      ].join(" ")}
                    >
                      <div className="text-2xl mb-1.5">{wf.icon}</div>
                      <div className="text-xs font-bold text-white">{wf.name}</div>
                      <div className="text-[10px] text-gray-500 mt-0.5">{wf.desc}</div>
                    </button>
                  ))}
                </div>
              </Card>

              {/* API Keys */}
              <Card>
                <SectionTitle icon="🔑" title="API Keys" />
                <div className="space-y-4">
                  <ApiKeyInput
                    label="Groq API Key — Transcription"
                    value={settings.groqApiKey}
                    onChange={(v) => set("groqApiKey", v)}
                    placeholder="gsk_xxxxxxxxxxxx"
                    hint={<>Free tier: 7,200 audio sec/hr · <a href="https://console.groq.com" target="_blank" rel="noreferrer" className="text-amber-400/70 hover:text-amber-400 underline">console.groq.com</a></>}
                  />
                  <ApiKeyInput
                    label="Gemini API Key — Translation"
                    value={settings.geminiApiKey}
                    onChange={(v) => set("geminiApiKey", v)}
                    placeholder="AIzaSyxxxxxxxxxxxxxx"
                    hint={<>Free tier: 1,500 req/day · <a href="https://aistudio.google.com" target="_blank" rel="noreferrer" className="text-amber-400/70 hover:text-amber-400 underline">aistudio.google.com</a></>}
                  />
                  {settings.workflow !== "subtitles" && (
                    <ApiKeyInput
                      label="ElevenLabs API Key — Voiceover"
                      value={settings.elevenLabsKey}
                      onChange={(v) => set("elevenLabsKey", v)}
                      placeholder="sk_xxxxxxxxxxxxxxxx"
                      hint={<>Free tier: 10,000 chars/mo · <a href="https://elevenlabs.io" target="_blank" rel="noreferrer" className="text-amber-400/70 hover:text-amber-400 underline">elevenlabs.io</a></>}
                    />
                  )}
                </div>
              </Card>

              {/* Start button */}
              <button
                onClick={handleStart}
                disabled={!videoFile || !settings.groqApiKey || !settings.geminiApiKey}
                className={[
                  "w-full py-4 rounded-2xl font-bold text-sm tracking-[0.2em] uppercase transition-all duration-200",
                  videoFile && settings.groqApiKey && settings.geminiApiKey
                    ? "bg-amber-500 hover:bg-amber-400 text-black shadow-[0_4px_30px_rgba(245,158,11,0.3)] hover:shadow-[0_4px_40px_rgba(245,158,11,0.5)] hover:scale-[1.01]"
                    : "bg-[#0d1828] border border-[#1e3055] text-gray-600 cursor-not-allowed",
                ].join(" ")}
              >
                ▶ Start Myanmar Dubbing
              </button>
            </>
          ) : (
            /* ── Progress Panel ── */
            <Card>
              {/* Header */}
              <div className="flex items-start justify-between mb-5">
                <div>
                  <h2 className="font-bold text-sm tracking-wide">
                    {isCompleted ? "✅ Processing Complete" :
                     isFailed    ? "❌ Pipeline Failed"    :
                                   "⚙ Processing Video…"}
                  </h2>
                  <p className="text-[10px] text-gray-600 mt-1">
                    {videoFile?.name ?? ""}
                  </p>
                </div>
                {(isCompleted || isFailed) && (
                  <button
                    onClick={handleReset}
                    className="text-[11px] text-amber-400 hover:text-amber-300 border border-amber-400/30 px-3 py-1.5 rounded-lg transition-colors tracking-wider"
                  >
                    ↺ New Job
                  </button>
                )}
              </div>

              {/* Progress bar */}
              <div className="mb-5">
                <div className="flex justify-between text-[11px] text-gray-500 mb-1.5">
                  <span className="truncate max-w-[75%]">{state.message}</span>
                  <span className="font-bold text-white ml-2 shrink-0">{state.progress}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-[#1a2640] overflow-hidden">
                  <div
                    className="h-full rounded-full progress-fill"
                    style={{
                      width:     `${state.progress}%`,
                      background: isCompleted ? "#22c55e" :
                                  isFailed    ? "#ef4444" :
                                  "linear-gradient(90deg, #d97706, #f59e0b)",
                      boxShadow: isCompleted ? "0 0 8px rgba(34,197,94,0.5)" :
                                 isFailed    ? "0 0 8px rgba(239,68,68,0.5)" :
                                 "0 0 10px rgba(245,158,11,0.5)",
                    }}
                  />
                </div>
              </div>

              {/* Steps */}
              <div className="space-y-1.5 mb-4">
                {PIPELINE_STEPS.map((step, idx) => {
                  const done    = isCompleted || (currentStepIdx > idx && currentStepIdx >= 0);
                  const current = state.step === step.id && !isCompleted;
                  const pending = !done && !current;

                  return (
                    <div
                      key={step.id}
                      className={[
                        "flex items-center gap-3 px-3 py-2 rounded-lg transition-all",
                        current ? "bg-amber-400/8 border border-amber-400/20" : "",
                        pending ? "opacity-25" : "",
                      ].join(" ")}
                    >
                      <div className={[
                        "w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0",
                        done    ? "bg-green-500 text-white" :
                        current ? "bg-amber-500 text-black pulse-amber" :
                        "bg-[#1e3055] text-gray-600",
                      ].join(" ")}>
                        {done ? "✓" : current ? "●" : "○"}
                      </div>
                      <span className="text-xs">{step.icon}</span>
                      <span className={`text-sm flex-1 ${done ? "line-through opacity-50" : ""}`}>
                        {step.label}
                      </span>
                      {current && <span className="text-[10px] text-amber-400 font-bold animate-pulse shrink-0">RUNNING</span>}
                      {done && !isCompleted && <span className="text-[10px] text-green-500 shrink-0">DONE</span>}
                    </div>
                  );
                })}
              </div>

              {/* Segment preview */}
              {state.segments.length > 0 && (
                <div className="mt-4 border-t border-[#1a2640] pt-4">
                  <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-2">
                    Segments ({state.segments.length})
                  </p>
                  <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1">
                    {state.segments.slice(0, 20).map((seg) => (
                      <div key={seg.id} className="text-[11px] leading-relaxed">
                        <span className="text-amber-400/60">
                          [{seg.start.toFixed(1)}s–{seg.end.toFixed(1)}s]
                        </span>
                        {seg.translated_text && (
                          <span className="text-white ml-2">{seg.translated_text}</span>
                        )}
                        {!seg.translated_text && (
                          <span className="text-gray-400 ml-2">{seg.text}</span>
                        )}
                      </div>
                    ))}
                    {state.segments.length > 20 && (
                      <p className="text-[10px] text-gray-600">
                        … {state.segments.length - 20} more segments
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Downloads */}
              {isCompleted && state.outputUrl && (
                <div className="mt-5 space-y-2 border-t border-[#1a2640] pt-5">
                  <button
                    onClick={() => downloadBlob(state.outputUrl!, "myanmar_dubbed.mp4")}
                    className="flex items-center justify-center gap-2 w-full py-3 bg-green-600 hover:bg-green-500 rounded-xl text-sm font-bold tracking-wide transition-all hover:shadow-[0_0_20px_rgba(34,197,94,0.3)]"
                  >
                    ↓ Download Dubbed Video (.mp4)
                  </button>
                  {state.srtContent && (
                    <button
                      onClick={() => downloadSRT(state.srtContent!, "myanmar_subtitles.srt")}
                      className="flex items-center justify-center gap-2 w-full py-3 border border-amber-400/40 hover:border-amber-400 rounded-xl text-sm font-medium text-amber-400 hover:text-amber-300 transition-all"
                    >
                      ↓ Download Subtitles (.srt)
                    </button>
                  )}
                </div>
              )}

              {/* Error */}
              {isFailed && (
                <div className="mt-4 rounded-xl border border-red-500/40 bg-red-900/20 p-3 text-xs text-red-300 leading-relaxed">
                  <span className="font-bold text-red-400 block mb-1">Error:</span>
                  {state.error ?? state.message}
                </div>
              )}
            </Card>
          )}
        </div>

        {/* ════════ RIGHT: Settings ════════ */}
        <div className="space-y-4">

          {/* Voice */}
          <Card>
            <SectionTitle icon="⊕" title="Output & Voice" />

            {/* Language — fixed */}
            <div className="mb-3">
              <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-1.5">Language</p>
              <div className="flex items-center justify-between bg-[#0d1828] border border-[#1e3055] rounded-lg px-3 py-2">
                <span className="text-sm">မြ မြန်မာ (Myanmar / Burmese)</span>
                <Pill color="amber">Default</Pill>
              </div>
            </div>

            {/* ElevenLabs Voice */}
            {settings.workflow !== "subtitles" && (
              <div className="mb-3">
                <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-1.5">ElevenLabs Voice</p>
                <div className="space-y-1.5 max-h-56 overflow-y-auto pr-0.5">
                  {ELEVENLABS_VOICES.map((v) => (
                    <SelectOption
                      key={v.id}
                      selected={settings.voiceId === v.id}
                      onClick={() => set("voiceId", v.id)}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-sm font-semibold">{v.name}</span>
                          <span className="text-[11px] text-gray-500 ml-2">{v.style}</span>
                        </div>
                        {settings.voiceId === v.id && <span className="text-amber-400 text-xs">✓</span>}
                      </div>
                    </SelectOption>
                  ))}
                </div>
                <p className="text-[10px] text-gray-600 mt-2 leading-relaxed">
                  💡 For best Burmese quality, create a Voice Clone with native Myanmar speaker audio in your ElevenLabs dashboard.
                </p>
              </div>
            )}

            {/* TTS Model */}
            {settings.workflow !== "subtitles" && (
              <div>
                <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-1.5">TTS Model</p>
                <div className="space-y-1.5">
                  {ELEVENLABS_MODELS.map((m) => (
                    <SelectOption
                      key={m.id}
                      selected={settings.ttsModel === m.id}
                      onClick={() => set("ttsModel", m.id)}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-sm font-semibold">{m.name}</span>
                          <p className="text-[11px] text-gray-500 mt-0.5">{m.desc}</p>
                        </div>
                        {settings.ttsModel === m.id && <span className="text-amber-400 text-xs">✓</span>}
                      </div>
                    </SelectOption>
                  ))}
                </div>
              </div>
            )}
          </Card>

          {/* AI Models */}
          <Card>
            <button
              onClick={() => setShowModels(!showModels)}
              className="w-full flex items-center justify-between focus:outline-none"
            >
              <SectionTitle icon="⚙" title="AI Models" right={null} />
              <div className="flex items-center gap-2 -mt-3">
                <Pill color="gray">Optional</Pill>
                <span className="text-gray-500 text-xs">{showModels ? "∧" : "∨"}</span>
              </div>
            </button>

            {showModels && (
              <div className="mt-2 space-y-4">
                {/* Transcription */}
                <div>
                  <p className="text-[10px] text-amber-400/70 uppercase tracking-widest mb-1.5">
                    Transcription (Groq Whisper)
                  </p>
                  <div className="space-y-1.5">
                    {WHISPER_MODELS.map((m) => (
                      <SelectOption
                        key={m.id}
                        selected={settings.whisperModel === m.id}
                        onClick={() => set("whisperModel", m.id)}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="text-sm font-semibold">{m.name}</span>
                            <span className="ml-2"><Pill color="green">{m.badge}</Pill></span>
                            <p className="text-[11px] text-gray-500 mt-0.5">{m.desc}</p>
                          </div>
                          {settings.whisperModel === m.id && <span className="text-amber-400 text-xs">✓</span>}
                        </div>
                      </SelectOption>
                    ))}
                  </div>
                </div>

                {/* Translation */}
                <div>
                  <p className="text-[10px] text-amber-400/70 uppercase tracking-widest mb-1.5">
                    Translation (Gemini)
                  </p>
                  <div className="rounded-xl border border-[#1e3055] bg-[#0d1828] px-3 py-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold">Gemini 2.0 Flash</span>
                      <Pill color="green">Free</Pill>
                    </div>
                    <p className="text-[11px] text-gray-500 mt-0.5">
                      Latest Flash model — fast, accurate Burmese translation
                    </p>
                  </div>
                </div>
              </div>
            )}
          </Card>

          {/* Subtitle Style */}
          <Card>
            <SectionTitle icon="💬" title="Subtitle Style" />

            <select
              value={settings.subtitleStyle}
              onChange={(e) => set("subtitleStyle", e.target.value)}
              className="w-full bg-[#0d1828] border border-[#1e3055] rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-amber-400/60 transition-colors mb-3 font-mono"
            >
              <option value="outline_black">Outline Black (default)</option>
              <option value="outline_white">Outline White</option>
              <option value="drop_shadow">Drop Shadow</option>
              <option value="plain">Plain Text</option>
            </select>

            <div>
              <div className="flex justify-between text-[11px] text-gray-500 mb-2">
                <span>Font size</span>
                <span className="text-white font-bold">{settings.fontSize}px</span>
              </div>
              <input
                type="range" min="20" max="72" step="2"
                value={settings.fontSize}
                onChange={(e) => set("fontSize", Number(e.target.value))}
                className="w-full"
              />
              <div className="flex justify-between text-[10px] text-gray-600 mt-1">
                <span>20 compact</span>
                <span>44 default</span>
                <span>72 large</span>
              </div>
            </div>
          </Card>

          {/* How it works */}
          <Card>
            <SectionTitle icon="📋" title="Pipeline" />
            <div className="space-y-2.5">
              {[
                { step: "01", label: "Extract Audio",     tool: "ffmpeg.wasm",     color: "blue"  },
                { step: "02", label: "Transcribe Speech", tool: "Groq Whisper",    color: "green" },
                { step: "03", label: "Translate Text",    tool: "Gemini 2.0 Flash",color: "amber" },
                { step: "04", label: "Generate Voice",    tool: "ElevenLabs TTS",  color: "amber" },
                { step: "05", label: "Assemble Video",    tool: "ffmpeg.wasm",     color: "blue"  },
                { step: "06", label: "Export + SRT",      tool: "Browser",         color: "green" },
              ].map(({ step, label, tool, color }) => (
                <div key={step} className="flex items-center gap-3">
                  <span className="text-[10px] text-gray-600 w-5 shrink-0">{step}</span>
                  <div className="w-px h-5 bg-[#1e3055]" />
                  <span className="text-xs text-gray-300 flex-1">{label}</span>
                  <Pill color={color as "amber" | "green" | "blue" | "gray"}>{tool}</Pill>
                </div>
              ))}
            </div>
            <p className="text-[10px] text-gray-600 mt-3 leading-relaxed">
              ✦ All video I/O runs in your browser via WebAssembly — no video data is sent to any server except audio for transcription.
            </p>
          </Card>

        </div>
      </main>

      {/* ── Footer ─────────────────────────────────────────────────────────── */}
      <footer className="border-t border-[#1a2640] px-5 py-4 text-center mt-4">
        <p className="text-[10px] text-gray-700 tracking-[0.2em] uppercase">
          Myanmar Video Dubber · Open Source · MIT License
        </p>
      </footer>
    </div>
  );
}
