"use client";

import { useState, useRef, useCallback } from "react";
import type { DubSettings, PipelineStep } from "@/lib/types";
import { useDubPipeline } from "@/hooks/useDubPipeline";
import { buildSRT, downloadBlob, downloadSRT } from "@/lib/srt";

// ─── Static data ──────────────────────────────────────────────────────────────

const VOICES = [
  { id: "21m00Tcm4TlvDq8ikWAM", name: "Rachel",  desc: "Calm, warm"          },
  { id: "pNInz6obpgDQGcFmaJgB", name: "Adam",    desc: "Deep, authoritative" },
  { id: "ErXwobaYiN019PkySvjV", name: "Antoni",  desc: "Well-rounded"        },
  { id: "29vD33N1lfxlmkjXQ9yp", name: "Drew",    desc: "Conversational"      },
  { id: "D38z5RcWu1voky8WS1ja", name: "Fin",     desc: "Smooth, engaging"    },
  { id: "EXAVITQu4vr4xnSDxMaL", name: "Sarah",   desc: "Gentle, clear"       },
];

const TTS_MODELS = [
  { id: "eleven_multilingual_v2", name: "Multilingual v2", desc: "Best for Burmese — recommended" },
  { id: "eleven_turbo_v2_5",      name: "Turbo v2.5",      desc: "Faster, slightly lower quality"  },
  { id: "eleven_flash_v2_5",      name: "Flash v2.5",      desc: "Fastest — ultra-low latency"     },
];

const WHISPER_MODELS = [
  { id: "whisper-large-v3-turbo", name: "Whisper Large v3 Turbo", desc: "Fastest · best value", free: true },
  { id: "whisper-large-v3",       name: "Whisper Large v3",       desc: "Highest accuracy",      free: true },
];

const WORKFLOWS = [
  { id: "video_dub",    icon: "🎙", name: "Video Dub",    desc: "Voice + Subtitles" },
  { id: "storytelling", icon: "✨", name: "Storytelling", desc: "Recap Narrator"    },
  { id: "audio_dub",    icon: "🔊", name: "Audio Dub",    desc: "Voice only"        },
  { id: "subtitles",    icon: "💬", name: "Subtitles",    desc: "Subs only"         },
];

const STEPS: { id: PipelineStep; label: string }[] = [
  { id: "loading_ffmpeg",   label: "Loading ffmpeg.wasm"       },
  { id: "extracting_audio", label: "Extracting audio"          },
  { id: "transcribing",     label: "Groq Whisper transcription"},
  { id: "translating",      label: "Gemini 2.0 Flash translate"},
  { id: "generating_tts",   label: "ElevenLabs voice synthesis"},
  { id: "assembling",       label: "Video assembly"            },
  { id: "completed",        label: "Complete"                  },
];

const DEFAULTS: DubSettings = {
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

// ─── Tiny primitives ─────────────────────────────────────────────────────────

function Chip({ color, children }: { color: "amber"|"green"|"blue"|"gray"; children: React.ReactNode }) {
  const map = {
    amber: "bg-amber-400/10 text-amber-400 border-amber-400/25",
    green: "bg-green-500/10 text-green-400 border-green-500/25",
    blue:  "bg-blue-500/10  text-blue-400  border-blue-500/25",
    gray:  "bg-white/5      text-gray-400  border-white/10",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[10px] font-semibold tracking-wide ${map[color]}`}>
      {children}
    </span>
  );
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-white/[0.07] bg-white/[0.03] backdrop-blur-sm p-4 ${className}`}>
      {children}
    </div>
  );
}

function SectionHead({ icon, title, aside }: { icon: string; title: string; aside?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.15em] text-amber-400">
        <span>{icon}</span>{title}
      </p>
      {aside}
    </div>
  );
}

function Opt({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left rounded-xl border px-3 py-2.5 text-sm transition-all duration-150 focus:outline-none ${
        on
          ? "border-amber-400/70 bg-amber-400/[0.08] shadow-[0_0_16px_rgba(251,191,36,0.1)]"
          : "border-white/[0.07] hover:border-amber-400/30 hover:bg-white/[0.04]"
      }`}
    >
      {children}
    </button>
  );
}

function SecretInput({
  label, placeholder, hint, value, onChange,
}: {
  label: string; placeholder: string; hint: React.ReactNode;
  value: string; onChange: (v: string) => void;
}) {
  const [show, setShow] = useState(false);
  return (
    <div>
      <p className="text-[10px] uppercase tracking-widest text-gray-500 mb-1.5">{label}</p>
      <div className="relative">
        <input
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          spellCheck={false}
          autoComplete="off"
          className="w-full bg-black/30 border border-white/[0.08] rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-amber-400/50 pr-14 font-mono transition-colors"
        />
        <button
          type="button"
          onClick={() => setShow(!show)}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-gray-500 hover:text-amber-400 font-semibold tracking-widest transition-colors"
        >
          {show ? "HIDE" : "SHOW"}
        </button>
      </div>
      <p className="text-[11px] text-gray-600 mt-1.5 leading-relaxed">{hint}</p>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function Home() {
  const [file, setFile]           = useState<File | null>(null);
  const [dragging, setDragging]   = useState(false);
  const [cfg, setCfg]             = useState<DubSettings>(DEFAULTS);
  const [showModels, setModels]   = useState(false);
  const fileRef                   = useRef<HTMLInputElement>(null);

  const { state, run, reset } = useDubPipeline();

  const set = <K extends keyof DubSettings>(k: K, v: DubSettings[K]) =>
    setCfg((c) => ({ ...c, [k]: v }));

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) setFile(f);
  }, []);

  const canStart = !!file && !!cfg.groqApiKey && !!cfg.geminiApiKey &&
    (cfg.workflow === "subtitles" || !!cfg.elevenLabsKey);

  const handleStart = async () => {
    if (!canStart) return;
    await run(file!, cfg);
  };

  const handleReset = () => { setFile(null); reset(); };

  const isIdle      = state.step === "idle";
  const isRunning   = !["idle","completed","error"].includes(state.step);
  const isDone      = state.step === "completed";
  const isFailed    = state.step === "error";
  const hasJob      = !isIdle;
  const curIdx      = STEPS.findIndex((s) => s.id === state.step);

  return (
    <div className="min-h-screen bg-[#06090f] text-white font-mono">

      {/* Grid overlay */}
      <div className="fixed inset-0 pointer-events-none opacity-[0.025]"
        style={{ backgroundImage:"linear-gradient(#4f8ef7 1px,transparent 1px),linear-gradient(90deg,#4f8ef7 1px,transparent 1px)", backgroundSize:"44px 44px" }} />

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 border-b border-white/[0.07] bg-[#06090f]/95 backdrop-blur px-5 py-3.5">
        <div className="max-w-6xl mx-auto flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center text-black font-black text-sm bg-gradient-to-br from-amber-400 to-orange-500 select-none shrink-0">မြ</div>
          <div>
            <h1 className="text-[11px] font-bold tracking-[0.22em] uppercase text-white">Myanmar Video Dubber</h1>
            <p className="text-[10px] text-gray-600 tracking-wider mt-0.5">Groq · Gemini 2.0 · ElevenLabs · ffmpeg.wasm</p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Chip color="green">FREE TIER</Chip>
            <Chip color="blue">VERCEL</Chip>
            <a href="https://github.com" target="_blank" rel="noreferrer"
               className="text-[11px] text-gray-500 hover:text-amber-400 transition-colors tracking-wider ml-1">GitHub ↗</a>
          </div>
        </div>
      </header>

      {/* ── Body ───────────────────────────────────────────────────────────── */}
      <main className="relative max-w-6xl mx-auto px-4 py-6 grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-5">

        {/* ══ LEFT ══ */}
        <div className="space-y-4">

          {/* ─ Upload / Progress toggle ─ */}
          {!hasJob ? (
            <>
              {/* Upload card */}
              <Card>
                <div className="flex -mx-4 -mt-4 mb-4 border-b border-white/[0.07] rounded-t-2xl overflow-hidden">
                  {["Upload File","TikTok URL"].map((t,i) => (
                    <div key={t} className={`flex-1 py-3 text-[11px] font-semibold tracking-widest uppercase flex items-center justify-center gap-2 ${i===0?"bg-white/[0.05] text-white border-r border-white/[0.07]":"text-gray-600"}`}>
                      {i===0?"↑":""} {t}
                    </div>
                  ))}
                </div>

                {/* Drop zone */}
                <div
                  onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={onDrop}
                  onClick={() => fileRef.current?.click()}
                  className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer select-none transition-all duration-200 ${
                    dragging ? "border-amber-400 bg-amber-400/5 scale-[1.01]"
                    : file   ? "border-green-500/50 bg-green-500/[0.04]"
                             : "border-white/[0.1] hover:border-amber-400/40 hover:bg-white/[0.03]"
                  }`}
                >
                  <input ref={fileRef} type="file" accept=".mp4,.mov,.webm,.avi,.mkv" className="hidden"
                    onChange={(e) => e.target.files?.[0] && setFile(e.target.files[0])} />
                  {file ? (
                    <div className="space-y-1.5">
                      <div className="text-4xl">✅</div>
                      <p className="text-sm font-semibold text-green-400 truncate max-w-xs mx-auto">{file.name}</p>
                      <p className="text-xs text-gray-500">{(file.size/1024/1024).toFixed(1)} MB</p>
                      <button onClick={(e) => { e.stopPropagation(); setFile(null); }}
                        className="text-[11px] text-red-400 hover:text-red-300 underline underline-offset-2">Remove</button>
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      <div className="text-5xl opacity-20 mb-3">⬆</div>
                      <p className="text-sm font-semibold">Drop your video here or click to browse</p>
                      <p className="text-xs text-gray-500">MP4 · MOV · WebM · AVI — up to 512 MB</p>
                    </div>
                  )}
                </div>
              </Card>

              {/* Workflow */}
              <Card>
                <SectionHead icon="⬡" title="Workflow" />
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {WORKFLOWS.map((w) => (
                    <button key={w.id} onClick={() => set("workflow", w.id as DubSettings["workflow"])}
                      className={`rounded-xl border p-3 text-left transition-all focus:outline-none ${
                        cfg.workflow===w.id ? "border-amber-400/70 bg-amber-400/[0.08] shadow-[0_0_18px_rgba(251,191,36,0.1)]"
                                            : "border-white/[0.07] hover:border-amber-400/30"}`}>
                      <div className="text-2xl mb-1.5">{w.icon}</div>
                      <div className="text-xs font-bold">{w.name}</div>
                      <div className="text-[10px] text-gray-500 mt-0.5">{w.desc}</div>
                    </button>
                  ))}
                </div>
              </Card>

              {/* API Keys */}
              <Card>
                <SectionHead icon="🔑" title="API Keys" />
                <div className="space-y-4">
                  <SecretInput
                    label="Groq API Key — Transcription"
                    placeholder="gsk_xxxxxxxxxxxxxxxxxxxx"
                    hint={<>Free · 7,200 audio sec/hr · <a href="https://console.groq.com" target="_blank" rel="noreferrer" className="text-amber-400/70 hover:text-amber-400 underline">console.groq.com</a></>}
                    value={cfg.groqApiKey} onChange={(v) => set("groqApiKey",v)} />
                  <SecretInput
                    label="Gemini API Key — Translation"
                    placeholder="AIzaSyxxxxxxxxxxxxxxx"
                    hint={<>Free · 1,500 req/day · <a href="https://aistudio.google.com" target="_blank" rel="noreferrer" className="text-amber-400/70 hover:text-amber-400 underline">aistudio.google.com</a></>}
                    value={cfg.geminiApiKey} onChange={(v) => set("geminiApiKey",v)} />
                  {cfg.workflow !== "subtitles" && (
                    <SecretInput
                      label="ElevenLabs API Key — Voiceover"
                      placeholder="sk_xxxxxxxxxxxxxxxxxxxxxxxx"
                      hint={<>Free · 10,000 chars/month · <a href="https://elevenlabs.io" target="_blank" rel="noreferrer" className="text-amber-400/70 hover:text-amber-400 underline">elevenlabs.io</a></>}
                      value={cfg.elevenLabsKey} onChange={(v) => set("elevenLabsKey",v)} />
                  )}
                </div>
              </Card>

              {/* Submit */}
              <button onClick={handleStart} disabled={!canStart}
                className={`w-full py-4 rounded-2xl text-sm font-bold tracking-[0.2em] uppercase transition-all duration-200 ${
                  canStart
                    ? "bg-amber-500 hover:bg-amber-400 text-black shadow-[0_4px_32px_rgba(251,191,36,0.28)] hover:shadow-[0_4px_40px_rgba(251,191,36,0.45)] hover:scale-[1.01]"
                    : "bg-white/[0.04] border border-white/[0.07] text-gray-600 cursor-not-allowed"}`}>
                ▶ Start Myanmar Dubbing
              </button>
            </>
          ) : (
            /* ─ Progress panel ─ */
            <Card>
              <div className="flex items-start justify-between mb-5">
                <div>
                  <h2 className="text-sm font-bold tracking-wide">
                    {isDone?"✅ Complete" : isFailed?"❌ Failed" : "⚙ Processing…"}
                  </h2>
                  <p className="text-[10px] text-gray-600 mt-1 truncate max-w-xs">{file?.name}</p>
                </div>
                {(isDone||isFailed) && (
                  <button onClick={handleReset}
                    className="text-[11px] text-amber-400 hover:text-amber-300 border border-amber-400/25 px-3 py-1.5 rounded-lg transition-colors tracking-wider">
                    ↺ New job
                  </button>
                )}
              </div>

              {/* Bar */}
              <div className="mb-5">
                <div className="flex justify-between text-[11px] text-gray-500 mb-1.5">
                  <span className="truncate max-w-[74%]">{state.message}</span>
                  <span className="font-bold text-white ml-2 shrink-0">{state.progress}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-700"
                    style={{
                      width:`${state.progress}%`,
                      background: isDone?"#22c55e" : isFailed?"#ef4444" : "linear-gradient(90deg,#d97706,#f59e0b)",
                      boxShadow: isDone?"0 0 8px rgba(34,197,94,.5)" : isFailed?"0 0 8px rgba(239,68,68,.5)" : "0 0 10px rgba(251,191,36,.5)",
                    }} />
                </div>
              </div>

              {/* Steps */}
              <div className="space-y-1 mb-4">
                {STEPS.map((s, i) => {
                  const done = isDone || (curIdx > i && curIdx >= 0);
                  const cur  = state.step === s.id && !isDone;
                  return (
                    <div key={s.id} className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-all ${cur?"bg-amber-400/[0.06] border border-amber-400/15":""} ${(!done&&!cur)?"opacity-25":""}`}>
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                        done?"bg-green-500 text-white" : cur?"bg-amber-500 text-black animate-pulse" : "bg-white/[0.06] text-gray-600"}`}>
                        {done?"✓":cur?"●":"○"}
                      </div>
                      <span className={`text-xs flex-1 ${done?"line-through opacity-40":""}`}>{s.label}</span>
                      {cur  && <span className="text-[10px] text-amber-400 font-bold animate-pulse shrink-0">RUNNING</span>}
                      {done && !isDone && <span className="text-[10px] text-green-500 shrink-0">DONE</span>}
                    </div>
                  );
                })}
              </div>

              {/* Segment preview */}
              {state.segments.length > 0 && (
                <div className="border-t border-white/[0.06] pt-4">
                  <p className="text-[10px] uppercase tracking-widest text-gray-500 mb-2">
                    Segments ({state.segments.length})
                  </p>
                  <div className="max-h-36 overflow-y-auto space-y-1 pr-1">
                    {state.segments.slice(0,15).map((seg) => (
                      <div key={seg.id} className="text-[11px] leading-relaxed">
                        <span className="text-amber-400/50">[{seg.start.toFixed(1)}s–{seg.end.toFixed(1)}s]</span>
                        <span className="ml-2 text-gray-300">{seg.translated_text ?? seg.text}</span>
                      </div>
                    ))}
                    {state.segments.length > 15 && (
                      <p className="text-[10px] text-gray-600">… {state.segments.length-15} more</p>
                    )}
                  </div>
                </div>
              )}

              {/* Downloads */}
              {isDone && state.outputUrl && (
                <div className="mt-5 space-y-2 border-t border-white/[0.06] pt-5">
                  <button onClick={() => downloadBlob(state.outputUrl!, "myanmar_dubbed.mp4")}
                    className="flex items-center justify-center gap-2 w-full py-3 bg-green-600 hover:bg-green-500 rounded-xl text-sm font-bold tracking-wide transition-all hover:shadow-[0_0_20px_rgba(34,197,94,.25)]">
                    ↓ Download Dubbed Video (.mp4)
                  </button>
                  {state.srtContent && (
                    <button onClick={() => downloadSRT(state.srtContent!)}
                      className="flex items-center justify-center gap-2 w-full py-3 border border-amber-400/30 hover:border-amber-400/60 rounded-xl text-sm font-medium text-amber-400 hover:text-amber-300 transition-all">
                      ↓ Download Subtitles (.srt)
                    </button>
                  )}
                </div>
              )}

              {/* Error */}
              {isFailed && (
                <div className="mt-4 rounded-xl border border-red-500/30 bg-red-900/10 p-3 text-xs text-red-300 leading-relaxed">
                  <span className="text-red-400 font-bold block mb-1">Error</span>
                  {state.error ?? state.message}
                </div>
              )}
            </Card>
          )}
        </div>

        {/* ══ RIGHT: Settings ══ */}
        <div className="space-y-4">

          {/* Output & Voice */}
          <Card>
            <SectionHead icon="⊕" title="Output & Voice" />

            {/* Language */}
            <div className="mb-3">
              <p className="text-[10px] uppercase tracking-widest text-gray-500 mb-1.5">Language</p>
              <div className="flex items-center justify-between bg-black/20 border border-white/[0.07] rounded-lg px-3 py-2.5">
                <span className="text-sm">မြ မြန်မာ (Myanmar / Burmese)</span>
                <Chip color="amber">Default</Chip>
              </div>
            </div>

            {/* ElevenLabs Voice */}
            {cfg.workflow !== "subtitles" && (
              <div className="mb-3">
                <p className="text-[10px] uppercase tracking-widest text-gray-500 mb-1.5">ElevenLabs Voice</p>
                <div className="space-y-1.5 max-h-52 overflow-y-auto pr-0.5">
                  {VOICES.map((v) => (
                    <Opt key={v.id} on={cfg.voiceId===v.id} onClick={() => set("voiceId",v.id)}>
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-white">{v.name}<span className="font-normal text-gray-500 ml-2 text-xs">{v.desc}</span></span>
                        {cfg.voiceId===v.id && <span className="text-amber-400 text-xs">✓</span>}
                      </div>
                    </Opt>
                  ))}
                </div>
                <p className="text-[10px] text-gray-600 mt-2 leading-relaxed">
                  💡 For best Burmese quality, create a Voice Clone in your ElevenLabs dashboard using native Myanmar speaker audio.
                </p>
              </div>
            )}

            {/* TTS Model */}
            {cfg.workflow !== "subtitles" && (
              <div>
                <p className="text-[10px] uppercase tracking-widest text-gray-500 mb-1.5">TTS Model</p>
                <div className="space-y-1.5">
                  {TTS_MODELS.map((m) => (
                    <Opt key={m.id} on={cfg.ttsModel===m.id} onClick={() => set("ttsModel",m.id)}>
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="font-semibold text-white text-sm">{m.name}</span>
                          <p className="text-[11px] text-gray-500 mt-0.5">{m.desc}</p>
                        </div>
                        {cfg.ttsModel===m.id && <span className="text-amber-400 text-xs">✓</span>}
                      </div>
                    </Opt>
                  ))}
                </div>
              </div>
            )}
          </Card>

          {/* AI Models */}
          <Card>
            <button onClick={() => setModels(!showModels)} className="w-full flex items-center justify-between focus:outline-none">
              <SectionHead icon="⚙" title="AI Models" />
              <div className="flex items-center gap-2 -mt-3">
                <Chip color="gray">Optional</Chip>
                <span className="text-gray-600 text-xs">{showModels?"∧":"∨"}</span>
              </div>
            </button>
            {showModels && (
              <div className="mt-2 space-y-4">
                <div>
                  <p className="text-[10px] text-amber-400/70 uppercase tracking-widest mb-1.5">Transcription (Groq)</p>
                  <div className="space-y-1.5">
                    {WHISPER_MODELS.map((m) => (
                      <Opt key={m.id} on={cfg.whisperModel===m.id} onClick={() => set("whisperModel",m.id)}>
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="font-semibold text-sm">{m.name}</span>
                            {m.free && <Chip color="green">Free</Chip>}
                            <p className="text-[11px] text-gray-500 mt-0.5">{m.desc}</p>
                          </div>
                          {cfg.whisperModel===m.id && <span className="text-amber-400 text-xs">✓</span>}
                        </div>
                      </Opt>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-[10px] text-amber-400/70 uppercase tracking-widest mb-1.5">Translation (Gemini)</p>
                  <div className="rounded-xl border border-white/[0.07] bg-black/20 px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold">Gemini 2.0 Flash</span>
                      <Chip color="green">Free</Chip>
                    </div>
                    <p className="text-[11px] text-gray-500 mt-0.5">Fast & accurate Burmese translation</p>
                  </div>
                </div>
                <div>
                  <p className="text-[10px] text-amber-400/70 uppercase tracking-widest mb-1.5">Video Assembly</p>
                  <div className="rounded-xl border border-white/[0.07] bg-black/20 px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold">ffmpeg.wasm</span>
                      <Chip color="blue">Browser</Chip>
                    </div>
                    <p className="text-[11px] text-gray-500 mt-0.5">Runs locally — video never leaves your device</p>
                  </div>
                </div>
              </div>
            )}
          </Card>

          {/* Subtitle style */}
          <Card>
            <SectionHead icon="💬" title="Subtitle Style" />
            <select value={cfg.subtitleStyle} onChange={(e) => set("subtitleStyle",e.target.value)}
              className="w-full bg-black/30 border border-white/[0.08] rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-amber-400/50 mb-3 font-mono transition-colors">
              <option value="outline_black">Outline Black (default)</option>
              <option value="outline_white">Outline White</option>
              <option value="drop_shadow">Drop Shadow</option>
              <option value="plain">Plain Text</option>
            </select>
            <div>
              <div className="flex justify-between text-[11px] text-gray-500 mb-2">
                <span>Font size</span>
                <span className="text-white font-bold">{cfg.fontSize}px</span>
              </div>
              <input type="range" min="20" max="72" step="2" value={cfg.fontSize}
                onChange={(e) => set("fontSize",Number(e.target.value))}
                className="w-full" style={{accentColor:"#f59e0b"}} />
              <div className="flex justify-between text-[10px] text-gray-600 mt-1.5">
                <span>20 compact</span><span>44 default</span><span>72 large</span>
              </div>
            </div>
          </Card>

          {/* Pipeline info */}
          <Card>
            <SectionHead icon="📋" title="Pipeline" />
            <div className="space-y-2.5">
              {[
                { n:"01", label:"Extract audio",    tool:"ffmpeg.wasm",      c:"blue"  },
                { n:"02", label:"Transcribe speech", tool:"Groq Whisper",     c:"green" },
                { n:"03", label:"Translate text",    tool:"Gemini 2.0 Flash", c:"amber" },
                { n:"04", label:"Generate voice",    tool:"ElevenLabs",       c:"amber" },
                { n:"05", label:"Assemble video",    tool:"ffmpeg.wasm",      c:"blue"  },
                { n:"06", label:"Export + SRT",      tool:"Browser",          c:"green" },
              ].map(({ n, label, tool, c }) => (
                <div key={n} className="flex items-center gap-3">
                  <span className="text-[10px] text-gray-600 w-5 shrink-0">{n}</span>
                  <div className="w-px h-4 bg-white/[0.08]" />
                  <span className="text-xs text-gray-300 flex-1">{label}</span>
                  <Chip color={c as "amber"|"green"|"blue"|"gray"}>{tool}</Chip>
                </div>
              ))}
            </div>
            <p className="text-[10px] text-gray-600 mt-3 leading-relaxed">
              ✦ Video data stays in your browser. Only audio is sent for transcription.
            </p>
          </Card>
        </div>
      </main>

      <footer className="border-t border-white/[0.05] px-5 py-4 text-center mt-4">
        <p className="text-[10px] text-gray-700 tracking-[0.22em] uppercase">
          Myanmar Video Dubber · MIT License · Vercel
        </p>
      </footer>
    </div>
  );
}
