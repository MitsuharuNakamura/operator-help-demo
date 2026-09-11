import { logger } from "./logger.js";

/**
 * Twilio Conversation Memory API 実装メモ:
 *
 * - Base URL:                 https://memory.twilio.com/v1
 * - Profile resource ID:      Twilio が発行する mem_profile_* のみ有効。任意の外部 ID は受け付けない
 * - Profile 作成:              Orchestrator による通話キャプチャ時に自動作成される。API 経由での新規作成は不可
 * - Profile 検索:              GET /Stores/{sid}/Profiles?identifier=<value>  (phone / email など)
 * - Profile 取得:              GET /Stores/{sid}/Profiles/{mem_profile_id}
 * - Recall (semantic):        POST /Stores/{sid}/Profiles/{mem_profile_id}/Recall
 * - Trait 更新:                PATCH /Stores/{sid}/Profiles/{mem_profile_id} — 未登録 trait は 400 で拒否
 *   (Bulk PUT /Profiles/Bulk は 202 で受理されるが、未登録 trait を silent drop するため使わない)
 * - Registered Contact.*:     phone / email / firstName / lastName / city (実測)
 *   その他の trait は Console でスキーマ登録が必要
 * - Profile 削除:              DELETE /Stores/{sid}/Profiles/{mem_profile_id}
 */

const BASE = "https://memory.twilio.com/v1";

/** Memory 側に登録済で PATCH できる Contact.* trait のホワイトリスト */
export const REGISTERED_CONTACT_TRAITS = [
  "phone",
  "email",
  "firstName",
  "lastName",
  "city",
] as const;

type ContactTraitKey = (typeof REGISTERED_CONTACT_TRAITS)[number];

/** setup-ci.ts で作成される Candidate 群の trait 一覧 */
export const REGISTERED_CANDIDATE_TRAITS = [
  "license",
  "experienceYears",
  "preferredPrefecture",
  "preferredCity",
  "preferredEmploymentType",
  "wantsNightShift",
  "hourlyWageMinJpy",
  "furigana",
  "tags",
] as const;

type CandidateTraitKey = (typeof REGISTERED_CANDIDATE_TRAITS)[number];

async function memoryFetch(
  path: string,
  init: RequestInit = {},
): Promise<any> {
  const key = process.env.TWILIO_API_KEY_SID;
  const secret = process.env.TWILIO_API_KEY_SECRET;
  if (!key || !secret) throw new Error("Twilio API key missing");
  const auth = Buffer.from(`${key}:${secret}`).toString("base64");
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Twilio Memory ${res.status}: ${text}`);
  }
  return text ? JSON.parse(text) : {};
}

function storeId(): string | null {
  const id = process.env.TWILIO_MEMORY_STORE_ID;
  return id && id.startsWith("mem_store_") ? id : null;
}

function encodePhoneForQuery(phone: string): string {
  return encodeURIComponent(phone);
}

export async function findProfileIdByPhone(
  phone: string,
): Promise<string | null> {
  const sid = storeId();
  if (!sid || !phone) return null;
  try {
    const data = (await memoryFetch(
      `/Stores/${sid}/Profiles?identifier=${encodePhoneForQuery(phone)}`,
    )) as { profiles?: string[] };
    return data.profiles?.[0] || null;
  } catch (e) {
    logger.warn(
      { err: (e as Error).message, phone },
      "memory identifier lookup failed",
    );
    return null;
  }
}

export interface MemoryProfileView {
  memProfileId: string | null;
  traits: Record<string, unknown>;
  observations: Array<{ content: string; occurredAt?: string; score?: number }>;
  summaries: Array<{ content: string; occurredAt?: string }>;
}

export async function getMemoryProfileByPhone(
  phone: string,
): Promise<MemoryProfileView | null> {
  const sid = storeId();
  if (!sid) {
    logger.warn("TWILIO_MEMORY_STORE_ID not set — memory disabled");
    return null;
  }
  const memId = await findProfileIdByPhone(phone);
  if (!memId) return { memProfileId: null, traits: {}, observations: [], summaries: [] };

  let traits: Record<string, unknown> = {};
  try {
    const detail = (await memoryFetch(`/Stores/${sid}/Profiles/${memId}`)) as {
      traits?: Record<string, unknown>;
    };
    traits = detail.traits || {};
  } catch (e) {
    logger.warn(
      { err: (e as Error).message, memId },
      "memory profile fetch failed",
    );
  }

  let observations: MemoryProfileView["observations"] = [];
  let summaries: MemoryProfileView["summaries"] = [];
  try {
    const recall = (await memoryFetch(
      `/Stores/${sid}/Profiles/${memId}/Recall`,
      {
        method: "POST",
        body: JSON.stringify({
          query: "candidate profile summary",
          observationsLimit: 20,
          summariesLimit: 5,
        }),
      },
    )) as {
      observations?: any[];
      summaries?: any[];
    };
    observations = (recall.observations || []).map((o) => ({
      content: String(o.content ?? ""),
      occurredAt: o.occurredAt,
      score: o.score,
    }));
    summaries = (recall.summaries || []).map((s) => ({
      content: String(s.content ?? ""),
      occurredAt: s.occurredAt,
    }));
  } catch (e) {
    logger.warn(
      { err: (e as Error).message, memId },
      "memory recall failed",
    );
  }

  return { memProfileId: memId, traits, observations, summaries };
}

export interface ContactTraitPatch
  extends Partial<Record<ContactTraitKey, string>> {}

export interface CandidateTraitPatch {
  license?: string;
  experienceYears?: number;
  preferredPrefecture?: string;
  preferredCity?: string;
  preferredEmploymentType?: string;
  wantsNightShift?: boolean;
  hourlyWageMinJpy?: number;
  furigana?: string;
  tags?: string[];
}

function pickContactPatch(patch: ContactTraitPatch): Record<string, string> {
  const out: Record<string, string> = {};
  for (const k of REGISTERED_CONTACT_TRAITS) {
    const v = patch[k];
    if (typeof v === "string" && v.trim() !== "") out[k] = v.trim();
  }
  return out;
}

function pickCandidatePatch(
  patch: CandidateTraitPatch,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of REGISTERED_CANDIDATE_TRAITS) {
    const v = (patch as Record<CandidateTraitKey, unknown>)[k];
    if (v === undefined || v === null || v === "") continue;
    if (Array.isArray(v)) {
      if (v.length > 0) out[k] = v;
      continue;
    }
    out[k] = v;
  }
  return out;
}

/**
 * 既存プロファイルに登録済 trait (Contact + Candidate 両群) を PATCH する。
 * profile が未存在 (通話前) の場合は skip。
 * 未登録 trait は事前 filter で捨てる。
 */
export async function patchProfileTraits(
  phone: string,
  patch: {
    contact?: ContactTraitPatch;
    candidate?: CandidateTraitPatch;
  },
): Promise<{ patched: boolean; memProfileId: string | null }> {
  const sid = storeId();
  if (!sid) return { patched: false, memProfileId: null };
  const memId = await findProfileIdByPhone(phone);
  if (!memId) return { patched: false, memProfileId: null };

  const contactFields = patch.contact ? pickContactPatch(patch.contact) : {};
  const candidateFields = patch.candidate
    ? pickCandidatePatch(patch.candidate)
    : {};

  const traits: Record<string, Record<string, unknown>> = {};
  if (Object.keys(contactFields).length > 0) traits.Contact = contactFields;
  if (Object.keys(candidateFields).length > 0)
    traits.Candidate = candidateFields;

  if (Object.keys(traits).length === 0) {
    return { patched: false, memProfileId: memId };
  }

  try {
    await memoryFetch(`/Stores/${sid}/Profiles/${memId}`, {
      method: "PATCH",
      body: JSON.stringify({ traits }),
    });
    logger.info(
      {
        memId,
        contactKeys: Object.keys(contactFields),
        candidateKeys: Object.keys(candidateFields),
      },
      "memory patch ok",
    );
    return { patched: true, memProfileId: memId };
  } catch (e) {
    logger.warn(
      {
        err: (e as Error).message,
        memId,
        contactKeys: Object.keys(contactFields),
        candidateKeys: Object.keys(candidateFields),
      },
      "memory patch failed",
    );
    return { patched: false, memProfileId: memId };
  }
}

/** 旧 API 互換: Contact のみパッチしたいとき */
export async function patchContactTraits(
  phone: string,
  patch: ContactTraitPatch,
) {
  return patchProfileTraits(phone, { contact: patch });
}

/**
 * name を "family given" で split して firstName/lastName にする。
 * 空白がなければ全体を firstName にフォールバック。
 */
export function splitJapaneseName(name: string): {
  lastName?: string;
  firstName?: string;
} {
  const m = name.trim().split(/[\s　]+/);
  if (m.length >= 2) return { lastName: m[0], firstName: m.slice(1).join(" ") };
  if (m.length === 1 && m[0]) return { firstName: m[0] };
  return {};
}

/**
 * 削除: phone で lookup → 該当 mem_profile を DELETE。
 * profile が存在しない場合は true 扱いで OK。
 */
export async function deleteProfileByPhone(phone: string): Promise<boolean> {
  const sid = storeId();
  if (!sid) return false;
  const memId = await findProfileIdByPhone(phone);
  if (!memId) return true;
  try {
    await memoryFetch(`/Stores/${sid}/Profiles/${memId}`, {
      method: "DELETE",
    });
    return true;
  } catch (e) {
    const msg = (e as Error).message;
    if (/404/.test(msg)) return true;
    logger.warn({ err: msg, memId }, "memory profile delete failed");
    return false;
  }
}
