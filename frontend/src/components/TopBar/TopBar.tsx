import { useState } from "react";
import { useNavigate } from "react-router-dom";
import type { ChecklistItemTemplate, Contact } from "../../types/domain";
import CallStatus from "./CallStatus";
import ContactsManagerModal from "./ContactsManagerModal";
import DialPad from "./DialPad";
import CallControls from "./CallControls";
import { useTranslation } from "react-i18next";
import { useAppStore } from "../../store/useAppStore";
import { useCallStore } from "../../store/useCallStore";
import type { Lang } from "../../types/domain";
import i18n from "../../i18n";

interface Props {
  contacts: Contact[];
  checklistTpl: ChecklistItemTemplate[];
  onContactsChanged: () => void;
}

function GearIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        d="M8.34 1.804A1 1 0 0 1 9.32 1h1.36a1 1 0 0 1 .98.804l.216 1.08a6.99 6.99 0 0 1 1.837 1.06l1.045-.352a1 1 0 0 1 1.135.44l.68 1.178a1 1 0 0 1-.198 1.207l-.803.741a7.011 7.011 0 0 1 0 2.122l.803.74a1 1 0 0 1 .198 1.208l-.68 1.178a1 1 0 0 1-1.135.44l-1.045-.351a6.99 6.99 0 0 1-1.837 1.059l-.216 1.08a1 1 0 0 1-.98.804H9.32a1 1 0 0 1-.98-.804l-.216-1.08a6.99 6.99 0 0 1-1.837-1.06l-1.045.352a1 1 0 0 1-1.135-.44l-.68-1.178a1 1 0 0 1 .198-1.207l.803-.741a7.011 7.011 0 0 1 0-2.122l-.803-.74a1 1 0 0 1-.198-1.208l.68-1.178a1 1 0 0 1 1.135-.44l1.045.351a6.99 6.99 0 0 1 1.837-1.059l.216-1.08zM10 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function LogoutIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        d="M3 4.75A2.75 2.75 0 0 1 5.75 2h4.5A2.75 2.75 0 0 1 13 4.75V5.5a.75.75 0 0 1-1.5 0v-.75c0-.69-.56-1.25-1.25-1.25h-4.5c-.69 0-1.25.56-1.25 1.25v10.5c0 .69.56 1.25 1.25 1.25h4.5c.69 0 1.25-.56 1.25-1.25v-.75a.75.75 0 0 1 1.5 0v.75A2.75 2.75 0 0 1 10.25 18h-4.5A2.75 2.75 0 0 1 3 15.25V4.75z"
        clipRule="evenodd"
      />
      <path
        fillRule="evenodd"
        d="M16.72 10.53a.75.75 0 0 0 0-1.06l-2.5-2.5a.75.75 0 1 0-1.06 1.06l1.22 1.22H8.75a.75.75 0 0 0 0 1.5h5.63l-1.22 1.22a.75.75 0 1 0 1.06 1.06l2.5-2.5z"
        clipRule="evenodd"
      />
    </svg>
  );
}

export default function TopBar({ contacts, checklistTpl, onContactsChanged }: Props) {
  const { t } = useTranslation();
  const nav = useNavigate();
  const { lang, setLang, agentName, logout } = useAppStore();
  const resetCall = useCallStore((s) => s.resetCall);
  const callState = useCallStore((s) => s.callState);
  const [contactsOpen, setContactsOpen] = useState(false);

  const inCall =
    callState === "connected" ||
    callState === "muted" ||
    callState === "dialing" ||
    callState === "ringing";

  const onLang = (l: Lang) => {
    setLang(l);
    i18n.changeLanguage(l);
  };

  const onSettings = () => nav("/setup");
  const onLogout = () => {
    resetCall();
    logout();
    nav("/login", { replace: true });
  };

  return (
    <div className="bg-white border-b border-brand-100 px-4 py-3 flex items-center gap-4 shadow-clinical">
      <div className="flex items-center gap-2 text-brand-700 font-semibold text-lg tracking-tight">
        <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-brand-500 text-white shadow-clinical" aria-hidden="true">
          <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
            <path d="M8.5 2.5A1.5 1.5 0 0 1 10 1h0a1.5 1.5 0 0 1 1.5 1.5v4h4A1.5 1.5 0 0 1 17 8v0a1.5 1.5 0 0 1-1.5 1.5h-4v4A1.5 1.5 0 0 1 10 15h0a1.5 1.5 0 0 1-1.5-1.5v-4h-4A1.5 1.5 0 0 1 3 8v0a1.5 1.5 0 0 1 1.5-1.5h4v-4z" />
          </svg>
        </span>
        {t("app.title")}
      </div>
      <div className="flex items-center gap-2 ml-4">
        <button
          onClick={() => setContactsOpen(true)}
          className="border border-brand-200 rounded-lg px-3 py-2 text-sm hover:bg-brand-50 text-brand-800 font-medium"
        >
          {t("top.contacts")}
        </button>
        <DialPad />
        <CallControls />
      </div>
      <ContactsManagerModal
        open={contactsOpen}
        onClose={() => setContactsOpen(false)}
        contacts={contacts}
        checklistTpl={checklistTpl}
        onChanged={onContactsChanged}
      />
      <div className="ml-auto flex items-center gap-3">
        <CallStatus />
        <div className="flex items-center gap-1 text-xs">
          {(["ja", "en", "zh"] as Lang[]).map((l) => (
            <button
              key={l}
              onClick={() => onLang(l)}
              className={
                lang === l
                  ? "bg-brand-500 text-white rounded px-2 py-1"
                  : "text-slate-500 hover:bg-slate-100 rounded px-2 py-1"
              }
            >
              {l.toUpperCase()}
            </button>
          ))}
        </div>
        <div className="text-sm text-slate-500">@ {agentName}</div>
        <div className="h-6 w-px bg-brand-100" aria-hidden="true" />
        <button
          onClick={onSettings}
          title={t("top.settings")}
          aria-label={t("top.settings")}
          className="text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded p-1.5"
        >
          <GearIcon className="w-5 h-5" />
        </button>
        <button
          onClick={onLogout}
          disabled={inCall}
          title={
            inCall
              ? `${t("top.logout")} (${t("top.status.connected")})`
              : t("top.logout")
          }
          aria-label={t("top.logout")}
          className="text-slate-500 hover:text-red-600 hover:bg-red-50 rounded p-1.5 disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-slate-500 disabled:cursor-not-allowed"
        >
          <LogoutIcon className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
