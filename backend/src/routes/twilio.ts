import { Router } from "express";
import twilio from "twilio";
import { ingestTranscriptionEvent, clearTranscriptBuffer } from "../services/transcription.js";
import { handleRuleWebhook, handleEndWebhook } from "../services/ciWebhook.js";
import { endCallSession, getCallSession, pushToCall } from "../services/liveHub.js";
import { logger } from "../services/logger.js";
import { buildTranscriptionVerbAttributes } from "../services/transcriptionConfig.js";
import { toSafeAgentId } from "../services/twilioClient.js";

export const twilioRouter = Router();

/**
 * UI 用の transcript ticker に partial/final を流す Transcription 属性を組み立てる。
 * 実際の設定は services/transcriptionConfig.ts の runtime state から読み、
 * Setup 画面から上書き可能。CI 側 ingestion は Orchestrator の captureRules が別で担う。
 */
function transcriptionVerbAttributes(): Record<string, string | boolean> {
  const base = process.env.PUBLIC_BASE_URL || "";
  return buildTranscriptionVerbAttributes(base);
}

/**
 * agent クエリはすでに call.ts 側で `toSafeAgentId()` を通しているが、
 * 直接叩かれる場合もあるので防御的に再サニタイズする。
 * agent は "agent-xxx" 形で来る場合と生名で来る場合があるので両対応。
 */
function resolveClientIdentity(raw: string): string {
  if (!raw) return toSafeAgentId("demo");
  if (raw.startsWith("agent-")) {
    // 既にサニタイズ済 (call.ts 経由) — そのまま
    return raw;
  }
  return toSafeAgentId(raw);
}

twilioRouter.post("/twilio/voice/outbound", (req, res) => {
  const agent = (req.query.agent as string) || "";
  const identity = resolveClientIdentity(agent);
  logger.info({ agent, identity }, "outbound TwiML dial → Client");
  const twiml = new twilio.twiml.VoiceResponse();
  const start = twiml.start();
  start.transcription(transcriptionVerbAttributes() as any);
  const dial = twiml.dial({ answerOnBridge: true, timeout: 30 });
  dial.client({}, identity);
  res.type("text/xml").send(twiml.toString());
});

twilioRouter.post("/twilio/voice/inbound", (req, res) => {
  const twiml = new twilio.twiml.VoiceResponse();
  const start = twiml.start();
  start.transcription(transcriptionVerbAttributes() as any);
  const dial = twiml.dial({ answerOnBridge: true, timeout: 30 });
  const defaultAgent = process.env.DEFAULT_INBOUND_AGENT || "demo";
  dial.client({}, resolveClientIdentity(defaultAgent));
  res.type("text/xml").send(twiml.toString());
});

twilioRouter.post("/twilio/voice/status", (req, res) => {
  const CallSid = req.body?.CallSid as string;
  const status = req.body?.CallStatus as string;
  logger.info({ CallSid, status }, "voice status");
  if (!CallSid) {
    res.status(200).end();
    return;
  }
  const session = getCallSession(CallSid);
  const state =
    status === "ringing"
      ? "ringing"
      : status === "in-progress"
        ? "connected"
        : status === "completed"
          ? "ended"
          : status === "failed" || status === "busy" || status === "no-answer"
            ? "failed"
            : "idle";
  if (session) {
    pushToCall(CallSid, {
      type: "call-status",
      payload: { callSid: CallSid, state, contactId: session.contactId },
    });
    if (state === "ended" || state === "failed") {
      endCallSession(CallSid, new Date().toISOString());
      clearTranscriptBuffer(CallSid);
    }
  }
  res.status(200).end();
});

twilioRouter.post("/twilio/transcription", (req, res) => {
  ingestTranscriptionEvent(req.body);
  res.status(200).end();
});

twilioRouter.post("/twilio/ci/rule", async (req, res) => {
  try {
    await handleRuleWebhook(req.body || {});
  } catch (e) {
    logger.error({ err: (e as Error).message }, "ci/rule handler failed");
  }
  res.status(200).end();
});

twilioRouter.post("/twilio/ci/end", (req, res) => {
  try {
    handleEndWebhook(req.body || {});
  } catch (e) {
    logger.error({ err: (e as Error).message }, "ci/end handler failed");
  }
  res.status(200).end();
});
