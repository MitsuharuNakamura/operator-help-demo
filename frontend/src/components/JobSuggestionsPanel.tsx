import { useTranslation } from "react-i18next";
import type { Job } from "../types/domain";
import { useAppStore } from "../store/useAppStore";
import { useCallStore } from "../store/useCallStore";

interface Props {
  jobs: Job[];
}

export default function JobSuggestionsPanel({ jobs }: Props) {
  const { t } = useTranslation();
  const lang = useAppStore((s) => s.lang);
  const rankings = useCallStore((s) => s.jobRankings);

  const byId = new Map(jobs.map((j) => [j.id, j]));
  const ranked = rankings
    .filter((r) => r.score > 0)
    .map((r) => ({ r, job: byId.get(r.jobId) }))
    .filter((x) => x.job) as { r: (typeof rankings)[number]; job: Job }[];

  return (
    <section className="bg-white rounded-clinical shadow-clinical border border-brand-100 p-4 h-full flex flex-col">
      <div className="text-base tracking-wide text-brand-800 font-semibold mb-2 flex items-center gap-2 before:content-[''] before:w-2 before:h-2 before:rounded-full before:bg-brand-500">
        {t("jobs.heading")}
      </div>
      {ranked.length === 0 ? (
        <div className="text-slate-400 text-sm mt-2">
          {t("jobs.empty")}
        </div>
      ) : (
        <ul className="flex-1 overflow-auto space-y-3">
          {ranked.slice(0, 5).map(({ r, job }) => (
            <li
              key={job.id}
              className="border border-slate-200 rounded-lg p-3 hover:border-brand-500 transition"
            >
              <div className="flex items-start gap-2">
                <div className="flex-1">
                  <div className="text-sm font-semibold text-slate-800">
                    {job.title}
                  </div>
                  <div className="text-xs text-slate-500">
                    {t("jobs.location")}: {job.location.prefecture}
                    {job.location.city ? ` / ${job.location.city}` : ""}
                    {job.hourlyWageJpy && (
                      <>
                        {" ・ "}
                        {t("jobs.wage")}: ¥{job.hourlyWageJpy[0]}〜¥
                        {job.hourlyWageJpy[1]}
                      </>
                    )}
                  </div>
                  {job.description && (
                    <div className="text-xs text-slate-600 mt-1">
                      {job.description[lang]}
                    </div>
                  )}
                  {r.reasons.length > 0 && (
                    <div className="mt-1 text-[11px] text-brand-700">
                      {t("jobs.reasons")}: {r.reasons.join(" / ")}
                    </div>
                  )}
                </div>
                <div className="text-xs font-mono text-slate-500">
                  {r.score}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
