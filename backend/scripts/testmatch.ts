import {
  matchJobs,
  countKnownAttributes,
  type ExtractedProfile,
} from "../src/services/matchJobs.js";
import { loadJobs } from "../src/services/dataStore.js";

const jobs = loadJobs();

/**
 * 通話中に候補者情報が徐々に埋まる想定で、
 * profile を段階的に足しながら matchJobs の候補数がどう変化するか可視化する。
 */
const stages: { label: string; profile: ExtractedProfile }[] = [
  {
    label: "0. 通話開始直後 (何も情報なし)",
    profile: {},
  },
  {
    label: "1. 資格を確認: 正看護師",
    profile: { license: "正看護師" },
  },
  {
    label: "2. 希望都道府県: 東京都",
    profile: { license: "正看護師", preferredPrefecture: "東京都" },
  },
  {
    label: "3. 経験: 8年",
    profile: {
      license: "正看護師",
      preferredPrefecture: "東京都",
      experienceYears: 8,
    },
  },
  {
    label: "4. 雇用形態: 常勤",
    profile: {
      license: "正看護師",
      preferredPrefecture: "東京都",
      experienceYears: 8,
      preferredEmploymentType: "full_time",
    },
  },
  {
    label: "5. 夜勤: NG",
    profile: {
      license: "正看護師",
      preferredPrefecture: "東京都",
      experienceYears: 8,
      preferredEmploymentType: "full_time",
      wantsNightShift: false,
    },
  },
  {
    label: "6. 希望時給: 2500以上",
    profile: {
      license: "正看護師",
      preferredPrefecture: "東京都",
      experienceYears: 8,
      preferredEmploymentType: "full_time",
      wantsNightShift: false,
      hourlyWageMinJpy: 2500,
    },
  },
];

for (const s of stages) {
  const known = countKnownAttributes(s.profile);
  const cap = known >= 4 ? 3 : Math.max(3, 7 - known);
  const ranking = matchJobs(s.profile, jobs).slice(0, cap);
  console.log(`\n=== ${s.label} (known=${known}, cap=${cap}, shown=${ranking.length}) ===`);
  for (const r of ranking) {
    const j = jobs.find((x) => x.id === r.jobId)!;
    console.log(
      `  ${r.score.toString().padStart(4)}  ${j.title.padEnd(35).slice(0, 35)}  [${j.location.prefecture}${j.location.city ? "/" + j.location.city : ""}]`,
    );
  }
}
