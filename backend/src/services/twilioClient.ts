import twilio from "twilio";
import crypto from "node:crypto";

let cachedClient: ReturnType<typeof twilio> | null = null;

/**
 * Twilio Voice Client identity は `0-9 A-Z a-z - _ .` のみ許可。
 * 日本語・空白などが入った表示名を安全な id に正規化する。
 * 決定論的 (同じ入力 → 同じ出力) にして、リロード後も同じ identity になるようにする。
 * 冪等 — 既に "agent-xxx" 形式で来た場合は再 prefix しない。
 */
export function toSafeAgentId(raw: string): string {
  if (raw && /^agent-[0-9A-Za-z._-]+$/.test(raw) && raw.length <= 40) {
    return raw;
  }
  const stripped = (raw || "")
    .normalize("NFKC")
    .replace(/[^0-9A-Za-z._-]/g, "")
    .slice(0, 32);
  if (stripped) return `agent-${stripped}`;
  const hash = crypto.createHash("sha1").update(raw || "").digest("hex");
  return `agent-${hash.slice(0, 12)}`;
}

export function getTwilioClient() {
  if (cachedClient) return cachedClient;

  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const apiKeySid = process.env.TWILIO_API_KEY_SID;
  const apiKeySecret = process.env.TWILIO_API_KEY_SECRET;

  if (!accountSid || !apiKeySid || !apiKeySecret) {
    throw new Error(
      "Twilio credentials missing. Set TWILIO_ACCOUNT_SID / TWILIO_API_KEY_SID / TWILIO_API_KEY_SECRET in backend/.env",
    );
  }

  cachedClient = twilio(apiKeySid, apiKeySecret, { accountSid });
  return cachedClient;
}

export function issueVoiceAccessToken(identity: string, ttlSeconds = 3600) {
  const {
    TWILIO_ACCOUNT_SID,
    TWILIO_API_KEY_SID,
    TWILIO_API_KEY_SECRET,
    TWILIO_TWIML_APP_SID,
  } = process.env;

  if (
    !TWILIO_ACCOUNT_SID ||
    !TWILIO_API_KEY_SID ||
    !TWILIO_API_KEY_SECRET ||
    !TWILIO_TWIML_APP_SID
  ) {
    throw new Error("Missing Twilio env vars for AccessToken issuance");
  }

  const AccessToken = twilio.jwt.AccessToken;
  const VoiceGrant = AccessToken.VoiceGrant;

  const token = new AccessToken(
    TWILIO_ACCOUNT_SID,
    TWILIO_API_KEY_SID,
    TWILIO_API_KEY_SECRET,
    { identity, ttl: ttlSeconds },
  );
  token.addGrant(
    new VoiceGrant({
      outgoingApplicationSid: TWILIO_TWIML_APP_SID,
      incomingAllow: true,
    }),
  );
  return token.toJwt();
}
