"use client";
import { useEffect, useRef, useState, useCallback } from "react";

interface Props { src: string; downloadName?: string }

function fmt(s: number) {
  if (!isFinite(s)) return "0:00";
  return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
}

const PlayIcon  = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21"/></svg>;
const PauseIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>;
const DlIcon    = () => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>;

export default function AudioPlayer({ src, downloadName = "myanmar-voice.wav" }: Props) {
  const audioRef   = useRef<HTMLAudioElement>(null);
  const trackRef   = useRef<HTMLDivElement>(null);
  const [playing,  setPlaying]  = useState(false);
  const [progress, setProgress] = useState(0);
  const [current,  setCurrent]  = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    setPlaying(false); setProgress(0); setCurrent(0); setDuration(0);
    audioRef.current?.load();
  }, [src]);

  const toggle = useCallback(() => {
    const a = audioRef.current;
    if (!a) return;
    playing ? a.pause() : a.play().catch(() => {});
  }, [playing]);

  const seek = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const a = audioRef.current, t = trackRef.current;
    if (!a || !t || !a.duration) return;
    const r = (e.clientX - t.getBoundingClientRect().left) / t.offsetWidth;
    a.currentTime = Math.max(0, Math.min(1, r)) * a.duration;
  }, []);

  return (
    <div className="audio-panel animate-fade-in">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={`wave-bars flex items-end gap-[3px] h-4 transition-opacity ${playing ? "opacity-100" : "opacity-0"}`} aria-hidden="true">
            {[0,1,2,3,4].map(i => <span key={i} />)}
          </div>
          <span className="text-xs uppercase tracking-widest" style={{ color: "var(--gold)", fontFamily: "var(--font-body)" }}>
            Generated Audio
          </span>
        </div>
        <a href={src} download={downloadName} className="download-btn">
          <DlIcon /><span>WAV</span>
        </a>
      </div>

      <div className="flex items-center gap-3">
        <button onClick={toggle} className="play-btn" aria-label={playing ? "Pause" : "Play"}>
          {playing ? <PauseIcon /> : <PlayIcon />}
        </button>
        <div className="flex-1 flex flex-col gap-1.5">
          <div ref={trackRef} className="progress-track" onClick={seek}>
            <div className="progress-fill" style={{ width: `${progress}%` }} />
          </div>
          <div className="flex justify-between text-xs tabular-nums" style={{ color: "var(--text-muted)" }}>
            <span>{fmt(current)}</span>
            <span>{fmt(duration)}</span>
          </div>
        </div>
      </div>

      <audio
        ref={audioRef} src={src} preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => { setPlaying(false); setProgress(0); setCurrent(0); if (audioRef.current) audioRef.current.currentTime = 0; }}
        onTimeUpdate={() => { const a = audioRef.current; if (a?.duration) { setCurrent(a.currentTime); setProgress((a.currentTime / a.duration) * 100); }}}
        onLoadedMetadata={() => { if (audioRef.current) setDuration(audioRef.current.duration); }}
      />
    </div>
  );
}
