# 🎬 Myanmar Video Dubber

> Auto-dub any video into Burmese using **Groq Whisper** (transcription) · **Gemini 2.0 Flash** (translation) · **ElevenLabs** (voiceover) · **ffmpeg.wasm** (video assembly). Deploys to Vercel in minutes.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/YOUR_USERNAME/myanmar-video-dubber)

---

## ✨ Features

| Feature | Detail |
|---|---|
| **Transcription** | Groq `whisper-large-v3-turbo` — free tier, ~5× real-time speed |
| **Translation** | Gemini `gemini-2.0-flash` — free tier, 1,500 req/day |
| **Voiceover** | ElevenLabs `eleven_multilingual_v2` — free tier, 10k chars/month |
| **SRT Subtitles** | Auto-generated, burned into video or downloadable |
| **Video Assembly** | `ffmpeg.wasm` runs entirely in the browser — no video uploaded to server |
| **Workflows** | Video Dub · Audio Dub · Subtitles Only · Storytelling |
| **Vercel-ready** | All API routes under 60s timeout; WASM headers auto-configured |

---

## 🆓 Free API Tiers

| Service | Free Tier | Sign Up |
|---|---|---|
| **Groq** | 7,200 audio sec/hr · 1M tokens/day | [console.groq.com](https://console.groq.com) |
| **Google Gemini** | 1,500 req/day · 1M tokens/min | [aistudio.google.com](https://aistudio.google.com) |
| **ElevenLabs** | 10,000 chars/month | [elevenlabs.io](https://elevenlabs.io) |
| **Vercel Hobby** | 100 GB bandwidth · 100 GB-hours compute | [vercel.com](https://vercel.com) |

---

## 🚀 Quick Start

### 1. Clone & Install

```bash
git clone https://github.com/YOUR_USERNAME/myanmar-video-dubber
cd myanmar-video-dubber
npm install
```

### 2. Configure API Keys

```bash
cp .env.example .env.local
```

Edit `.env.local`:

```env
GROQ_API_KEY=gsk_xxxxxxxxxxxxxxxxxxxxxxxxxxxx
GEMINI_API_KEY=AIzaSyxxxxxxxxxxxxxxxxxxxxxxx
ELEVENLABS_API_KEY=sk_xxxxxxxxxxxxxxxxxxxxxxxxxxxx
ELEVENLABS_DEFAULT_VOICE_ID=21m00Tcm4TlvDq8ikWAM
```

### 3. Run Locally

```bash
npm run dev
# Open http://localhost:3000
```

### 4. Deploy to Vercel

```bash
npm i -g vercel
vercel
# Follow prompts; add env vars in Vercel dashboard
```

Or use the one-click button at the top of this README.

---

## 🏗 Architecture

```
Browser (Next.js)
│
├── ffmpeg.wasm          ← Extract audio from video (client-side, no upload)
│
├── POST /api/transcribe ← Groq whisper-large-v3-turbo
│   └── Returns: segments [{id, start, end, text}]
│
├── POST /api/translate  ← Gemini 2.0 Flash
│   └── Returns: [{id, text: "မြန်မာဘာသာ..."}]
│
├── POST /api/tts        ← ElevenLabs eleven_multilingual_v2
│   └── Returns: audio/mpeg stream (per segment)
│
└── ffmpeg.wasm          ← Assemble: adelay + amix + mux → .mp4 + .srt
```

### Why ffmpeg.wasm in the Browser?

- **Privacy**: Your video never leaves your device (only audio is sent for transcription)
- **Vercel compatibility**: No need for ffmpeg binary on the server; avoids timeout issues
- **Free**: No storage costs; no server CPU for video encoding

---

## 📁 Project Structure

```
myanmar-video-dubber/
├── src/
│   ├── app/
│   │   ├── page.tsx                  # Main UI
│   │   ├── layout.tsx
│   │   ├── globals.css
│   │   └── api/
│   │       ├── transcribe/route.ts   # Groq Whisper proxy
│   │       ├── translate/route.ts    # Gemini proxy
│   │       └── tts/route.ts          # ElevenLabs proxy (streaming)
│   ├── hooks/
│   │   └── useDubPipeline.ts         # Full pipeline orchestration
│   └── lib/
│       ├── types.ts                  # TypeScript interfaces
│       └── srt.ts                    # SRT generation utilities
├── next.config.mjs                   # COEP/COOP headers for WASM
├── vercel.json                        # Function timeout config
└── .env.example
```

---

## 🔧 Configuration

### ElevenLabs Voice Selection

The default voices in the UI are ElevenLabs' pre-made multilingual voices. For the **best Burmese dubbing quality**:

1. Record a native Myanmar speaker (5–10 minutes of clean audio)
2. Create a **Voice Clone** in your ElevenLabs dashboard
3. Copy the Voice ID and paste it into the UI

ElevenLabs' `eleven_multilingual_v2` model supports Burmese script natively.

### Groq Whisper Models

| Model | Speed | Accuracy | Use case |
|---|---|---|---|
| `whisper-large-v3-turbo` | ~5× real-time | Very high | **Recommended** |
| `whisper-large-v3` | ~3× real-time | Highest | Long/complex content |

### Vercel Function Timeouts

- **Hobby plan**: 10s max → upgrade to Pro or reduce video length
- **Pro plan**: 60s max → sufficient for most short videos
- **Enterprise**: 300s max

For longer videos, the transcription and TTS calls are the main bottleneck. Consider chunking audio server-side for videos > 5 minutes.

---

## 🌐 Workflow Details

### Video Dub (Default)
Replaces original audio with Burmese voice + burns Burmese subtitles into video.

### Audio Dub
Replaces audio only; no subtitle overlay. Useful when you want clean video.

### Subtitles Only
Skips TTS entirely. Burns Burmese subtitle text from Gemini translation. Fast & free.

### Storytelling
Same as Video Dub but optimized for recap/narration style content.

---

## 🛠 Local Development Notes

### CORS / WASM Headers
`ffmpeg.wasm` requires `SharedArrayBuffer`, which needs:
```
Cross-Origin-Embedder-Policy: require-corp
Cross-Origin-Opener-Policy: same-origin
```
These are set automatically in `next.config.mjs` and `vercel.json`.

### First Load
`@ffmpeg/core` WASM (~30 MB) is fetched from unpkg CDN on first use and cached by the browser. Subsequent runs are instant.

### Large File Testing
For files > 100 MB, increase the Node.js body size limit in `next.config.mjs` or use chunked uploads.

---

## 📋 Roadmap

- [ ] Chunked audio upload for videos > 30 minutes
- [ ] Server-side ffmpeg option (for Vercel Pro with larger timeouts)
- [ ] Custom voice clone upload via ElevenLabs API
- [ ] TikTok URL import via yt-dlp
- [ ] Batch processing queue
- [ ] Web Share API for direct mobile sharing

---

## 📄 License

MIT — free to use, modify, and deploy commercially.

---

## 🙏 Credits

- [Groq](https://groq.com) — lightning-fast Whisper inference
- [Google Gemini](https://ai.google.dev) — translation
- [ElevenLabs](https://elevenlabs.io) — voice synthesis
- [@ffmpeg/ffmpeg](https://github.com/ffmpegwasm/ffmpeg.wasm) — browser-native video processing
- [Next.js](https://nextjs.org) — React framework
- [Tailwind CSS](https://tailwindcss.com) — styling
