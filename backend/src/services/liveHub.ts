import type { WebSocket } from "ws";
import type { CallSession, LiveEvent } from "../types/domain.js";
import { logger } from "./logger.js";

const agentConnections = new Map<string, Set<WebSocket>>();
const callSessions = new Map<string, CallSession>();
const conversationToCall = new Map<string, string>();

export function registerConnection(agentId: string, ws: WebSocket) {
  let set = agentConnections.get(agentId);
  if (!set) {
    set = new Set();
    agentConnections.set(agentId, set);
  }
  set.add(ws);
  logger.info({ agentId, size: set.size }, "ws connect");

  ws.on("close", () => {
    set!.delete(ws);
    if (set!.size === 0) agentConnections.delete(agentId);
    logger.info({ agentId }, "ws close");
  });
}

const pushCounters = new Map<string, number>();

export function pushToAgent(agentId: string, event: LiveEvent) {
  const set = agentConnections.get(agentId);
  if (!set) {
    logger.warn({ agentId, type: event.type }, "no ws for agent");
    return;
  }
  const payload = JSON.stringify(event);
  let sent = 0;
  let closed = 0;
  for (const ws of set) {
    if (ws.readyState === ws.OPEN) {
      ws.send(payload);
      sent++;
    } else {
      closed++;
    }
  }
  if (sent === 0 && closed > 0) {
    logger.warn(
      { agentId, type: event.type, closed },
      "no OPEN ws for agent (all closed)",
    );
  }
  // debug: transcript の push 累計を 20 件毎にログ
  if (event.type === "transcript") {
    const key = `${agentId}:transcript`;
    const n = (pushCounters.get(key) || 0) + 1;
    pushCounters.set(key, n);
    if (n % 20 === 0) {
      logger.info({ agentId, wsCount: set.size, sent, closed, total: n }, "ws push transcript");
    }
  }
}

export function pushToCall(callSid: string, event: LiveEvent) {
  const session = callSessions.get(callSid);
  if (!session) {
    logger.warn({ callSid, type: event.type }, "no session for callSid");
    return;
  }
  pushToAgent(session.agentIdentity, event);
}

export function broadcast(event: LiveEvent) {
  const payload = JSON.stringify(event);
  for (const set of agentConnections.values()) {
    for (const ws of set) {
      if (ws.readyState === ws.OPEN) ws.send(payload);
    }
  }
}

export function registerCallSession(session: CallSession) {
  callSessions.set(session.callSid, session);
}

export function getCallSession(callSid: string): CallSession | undefined {
  return callSessions.get(callSid);
}

export function endCallSession(callSid: string, endedAt: string) {
  const s = callSessions.get(callSid);
  if (!s) return;
  s.endedAt = endedAt;
}

export function updateExtracted(
  callSid: string,
  patch: Record<string, unknown>,
) {
  const s = callSessions.get(callSid);
  if (!s) return;
  s.extracted = { ...s.extracted, ...patch };
}

function normalizePhone(p: string | undefined | null): string {
  if (!p) return "";
  return String(p).replace(/[^\d+]/g, "");
}

/**
 * CI webhook が渡してくる conversationId / participants から
 * 対応する callSession を引き当てる。
 *
 *  1. すでに紐付けキャッシュがあればそれを返す
 *  2. participants の電話番号が customerPhone と一致する active session
 *  3. 最新に開始した active session (endedAt 未設定のもの)
 */
export function findCallForConversation(
  conversationId: string | undefined,
  participantAddresses: string[] = [],
): CallSession | undefined {
  if (conversationId) {
    const cached = conversationToCall.get(conversationId);
    if (cached) {
      const s = callSessions.get(cached);
      if (s) return s;
    }
  }

  const normalizedParticipants = participantAddresses
    .map(normalizePhone)
    .filter(Boolean);

  const active = [...callSessions.values()]
    .filter((s) => !s.endedAt)
    .sort((a, b) => (a.startedAt < b.startedAt ? 1 : -1));

  const byPhone = active.find((s) => {
    const cp = normalizePhone(s.customerPhone);
    return cp && normalizedParticipants.some((p) => p === cp || p.endsWith(cp) || cp.endsWith(p));
  });

  const chosen = byPhone || active[0];
  if (chosen && conversationId) {
    conversationToCall.set(conversationId, chosen.callSid);
    chosen.conversationId = conversationId;
  }
  return chosen;
}
