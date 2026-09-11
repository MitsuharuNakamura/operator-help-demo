import type { Job } from "../types/domain.js";

export interface ExtractedProfile {
  license?: string;
  experienceYears?: number;
  preferredPrefecture?: string;
  preferredCity?: string;
  preferredEmploymentType?: string;
  wantsNightShift?: boolean;
  hourlyWageMinJpy?: number;
  tags?: string[];
}

export interface JobRanking {
  jobId: string;
  score: number;
  reasons: string[];
}

const LICENSE_MAP: Record<string, "RN" | "LPN" | "care_worker"> = {
  正看護師: "RN",
  看護師: "RN",
  RN: "RN",
  准看護師: "LPN",
  LPN: "LPN",
  介護福祉士: "care_worker",
  ヘルパー: "care_worker",
  care_worker: "care_worker",
};

/**
 * profile で明示された条件のうち、job が満たさなければ「候補外」となる強い条件。
 * デモ的には「候補者が明確に希望していることに合わない求人は出さない」フィルタ。
 */
function passesHardFilter(profile: ExtractedProfile, job: Job): boolean {
  // 資格ミスマッチ → 除外 (実質的に応募不可)
  if (profile.license) {
    const norm = LICENSE_MAP[profile.license];
    if (norm && job.requirements.license) {
      if (!job.requirements.license.includes(norm)) return false;
    }
  }
  // 希望勤務都道府県が異なる → 除外
  if (
    profile.preferredPrefecture &&
    job.location.prefecture !== profile.preferredPrefecture
  ) {
    return false;
  }
  // 雇用形態がハッキリ違う → 除外
  if (
    profile.preferredEmploymentType &&
    profile.preferredEmploymentType !== job.employmentType
  ) {
    return false;
  }
  // 夜勤 NG と明言された & 求人は夜勤必須 → 除外
  if (profile.wantsNightShift === false && job.requirements.nightShift === true) {
    return false;
  }
  return true;
}

/** 候補者情報が「まだ何も無い」状態か判定 */
export function isProfileEmpty(p: ExtractedProfile): boolean {
  return (
    !p.license &&
    !p.experienceYears &&
    !p.preferredPrefecture &&
    !p.preferredCity &&
    !p.preferredEmploymentType &&
    p.wantsNightShift === undefined &&
    !p.hourlyWageMinJpy &&
    (!p.tags || p.tags.length === 0)
  );
}

/** 取得済みの主要属性数 (絞込みの厳しさ調整に使う) */
export function countKnownAttributes(p: ExtractedProfile): number {
  let n = 0;
  if (p.license) n++;
  if (p.experienceYears !== undefined && p.experienceYears !== null) n++;
  if (p.preferredPrefecture) n++;
  if (p.preferredCity) n++;
  if (p.preferredEmploymentType) n++;
  if (p.wantsNightShift !== undefined && p.wantsNightShift !== null) n++;
  if (p.hourlyWageMinJpy) n++;
  return n;
}

function scoreJob(profile: ExtractedProfile, job: Job): JobRanking {
  let score = 0;
  const reasons: string[] = [];

  if (profile.license) {
    const norm = LICENSE_MAP[profile.license];
    if (norm && job.requirements.license?.includes(norm)) {
      score += 30;
      reasons.push(`資格一致 (${profile.license})`);
    }
  }

  if (
    profile.preferredPrefecture &&
    job.location.prefecture === profile.preferredPrefecture
  ) {
    score += 25;
    reasons.push(`勤務地一致 (${profile.preferredPrefecture})`);
  }
  if (
    profile.preferredCity &&
    job.location.city &&
    job.location.city === profile.preferredCity
  ) {
    score += 10;
    reasons.push(`市区一致 (${profile.preferredCity})`);
  }

  if (
    profile.preferredEmploymentType &&
    profile.preferredEmploymentType === job.employmentType
  ) {
    score += 15;
    reasons.push(`雇用形態一致`);
  }

  if (typeof profile.wantsNightShift === "boolean") {
    if (profile.wantsNightShift === !!job.requirements.nightShift) {
      score += 8;
      reasons.push(
        profile.wantsNightShift ? "夜勤あり求人" : "夜勤なし条件合致",
      );
    }
  }

  if (
    typeof profile.experienceYears === "number" &&
    typeof job.requirements.experienceYears === "number"
  ) {
    if (profile.experienceYears >= job.requirements.experienceYears) {
      score += 8;
      reasons.push(`経験年数充足`);
    } else {
      score -= 6;
    }
  }

  if (
    typeof profile.hourlyWageMinJpy === "number" &&
    job.hourlyWageJpy &&
    job.hourlyWageJpy[1] >= profile.hourlyWageMinJpy
  ) {
    score += 6;
    reasons.push(`希望時給を満たす`);
  }

  if (profile.tags?.length) {
    const overlap = profile.tags.filter((t) => job.tags.includes(t));
    if (overlap.length) {
      score += 3 * overlap.length;
      reasons.push(`タグ一致: ${overlap.join(", ")}`);
    }
  }

  return { jobId: job.id, score, reasons };
}

/**
 * profile を使って job list を絞込み、スコア降順で返す。
 *  - profile が空なら空配列 (通話開始直後の空表示用)
 *  - 明示された希望に合わない求人は hard filter で除外
 *  - 残りをスコア降順で
 */
export function matchJobs(profile: ExtractedProfile, jobs: Job[]): JobRanking[] {
  if (isProfileEmpty(profile)) return [];
  const filtered = jobs.filter((job) => passesHardFilter(profile, job));
  return filtered
    .map((job) => scoreJob(profile, job))
    .sort((a, b) => b.score - a.score);
}
