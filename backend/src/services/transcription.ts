import type { Utterance } from "../types/domain.js";
import { logger } from "./logger.js";
import { pushToCall } from "./liveHub.js";

interface TranscriptionEventInput {
  CallSid: string;
  TranscriptionSid?: string;
  SequenceId?: string;
  TranscriptionEvent: string;
  Track?: string;
  InboundTrackLabel?: string;
  OutboundTrackLabel?: string;
  TranscriptionData?: string;
  Final?: string;
  Stability?: string;
  LanguageCode?: string;
  Timestamp?: string;
}

const trackLabels = new Map<
  string,
  { inbound: string; outbound: string }
>();

const callBuffers = new Map<string, Utterance[]>();
const contentCount = new Map<string, number>();

export function ingestTranscriptionEvent(body: TranscriptionEventInput) {
  const {
    CallSid,
    TranscriptionEvent,
    Track,
    InboundTrackLabel,
    OutboundTrackLabel,
    TranscriptionData,
    Final,
    SequenceId,
    TranscriptionSid,
  } = body;

  if (!CallSid) {
    logger.warn({ body }, "transcription event without CallSid");
    return;
  }

  if (TranscriptionEvent === "transcription-started") {
    trackLabels.set(CallSid, {
      inbound: InboundTrackLabel || "customer",
      outbound: OutboundTrackLabel || "agent",
    });
    logger.info({ CallSid, InboundTrackLabel, OutboundTrackLabel }, "transcription started");
    return;
  }

  if (TranscriptionEvent === "transcription-stopped") {
    logger.info({ CallSid }, "transcription stopped");
    return;
  }

  if (TranscriptionEvent === "transcription-error") {
    logger.error({ body }, "transcription error");
    return;
  }

  if (TranscriptionEvent !== "transcription-content") return;
  if (!TranscriptionData) return;

  let parsed: { transcript?: string; confidence?: number };
  try {
    parsed = JSON.parse(TranscriptionData);
  } catch (e) {
    logger.warn({ err: e, TranscriptionData }, "invalid TranscriptionData JSON");
    return;
  }

  const labels = trackLabels.get(CallSid) || {
    inbound: "customer",
    outbound: "agent",
  };
  const track = Track || "";
  const label =
    track === "inbound_track" || track === "inbound"
      ? labels.inbound
      : track === "outbound_track" || track === "outbound"
        ? labels.outbound
        : "customer";

  const speaker: "agent" | "customer" =
    label === "agent" ? "agent" : "customer";

  const utterance: Utterance = {
    id: `${TranscriptionSid || CallSid}-${SequenceId || Date.now()}`,
    callSid: CallSid,
    speaker,
    text: parsed.transcript || "",
    final: Final === "true",
    confidence: parsed.confidence,
    timestamp: new Date().toISOString(),
  };

  // debug: 到達イベントを可視化 (final は全部、partial は 10 件ごとに集計)
  const c = (contentCount.get(CallSid) || 0) + 1;
  contentCount.set(CallSid, c);
  if (c <= 3 || c % 10 === 0 || utterance.final) {
    logger.info(
      {
        CallSid,
        seq: SequenceId,
        n: c,
        final: utterance.final,
        speaker,
        len: utterance.text.length,
      },
      "transcription content",
    );
  }

  if (utterance.final) {
    let buf = callBuffers.get(CallSid);
    if (!buf) {
      buf = [];
      callBuffers.set(CallSid, buf);
    }
    buf.push(utterance);
  }

  pushToCall(CallSid, { type: "transcript", payload: utterance });
}

export function getTranscriptBuffer(callSid: string): Utterance[] {
  return callBuffers.get(callSid) || [];
}

export function clearTranscriptBuffer(callSid: string) {
  callBuffers.delete(callSid);
  trackLabels.delete(callSid);
  contentCount.delete(callSid);
}
