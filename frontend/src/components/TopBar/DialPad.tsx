import { useTranslation } from "react-i18next";
import { useCallStore } from "../../store/useCallStore";

export default function DialPad() {
  const { t } = useTranslation();
  const dial = useCallStore((s) => s.dialInput);
  const setDial = useCallStore((s) => s.setDialInput);

  return (
    <input
      value={dial}
      onChange={(e) => setDial(e.target.value)}
      placeholder={t("top.phonePlaceholder")}
      className="w-56 border border-slate-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-brand-500 font-mono"
    />
  );
}
