"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import AudioPlayer from "@/components/AudioPlayer";
import { parseSrt, msToTs, type SrtSegment } from "@/components/SrtParser";

/* ── Constants ─────────────────────────────────────────────────────────── */
const STYLES = [
  { value: "normal",      label: "Normal",      desc: "Clear, natural delivery" },
  { value: "excited",     label: "Excited",     desc: "High energy, enthusiastic" },
  { value: "whispers",    label: "Whisper",      desc: "Quiet, intimate tone" },
  { value: "news-anchor", label: "News Anchor", desc: "Formal, authoritative" },
  { value: "calm",        label: "Calm",        desc: "Soft, peaceful, gentle" },
  { value: "cheerful",    label: "Cheerful",    desc: "Warm, bright, positive" },
  { value: "sad",         label: "Somber",      desc: "Melancholic, emotional" },
] as const;

const VOICES = [
  { value: "Kore",   note: "Female · Warm"      },
  { value: "Aoede",  note: "Female · Bright"    },
  { value: "Leda",   note: "Female · Smooth"    },
  { value: "Charon", note: "Male · Deep"        },
  { value: "Fenrir", note: "Male · Grounded"    },
  { value: "Orus",   note: "Male · Rich"        },
  { value: "Puck",   note: "Male · Expressive"  },
] as const;

const SAMPLES = [
  "မင်္ဂလာပါ၊ ဒီနေ့ ရာသီဥတုကောင်းနေပါတယ်။",
  "မြန်မာနိုင်ငံသည် အရှေ့တောင်အာရှတွင် တည်ရှိသောနိုင်ငံဖြစ်သည်။",
  "သင်တို့ကို ကြိုဆိုပါသည်။ ဤဝန်ဆောင်မှုသည် မြန်မာဘာသာကို အသံဖြင့် ပြောင်းပေးသည်။",
];

const SAMPLE_SRT = `1
00:00:01,000 --> 00:00:04,000
မင်္ဂလာပါ၊ ကျွန်တော်တို့ပြစာကို ကြည့်ရှုတဲ့အတွက် ကျေးဇူးတင်ပါတယ်။

2
00:00:05,000 --> 00:00:09,000
မြန်မာနိုင်ငံသည် အရှေ့တောင်အာရှတွင် တည်ရှိသောနိုင်ငံဖြစ်သည်။

3
00:00:10,500 --> 00:00:14,500
သင်တို့ကို ကြိုဆိုပါသည်။ ဤဝန်ဆောင်မှုသည် မြန်မာဘာသာကို အသံဖြင့် ပြောင်းပေးသည်။
`;

const LS_KEY = "mm_tts_api_key";

type Tab = "single" | "srt";

/* ── SVG icons ──────────────────────────────────────────────────────────── */
const EyeIcon = ({ off }: { off?: boolean }) =>
  off ? (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  ) : (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <path d="M1 12S5 4 12 4s11 8 11 8-4 8-11 8S1 12 1 12z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );

const CheckIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const KeyIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <circle cx="7.5" cy="15.5" r="5.5" />
    <path d="M21 2l-9.6 9.6" /><path d="M15.5 7.5l3 3L22 7l-3-3" />
  </svg>
);

const SoundIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M11 5L6 9H2v6h4l5 4V5z" />
    <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
    <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
  </svg>
);

const Spinner = () => (
  <svg className="animate-spin-slow" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
  </svg>
);

const FilmIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <rect x="2" y="2" width="20" height="20" rx="2.18" />
    <line x1="7" y1="2" x2="7" y2="22"/><line x1="17" y1="2" x2="17" y2="22"/>
    <line x1="2" y1="12" x2="22" y2="12"/><line x1="2" y1="7" x2="7" y2="7"/>
    <line x1="2" y1="17" x2="7" y2="17"/><line x1="17" y1="17" x2="22" y2="17"/>
    <line x1="17" y1="7" x2="22" y2="7"/>
  </svg>
);

const SubIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <rect x="2" y="4" width="20" height="16" rx="2"/>
    <path d="M7 15h4m4 0h2M7 11h2m4 0h6"/>
  </svg>
);

const Motif = () => (
  <svg width="110" height="110" viewBox="0 0 110 110" fill="none"
    className="absolute -top-5 -right-5 opacity-[0.06] pointer-events-none select-none" aria-hidden="true">
    <circle cx="55" cy="55" r="53" stroke="#d4960f" strokeWidth="1" />
    <circle cx="55" cy="55" r="39" stroke="#d4960f" strokeWidth="0.5" />
    <circle cx="55" cy="55" r="24" stroke="#d4960f" strokeWidth="1" />
    {[0,45,90,135,180,225,270,315].map(d => (
      <line key={d} x1="55" y1="55"
        x2={55 + 53 * Math.cos(d * Math.PI / 180)}
        y2={55 + 53 * Math.sin(d * Math.PI / 180)}
        stroke="#d4960f" strokeWidth="0.5" />
    ))}
  </svg>
);

/* ── Small progress display for SRT stitching ────────────────────────── */
function StitchProgress({ current, total, step }: { current: number; total: number; step: string }) {
  const pct = total > 0 ? Math.round((current / total) * 100) : 0;
  return (
    <div className="rounded-lg px-4 py-3 animate-fade-in" style={{
      background: "rgba(212,150,15,0.07)",
      border: "1px solid var(--border-dim)",
    }}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs uppercase tracking-widest" style={{ color: "var(--gold)" }}>
          Stitching Timeline
        </span>
        <span className="text-xs tabular-nums" style={{ color: "var(--text-muted)" }}>
          {current} / {total}
        </span>
      </div>
      <div className="w-full rounded-full h-1.5" style={{ background: "var(--border-dim)" }}>
        <div className="h-1.5 rounded-full transition-all duration-300" style={{
          width: `${pct}%`,
          background: "linear-gradient(90deg, var(--gold), #f5c842)",
        }} />
      </div>
      <p className="mt-2 text-xs truncate" style={{ color: "var(--text-faint)" }}>{step}</p>
    </div>
  );
}

/* ── Segment table ──────────────────────────────────────────────────────── */
function SegmentTable({ segments }: { segments: SrtSegment[] }) {
  if (segments.length === 0) return null;
  return (
    <div className="rounded-lg overflow-hidden" style={{ border: "1px solid var(--border-dim)" }}>
      <div className="px-3 py-2 text-xs uppercase tracking-widest flex items-center gap-2"
        style={{ background: "rgba(212,150,15,0.07)", color: "var(--gold)", borderBottom: "1px solid var(--border-dim)" }}>
        <SubIcon />
        {segments.length} subtitle segments parsed
      </div>
      <div style={{ maxHeight: "220px", overflowY: "auto" }}>
        {segments.map(seg => (
          <div key={seg.index} className="px-3 py-2 flex gap-3 items-start text-xs"
            style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
            <span className="tabular-nums flex-shrink-0 w-6 text-right"
              style={{ color: "var(--text-faint)" }}>{seg.index}</span>
            <span className="flex-shrink-0 tabular-nums"
              style={{ color: "var(--gold)", fontVariantNumeric: "tabular-nums" }}>
              {msToTs(seg.startMs)} → {msToTs(seg.endMs)}
            </span>
            <span style={{ color: "var(--parchment)", fontFamily: "Noto Sans Myanmar, serif" }}
              className="leading-relaxed">{seg.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Main Page ──────────────────────────────────────────────────────────── */
export default function HomePage() {
  const [tab, setTab] = useState<Tab>("single");

  /* ── API key state ── */
  const [apiKey,   setApiKey]   = useState("");
  const [showKey,  setShowKey]  = useState(false);
  const [keySaved, setKeySaved] = useState(false);

  /* ── Single-mode state ── */
  const [text,      setText]      = useState("");
  const [style,     setStyle]     = useState("normal");
  const [voice,     setVoice]     = useState("Kore");
  const [loading,   setLoading]   = useState(false);
  const [audioSrc,  setAudioSrc]  = useState<string | null>(null);
  const [error,     setError]     = useState<string | null>(null);
  const [charCount, setCharCount] = useState(0);

  /* ── SRT mode state ── */
  const [srtText,        setSrtText]        = useState("");
  const [segments,       setSegments]       = useState<SrtSegment[]>([]);
  const [srtError,       setSrtError]       = useState<string | null>(null);
  const [targetDurSec,   setTargetDurSec]   = useState<string>("");
  const [srtLoading,     setSrtLoading]     = useState(false);
  const [srtAudioSrc,    setSrtAudioSrc]    = useState<string | null>(null);
  const [srtGenError,    setSrtGenError]    = useState<string | null>(null);
  const [stitchProgress, setStitchProgress] = useState<{ current: number; total: number; step: string } | null>(null);
  const [srtStyle,       setSrtStyle]       = useState("normal");
  const [srtVoice,       setSrtVoice]       = useState("Kore");

  const singleBlobRef = useRef<string | null>(null);
  const srtBlobRef    = useRef<string | null>(null);

  /* Load saved key on mount */
  useEffect(() => {
    try {
      const saved = localStorage.getItem(LS_KEY);
      if (saved) { setApiKey(saved); setKeySaved(true); }
    } catch {}
  }, []);

  function saveKey() {
    const trimmed = apiKey.trim();
    if (!trimmed) return;
    try { localStorage.setItem(LS_KEY, trimmed); setKeySaved(true); } catch {}
  }

  function clearKey() {
    try { localStorage.removeItem(LS_KEY); } catch {}
    setApiKey(""); setKeySaved(false);
  }

  function handleKeyChange(v: string) {
    setApiKey(v);
    setKeySaved(false);
    if (error?.toLowerCase().includes("key")) setError(null);
  }

  function handleTextChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const v = e.target.value.slice(0, 4000);
    setText(v); setCharCount(v.length);
  }

  function useSample() {
    const s = SAMPLES[Math.floor(Math.random() * SAMPLES.length)];
    setText(s); setCharCount(s.length);
  }

  /* ── Single-mode generate ── */
  async function generate() {
    if (!text.trim()) return;
    setLoading(true); setError(null);
    if (singleBlobRef.current) { URL.revokeObjectURL(singleBlobRef.current); singleBlobRef.current = null; }
    setAudioSrc(null);

    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, style, voice, apiKey: apiKey.trim() }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }

      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      singleBlobRef.current = url;
      setAudioSrc(url);
      if (apiKey.trim() && !keySaved) saveKey();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Generation failed.");
    } finally {
      setLoading(false);
    }
  }

  /* ── SRT parse on change ── */
  const handleSrtChange = useCallback((v: string) => {
    setSrtText(v);
    setSrtError(null);
    setSrtAudioSrc(null);
    setSrtGenError(null);
    if (!v.trim()) { setSegments([]); return; }
    try {
      const parsed = parseSrt(v);
      if (parsed.length === 0) {
        setSrtError("No valid SRT blocks found. Check the format.");
        setSegments([]);
      } else if (parsed.length > 50) {
        setSrtError(`Too many segments (${parsed.length}). Maximum is 50.`);
        setSegments(parsed.slice(0, 50));
      } else {
        setSegments(parsed);
      }
    } catch {
      setSrtError("Failed to parse SRT. Verify the format.");
      setSegments([]);
    }
  }, []);

  function useSampleSrt() {
    handleSrtChange(SAMPLE_SRT);
    // Auto-set target duration from sample (15 seconds)
    setTargetDurSec("15");
  }

  /* ── SRT generate ── */
  async function generateSrt() {
    if (segments.length === 0) return;
    setSrtLoading(true); setSrtGenError(null); setStitchProgress(null);
    if (srtBlobRef.current) { URL.revokeObjectURL(srtBlobRef.current); srtBlobRef.current = null; }
    setSrtAudioSrc(null);

    try {
      const maxEndMs      = Math.max(...segments.map(s => s.endMs));
      const targetDurMs   = targetDurSec.trim()
        ? Math.max(Math.round(parseFloat(targetDurSec) * 1000), maxEndMs)
        : maxEndMs + 1000; // 1s tail by default

      setStitchProgress({ current: 0, total: segments.length, step: "Starting…" });

      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          segments,
          targetDurationMs: targetDurMs,
          style: srtStyle,
          voice: srtVoice,
          apiKey: apiKey.trim(),
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }

      const segCount = parseInt(res.headers.get("X-Segment-Count") ?? "0", 10);
      setStitchProgress({ current: segCount, total: segCount, step: "Assembling WAV…" });

      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      srtBlobRef.current = url;
      setSrtAudioSrc(url);
      setStitchProgress(null);

      if (apiKey.trim() && !keySaved) saveKey();
    } catch (err: unknown) {
      setSrtGenError(err instanceof Error ? err.message : "Stitching failed.");
      setStitchProgress(null);
    } finally {
      setSrtLoading(false);
    }
  }

  const keyValid    = apiKey.trim().startsWith("AIza") && apiKey.trim().length > 20;
  const canGenerate = text.trim().length > 0 && !loading && keyValid;
  const canSrtGen   = segments.length > 0 && !srtLoading && keyValid;

  /* ── computed SRT timeline info ── */
  const maxEndMs    = segments.length ? Math.max(...segments.map(s => s.endMs)) : 0;
  const effectiveDurMs = targetDurSec.trim()
    ? Math.max(Math.round(parseFloat(targetDurSec) * 1000), maxEndMs)
    : maxEndMs + 1000;

  return (
    <main className="relative z-10 min-h-screen flex flex-col items-center px-4 py-14"
      style={{ fontFamily: "var(--font-body)" }}>

      {/* ── Header ── */}
      <header className="text-center mb-10 animate-fade-up">
        <p className="text-xs tracking-[0.3em] uppercase mb-3" style={{ color: "var(--gold)" }}>
          Google Gemini TTS
        </p>
        <h1 style={{
          fontFamily: "var(--font-display)",
          fontSize: "clamp(2.2rem,5.5vw,3.8rem)",
          fontWeight: 500, letterSpacing: "-0.01em", lineHeight: 1.15,
          color: "var(--parchment)",
        }}>
          Myanmar{" "}
          <em style={{ color: "var(--gold)", fontStyle: "italic" }}>Voice</em>
        </h1>
        <p className="mt-2 text-base" style={{
          fontFamily: "Noto Sans Myanmar, serif",
          color: "var(--text-muted)", letterSpacing: "0.04em",
        }}>
          မြန်မာစာကို သဘာဝကျသော အသံဖြင့် ပြောင်းလဲပေးသည်
        </p>
        <div className="gold-rule w-20 mx-auto mt-5" />
      </header>

      {/* ── Card ── */}
      <div className="w-full max-w-2xl rounded-xl relative overflow-hidden"
        style={{
          background: "var(--bg-surface)",
          border: "1px solid var(--border-dim)",
          boxShadow: "0 8px 48px rgba(0,0,0,0.55), 0 2px 8px rgba(0,0,0,0.4)",
        }}>
        <Motif />

        <div className="relative z-10 p-6 sm:p-8 space-y-6">

          {/* ── API Key ── */}
          <section className="animate-fade-up" style={{ animationDelay: "0.05s" }}>
            <div className="flex items-center justify-between mb-2">
              <label htmlFor="api-key" className="flex items-center gap-1.5 text-xs uppercase tracking-widest"
                style={{ color: "var(--gold)" }}>
                <KeyIcon />
                Gemini API Key
              </label>
              <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer"
                className="text-xs transition-colors"
                style={{ color: "var(--text-muted)" }}
                onMouseOver={e => (e.currentTarget.style.color = "var(--gold)")}
                onMouseOut={e  => (e.currentTarget.style.color = "var(--text-muted)")}>
                Get free key ↗
              </a>
            </div>
            <div className="flex gap-2">
              <div className="key-input-wrap flex-1">
                <input
                  id="api-key"
                  type={showKey ? "text" : "password"}
                  className={`key-input${keyValid ? " valid" : ""}`}
                  placeholder="AIzaSy••••••••••••••••••••••••••••••••"
                  value={apiKey}
                  onChange={e => handleKeyChange(e.target.value)}
                  autoComplete="off" spellCheck={false} aria-label="Gemini API Key"
                />
                <button className="key-toggle-btn" onClick={() => setShowKey(p => !p)}
                  aria-label={showKey ? "Hide key" : "Show key"} type="button">
                  <EyeIcon off={showKey} />
                </button>
              </div>
              {keySaved ? (
                <button onClick={clearKey} type="button"
                  className="flex items-center gap-1.5 px-3 rounded-md text-xs transition-colors flex-shrink-0"
                  style={{ border: "1px solid var(--success)", color: "var(--success)", background: "var(--success-bg)", fontFamily: "var(--font-body)" }}>
                  <CheckIcon />Saved
                </button>
              ) : (
                <button onClick={saveKey} disabled={!keyValid} type="button"
                  className="flex-shrink-0 px-4 rounded-md text-xs font-medium transition-all"
                  style={{
                    border: `1px solid ${keyValid ? "var(--border-accent)" : "var(--border-dim)"}`,
                    color: keyValid ? "var(--gold)" : "var(--text-faint)",
                    background: "transparent", fontFamily: "var(--font-body)",
                    cursor: keyValid ? "pointer" : "not-allowed",
                  }}>
                  Save
                </button>
              )}
            </div>
            <p className="mt-1.5 text-xs" style={{ color: "var(--text-faint)" }}>
              Your key is stored in your browser only — never sent to our servers without your request.
            </p>
          </section>

          {/* ── Tab switcher ── */}
          <div className="flex rounded-lg overflow-hidden animate-fade-up" style={{ animationDelay: "0.08s", border: "1px solid var(--border-dim)" }}>
            {([
              { id: "single" as Tab, label: "Single Text", icon: <SoundIcon /> },
              { id: "srt"    as Tab, label: "SRT Timeline", icon: <FilmIcon /> },
            ] as const).map(t => (
              <button key={t.id} type="button"
                onClick={() => setTab(t.id)}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 text-xs uppercase tracking-widest transition-all"
                style={{
                  background: tab === t.id ? "rgba(212,150,15,0.12)" : "transparent",
                  color: tab === t.id ? "var(--gold)" : "var(--text-faint)",
                  borderRight: t.id === "single" ? "1px solid var(--border-dim)" : "none",
                  fontFamily: "var(--font-body)",
                }}>
                {t.icon}
                {t.label}
              </button>
            ))}
          </div>

          <div className="gold-rule animate-fade-up" style={{ animationDelay: "0.10s" }} />

          {/* ════════════════════════════════════ SINGLE TAB ════ */}
          {tab === "single" && (
            <>
              <section className="animate-fade-up" style={{ animationDelay: "0.15s" }}>
                <div className="flex items-baseline justify-between mb-2">
                  <label htmlFor="myanmar-text" className="text-xs uppercase tracking-widest" style={{ color: "var(--gold)" }}>
                    Myanmar Text
                  </label>
                  <div className="flex items-center gap-3">
                    <button onClick={useSample} type="button"
                      className="text-xs transition-colors"
                      style={{ color: "var(--text-muted)" }}
                      onMouseOver={e => (e.currentTarget.style.color = "var(--gold)")}
                      onMouseOut={e  => (e.currentTarget.style.color = "var(--text-muted)")}>
                      ↗ sample
                    </button>
                    <span className="text-xs tabular-nums"
                      style={{ color: charCount > 3600 ? "#ef4444" : "var(--text-faint)" }}>
                      {charCount} / 4000
                    </span>
                  </div>
                </div>
                <textarea id="myanmar-text" className="myanmar-input"
                  placeholder="မြန်မာဘာသာ စာသားရိုက်ထည့်ပါ…"
                  value={text} onChange={handleTextChange} rows={6} spellCheck={false} />
              </section>

              <section className="grid grid-cols-1 sm:grid-cols-2 gap-4 animate-fade-up" style={{ animationDelay: "0.20s" }}>
                <div>
                  <label htmlFor="audio-style" className="block text-xs uppercase tracking-widest mb-2" style={{ color: "var(--gold)" }}>
                    Audio Style
                  </label>
                  <select id="audio-style" className="lacquer-select w-full" value={style} onChange={e => setStyle(e.target.value)}>
                    {STYLES.map(s => <option key={s.value} value={s.value}>{s.label} — {s.desc}</option>)}
                  </select>
                </div>
                <div>
                  <label htmlFor="voice-select" className="block text-xs uppercase tracking-widest mb-2" style={{ color: "var(--gold)" }}>
                    Voice
                  </label>
                  <select id="voice-select" className="lacquer-select w-full" value={voice} onChange={e => setVoice(e.target.value)}>
                    {VOICES.map(v => <option key={v.value} value={v.value}>{v.value} · {v.note}</option>)}
                  </select>
                </div>
              </section>

              <div className="gold-rule animate-fade-up" style={{ animationDelay: "0.25s" }} />

              <section className="animate-fade-up" style={{ animationDelay: "0.30s" }}>
                {!keyValid && apiKey.length > 0 && (
                  <p className="text-xs mb-3 text-center" style={{ color: "#f59e0b" }}>
                    ⚠ Key should start with "AIza" and be at least 20 characters
                  </p>
                )}
                {!apiKey && (
                  <p className="text-xs mb-3 text-center" style={{ color: "var(--text-muted)" }}>
                    Enter your Gemini API key above to generate audio
                  </p>
                )}
                <button onClick={generate} disabled={!canGenerate} className="btn-generate" aria-busy={loading}>
                  {loading ? <><Spinner /><span>Synthesising Voice…</span></> : <><SoundIcon /><span>Generate Voiceover</span></>}
                </button>
              </section>

              {error && (
                <div className="rounded-lg px-4 py-3 text-sm animate-fade-in" role="alert"
                  style={{ background: "var(--danger-bg)", border: "1px solid var(--danger-border)", color: "#fca5a5" }}>
                  <strong className="block mb-0.5">Error</strong>
                  {error}
                  {(error.includes("key") || error.includes("401") || error.includes("403")) && (
                    <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer"
                      className="block mt-1.5 underline text-xs" style={{ color: "var(--gold)" }}>
                      Get / check your API key at aistudio.google.com →
                    </a>
                  )}
                </div>
              )}
              {audioSrc && <AudioPlayer src={audioSrc} />}
            </>
          )}

          {/* ════════════════════════════════════ SRT TAB ════ */}
          {tab === "srt" && (
            <>
              {/* SRT input */}
              <section className="animate-fade-up" style={{ animationDelay: "0.15s" }}>
                <div className="flex items-baseline justify-between mb-2">
                  <label htmlFor="srt-input" className="text-xs uppercase tracking-widest flex items-center gap-1.5" style={{ color: "var(--gold)" }}>
                    <SubIcon />SRT Subtitles
                  </label>
                  <button onClick={useSampleSrt} type="button"
                    className="text-xs transition-colors"
                    style={{ color: "var(--text-muted)" }}
                    onMouseOver={e => (e.currentTarget.style.color = "var(--gold)")}
                    onMouseOut={e  => (e.currentTarget.style.color = "var(--text-muted)")}>
                    ↗ sample
                  </button>
                </div>
                <textarea id="srt-input" className="myanmar-input"
                  placeholder={"1\n00:00:01,000 --> 00:00:04,000\nမင်္ဂလာပါ…\n\n2\n00:00:05,000 --> 00:00:08,000\nမြန်မာနိုင်ငံ…"}
                  value={srtText}
                  onChange={e => handleSrtChange(e.target.value)}
                  rows={8} spellCheck={false}
                  style={{ fontFamily: "monospace, Noto Sans Myanmar, serif", fontSize: "0.8rem" }}
                />
                {srtError && (
                  <p className="mt-1.5 text-xs" style={{ color: "#f87171" }}>⚠ {srtError}</p>
                )}
              </section>

              {/* Parsed segments table */}
              {segments.length > 0 && <SegmentTable segments={segments} />}

              {/* Timeline config */}
              {segments.length > 0 && (
                <section className="rounded-lg p-4 animate-fade-up" style={{
                  background: "rgba(212,150,15,0.05)",
                  border: "1px solid var(--border-dim)",
                }}>
                  <p className="text-xs uppercase tracking-widest mb-3 flex items-center gap-1.5" style={{ color: "var(--gold)" }}>
                    <FilmIcon />Timeline Configuration
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs mb-1" style={{ color: "var(--text-muted)" }}>
                        Target Video Length (s)
                      </label>
                      <input
                        type="number" min="1" step="0.5"
                        className="lacquer-select w-full"
                        placeholder={`auto (${Math.ceil(effectiveDurMs/1000)}s)`}
                        value={targetDurSec}
                        onChange={e => setTargetDurSec(e.target.value)}
                        style={{ fontFamily: "var(--font-body)" }}
                      />
                      <p className="mt-1 text-xs" style={{ color: "var(--text-faint)" }}>
                        Output: {(effectiveDurMs/1000).toFixed(1)}s WAV
                      </p>
                    </div>
                    <div>
                      <label htmlFor="srt-style" className="block text-xs mb-1" style={{ color: "var(--text-muted)" }}>Style</label>
                      <select id="srt-style" className="lacquer-select w-full" value={srtStyle} onChange={e => setSrtStyle(e.target.value)}>
                        {STYLES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label htmlFor="srt-voice" className="block text-xs mb-1" style={{ color: "var(--text-muted)" }}>Voice</label>
                      <select id="srt-voice" className="lacquer-select w-full" value={srtVoice} onChange={e => setSrtVoice(e.target.value)}>
                        {VOICES.map(v => <option key={v.value} value={v.value}>{v.value} · {v.note}</option>)}
                      </select>
                    </div>
                  </div>

                  {/* Timeline info pills */}
                  <div className="mt-3 flex flex-wrap gap-2">
                    {[
                      { label: "Segments",   val: segments.length },
                      { label: "Last cue",   val: msToTs(maxEndMs) },
                      { label: "Output",     val: `${(effectiveDurMs/1000).toFixed(1)}s` },
                      { label: "Silence gaps", val: `${segments.length - 1}` },
                    ].map(p => (
                      <span key={p.label} className="px-2 py-0.5 rounded text-xs" style={{
                        background: "rgba(255,255,255,0.04)",
                        border: "1px solid var(--border-dim)",
                        color: "var(--text-muted)",
                      }}>
                        {p.label}: <span style={{ color: "var(--parchment)" }}>{p.val}</span>
                      </span>
                    ))}
                  </div>
                </section>
              )}

              <div className="gold-rule animate-fade-up" style={{ animationDelay: "0.25s" }} />

              {/* Generate button */}
              <section className="animate-fade-up" style={{ animationDelay: "0.30s" }}>
                {!keyValid && apiKey.length > 0 && (
                  <p className="text-xs mb-3 text-center" style={{ color: "#f59e0b" }}>
                    ⚠ Enter a valid Gemini API key above
                  </p>
                )}
                {segments.length === 0 && !srtError && (
                  <p className="text-xs mb-3 text-center" style={{ color: "var(--text-muted)" }}>
                    Paste an SRT file above to enable timeline stitching
                  </p>
                )}
                <button onClick={generateSrt} disabled={!canSrtGen} className="btn-generate" aria-busy={srtLoading}>
                  {srtLoading
                    ? <><Spinner /><span>Stitching {segments.length} segments…</span></>
                    : <><FilmIcon /><span>Generate Timeline Audio</span></>}
                </button>
              </section>

              {stitchProgress && (
                <StitchProgress
                  current={stitchProgress.current}
                  total={stitchProgress.total}
                  step={stitchProgress.step}
                />
              )}

              {srtGenError && (
                <div className="rounded-lg px-4 py-3 text-sm animate-fade-in" role="alert"
                  style={{ background: "var(--danger-bg)", border: "1px solid var(--danger-border)", color: "#fca5a5" }}>
                  <strong className="block mb-0.5">Error</strong>
                  {srtGenError}
                </div>
              )}

              {srtAudioSrc && (
                <div>
                  <p className="text-xs uppercase tracking-widest mb-2" style={{ color: "var(--gold)" }}>
                    Timeline-Stitched Audio · {(effectiveDurMs/1000).toFixed(1)}s · {segments.length} cues
                  </p>
                  <AudioPlayer src={srtAudioSrc} downloadName="myanmar-tts-timeline.wav" />
                  <p className="mt-2 text-xs" style={{ color: "var(--text-faint)" }}>
                    Each subtitle cue is placed at its exact SRT timestamp. Silence fills gaps between cues.
                    Use this WAV directly in your video editor — it will be in sync with the subtitles.
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── Style pills ── */}
      <div className="mt-6 flex flex-wrap gap-2 justify-center animate-fade-up" style={{ animationDelay: "0.38s" }}>
        {STYLES.map(s => {
          const active = tab === "single" ? style === s.value : srtStyle === s.value;
          return (
            <button key={s.value}
              onClick={() => tab === "single" ? setStyle(s.value) : setSrtStyle(s.value)}
              type="button"
              className="px-3 py-1 rounded-full text-xs transition-all"
              style={{
                border: `1px solid ${active ? "var(--border-accent)" : "var(--border-dim)"}`,
                background: active ? "rgba(212,150,15,0.12)" : "transparent",
                color: active ? "var(--gold)" : "var(--text-faint)",
              }}>
              {s.label}
            </button>
          );
        })}
      </div>

      {/* ── Footer ── */}
      <footer className="mt-12 text-center text-xs" style={{ color: "var(--text-faint)" }}>
        <p>Myanmar Voice · Gemini 2.5 Flash TTS · SRT Timeline Stitcher</p>
        <p className="mt-1" style={{ fontFamily: "Noto Sans Myanmar, serif", fontSize: "0.72rem" }}>
          မြန်မာဘာသာ အသံပြောင်းလဲမှုဝန်ဆောင်မှု
        </p>
      </footer>
    </main>
  );
}
