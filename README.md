# 🎬 Myanmar Video Dubber

> Auto-dub any video into Burmese using **Groq Whisper** (transcription) · **Gemini 2.0 Flash** (translation) · **ElevenLabs** (voiceover) · **ffmpeg.wasm** (video assembly in the browser). Deploys to Vercel in minutes with zero server infrastructure for video processing.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/YOUR_USERNAME/myanmar-video-dubber&env=GROQ_API_KEY,GEMINI_API_KEY,ELEVENLABS_API_KEY,ELEVENLABS_DEFAULT_VOICE_ID&project-name=myanmar-video-dubber)

---

## ✨ Features

| Feature | Stack | Free Tier |
|---|---|---|
| Speech transcription | Groq `whisper-large-v3-turbo` | ✅ 7,200 sec/hr |
| Text translation | Gemini `gemini-2.0-flash` | ✅ 1,500 req/day |
| Burmese voiceover | ElevenLabs `eleven_multilingual_v2` | ✅ 10k chars/mo |
| Video assembly | `@ffmpeg/ffmpeg` WASM in browser | ✅ Always free |
| SRT subtitle export | Built-in generator | ✅ Always free |
| Workflows | Video Dub · Audio Dub · Subtitles · Storytelling | — |
| Deploy target | Vercel (Next.js 14 App Router) | ✅ Hobby plan |

---

## 🚀 Quick Start

### 1. Clone

```bash
git clone https://github.com/YOUR_USERNAME/myanmar-video-dubber.git
cd myanmar-video-dubber
npm install
```

### 2. Add API keys

```bash
cp .env.example .env.local
# Edit .env.local with your keys (see Free API Tiers below)
```

### 3. Run locally

```bash
npm run dev
# → http://localhost:3000
```

### 4. Deploy to Vercel

```bash
npx vercel          # follow the prompts
# Add the 4 env vars in the Vercel dashboard → Settings → Environment Variables
# Then: npx vercel --prod
```

---

## 🆓 Free API Tiers

| Service | What you get free | Sign up |
|---|---|---|
| **Groq** | 7,200 audio sec/hr · fastest Whisper available | [console.groq.com](https://console.groq.com) |
| **Google Gemini** | 1,500 req/day · 1 M tokens/min | [aistudio.google.com](https://aistudio.google.com) |
| **ElevenLabs** | 10,000 chars/month · multilingual v2 | [elevenlabs.io](https://elevenlabs.io) |
| **Vercel Hobby** | 100 GB bandwidth · serverless functions | [vercel.com](https://vercel.com) |

---

## 📁 Project Structure

```
myanmar-video-dubber/
│
├── src/
│   ├── app/
│   │   ├── page.tsx                    # Main UI (client component)
│   │   ├── layout.tsx                  # Root layout + IBM Plex Mono font
│   │   ├── globals.css                 # Tailwind base + custom CSS
│   │   └── api/
│   │       ├── transcribe/route.ts     # POST → Groq Whisper
│   │       ├── translate/route.ts      # POST → Gemini 2.0 Flash
│   │       ├── tts/route.ts            # POST → ElevenLabs (streaming)
│   │       └── voices/route.ts         # GET  → ElevenLabs voice list
│   │
│   ├── components/
│   │   ├── DropZone.tsx                # Drag-and-drop file input
│   │   ├── ProgressBar.tsx             # Animated progress bar
│   │   ├── StepList.tsx                # Pipeline step tracker
│   │   └── ApiKeyInput.tsx             # Masked key input field
│   │
│   ├── hooks/
│   │   └── useDubPipeline.ts           # Full orchestration hook
│   │
│   ├── lib/
│   │   ├── types.ts                    # Shared TypeScript interfaces
│   │   └── srt.ts                      # SRT generation + download utils
│   │
│   └── middleware.ts                   # COEP/COOP headers for WASM
│
├── .env.example                        # Key template (copy → .env.local)
├── .eslintrc.json
├── .gitignore
├── .prettierrc
├── next.config.mjs                     # WASM headers + webpack config
├── package.json                        # Pinned exact dependency versions
├── postcss.config.js
├── tailwind.config.ts
├── tsconfig.json
└── vercel.json                         # Function timeouts + security headers
```

---

## 🏗 Architecture

```
Browser
│
├─► ffmpeg.wasm      Extract mono MP3 from uploaded video (client-side)
│
├─► POST /api/transcribe   Audio → Groq whisper-large-v3-turbo
│        Returns: [{ id, start, end, text }]
│
├─► POST /api/translate    Segments → Gemini 2.0 Flash
│        Returns: [{ id, text: "မြန်မာဘာသာ…" }]
│
├─► POST /api/tts (×N)     Each segment → ElevenLabs eleven_multilingual_v2
│        Returns: audio/mpeg stream per segment
│
└─► ffmpeg.wasm      adelay + amix composite audio → mux with video → .mp4 + .srt
                     Everything stays in the browser — only audio sent to transcription
```

---

## ⚙️ Workflows

| Mode | What it does |
|---|---|
| **Video Dub** | Replaces original audio with Burmese voice + burns Burmese subtitles |
| **Audio Dub** | Replaces audio only, no subtitle overlay |
| **Subtitles** | Keeps original audio, burns Burmese subtitles only (no TTS needed) |
| **Storytelling** | Video Dub optimised for recap/narrator content |

---

## 🔧 Burmese Voice Quality Tips

ElevenLabs' `eleven_multilingual_v2` supports Burmese script out of the box, but for the best natural-sounding result:

1. **Create a Voice Clone** in your ElevenLabs dashboard using 5–10 minutes of clean native Myanmar speaker audio.
2. Copy the resulting Voice ID and paste it into the UI voice dropdown.
3. The clone will speak Burmese with a far more natural accent than the default English-trained voices.

---

## 🛠 Troubleshooting

| Problem | Fix |
|---|---|
| `SharedArrayBuffer is not defined` | Check `vercel.json` and `middleware.ts` have the COEP/COOP headers; redeploy |
| Function timeout on transcription | Upgrade to Vercel Pro (60 s limit) or shorten the video |
| `401` from any API route | Check env vars are set in Vercel dashboard with exact names, no trailing spaces |
| `git push` asks for password | Use a GitHub Personal Access Token (Settings → Developer settings → PAT) |
| ElevenLabs quota exceeded | Free tier is 10k chars/month; upgrade plan or reduce segment count |
| Translation JSON parse error | Gemini auto-retries on malformed JSON; if it keeps failing, reduce batch size in `route.ts` |

---

## 📄 License

MIT — free to use, modify, and deploy commercially.
