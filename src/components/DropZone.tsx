"use client";

import { useRef, useState, useCallback } from "react";

interface Props {
  onFile:   (f: File) => void;
  file:     File | null;
  onClear:  () => void;
  disabled?: boolean;
}

const ACCEPTED = ".mp4,.mov,.webm,.avi,.mkv";

export default function DropZone({ onFile, file, onClear, disabled }: Props) {
  const [drag, setDrag] = useState(false);
  const ref = useRef<HTMLInputElement>(null);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDrag(false);
    if (disabled) return;
    const f = e.dataTransfer.files[0];
    if (f) onFile(f);
  }, [onFile, disabled]);

  const zone = drag
    ? "border-amber-400 bg-amber-400/5 scale-[1.01]"
    : file
    ? "border-green-500/50 bg-green-500/[0.04]"
    : "border-white/[0.1] hover:border-amber-400/40 hover:bg-white/[0.03]";

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); if (!disabled) setDrag(true); }}
      onDragLeave={() => setDrag(false)}
      onDrop={onDrop}
      onClick={() => !disabled && ref.current?.click()}
      className={`border-2 border-dashed rounded-xl p-10 text-center select-none transition-all duration-200 ${
        disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"
      } ${zone}`}
    >
      <input
        ref={ref}
        type="file"
        accept={ACCEPTED}
        className="hidden"
        disabled={disabled}
        onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
      />

      {file ? (
        <div className="space-y-1.5">
          <div className="text-4xl">✅</div>
          <p className="text-sm font-semibold text-green-400 truncate max-w-xs mx-auto">
            {file.name}
          </p>
          <p className="text-xs text-gray-500">{(file.size / 1024 / 1024).toFixed(1)} MB</p>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onClear(); }}
            className="text-[11px] text-red-400 hover:text-red-300 underline underline-offset-2"
          >
            Remove
          </button>
        </div>
      ) : (
        <div className="space-y-1.5">
          <div className="text-5xl opacity-20 mb-3">⬆</div>
          <p className="text-sm font-semibold">Drop your video here or click to browse</p>
          <p className="text-xs text-gray-500">MP4 · MOV · WebM · AVI — up to 512 MB</p>
        </div>
      )}
    </div>
  );
}
