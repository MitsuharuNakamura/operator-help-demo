import { Router } from "express";
import {
  getTranscriptionConfig,
  resetTranscriptionConfig,
  updateTranscriptionConfig,
  type TranscriptionConfig,
} from "../services/transcriptionConfig.js";
import { buildHints } from "../services/transcriptionHints.js";
import { logger } from "../services/logger.js";

export const transcriptionRouter = Router();

const ALLOWED_ENGINES = ["google", "deepgram"] as const;

transcriptionRouter.get("/transcription/config", (_req, res) => {
  res.json(getTranscriptionConfig());
});

transcriptionRouter.put("/transcription/config", (req, res) => {
  const body = (req.body || {}) as Partial<TranscriptionConfig>;
  const patch: Partial<TranscriptionConfig> = {};

  if (typeof body.languageCode === "string" && body.languageCode.trim()) {
    patch.languageCode = body.languageCode.trim();
  }
  if (
    typeof body.engine === "string" &&
    (ALLOWED_ENGINES as readonly string[]).includes(body.engine)
  ) {
    patch.engine = body.engine as TranscriptionConfig["engine"];
  }
  if (typeof body.speechModel === "string" && body.speechModel.trim()) {
    patch.speechModel = body.speechModel.trim();
  }
  if (typeof body.hintsEnabled === "boolean") {
    patch.hintsEnabled = body.hintsEnabled;
  }
  if (typeof body.hintsExtra === "string") {
    patch.hintsExtra = body.hintsExtra;
  }

  const next = updateTranscriptionConfig(patch);
  logger.info({ patch, next }, "transcription config updated");
  res.json(next);
});

transcriptionRouter.post("/transcription/config/reset", (_req, res) => {
  const next = resetTranscriptionConfig();
  logger.info({ next }, "transcription config reset");
  res.json(next);
});

/**
 * 現行 config で実際に送出される hints 全体を返す。
 * UI から「今まさに使われている語彙」を確認できるようにするため。
 */
transcriptionRouter.get("/transcription/hints", (_req, res) => {
  const c = getTranscriptionConfig();
  const hints = buildHints(c.hintsExtra);
  const words = hints ? hints.split(",") : [];
  res.json({
    enabled: c.hintsEnabled,
    count: words.length,
    words,
  });
});
