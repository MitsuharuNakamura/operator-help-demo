import type {
  ChecklistItemTemplate,
  TalklistItemTemplate,
  Verdict,
} from "../types/domain.js";
import { logger } from "./logger.js";
import {
  pushToCall,
  updateExtracted,
  findCallForConversation,
} from "./liveHub.js";
import { matchJobs, countKnownAttributes, type ExtractedProfile } from "./matchJobs.js";
import {
  loadChecklistTemplate,
  loadJobs,
  loadTalklistTemplate,
} from "./dataStore.js";
import { patchProfileTraits } from "./memory.js";
import { normalizeExtractLocation } from "./locationNormalize.js";

/**
 * Twilio Conversation Intelligence v3 の Rule Execution Webhook payload:
 *
 *   {
 *     accountId, conversationId,
 *     intelligenceConfiguration: { id, displayName, version, ruleId },
 *     operatorResults: [{
 *       id,
 *       operator: { id, displayName, version, parameters },
 *       outputFormat: "JSON" | "TEXT" | "CLASSIFICATION",
 *       result: object | string,
 *       dateCreated,
 *       executionDetails: { trigger, communicationRange, channels, participants },
 *       metadata,
 *     }]
 *   }
 */
interface CiOperatorResult {
  id?: string;
  operator?: {
    id?: string;
    displayName?: string;
    version?: string;
    parameters?: Record<string, unknown>;
  };
  outputFormat?: "JSON" | "TEXT" | "CLASSIFICATION";
  result?: unknown;
  dateCreated?: string;
  executionDetails?: {
    trigger?: unknown;
    channels?: unknown;
    participants?: Array<{ address?: string; role?: string }>;
  };
  metadata?: unknown;
}

interface CiRuleWebhookPayload {
  accountId?: string;
  conversationId?: string;
  intelligenceConfiguration?: {
    id?: string;
    displayName?: string;
    version?: string;
    ruleId?: string;
  };
  operatorResults?: CiOperatorResult[];
}

function extractParticipantAddresses(
  results: CiOperatorResult[],
): string[] {
  const out = new Set<string>();
  for (const r of results) {
    for (const p of r.executionDetails?.participants || []) {
      if (p.address) out.add(p.address);
    }
  }
  return [...out];
}

function toJsonResult(r: CiOperatorResult): Record<string, unknown> | null {
  if (r.result == null) return null;
  if (typeof r.result === "object") return r.result as Record<string, unknown>;
  if (typeof r.result === "string") {
    try {
      return JSON.parse(r.result) as Record<string, unknown>;
    } catch {
      return null;
    }
  }
  return null;
}

export async function handleRuleWebhook(payload: CiRuleWebhookPayload) {
  const results = payload.operatorResults || [];
  const addresses = extractParticipantAddresses(results);
  const session = findCallForConversation(payload.conversationId, addresses);
  if (!session) {
    logger.warn(
      {
        conversationId: payload.conversationId,
        addresses,
        opCount: results.length,
      },
      "CI rule webhook: no matching call session",
    );
    return;
  }
  const callSid = session.callSid;
  logger.info(
    {
      callSid,
      conversationId: payload.conversationId,
      ops: results.map((r) => r.operator?.displayName),
    },
    "CI rule webhook",
  );

  const checklistTpl = loadChecklistTemplate();
  const talklistTpl = loadTalklistTemplate();

  for (const r of results) {
    const name = r.operator?.displayName || "";
    // === DIAGNOSTIC: LLM 生 result を丸ごとログ ===
    logger.info(
      {
        callSid,
        operator: name,
        outputFormat: r.outputFormat,
        result: r.result,
      },
      "CI operator result (raw)",
    );

    if (name === "caller_profile_extract") {
      const rawExtract = toJsonResult(r);
      // 都道府県名が preferredCity に入るなどの LLM 誤配置を後処理で修正
      const extract = rawExtract ? normalizeExtractLocation(rawExtract) : null;
      if (extract) {
        emitChecklistVerdict(callSid, extract, checklistTpl);
        emitJobsVerdict(callSid, extract);
        updateExtracted(callSid, extract);
        // 抽出値を Memory の Candidate.* trait に PATCH (best-effort)。
        // 会話中に自動 update されて次回通話時にも参照できる。
        if (session.customerPhone) {
          const candidatePatch = {
            license: str(extract.license),
            experienceYears: num(extract.experienceYears),
            preferredPrefecture: str(extract.preferredPrefecture),
            preferredCity: str(extract.preferredCity),
            preferredEmploymentType: str(extract.preferredEmploymentType),
            wantsNightShift: bool(extract.wantsNightShift),
            hourlyWageMinJpy: num(extract.hourlyWageMinJpy),
            tags: Array.isArray(extract.tags)
              ? (extract.tags as string[])
              : undefined,
          };
          void patchProfileTraits(session.customerPhone, {
            candidate: candidatePatch,
          }).catch(() => {
            /* logged in memory service */
          });
        }
      }
    } else if (name === "talklist_check") {
      const list = toJsonResult(r);
      if (list) emitTalklistVerdict(callSid, list, talklistTpl);
    }
  }
}

export function handleEndWebhook(payload: CiRuleWebhookPayload) {
  const results = payload.operatorResults || [];
  const addresses = extractParticipantAddresses(results);
  const session = findCallForConversation(payload.conversationId, addresses);
  if (!session) {
    logger.warn(
      { conversationId: payload.conversationId, addresses },
      "CI end webhook: no matching call session",
    );
    return;
  }
  const callSid = session.callSid;
  const summaryResult = results.find(
    (r) => r.operator?.displayName === "call_summary",
  );
  const sentimentResult = results.find(
    (r) => r.operator?.displayName === "sentiment",
  );
  const summary =
    typeof summaryResult?.result === "string"
      ? summaryResult.result
      : summaryResult?.result
        ? JSON.stringify(summaryResult.result)
        : undefined;
  const sentimentObj = toJsonResult(sentimentResult || {}) as
    | { label?: string }
    | null;
  const sentiment =
    sentimentObj?.label ||
    (typeof sentimentResult?.result === "string"
      ? sentimentResult.result
      : undefined);

  pushToCall(callSid, {
    type: "ci-post-call",
    payload: {
      callSid,
      summary,
      sentiment,
      operators: results.map((r) => ({
        name: r.operator?.displayName || "unknown",
        kind: r.outputFormat || "",
        result: r.result,
      })),
    },
  });
}

function emitChecklistVerdict(
  callSid: string,
  extract: Record<string, unknown>,
  tpl: ChecklistItemTemplate[],
) {
  const items = tpl.map((t) => {
    const value = extract[t.extractionKey];
    const has =
      value !== undefined &&
      value !== null &&
      !(typeof value === "string" && value.trim() === "");
    return {
      itemId: t.id,
      value: has ? value : null,
      confidence: has ? 0.8 : 0,
      status: has ? ("confirmed" as const) : ("empty" as const),
    };
  });
  const verdict: Verdict = { kind: "checklist", items };
  pushToCall(callSid, {
    type: "verdict",
    payload: { ...verdict, callSid, at: new Date().toISOString() },
  });
}

function emitTalklistVerdict(
  callSid: string,
  data: Record<string, unknown>,
  tpl: TalklistItemTemplate[],
) {
  const items = tpl.map((t) => {
    const v = data[t.id];
    if (typeof v === "boolean") {
      return { itemId: t.id, done: v };
    }
    if (v && typeof v === "object" && "done" in v) {
      const obj = v as { done?: boolean; evidence?: string };
      return { itemId: t.id, done: !!obj.done, evidence: obj.evidence };
    }
    return { itemId: t.id, done: false };
  });
  const verdict: Verdict = { kind: "talklist", items };
  pushToCall(callSid, {
    type: "verdict",
    payload: { ...verdict, callSid, at: new Date().toISOString() },
  });
}

function emitJobsVerdict(
  callSid: string,
  extract: Record<string, unknown>,
) {
  const profile: ExtractedProfile = {
    license: str(extract.license),
    experienceYears: num(extract.experienceYears),
    preferredPrefecture: str(extract.preferredPrefecture),
    preferredCity: str(extract.preferredCity),
    preferredEmploymentType: str(extract.preferredEmploymentType),
    wantsNightShift: bool(extract.wantsNightShift),
    hourlyWageMinJpy: num(extract.hourlyWageMinJpy),
    tags: Array.isArray(extract.tags) ? (extract.tags as string[]) : undefined,
  };
  const jobs = loadJobs();
  // 取得済み属性数に応じて表示件数を動的に絞る:
  //   1 属性 → 6 件 / 2 属性 → 5 件 / 3 → 4 件 / 4+ 属性 → 3 件
  // matchJobs 自体は hard filter で不適合を除外済み
  const known = countKnownAttributes(profile);
  const cap = known >= 4 ? 3 : Math.max(3, 7 - known);
  const rankings = matchJobs(profile, jobs).slice(0, cap);
  const verdict: Verdict = { kind: "jobs", rankings };
  pushToCall(callSid, {
    type: "verdict",
    payload: { ...verdict, callSid, at: new Date().toISOString() },
  });
}

function str(v: unknown): string | undefined {
  return typeof v === "string" ? v : undefined;
}
function num(v: unknown): number | undefined {
  return typeof v === "number" ? v : undefined;
}
function bool(v: unknown): boolean | undefined {
  return typeof v === "boolean" ? v : undefined;
}
