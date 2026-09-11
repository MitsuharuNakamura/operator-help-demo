import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAppStore } from "../store/useAppStore";

export default function LoginScreen() {
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const setAgent = useAppStore((s) => s.setAgent);
  const nav = useNavigate();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const v = name.trim();
    if (!v) return;
    setAgent(v);
    nav("/setup");
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-6 bg-brand-50">
      <form
        onSubmit={submit}
        className="w-full max-w-sm bg-white rounded-clinical shadow-clinical border border-brand-100 p-8 space-y-6"
      >
        <div className="flex items-center gap-3">
          <span
            className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-brand-500 text-white shadow-clinical"
            aria-hidden="true"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="w-6 h-6">
              <path d="M8.5 2.5A1.5 1.5 0 0 1 10 1h0a1.5 1.5 0 0 1 1.5 1.5v4h4A1.5 1.5 0 0 1 17 8v0a1.5 1.5 0 0 1-1.5 1.5h-4v4A1.5 1.5 0 0 1 10 15h0a1.5 1.5 0 0 1-1.5-1.5v-4h-4A1.5 1.5 0 0 1 3 8v0a1.5 1.5 0 0 1 1.5-1.5h4v-4z" />
            </svg>
          </span>
          <div>
            <div className="text-xs uppercase tracking-wider text-brand-600 font-medium">
              {t("app.subtitle")}
            </div>
            <h1 className="text-xl font-semibold text-brand-900 tracking-tight">
              {t("app.title")}
            </h1>
          </div>
        </div>
        <div>
          <label className="block text-sm text-clinical-mutedText mb-1 font-medium">
            {t("login.nameLabel")}
          </label>
          <input
            className="w-full border border-brand-200 bg-white rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition"
            placeholder={t("login.namePlaceholder")}
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
        </div>
        <button
          type="submit"
          className="w-full bg-brand-600 hover:bg-brand-700 text-white rounded-lg py-2.5 font-semibold shadow-clinical transition"
        >
          {t("login.continue")}
        </button>
      </form>
    </div>
  );
}
