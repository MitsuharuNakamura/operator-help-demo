import { useTranslation } from "react-i18next";
import { useCallStore } from "../store/useCallStore";

export default function PostCallCIPanel() {
  const { t } = useTranslation();
  const postCall = useCallStore((s) => s.postCall);
  const close = useCallStore((s) => s.closePostCall);
  if (!postCall.open) return null;
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-30 p-6">
      <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[80vh] overflow-auto p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-brand-700">
            {t("postCall.heading")}
          </h2>
          <button
            onClick={close}
            className="text-sm text-slate-500 hover:text-slate-800"
          >
            {t("postCall.close")}
          </button>
        </div>
        {postCall.summary && (
          <div>
            <div className="text-xs uppercase text-slate-500">
              {t("postCall.summary")}
            </div>
            <p className="text-sm text-slate-800 whitespace-pre-wrap">
              {postCall.summary}
            </p>
          </div>
        )}
        {postCall.sentiment && (
          <div>
            <div className="text-xs uppercase text-slate-500">
              {t("postCall.sentiment")}
            </div>
            <p className="text-sm text-slate-800">{postCall.sentiment}</p>
          </div>
        )}
        {postCall.operators && postCall.operators.length > 0 && (
          <div className="space-y-2">
            {postCall.operators.map((op, i) => (
              <div
                key={i}
                className="border border-slate-200 rounded-lg p-3 text-sm"
              >
                <div className="text-xs text-slate-500 font-mono">
                  {op.name} ({op.kind})
                </div>
                <pre className="text-xs text-slate-800 whitespace-pre-wrap">
                  {typeof op.result === "string"
                    ? op.result
                    : JSON.stringify(op.result, null, 2)}
                </pre>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
