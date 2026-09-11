import { useMemo, useState } from "react";
import clsx from "clsx";
import { useTranslation } from "react-i18next";
import type { ChecklistItemTemplate } from "../types/domain";
import { useAppStore } from "../store/useAppStore";
import { useCallStore } from "../store/useCallStore";
import { api } from "../api/http";

interface Props {
  template: ChecklistItemTemplate[];
}

type FieldType = "string" | "number" | "bool" | "employmentType";

function fieldTypeFor(extractionKey: string): FieldType {
  switch (extractionKey) {
    case "experienceYears":
    case "hourlyWageMinJpy":
      return "number";
    case "wantsNightShift":
      return "bool";
    case "preferredEmploymentType":
      return "employmentType";
    default:
      return "string";
  }
}

function displayValue(v: unknown, type: FieldType, t: (k: string) => string): string {
  if (v == null || v === "") return "-";
  if (type === "bool") return v ? t("traitValues.yes") : t("traitValues.no");
  if (type === "employmentType" && typeof v === "string") {
    return t(`traitValues.employmentType.${v}`) || v;
  }
  return String(v);
}

export default function ChecklistPanel({ template }: Props) {
  const { t } = useTranslation();
  const lang = useAppStore((s) => s.lang);
  const auto = useCallStore((s) => s.checklist);
  const manual = useCallStore((s) => s.checklistManual);
  const setManual = useCallStore((s) => s.setChecklistManual);
  const contact = useCallStore((s) => s.activeContact);
  const updateContactAfterSave = useCallStore(
    (s) => s.updateActiveContactAfterSave,
  );

  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<null | "saved" | "error">(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // 現在の効果値 (優先度: manual > contact > auto)
  //   - manual: いま編集中のセル
  //   - contact: 登録時 or 直前の Save で確定した値 (人が commit した値なので auto より上)
  //   - auto:   CI 抽出で提示された候補 (contact に無い項目の初期表示用)
  const effective = useMemo(() => {
    const map: Record<string, unknown> = {};
    for (const t of template) {
      const key = t.extractionKey;
      if (Object.prototype.hasOwnProperty.call(manual, t.id)) {
        map[t.id] = manual[t.id];
        continue;
      }
      const contactVal = contact ? (contact as any)[key] : undefined;
      if (contactVal !== undefined && contactVal !== null && contactVal !== "") {
        map[t.id] = contactVal;
        continue;
      }
      const item = auto[t.id];
      if (item && item.value !== null && item.value !== undefined) {
        map[t.id] = item.value;
      }
    }
    return map;
  }, [template, auto, manual, contact]);

  const onSave = async () => {
    if (!contact) return;
    setBusy(true);
    setStatus(null);
    setErrorMsg(null);
    try {
      // template を回して patch payload を構築
      const payload: Record<string, unknown> = {};
      for (const t of template) {
        payload[t.extractionKey] = effective[t.id] ?? null;
      }
      const res = await api.updateContactTraits(contact.id, payload as any);
      // contact のみ更新 (checklistManual は保持 → 手動入力値が表示に残る)
      updateContactAfterSave(res.contact);
      setStatus("saved");
      // 3秒後にステータスクリア
      setTimeout(() => setStatus(null), 3000);
    } catch (e) {
      setStatus("error");
      setErrorMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="bg-white rounded-clinical shadow-clinical border border-brand-100 p-4 h-full flex flex-col">
      <div className="text-base tracking-wide text-brand-800 font-semibold mb-2 flex items-center gap-2 before:content-[''] before:w-2 before:h-2 before:rounded-full before:bg-brand-500">
        {t("checklist.heading")}
      </div>
      <ul className="flex-1 overflow-auto divide-y divide-slate-100 -mx-1 px-1">
        {template.map((it) => {
          const type = fieldTypeFor(it.extractionKey);
          const v = effective[it.id];
          const isManual = Object.prototype.hasOwnProperty.call(manual, it.id);
          const isAuto =
            !isManual &&
            auto[it.id] &&
            auto[it.id].value !== null &&
            auto[it.id].value !== undefined;
          const has = v !== undefined && v !== null && v !== "";
          return (
            <li key={it.id} className="py-2 flex items-start gap-2">
              <span
                className={clsx(
                  "mt-1 inline-flex w-4 h-4 rounded border items-center justify-center text-[10px]",
                  has
                    ? "bg-emerald-500 border-emerald-500 text-white"
                    : "border-slate-300 text-transparent",
                )}
              >
                ✓
              </span>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-xs text-slate-600">
                    {it.label[lang]}
                  </span>
                  {isAuto && (
                    <span className="text-[9px] px-1 py-0.5 rounded bg-brand-50 text-brand-700 border border-brand-100">
                      {t("checklist.auto")}
                    </span>
                  )}
                  {isManual && (
                    <span className="text-[9px] px-1 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                      {t("checklist.manual")}
                    </span>
                  )}
                </div>
                {type === "string" && (
                  <input
                    className="w-full border border-slate-200 rounded px-2 py-1 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
                    placeholder={t("checklist.empty")}
                    value={typeof v === "string" ? v : v == null ? "" : String(v)}
                    onChange={(e) => setManual(it.id, e.target.value)}
                    disabled={!contact}
                  />
                )}
                {type === "number" && (
                  <input
                    type="number"
                    className="w-full border border-slate-200 rounded px-2 py-1 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
                    placeholder={t("checklist.empty")}
                    value={
                      typeof v === "number"
                        ? v
                        : v == null || v === ""
                          ? ""
                          : String(v)
                    }
                    onChange={(e) => {
                      const s = e.target.value;
                      if (s === "") {
                        setManual(it.id, null);
                      } else {
                        const n = Number(s);
                        setManual(it.id, Number.isFinite(n) ? n : null);
                      }
                    }}
                    disabled={!contact}
                  />
                )}
                {type === "bool" && (
                  <select
                    className="w-full border border-slate-200 rounded px-2 py-1 text-sm bg-white focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
                    value={v === true ? "true" : v === false ? "false" : ""}
                    onChange={(e) => {
                      const s = e.target.value;
                      setManual(it.id, s === "" ? null : s === "true");
                    }}
                    disabled={!contact}
                  >
                    <option value="">{t("checklist.pickOne")}</option>
                    <option value="true">{t("traitValues.yes")}</option>
                    <option value="false">{t("traitValues.no")}</option>
                  </select>
                )}
                {type === "employmentType" && (
                  <select
                    className="w-full border border-slate-200 rounded px-2 py-1 text-sm bg-white focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
                    value={typeof v === "string" ? v : ""}
                    onChange={(e) => setManual(it.id, e.target.value || null)}
                    disabled={!contact}
                  >
                    <option value="">{t("checklist.pickOne")}</option>
                    <option value="full_time">
                      {t("traitValues.employmentType.full_time")}
                    </option>
                    <option value="part_time">
                      {t("traitValues.employmentType.part_time")}
                    </option>
                    <option value="contract">
                      {t("traitValues.employmentType.contract")}
                    </option>
                    <option value="dispatch">
                      {t("traitValues.employmentType.dispatch")}
                    </option>
                  </select>
                )}
                {/* Ghost hint: 通話前で AI 抽出値がまだ来ていないなら CI 抽出候補を薄く表示 */}
                {!isManual && isAuto && (
                  <div className="mt-0.5 text-[10px] text-brand-600">
                    {displayValue(auto[it.id].value, type, t)}
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      <div className="pt-3 mt-2 border-t border-slate-100 flex items-center gap-2">
        <button
          onClick={onSave}
          disabled={!contact || busy}
          className="bg-brand-600 hover:bg-brand-700 disabled:opacity-40 text-white rounded-lg px-3 py-1.5 text-sm font-semibold shadow-clinical transition"
        >
          {busy ? t("checklist.saving") : t("checklist.save")}
        </button>
        {!contact && (
          <span className="text-xs text-slate-500">
            {t("checklist.selectContact")}
          </span>
        )}
        {status === "saved" && (
          <span className="text-xs text-emerald-700">
            {t("checklist.saved")}
          </span>
        )}
        {status === "error" && (
          <span className="text-xs text-clinical-err" title={errorMsg || ""}>
            {t("checklist.saveError")}
          </span>
        )}
      </div>
    </section>
  );
}
