import { useTranslation } from "react-i18next";
import { useCallStore } from "../../store/useCallStore";
import { useAppStore } from "../../store/useAppStore";
import { hangup, startOutboundCall, toggleMute } from "../../api/twilioClient";

export default function CallControls() {
  const { t } = useTranslation();
  const state = useCallStore((s) => s.callState);
  const dial = useCallStore((s) => s.dialInput);
  const contact = useCallStore((s) => s.activeContact);
  const agentId = useAppStore((s) => s.agentId);
  const agentName = useAppStore((s) => s.agentName);
  const setError = useCallStore((s) => s.setError);

  const canCall = state === "idle" || state === "ended" || state === "failed";
  const isLive =
    state === "connected" || state === "muted" || state === "ringing" ||
    state === "dialing";
  const isMuted = state === "muted";

  const onCall = async () => {
    if (!dial) {
      setError(t("errors.callFailed"));
      return;
    }
    setError(null);
    await startOutboundCall(dial, agentId || agentName, contact?.id);
  };

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={onCall}
        disabled={!canCall}
        className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white rounded-lg px-4 py-2 text-sm font-semibold"
      >
        {t("top.call")}
      </button>
      <button
        onClick={hangup}
        disabled={!isLive}
        className="bg-red-600 hover:bg-red-700 disabled:opacity-40 text-white rounded-lg px-4 py-2 text-sm font-semibold"
      >
        {t("top.hangup")}
      </button>
      <button
        onClick={toggleMute}
        disabled={state !== "connected" && state !== "muted"}
        className="border border-slate-300 hover:bg-slate-50 disabled:opacity-40 rounded-lg px-4 py-2 text-sm font-medium"
      >
        {isMuted ? t("top.unmute") : t("top.mute")}
      </button>
    </div>
  );
}
