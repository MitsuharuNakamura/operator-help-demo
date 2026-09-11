import { Router } from "express";
import { getTwilioClient, toSafeAgentId } from "../services/twilioClient.js";
import { registerCallSession, pushToAgent } from "../services/liveHub.js";
import { logger } from "../services/logger.js";

export const callRouter = Router();

callRouter.post("/call/start", async (req, res) => {
  const { to, agentIdentity, contactId } = req.body as {
    to?: string;
    agentIdentity?: string;
    contactId?: string;
  };
  if (!to || !agentIdentity) {
    res.status(400).json({ error: "to and agentIdentity required" });
    return;
  }
  const base = process.env.PUBLIC_BASE_URL;
  const from = process.env.TWILIO_CALLER_ID;
  if (!base || !from) {
    res
      .status(500)
      .json({ error: "PUBLIC_BASE_URL and TWILIO_CALLER_ID must be set" });
    return;
  }
  // Twilio Voice Client identity は 0-9A-Za-z.-_ のみ。生の名前 (日本語含む) は
  // ここで安全化して以降すべての Voice / WS ルーティングに使う。
  const safeAgentIdentity = toSafeAgentId(agentIdentity);
  try {
    const client = getTwilioClient();
    const call = await client.calls.create({
      to,
      from,
      url: `${base}/twilio/voice/outbound?agent=${encodeURIComponent(safeAgentIdentity)}${
        contactId ? `&contact=${encodeURIComponent(contactId)}` : ""
      }`,
      statusCallback: `${base}/twilio/voice/status`,
      statusCallbackEvent: [
        "initiated",
        "ringing",
        "answered",
        "completed",
      ],
      statusCallbackMethod: "POST",
    });
    registerCallSession({
      callSid: call.sid,
      agentIdentity: safeAgentIdentity,
      contactId,
      customerPhone: to,
      startedAt: new Date().toISOString(),
      extracted: {},
    });
    pushToAgent(safeAgentIdentity, {
      type: "call-status",
      payload: { callSid: call.sid, state: "dialing", contactId },
    });
    res.json({ callSid: call.sid, agentIdentity: safeAgentIdentity });
  } catch (e) {
    logger.error({ err: (e as Error).message }, "call.start failed");
    res.status(500).json({ error: (e as Error).message });
  }
});
