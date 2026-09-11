import type { LiveEvent } from "../types/domain";
import { useCallStore } from "../store/useCallStore";

function resolveWsUrl(): string {
  if (import.meta.env.VITE_WS_URL) return import.meta.env.VITE_WS_URL as string;
  if (typeof window === "undefined") return "";
  const scheme = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${scheme}//${window.location.host}/ws/live`;
}
const WS_URL = resolveWsUrl();

let ws: WebSocket | null = null;
let retried = false;

export function connectLive(agentIdentity: string) {
  if (ws && ws.readyState !== WebSocket.CLOSED) return;
  const url = `${WS_URL}?agentId=${encodeURIComponent(agentIdentity)}`;
  ws = new WebSocket(url);

  ws.onmessage = (ev) => {
    try {
      const evt = JSON.parse(ev.data) as LiveEvent;
      dispatch(evt);
    } catch (e) {
      console.warn("bad ws payload", e);
    }
  };
  ws.onerror = () => {
    useCallStore.getState().setError("errors.wsDown");
  };
  ws.onclose = () => {
    if (!retried) {
      retried = true;
      setTimeout(() => connectLive(agentIdentity), 1500);
    } else {
      useCallStore.getState().setError("errors.wsDown");
    }
  };
  ws.onopen = () => {
    retried = false;
    useCallStore.getState().setError(null);
  };
}

export function closeLive() {
  ws?.close();
  ws = null;
}

function dispatch(evt: LiveEvent) {
  const store = useCallStore.getState();
  switch (evt.type) {
    case "transcript":
      store.addUtterance(evt.payload);
      break;
    case "call-status":
      store.setCallState(
        evt.payload.state,
        evt.payload.callSid ?? undefined,
      );
      if (evt.payload.state === "ended") {
        // keep transcript visible; user can start next call
      }
      break;
    case "verdict":
      if (evt.payload.kind === "checklist") {
        store.applyChecklist(evt.payload.items);
      } else if (evt.payload.kind === "talklist") {
        store.applyTalklist(evt.payload.items);
      } else if (evt.payload.kind === "jobs") {
        store.applyJobs(evt.payload.rankings);
      }
      break;
    case "ci-post-call":
      store.openPostCall({
        open: true,
        summary: evt.payload.summary,
        sentiment: evt.payload.sentiment,
        operators: evt.payload.operators,
      });
      break;
    case "error":
      store.setError(evt.payload.message);
      break;
  }
}
