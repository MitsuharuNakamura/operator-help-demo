import twilio from "twilio";
import { logger } from "./logger.js";

const INTELLIGENCE_BASE = "https://intelligence.twilio.com/v3";

async function intel(method: string, urlPath: string, body?: unknown) {
  const key = process.env.TWILIO_API_KEY_SID!;
  const secret = process.env.TWILIO_API_KEY_SECRET!;
  const auth = Buffer.from(`${key}:${secret}`).toString("base64");
  const res = await fetch(`${INTELLIGENCE_BASE}${urlPath}`, {
    method,
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`[${res.status}] ${method} ${urlPath}\n${text}`);
  return text ? JSON.parse(text) : {};
}

interface SyncResult {
  twimlApp: boolean;
  incomingNumber: boolean;
  ciRules: boolean;
  errors: string[];
}

/**
 * baseUrl (ngrok HTTPS など) を使って、Twilio 側の以下 webhook を一括更新する:
 *  - TwiML App voiceUrl
 *  - 電話番号 (TWILIO_CALLER_ID) の voiceUrl / statusCallback
 *  - Intelligence Configuration 内の Rules の webhook actions.url
 *
 * それぞれベストエフォート — 失敗しても他は続行する。
 */
export async function syncWebhooks(baseUrl: string): Promise<SyncResult> {
  const base = baseUrl.replace(/\/$/, "");
  const result: SyncResult = {
    twimlApp: false,
    incomingNumber: false,
    ciRules: false,
    errors: [],
  };

  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const apiKey = process.env.TWILIO_API_KEY_SID;
  const apiSecret = process.env.TWILIO_API_KEY_SECRET;
  if (!accountSid || !apiKey || !apiSecret) {
    result.errors.push("Twilio credentials missing");
    return result;
  }
  const client = twilio(apiKey, apiSecret, { accountSid });

  // 1) TwiML App voiceUrl
  const twimlAppSid = process.env.TWILIO_TWIML_APP_SID;
  if (twimlAppSid && twimlAppSid.startsWith("AP")) {
    try {
      await client.applications(twimlAppSid).update({
        voiceUrl: `${base}/twilio/voice/outbound`,
        voiceMethod: "POST",
      });
      result.twimlApp = true;
      logger.info(
        { twimlAppSid, url: `${base}/twilio/voice/outbound` },
        "TwiML App voiceUrl updated",
      );
    } catch (e) {
      result.errors.push(`TwiML App: ${(e as Error).message}`);
      logger.warn({ err: (e as Error).message }, "TwiML App update failed");
    }
  } else {
    logger.info("TWILIO_TWIML_APP_SID missing/dummy — skipping TwiML App update");
  }

  // 2) IncomingPhoneNumber の Voice Webhook / Status
  const callerId = process.env.TWILIO_CALLER_ID;
  if (callerId && /^\+/.test(callerId)) {
    try {
      const list = await client.incomingPhoneNumbers.list({
        phoneNumber: callerId,
        limit: 1,
      });
      const found = list[0];
      if (found) {
        await client.incomingPhoneNumbers(found.sid).update({
          voiceUrl: `${base}/twilio/voice/inbound`,
          voiceMethod: "POST",
          statusCallback: `${base}/twilio/voice/status`,
          statusCallbackMethod: "POST",
        });
        result.incomingNumber = true;
        logger.info(
          { phoneSid: found.sid, callerId },
          "IncomingPhoneNumber webhooks updated",
        );
      } else {
        result.errors.push(
          `IncomingPhoneNumber not found for ${callerId}`,
        );
      }
    } catch (e) {
      result.errors.push(`IncomingPhoneNumber: ${(e as Error).message}`);
      logger.warn(
        { err: (e as Error).message },
        "IncomingPhoneNumber update failed",
      );
    }
  }

  // 3) Intelligence Configuration の Rules の webhook URL
  const configId = process.env.TWILIO_INTELLIGENCE_CONFIG_ID;
  if (configId && configId.startsWith("intelligence_configuration_")) {
    try {
      const current = await intel(
        "GET",
        `/ControlPlane/Configurations/${configId}`,
      );
      const rules = Array.isArray(current.rules) ? current.rules : [];
      const newRules = rules.map((r: any) => {
        const actions = Array.isArray(r.actions) ? r.actions : [];
        const triggers = Array.isArray(r.triggers) ? r.triggers : [];
        const trigger = triggers[0]?.on;
        const url =
          trigger === "CONVERSATION_END"
            ? `${base}/twilio/ci/end`
            : `${base}/twilio/ci/rule`;
        return {
          ...r,
          actions: actions.map((a: any) => ({ ...a, url })),
        };
      });
      await intel("PUT", `/ControlPlane/Configurations/${configId}`, {
        ...current,
        rules: newRules,
      });
      result.ciRules = true;
      logger.info(
        { configId, ruleCount: newRules.length },
        "Intelligence Rules webhooks updated",
      );
    } catch (e) {
      result.errors.push(`CI Rules: ${(e as Error).message}`);
      logger.warn({ err: (e as Error).message }, "CI Rules update failed");
    }
  }

  return result;
}
