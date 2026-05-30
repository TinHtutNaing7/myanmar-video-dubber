import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/hooks/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        mono: ["'IBM Plex Mono'", "Menlo", "monospace"],
      },
      colors: {
        navy: {
          900: "#050912",
          800: "#080d18",
          700: "#0a1020",
          600: "#0d1828",
          500: "#111f35",
          400: "#1a2640",
          300: "#243050",
          200: "#2e3d62",
        },
      },
      animation: {
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "spin-slow":  "spin 2s linear infinite",
      },
    },
  },
  plugins: [],
};
export default config;
