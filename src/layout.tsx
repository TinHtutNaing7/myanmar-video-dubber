import type { Metadata } from "next";
import { IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title:       "Myanmar Video Dubber",
  description: "AI-powered video transcription, translation & dubbing into Burmese. Powered by Groq Whisper, Gemini, and ElevenLabs.",
  keywords:    ["myanmar", "burmese", "video dubbing", "ai translation", "whisper", "gemini", "elevenlabs"],
  openGraph: {
    title:       "Myanmar Video Dubber",
    description: "Auto-dub any video into Burmese using Groq · Gemini · ElevenLabs",
    type:        "website",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={ibmPlexMono.variable}>
      <body className="antialiased font-mono">{children}</body>
    </html>
  );
}
