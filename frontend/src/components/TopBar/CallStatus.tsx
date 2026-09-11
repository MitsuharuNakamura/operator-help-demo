import clsx from "clsx";
import { useTranslation } from "react-i18next";
import { useCallStore } from "../../store/useCallStore";

const COLORS: Record<string, string> = {
  idle: "bg-brand-100 text-brand-800",
  dialing: "bg-amber-100 text-amber-800",
  ringing: "bg-amber-200 text-amber-900",
  connected: "bg-emerald-100 text-emerald-800",
  muted: "bg-orange-100 text-orange-800",
  ended: "bg-brand-100 text-brand-600",
  failed: "bg-red-100 text-red-800",
};

export default function CallStatus() {
  const { t } = useTranslation();
  const state = useCallStore((s) => s.callState);
  return (
    <div
      className={clsx(
        "inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium",
        COLORS[state] || COLORS.idle,
      )}
    >
      <span className="w-2 h-2 rounded-full bg-current" />
      {t(`top.status.${state}`)}
    </div>
  );
}
