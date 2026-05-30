"use client";

import { useState } from "react";

interface Props {
  label:       string;
  placeholder: string;
  hint:        React.ReactNode;
  value:       string;
  onChange:    (v: string) => void;
  disabled?:   boolean;
}

export default function ApiKeyInput({ label, placeholder, hint, value, onChange, disabled }: Props) {
  const [show, setShow] = useState(false);

  return (
    <div>
      <p className="text-[10px] uppercase tracking-widest text-gray-500 mb-1.5 font-mono">
        {label}
      </p>
      <div className="relative">
        <input
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          spellCheck={false}
          autoComplete="off"
          className="w-full bg-black/30 border border-white/[0.08] rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-amber-400/50 pr-14 font-mono transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        />
        <button
          type="button"
          disabled={disabled}
          onClick={() => setShow(!show)}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-gray-500 hover:text-amber-400 font-semibold tracking-widest transition-colors disabled:pointer-events-none"
        >
          {show ? "HIDE" : "SHOW"}
        </button>
      </div>
      <p className="text-[11px] text-gray-600 mt-1.5 leading-relaxed font-mono">{hint}</p>
    </div>
  );
}
