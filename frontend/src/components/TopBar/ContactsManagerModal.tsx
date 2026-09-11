import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type {
  ChecklistItemTemplate,
  Contact,
  Lang,
} from "../../types/domain";
import { useAppStore } from "../../store/useAppStore";
import { useCallStore } from "../../store/useCallStore";
import { api } from "../../api/http";

interface Props {
  open: boolean;
  onClose: () => void;
  contacts: Contact[];
  checklistTpl: ChecklistItemTemplate[];
  onChanged: () => void;
}

function TrashIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden="true"
      className={className}
    >
      <path
        fillRule="evenodd"
        d="M8.75 1a2.25 2.25 0 0 0-2.236 2.02L6.5 3.25v.5H3.75a.75.75 0 0 0 0 1.5h.383l.75 10.877A2.25 2.25 0 0 0 7.128 18h5.744a2.25 2.25 0 0 0 2.245-1.873L15.867 5.25h.383a.75.75 0 0 0 0-1.5H13.5v-.5A2.25 2.25 0 0 0 11.25 1h-2.5zM8 3.75a.75.75 0 0 1 .75-.75h2.5a.75.75 0 0 1 .75.75v.5H8v-.5zM8.5 8a.75.75 0 0 1 .75.75v5a.75.75 0 0 1-1.5 0v-5A.75.75 0 0 1 8.5 8zm3.75.75a.75.75 0 0 0-1.5 0v5a.75.75 0 0 0 1.5 0v-5z"
        clipRule="evenodd"
      />
    </svg>
  );
}

interface TraitForm {
  license: string;
  experienceYears: string;
  preferredPrefecture: string;
  preferredCity: string;
  preferredEmploymentType: string;
  wantsNightShift: "" | "true" | "false";
  hourlyWageMinJpy: string;
}

const emptyTraits: TraitForm = {
  license: "",
  experienceYears: "",
  preferredPrefecture: "",
  preferredCity: "",
  preferredEmploymentType: "",
  wantsNightShift: "",
  hourlyWageMinJpy: "",
};

function labelFor(
  tpl: ChecklistItemTemplate[],
  key: string,
  lang: Lang,
  fallback: string,
) {
  const item = tpl.find((t) => t.extractionKey === key);
  return item?.label[lang] || fallback;
}

export default function ContactsManagerModal({
  open,
  onClose,
  contacts,
  checklistTpl,
  onChanged,
}: Props) {
  const { t } = useTranslation();
  const lang = useAppStore((s) => s.lang);
  const setActive = useCallStore((s) => s.setActiveContact);
  const [name, setName] = useState("");
  const [furigana, setFurigana] = useState("");
  const [phone, setPhone] = useState("");
  const [traits, setTraits] = useState<TraitForm>(emptyTraits);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setName("");
      setFurigana("");
      setPhone("");
      setTraits(emptyTraits);
      setError(null);
    }
  }, [open]);

  if (!open) return null;

  const select = async (c: Contact) => {
    try {
      const { memory } = await api.getContactMemory(c.id);
      setActive(c, memory);
    } catch {
      setActive(c, null);
    }
    onClose();
  };

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!name.trim() || !phone.trim()) return;
    if (!/^\+/.test(phone.trim())) {
      setError(t("contactsManager.invalidPhone"));
      return;
    }
    setBusy(true);
    try {
      const payload: Parameters<typeof api.createContact>[0] = {
        name: name.trim(),
        furigana: furigana.trim() || undefined,
        phone: phone.trim(),
      };
      if (traits.license) payload.license = traits.license;
      if (traits.experienceYears) {
        const n = Number(traits.experienceYears);
        if (Number.isFinite(n)) payload.experienceYears = n;
      }
      if (traits.preferredPrefecture)
        payload.preferredPrefecture = traits.preferredPrefecture;
      if (traits.preferredCity) payload.preferredCity = traits.preferredCity;
      if (traits.preferredEmploymentType)
        payload.preferredEmploymentType = traits.preferredEmploymentType;
      if (traits.wantsNightShift !== "")
        payload.wantsNightShift = traits.wantsNightShift === "true";
      if (traits.hourlyWageMinJpy) {
        const n = Number(traits.hourlyWageMinJpy);
        if (Number.isFinite(n)) payload.hourlyWageMinJpy = n;
      }
      await api.createContact(payload);
      setName("");
      setFurigana("");
      setPhone("");
      setTraits(emptyTraits);
      onChanged();
    } catch (e) {
      const msg = (e as Error).message;
      if (/409/.test(msg)) setError(t("contactsManager.duplicatePhone"));
      else if (/400.*E\.164/i.test(msg))
        setError(t("contactsManager.invalidPhone"));
      else setError(msg);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (c: Contact) => {
    if (!confirm(t("contactsManager.confirmDelete"))) return;
    setDeletingId(c.id);
    try {
      await api.deleteContact(c.id);
      onChanged();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-40 bg-black/40 flex items-center justify-center p-6"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-clinical shadow-clinical max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col border border-brand-100"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-3 border-b border-brand-100 flex items-center">
          <h2 className="text-brand-900 font-semibold">
            {t("contactsManager.heading")}
          </h2>
          <button
            onClick={onClose}
            className="ml-auto text-sm text-slate-500 hover:text-slate-800"
          >
            {t("contactsManager.close")}
          </button>
        </div>

        <div className="flex-1 overflow-auto">
          <form
            onSubmit={add}
            className="p-5 border-b border-brand-100 bg-brand-50/40 space-y-4"
          >
            <div>
              <div className="text-xs uppercase tracking-wider text-brand-800 font-semibold mb-2">
                {t("contactsManager.identityHeading")}
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-clinical-mutedText mb-1">
                    {t("contactsManager.name")} *
                  </label>
                  <input
                    className="w-full border border-brand-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-brand-500"
                    placeholder={t("contactsManager.namePlaceholder")}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs text-clinical-mutedText mb-1">
                    {t("contactsManager.furigana")}
                  </label>
                  <input
                    className="w-full border border-brand-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-brand-500"
                    placeholder={t("contactsManager.furiganaPlaceholder")}
                    value={furigana}
                    onChange={(e) => setFurigana(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs text-clinical-mutedText mb-1">
                    {t("contactsManager.phone")} *
                  </label>
                  <input
                    className="w-full border border-brand-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-brand-500 font-mono"
                    placeholder={t("contactsManager.phonePlaceholder")}
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div>
              <div className="text-xs uppercase tracking-wider text-brand-800 font-semibold mb-2">
                {t("contactsManager.traitsHeading")}
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-clinical-mutedText mb-1">
                    {labelFor(checklistTpl, "license", lang, "license")}
                  </label>
                  <input
                    className="w-full border border-brand-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-brand-500"
                    placeholder="正看護師 / 介護福祉士 ..."
                    value={traits.license}
                    onChange={(e) =>
                      setTraits({ ...traits, license: e.target.value })
                    }
                  />
                </div>
                <div>
                  <label className="block text-xs text-clinical-mutedText mb-1">
                    {labelFor(
                      checklistTpl,
                      "experienceYears",
                      lang,
                      "experienceYears",
                    )}
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={60}
                    className="w-full border border-brand-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-brand-500"
                    placeholder="8"
                    value={traits.experienceYears}
                    onChange={(e) =>
                      setTraits({
                        ...traits,
                        experienceYears: e.target.value,
                      })
                    }
                  />
                </div>
                <div>
                  <label className="block text-xs text-clinical-mutedText mb-1">
                    {labelFor(
                      checklistTpl,
                      "preferredPrefecture",
                      lang,
                      "preferredPrefecture",
                    )}
                  </label>
                  <input
                    className="w-full border border-brand-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-brand-500"
                    placeholder="東京都"
                    value={traits.preferredPrefecture}
                    onChange={(e) =>
                      setTraits({
                        ...traits,
                        preferredPrefecture: e.target.value,
                      })
                    }
                  />
                </div>
                <div>
                  <label className="block text-xs text-clinical-mutedText mb-1">
                    {labelFor(
                      checklistTpl,
                      "preferredCity",
                      lang,
                      "preferredCity",
                    )}
                  </label>
                  <input
                    className="w-full border border-brand-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-brand-500"
                    placeholder="新宿区"
                    value={traits.preferredCity}
                    onChange={(e) =>
                      setTraits({ ...traits, preferredCity: e.target.value })
                    }
                  />
                </div>
                <div>
                  <label className="block text-xs text-clinical-mutedText mb-1">
                    {labelFor(
                      checklistTpl,
                      "preferredEmploymentType",
                      lang,
                      "preferredEmploymentType",
                    )}
                  </label>
                  <select
                    className="w-full border border-brand-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-brand-500 bg-white"
                    value={traits.preferredEmploymentType}
                    onChange={(e) =>
                      setTraits({
                        ...traits,
                        preferredEmploymentType: e.target.value,
                      })
                    }
                  >
                    <option value="">{t("contactsManager.pickOne")}</option>
                    <option value="full_time">full_time</option>
                    <option value="part_time">part_time</option>
                    <option value="contract">contract</option>
                    <option value="dispatch">dispatch</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-clinical-mutedText mb-1">
                    {labelFor(
                      checklistTpl,
                      "wantsNightShift",
                      lang,
                      "wantsNightShift",
                    )}
                  </label>
                  <select
                    className="w-full border border-brand-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-brand-500 bg-white"
                    value={traits.wantsNightShift}
                    onChange={(e) =>
                      setTraits({
                        ...traits,
                        wantsNightShift: e.target
                          .value as TraitForm["wantsNightShift"],
                      })
                    }
                  >
                    <option value="">{t("contactsManager.pickOne")}</option>
                    <option value="true">{t("contactsManager.yes")}</option>
                    <option value="false">{t("contactsManager.no")}</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-clinical-mutedText mb-1">
                    {labelFor(
                      checklistTpl,
                      "hourlyWageMinJpy",
                      lang,
                      "hourlyWageMinJpy",
                    )}
                  </label>
                  <input
                    type="number"
                    min={0}
                    step={50}
                    className="w-full border border-brand-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-brand-500"
                    placeholder="2000"
                    value={traits.hourlyWageMinJpy}
                    onChange={(e) =>
                      setTraits({
                        ...traits,
                        hourlyWageMinJpy: e.target.value,
                      })
                    }
                  />
                </div>
              </div>
            </div>

            {error && (
              <div className="text-clinical-err text-sm bg-red-50 border border-red-200 rounded px-3 py-2">
                {error}
              </div>
            )}
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={busy || !name.trim() || !phone.trim()}
                className="bg-brand-600 hover:bg-brand-700 disabled:opacity-40 text-white rounded-lg px-4 py-2 text-sm font-semibold shadow-clinical transition"
              >
                {t("contactsManager.add")}
              </button>
            </div>
          </form>

          <ul className="divide-y divide-brand-100">
            {contacts.length === 0 && (
              <li className="px-5 py-8 text-center text-slate-400 text-sm">
                {t("contactsManager.empty")}
              </li>
            )}
            {contacts.map((c) => (
              <li
                key={c.id}
                className="px-5 py-3 flex items-center gap-3 hover:bg-brand-50"
              >
                <button
                  onClick={() => select(c)}
                  className="flex-1 text-left"
                  aria-label={t("contactsManager.select")}
                >
                  <div className="font-medium text-slate-800">{c.name}</div>
                  <div className="text-xs text-slate-500 font-mono">
                    {c.phone}
                  </div>
                  {c.notes && (
                    <div className="text-xs text-slate-500 mt-0.5">
                      {c.notes}
                    </div>
                  )}
                </button>
                <button
                  onClick={() => remove(c)}
                  disabled={deletingId === c.id}
                  aria-label={t("contactsManager.delete")}
                  title={t("contactsManager.delete")}
                  className="text-slate-400 hover:text-red-600 hover:bg-red-50 rounded p-1.5 disabled:opacity-40"
                >
                  <TrashIcon className="w-5 h-5" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
