import clsx from "clsx";
import { useTranslation } from "react-i18next";
import type { TalklistItemTemplate } from "../types/domain";
import { useAppStore } from "../store/useAppStore";
import { useCallStore } from "../store/useCallStore";

interface Props {
  template: TalklistItemTemplate[];
}

export default function TalklistPanel({ template }: Props) {
  const { t } = useTranslation();
  const lang = useAppStore((s) => s.lang);
  const items = useCallStore((s) => s.talklist);

  return (
    <section className="bg-white rounded-clinical shadow-clinical border border-brand-100 p-4 h-full flex flex-col">
      <div className="text-base tracking-wide text-brand-800 font-semibold mb-2 flex items-center gap-2 before:content-[''] before:w-2 before:h-2 before:rounded-full before:bg-brand-500">
        {t("talklist.heading")}
      </div>
      <ol className="flex-1 overflow-auto divide-y divide-slate-100">
        {template.map((it, idx) => {
          const done = items[it.id]?.done;
          return (
            <li key={it.id} className="py-2 flex items-start gap-3">
              <span
                className={clsx(
                  "mt-1 inline-flex w-5 h-5 rounded-full items-center justify-center text-xs",
                  done
                    ? "bg-brand-500 text-white"
                    : "bg-slate-100 text-slate-500",
                )}
              >
                {idx + 1}
              </span>
              <div className="flex-1">
                <div
                  className={clsx(
                    "text-sm",
                    done
                      ? "text-slate-400 line-through"
                      : "text-slate-800",
                  )}
                >
                  {it.label[lang]}
                </div>
                {items[it.id]?.evidence && (
                  <div className="text-xs text-slate-500 mt-0.5 italic">
                    {items[it.id]?.evidence}
                  </div>
                )}
              </div>
              <span
                className={clsx(
                  "text-[10px] px-1.5 py-0.5 rounded border",
                  done
                    ? "text-emerald-700 bg-emerald-50 border-emerald-200"
                    : "text-slate-500 bg-slate-50 border-slate-200",
                )}
              >
                {done ? t("talklist.done") : t("talklist.pending")}
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
