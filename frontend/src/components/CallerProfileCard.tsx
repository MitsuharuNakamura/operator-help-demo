import { useEffect, useState } from "react";
import clsx from "clsx";
import { useTranslation } from "react-i18next";
import type { Contact } from "../types/domain";
import { useCallStore } from "../store/useCallStore";
import { useAppStore } from "../store/useAppStore";

const LOCAL_TRAIT_KEYS: {
  key: keyof Contact;
  label: { ja: string; en: string; zh: string };
}[] = [
  { key: "license", label: { ja: "保有資格", en: "License", zh: "持有资格" } },
  {
    key: "experienceYears",
    label: { ja: "経験年数", en: "Experience (yr)", zh: "工作年数" },
  },
  {
    key: "preferredPrefecture",
    label: { ja: "希望勤務地 (都道府県)", en: "Prefecture", zh: "期望都道府县" },
  },
  {
    key: "preferredCity",
    label: { ja: "希望勤務地 (市区町村)", en: "City", zh: "期望市区" },
  },
  {
    key: "preferredEmploymentType",
    label: { ja: "希望雇用形態", en: "Employment", zh: "雇佣形式" },
  },
  {
    key: "wantsNightShift",
    label: { ja: "夜勤可否", en: "Night shift", zh: "是否可夜班" },
  },
  {
    key: "hourlyWageMinJpy",
    label: { ja: "希望時給 (下限)", en: "Min wage", zh: "期望时薪" },
  },
];

function formatSimple(v: unknown): string {
  if (v == null || v === "") return "-";
  if (typeof v === "boolean") return v ? "OK" : "NG";
  if (Array.isArray(v)) return v.join(", ");
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden="true"
      className={clsx(
        "w-4 h-4 transition-transform",
        open ? "rotate-90" : "rotate-0",
      )}
    >
      <path
        fillRule="evenodd"
        d="M7.72 14.53a.75.75 0 0 1 0-1.06L11.19 10 7.72 6.53a.75.75 0 1 1 1.06-1.06l4 4a.75.75 0 0 1 0 1.06l-4 4a.75.75 0 0 1-1.06 0z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function CollapsibleSection({
  title,
  count,
  open,
  onToggle,
  children,
}: {
  title: string;
  count?: number;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div>
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-1.5 text-xs uppercase tracking-wider text-brand-800 font-semibold py-1 hover:text-brand-600 group"
        aria-expanded={open}
      >
        <ChevronIcon open={open} />
        <span>{title}</span>
        {typeof count === "number" && count > 0 && (
          <span className="ml-1 text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-brand-100 text-brand-800 group-hover:bg-brand-200">
            {count}
          </span>
        )}
      </button>
      {open && <div className="mt-1">{children}</div>}
    </div>
  );
}

export default function CallerProfileCard() {
  const { t } = useTranslation();
  const lang = useAppStore((s) => s.lang);
  const c = useCallStore((s) => s.activeContact);
  const memory = useCallStore((s) => s.callerMemory);

  const [summariesOpen, setSummariesOpen] = useState(false);
  const [observationsOpen, setObservationsOpen] = useState(false);
  const [traitsOpen, setTraitsOpen] = useState(true);

  // 相手が変わったら折りたたみ状態をリセット
  useEffect(() => {
    setSummariesOpen(false);
    setObservationsOpen(false);
    setTraitsOpen(true);
  }, [c?.id]);

  // trait 値を人間可読にする (employment/bool/array 対応)
  const humanizeValue = (
    group: string,
    key: string,
    val: unknown,
  ): string => {
    if (val == null || val === "") return "-";
    if (typeof val === "boolean") {
      return val ? t("traitValues.yes") : t("traitValues.no");
    }
    if (key === "preferredEmploymentType" && typeof val === "string") {
      const localized = t(`traitValues.employmentType.${val}`, {
        defaultValue: "",
      });
      if (localized) return localized;
    }
    if (Array.isArray(val)) return val.join(", ");
    if (typeof val === "object") return JSON.stringify(val);
    return String(val);
  };

  const fieldLabel = (group: string, key: string): string => {
    return t(`traitFields.${group}.${key}`, { defaultValue: key });
  };

  const groupLabel = (group: string): string => {
    return t(`traitGroups.${group}`, { defaultValue: group });
  };

  return (
    <section className="bg-white rounded-clinical shadow-clinical border border-brand-100 p-4 h-full flex flex-col">
      <div className="text-base tracking-wide text-brand-800 font-semibold mb-2 flex items-center gap-2 before:content-[''] before:w-2 before:h-2 before:rounded-full before:bg-brand-500">
        {t("profile.heading")}
      </div>
      {!c ? (
        <div className="text-slate-400 text-sm mt-4">{t("profile.empty")}</div>
      ) : (
        <div className="flex-1 space-y-3 overflow-auto pr-1">
          <div>
            <div className="text-lg font-semibold text-slate-800">
              {c.name}
            </div>
            {c.furigana && (
              <div className="text-xs text-slate-500">{c.furigana}</div>
            )}
          </div>
          <div className="text-sm">
            <div className="text-slate-500 text-xs">{t("profile.phone")}</div>
            <div className="font-mono text-slate-800">{c.phone}</div>
          </div>

          {/* Local traits section (登録時に入れた情報) */}
          <div>
            <div className="text-xs uppercase tracking-wider text-brand-800 font-semibold mb-1">
              {t("profile.traits")}
            </div>
            <ul className="space-y-1 text-sm">
              {LOCAL_TRAIT_KEYS.map(({ key, label }) => {
                const v = c[key];
                if (v === undefined || v === null || v === "") return null;
                return (
                  <li key={key} className="flex items-baseline gap-2">
                    <span className="text-xs text-slate-500 min-w-[8rem]">
                      {label[lang]}
                    </span>
                    <span className="text-slate-800">{formatSimple(v)}</span>
                  </li>
                );
              })}
              {!LOCAL_TRAIT_KEYS.some(
                (t) =>
                  c[t.key] !== undefined &&
                  c[t.key] !== "" &&
                  c[t.key] !== null,
              ) &&
                !c.notes && (
                  <li className="text-xs text-slate-400">-</li>
                )}
            </ul>
          </div>

          {/* Memory section */}
          <div className="border-t border-brand-100 pt-2">
            <div className="text-xs uppercase tracking-wider text-brand-800 font-semibold mb-1">
              {t("profile.memory")}
            </div>
            {!memory?.memProfileId ? (
              <div className="text-xs text-slate-400">
                {t("profile.noMemory")}
              </div>
            ) : (
              <div className="space-y-2">
                {/* Traits — grouped, localized */}
                {memory.traits && Object.keys(memory.traits).length > 0 && (
                  <CollapsibleSection
                    title={t("profile.traits")}
                    open={traitsOpen}
                    onToggle={() => setTraitsOpen((v) => !v)}
                  >
                    <div className="space-y-2">
                      {Object.entries(memory.traits).map(([group, val]) => {
                        if (typeof val !== "object" || val === null) {
                          return (
                            <div key={group} className="text-sm">
                              <span className="text-xs text-slate-500 mr-2">
                                {groupLabel(group)}
                              </span>
                              <span className="text-slate-800">
                                {String(val)}
                              </span>
                            </div>
                          );
                        }
                        const entries = Object.entries(
                          val as Record<string, unknown>,
                        );
                        if (entries.length === 0) return null;
                        return (
                          <div key={group}>
                            <div className="text-[10px] uppercase tracking-wider text-brand-600 font-semibold mb-0.5">
                              {groupLabel(group)}
                            </div>
                            <ul className="space-y-0.5 text-sm">
                              {entries.map(([k, v]) => (
                                <li
                                  key={`${group}.${k}`}
                                  className="flex items-baseline gap-2"
                                >
                                  <span className="text-xs text-slate-500 min-w-[8rem]">
                                    {fieldLabel(group, k)}
                                  </span>
                                  <span className="text-slate-800">
                                    {humanizeValue(group, k, v)}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        );
                      })}
                    </div>
                  </CollapsibleSection>
                )}

                {/* Summaries — collapsed by default */}
                {memory.summaries.length > 0 && (
                  <CollapsibleSection
                    title={t("profile.summaries")}
                    count={memory.summaries.length}
                    open={summariesOpen}
                    onToggle={() => setSummariesOpen((v) => !v)}
                  >
                    <ul className="text-xs text-slate-700 space-y-1 list-disc list-inside pl-1">
                      {memory.summaries.map((s, i) => (
                        <li key={i}>{s.content}</li>
                      ))}
                    </ul>
                  </CollapsibleSection>
                )}

                {/* Observations — collapsed by default (usually many) */}
                {memory.observations.length > 0 && (
                  <CollapsibleSection
                    title={t("profile.observations")}
                    count={memory.observations.length}
                    open={observationsOpen}
                    onToggle={() => setObservationsOpen((v) => !v)}
                  >
                    <ul className="text-xs text-slate-700 space-y-1 list-disc list-inside pl-1">
                      {memory.observations.map((o, i) => (
                        <li key={i}>{o.content}</li>
                      ))}
                    </ul>
                  </CollapsibleSection>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
