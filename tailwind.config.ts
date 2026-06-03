import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        display: ["var(--font-display)", "Georgia", "serif"],
        body:    ["var(--font-body)", "system-ui", "sans-serif"],
        myanmar: ["Noto Sans Myanmar", "Pyidaungsu", "Myanmar Text", "serif"],
      },
      animation: {
        "fade-up":   "fadeUp 0.5s ease both",
        "fade-in":   "fadeIn 0.35s ease both",
        "spin-slow": "spin 1.6s linear infinite",
        "wave-bar":  "waveBar 1s ease-in-out infinite",
      },
      keyframes: {
        fadeUp:  { "0%": { opacity: "0", transform: "translateY(12px)" }, "100%": { opacity: "1", transform: "translateY(0)" } },
        fadeIn:  { "0%": { opacity: "0" }, "100%": { opacity: "1" } },
        waveBar: { "0%,100%": { transform: "scaleY(0.25)" }, "50%": { transform: "scaleY(1)" } },
      },
    },
  },
  plugins: [],
};
export default config;
