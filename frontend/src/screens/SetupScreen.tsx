import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAppStore } from "../store/useAppStore";
import type { Lang, TranscriptionConfig } from "../types/domain";
import i18n from "../i18n";
import { api } from "../api/http";

// engine ごとに提示する speechModel の候補
const MODEL_OPTIONS: Record<"google" | "deepgram", string[]> = {
  google: ["long", "telephony", "short"],
  deepgram: ["nova-3-general", "nova-2"],
};

export default function SetupScreen() {
  const { t } = useTranslation();
  const nav = useNavigate();
  const { lang, setLang } = useAppStore();
  const [busy, setBusy] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);
  const [tx, setTx] = useState<TranscriptionConfig | null>(null);
  const [loadingTx, setLoadingTx] = useState(true);
  const [hintsPreview, setHintsPreview] = useState<{ count: number; words: string[] } | null>(null);
  const [hintsExpanded, setHintsExpanded] = useState(false);

  useEffect(() => {
    api
      .getTranscriptionConfig()
      .then((c) => setTx(c))
      .catch(() => {
        setTx({
          languageCode: "ja-JP",
          engine: "google",
          speechModel: "long",
          hintsEnabled: true,
          hintsExtra: "",
        });
      })
      .finally(() => setLoadingTx(false));
    api
      .getTranscriptionHints()
      .then((h) => setHintsPreview({ count: h.count, words: h.words }))
      .catch(() => setHintsPreview(null));
  }, []);

  const onLang = (l: Lang) => {
    setLang(l);
    i18n.changeLanguage(l);
  };

  const setEngine = (engine: "google" | "deepgram") => {
    if (!tx) return;
    const defaultModel = MODEL_OPTIONS[engine][0];
    setTx({ ...tx, engine, speechModel: defaultModel });
  };

  const proceed = async () => {
    setBusy(true);
    setMicError(null);
    try {
      if (tx) {
        await api.updateTranscriptionConfig(tx);
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop());
      nav("/");
    } catch (e) {
      const msg = (e as Error).message;
      if (/permission|denied|NotAllowedError/i.test(msg)) {
        setMicError(t("errors.micDenied"));
      } else {
        setMicError(msg);
      }
    } finally {
      setBusy(false);
    }
  };

  const models = tx ? MODEL_OPTIONS[tx.engine] : [];
  const incompatible =
    tx?.engine === "google" &&
    tx.speechModel === "telephony" &&
    tx.hintsEnabled;

  return (
    <div className="min-h-screen flex items-center justify-center px-6 py-8 bg-brand-50">
      <div className="w-full max-w-lg bg-white rounded-clinical shadow-clinical border border-brand-100 p-8 space-y-6">
        <div className="flex items-center gap-3">
          <span
            className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-brand-500 text-white shadow-clinical"
            aria-hidden="true"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
              <path d="M8.5 2.5A1.5 1.5 0 0 1 10 1h0a1.5 1.5 0 0 1 1.5 1.5v4h4A1.5 1.5 0 0 1 17 8v0a1.5 1.5 0 0 1-1.5 1.5h-4v4A1.5 1.5 0 0 1 10 15h0a1.5 1.5 0 0 1-1.5-1.5v-4h-4A1.5 1.5 0 0 1 3 8v0a1.5 1.5 0 0 1 1.5-1.5h4v-4z" />
            </svg>
          </span>
          <h1 className="text-xl font-semibold text-brand-900 tracking-tight">
            {t("setup.heading")}
          </h1>
        </div>

        <div>
          <label className="block text-sm text-clinical-mutedText mb-2 font-medium">
            {t("setup.language")}
          </label>
          <div className="grid grid-cols-3 gap-2">
            {(["ja", "en", "zh"] as Lang[]).map((l) => (
              <button
                key={l}
                onClick={() => onLang(l)}
                className={`py-2 rounded-lg border transition ${
                  lang === l
                    ? "bg-brand-500 border-brand-600 text-white shadow-clinical"
                    : "border-brand-200 text-brand-900 hover:bg-brand-50"
                }`}
              >
                {l === "ja" ? "日本語" : l === "en" ? "English" : "中文"}
              </button>
            ))}
          </div>
        </div>

        <div className="border-t border-brand-100 pt-5 space-y-4">
          <div>
            <div className="text-sm text-clinical-mutedText font-medium mb-1">
              {t("setup.transcription.heading")}
            </div>
            <p className="text-[11px] text-clinical-mutedText leading-relaxed">
              {t("setup.transcription.note")}
            </p>
          </div>

          {loadingTx || !tx ? (
            <div className="text-xs text-slate-400">Loading...</div>
          ) : (
            <>
              <div>
                <label className="block text-xs text-clinical-mutedText mb-1">
                  {t("setup.transcription.engine")}
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {(["google", "deepgram"] as const).map((e) => (
                    <button
                      key={e}
                      onClick={() => setEngine(e)}
                      className={`py-2 rounded-lg border text-sm transition ${
                        tx.engine === e
                          ? "bg-brand-500 border-brand-600 text-white shadow-clinical"
                          : "border-brand-200 text-brand-900 hover:bg-brand-50"
                      }`}
                    >
                      {t(`setup.transcription.engines.${e}`)}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs text-clinical-mutedText mb-1">
                  {t("setup.transcription.speechModel")}
                </label>
                <select
                  className="w-full border border-brand-200 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
                  value={tx.speechModel}
                  onChange={(e) =>
                    setTx({ ...tx, speechModel: e.target.value })
                  }
                >
                  {models.map((m) => (
                    <option key={m} value={m}>
                      {t(`setup.transcription.models.${m}`, {
                        defaultValue: m,
                      })}
                    </option>
                  ))}
                </select>
                {incompatible && (
                  <p className="mt-1 text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1">
                    {t("setup.transcription.hintsIncompat")}
                  </p>
                )}
              </div>

              <div>
                <label className="flex items-center gap-2 text-sm text-brand-900 cursor-pointer">
                  <input
                    type="checkbox"
                    className="accent-brand-600"
                    checked={tx.hintsEnabled}
                    onChange={(e) =>
                      setTx({ ...tx, hintsEnabled: e.target.checked })
                    }
                  />
                  <span>{t("setup.transcription.hintsEnabled")}</span>
                </label>
                <p className="mt-0.5 text-[11px] text-clinical-mutedText pl-6">
                  {t("setup.transcription.hintsEnabledHint")}
                </p>
              </div>

              {tx.hintsEnabled && (
                <>
                  {hintsPreview && (
                    <div className="rounded-lg border border-brand-100 bg-brand-50/60 px-3 py-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-brand-800">
                          {t("setup.transcription.hintsBaseline", {
                            count: hintsPreview.count,
                          })}
                        </span>
                        <button
                          type="button"
                          onClick={() => setHintsExpanded((v) => !v)}
                          className="text-[11px] text-brand-700 hover:text-brand-900 underline"
                        >
                          {hintsExpanded
                            ? t("setup.transcription.hintsHide")
                            : t("setup.transcription.hintsShow")}
                        </button>
                      </div>
                      {hintsExpanded && (
                        <div className="mt-2 max-h-32 overflow-auto text-[11px] text-slate-700 leading-relaxed">
                          {hintsPreview.words.join("、")}
                        </div>
                      )}
                    </div>
                  )}
                  <div>
                    <label className="block text-xs text-clinical-mutedText mb-1">
                      {t("setup.transcription.hintsExtra")}
                    </label>
                    <textarea
                      className="w-full border border-brand-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none min-h-[60px]"
                      placeholder={t(
                        "setup.transcription.hintsExtraPlaceholder",
                      )}
                      value={tx.hintsExtra}
                      onChange={(e) =>
                        setTx({ ...tx, hintsExtra: e.target.value })
                      }
                    />
                  </div>
                </>
              )}
            </>
          )}
        </div>

        <p className="text-xs text-clinical-mutedText">{t("setup.micHint")}</p>

        {micError && (
          <div className="text-clinical-err text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {micError}
          </div>
        )}

        <button
          onClick={proceed}
          disabled={busy || loadingTx}
          className="w-full bg-brand-600 hover:bg-brand-700 text-white rounded-lg py-2.5 font-semibold disabled:opacity-50 shadow-clinical transition"
        >
          {t("setup.continue")}
        </button>
      </div>
    </div>
  );
}
