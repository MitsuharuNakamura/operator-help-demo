import { Device, Call } from "@twilio/voice-sdk";
import { useCallStore } from "../store/useCallStore";
import { api } from "./http";

let device: Device | null = null;
let activeCall: Call | null = null;

/**
 * agentRawName (localStorage の表示名) を渡すと、backend が sanitize した
 * 正規 identity ("agent-xxx") を返すのでそれを使って Device を register する。
 * WS / call.start でも同じ identity を使う必要があるので、識別子を戻り値で返す。
 */
export async function initDevice(
  agentRawName: string,
): Promise<{ identity: string }> {
  const { token, identity } = await api.getToken(agentRawName);
  if (!device) {
    device = new Device(token, { logLevel: "warn" });
    device.on("registered", () => {
      console.info("[twilio] device registered", identity);
    });
    device.on("error", (err) => {
      console.error("[twilio] device error", err);
      useCallStore.getState().setError(err.message);
    });
    device.on("incoming", (call) => {
      activeCall = call;
      attachCallListeners(call);
      call.accept();
    });
    await device.register();
  }
  return { identity };
}

function attachCallListeners(call: Call) {
  call.on("accept", () => {
    useCallStore.getState().setCallState("connected");
  });
  call.on("disconnect", () => {
    useCallStore.getState().setCallState("ended");
    activeCall = null;
  });
  call.on("cancel", () => {
    useCallStore.getState().setCallState("ended");
    activeCall = null;
  });
  call.on("reject", () => {
    useCallStore.getState().setCallState("failed");
    activeCall = null;
  });
  call.on("error", (err) => {
    useCallStore.getState().setError(err.message);
    useCallStore.getState().setCallState("failed");
    activeCall = null;
  });
}

export async function startOutboundCall(
  to: string,
  agentIdentity: string,
  contactId?: string,
) {
  useCallStore.getState().clearTranscript();
  useCallStore.getState().setCallState("dialing");
  try {
    await api.startCall(to, agentIdentity, contactId);
  } catch (e) {
    useCallStore.getState().setCallState("failed");
    useCallStore.getState().setError((e as Error).message);
  }
}

export function hangup() {
  if (activeCall) {
    activeCall.disconnect();
  } else {
    useCallStore.getState().setCallState("idle");
  }
}

export function toggleMute() {
  if (!activeCall) return;
  const wasMuted = activeCall.isMuted();
  activeCall.mute(!wasMuted);
  useCallStore
    .getState()
    .setCallState(!wasMuted ? "muted" : "connected");
}

export function isCallActive() {
  return !!activeCall;
}
