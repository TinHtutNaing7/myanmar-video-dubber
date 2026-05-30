// ─── Transcript / Segment ─────────────────────────────────────────────────────

export interface Segment {
  id:              number;
  start:           number;   // seconds
  end:             number;   // seconds
  text:            string;   // original transcript text
  translated_text?: string;  // Burmese translation
}

// ─── API Payloads ──────────────────────────────────────────────────────────────

export interface TranscribeResponse {
  segments: Segment[];
  language?: string;
  duration?: number;
}

export interface TranslateRequest {
  segments: Pick<Segment, "id" | "text">[];
  targetLanguage?: string;   // default: "Burmese (Myanmar)"
}

export interface TranslateResponse {
  translated: { id: number; text: string }[];
}

export interface TTSRequest {
  text:     string;
  voiceId:  string;
  modelId?: string;
}

// ─── Pipeline ─────────────────────────────────────────────────────────────────

export type PipelineStep =
  | "idle"
  | "loading_ffmpeg"
  | "extracting_audio"
  | "transcribing"
  | "translating"
  | "generating_tts"
  | "assembling"
  | "completed"
  | "error";

export interface PipelineState {
  step:        PipelineStep;
  progress:    number;          // 0-100
  message:     string;
  segments:    Segment[];
  outputUrl?:  string;          // object URL for the final video
  srtContent?: string;          // SRT file text
  error?:      string;
}

// ─── Settings ─────────────────────────────────────────────────────────────────

export type Workflow = "video_dub" | "audio_dub" | "subtitles" | "storytelling";

export interface DubSettings {
  workflow:        Workflow;
  voiceId:         string;
  voiceName:       string;
  ttsModel:        string;
  whisperModel:    string;
  outputLanguage:  string;
  subtitleStyle:   string;
  fontSize:        number;
  groqApiKey:      string;
  geminiApiKey:    string;
  elevenLabsKey:   string;
}
