import { buildHints } from "./transcriptionHints.js";

/**
 * TwiML <Start><Transcription> の runtime 設定。
 * .env を default とし、Setup 画面から上書きされうる。
 * backend 再起動で env 値に戻る (demo なので永続化なし)。
 */

export interface TranscriptionConfig {
  languageCode: string;
  engine: "google" | "deepgram";
  speechModel: string;
  hintsEnabled: boolean;
  hintsExtra: string;
}

function defaults(): TranscriptionConfig {
  return {
    languageCode: process.env.TRANSCRIPTION_LANGUAGE || "ja-JP",
    engine: (process.env.TRANSCRIPTION_ENGINE as "google" | "deepgram") || "google",
    speechModel: process.env.TRANSCRIPTION_SPEECH_MODEL || "long",
    hintsEnabled: process.env.TRANSCRIPTION_HINTS_DISABLE !== "true",
    hintsExtra: process.env.TRANSCRIPTION_HINTS_EXTRA || "",
  };
}

let current: TranscriptionConfig = defaults();

export function getTranscriptionConfig(): TranscriptionConfig {
  return { ...current };
}

export function updateTranscriptionConfig(
  patch: Partial<TranscriptionConfig>,
): TranscriptionConfig {
  current = { ...current, ...patch };
  return getTranscriptionConfig();
}

export function resetTranscriptionConfig(): TranscriptionConfig {
  current = defaults();
  return getTranscriptionConfig();
}

/**
 * TwiML <Transcription> に渡す attribute オブジェクトを組み立てる。
 * hints は TRANSCRIPTION_HINTS_EXTRA と runtime hintsExtra を merge する。
 */
export function buildTranscriptionVerbAttributes(base: string): Record<string, string | boolean> {
  const c = current;
  const attrs: Record<string, string | boolean> = {
    statusCallbackUrl: `${base}/twilio/transcription`,
    track: "both_tracks",
    partialResults: true,
    languageCode: c.languageCode,
    transcriptionEngine: c.engine,
    speechModel: c.speechModel,
    inboundTrackLabel: "customer",
    outboundTrackLabel: "agent",
  };
  if (c.hintsEnabled) {
    const h = buildHints(c.hintsExtra);
    if (h) attrs.hints = h;
  }
  return attrs;
}
