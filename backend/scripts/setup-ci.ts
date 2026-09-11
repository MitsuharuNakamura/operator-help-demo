/**
 * scripts/setup-ci.ts
 *
 * Twilio Conversation Orchestrator + Conversation Intelligence (v3) を
 * 冪等にセットアップする。作成順序:
 *
 *   1. Memory Store            (memory.twilio.com/v1/ControlPlane/Stores)
 *   2. Operators               (intelligence.twilio.com/v3/ControlPlane/Operators)
 *   3. Intelligence Config     (intelligence.twilio.com/v3/ControlPlane/Configurations)
 *      (rules は Configuration 本体に埋め込む)
 *   4. Conversation Config     (conversations.twilio.com/v2/ControlPlane/Configurations)
 *      (VOICE captureRules + intelligenceConfigurationIds を含める)
 *
 * 生成された ID は backend/.env に追記する:
 *   TWILIO_MEMORY_STORE_ID=mem_store_...
 *   TWILIO_INTELLIGENCE_CONFIG_ID=intelligence_configuration_...
 *   TWILIO_CONVERSATION_CONFIG_ID=...
 *   TWILIO_OPERATOR_CALLER_PROFILE_ID=intelligence_operator_...
 *   TWILIO_OPERATOR_TALKLIST_ID=intelligence_operator_...
 *   TWILIO_OPERATOR_CALL_SUMMARY_ID=intelligence_operator_...
 *   TWILIO_OPERATOR_SENTIMENT_ID=intelligence_operator_...
 *
 * 前提: backend/.env に以下が入っていること
 *   TWILIO_API_KEY_SID / TWILIO_API_KEY_SECRET / TWILIO_CALLER_ID / PUBLIC_BASE_URL
 */

import "dotenv/config";
import { promises as fs } from "node:fs";
import path from "node:path";
import twilio from "twilio";

const MEMORY_BASE = "https://memory.twilio.com/v1";
const INTELLIGENCE_BASE = "https://intelligence.twilio.com/v3";
const CONVERSATIONS_BASE = "https://conversations.twilio.com/v2";

function envOrDie(name: string): string {
  const v = process.env[name];
  if (!v) {
    console.error(`Missing env: ${name}. Set it in backend/.env first.`);
    process.exit(1);
  }
  return v;
}

async function tw(
  base: string,
  method: string,
  urlPath: string,
  body?: unknown,
): Promise<any> {
  const key = envOrDie("TWILIO_API_KEY_SID");
  const secret = envOrDie("TWILIO_API_KEY_SECRET");
  const auth = Buffer.from(`${key}:${secret}`).toString("base64");
  const res = await fetch(`${base}${urlPath}`, {
    method,
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) {
    console.error(`[${res.status}] ${method} ${base}${urlPath}\n${text}`);
    throw new Error(`Twilio API ${res.status}`);
  }
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return text;
  }
}

const memory = (m: string, p: string, b?: unknown) =>
  tw(MEMORY_BASE, m, p, b);
const intel = (m: string, p: string, b?: unknown) =>
  tw(INTELLIGENCE_BASE, m, p, b);
const conv = (m: string, p: string, b?: unknown) =>
  tw(CONVERSATIONS_BASE, m, p, b);

/* ------------------------------------------------------------------ */
/* Memory Store                                                        */
/* ------------------------------------------------------------------ */

async function ensureMemoryStore(): Promise<string> {
  const existing = process.env.TWILIO_MEMORY_STORE_ID;
  if (existing && existing.startsWith("mem_store_")) {
    console.log(`- Memory Store exists: ${existing}`);
    return existing;
  }
  const created = await memory("POST", "/ControlPlane/Stores", {
    displayName: "operator-help-demo",
    description: "Conversation Memory for Operator Help Demo",
  });
  const id = created.id || created.sid;
  console.log(`+ Created Memory Store: ${id}`);
  return id;
}

/**
 * Candidate trait group を Memory Store に登録する (冪等)。
 * ここに定義した trait 名だけが PATCH で書き込み可能になる。
 */
const CANDIDATE_TRAIT_GROUP = {
  displayName: "Candidate",
  description:
    "Medical staffing candidate profile — extracted during operator-assist calls",
  traits: {
    license: {
      dataType: "STRING",
      description: "保有資格 (正看護師 / 准看護師 / 介護福祉士 など)",
    },
    experienceYears: { dataType: "NUMBER", description: "実務経験年数" },
    preferredPrefecture: {
      dataType: "STRING",
      description: "希望勤務地の都道府県",
    },
    preferredCity: {
      dataType: "STRING",
      description: "希望勤務地の市区町村",
    },
    preferredEmploymentType: {
      dataType: "STRING",
      description:
        "希望雇用形態 (full_time/part_time/contract/dispatch)",
    },
    wantsNightShift: { dataType: "BOOLEAN", description: "夜勤可能か" },
    hourlyWageMinJpy: {
      dataType: "NUMBER",
      description: "希望時給の下限 (JPY)",
    },
    furigana: { dataType: "STRING", description: "ふりがな" },
    tags: {
      dataType: "ARRAY",
      description: "その他希望条件のフリータグ",
    },
  },
};

async function ensureCandidateTraitGroup(memoryStoreId: string): Promise<void> {
  try {
    const list = (await memory(
      "GET",
      `/ControlPlane/Stores/${memoryStoreId}/TraitGroups`,
    )) as { traitGroups?: Array<{ displayName?: string }> };
    const found = list.traitGroups?.some(
      (g) => g.displayName === CANDIDATE_TRAIT_GROUP.displayName,
    );
    if (found) {
      console.log(
        `- TraitGroup exists: ${CANDIDATE_TRAIT_GROUP.displayName}`,
      );
      return;
    }
  } catch (e) {
    console.warn(
      `  (could not list TraitGroups, will attempt create anyway: ${
        (e as Error).message
      })`,
    );
  }
  await memory(
    "POST",
    `/ControlPlane/Stores/${memoryStoreId}/TraitGroups`,
    CANDIDATE_TRAIT_GROUP,
  );
  console.log(`+ Created TraitGroup: ${CANDIDATE_TRAIT_GROUP.displayName}`);
}

/* ------------------------------------------------------------------ */
/* Operators (shared, referenced by Rules)                             */
/* ------------------------------------------------------------------ */

interface OperatorSpec {
  envKey: string;
  displayName: string;
  description: string;
  prompt: string;
  outputFormat: "JSON" | "TEXT" | "CLASSIFICATION";
  outputSchema?: unknown;
}

// OpenAI strict-mode 準拠: 全 object に additionalProperties:false + 全 property を required
// 任意フィールドは "type": ["<type>","null"] union で表現する
const TALKLIST_ITEM_IDS = [
  "greeting",
  "confirm_identity",
  "confirm_license",
  "confirm_experience",
  "ask_preferred_location",
  "ask_employment_type",
  "ask_night_shift",
  "ask_wage",
  "propose_next_step",
] as const;

const talklistItemSchema = {
  type: "object",
  properties: {
    done: { type: "boolean" },
    evidence: { type: ["string", "null"] },
  },
  required: ["done", "evidence"],
  additionalProperties: false,
};

const OPERATORS: OperatorSpec[] = [
  {
    envKey: "TWILIO_OPERATOR_CALLER_PROFILE_ID",
    displayName: "caller_profile_extract",
    description:
      "医療系人材候補者の会話履歴から属性 (資格 / 経験年数 / 希望勤務地 / 雇用形態 / 夜勤可否 / 希望時給) を抽出する",
    prompt: [
      "あなたは医療系人材紹介のコールセンター向けデータ抽出器です。",
      "会話履歴を読み、話者が候補者 (customer) として述べた属性のみを抽出してください。",
      "オペレータ (agent) 側の発言や質問は抽出しないこと。",
      "情報が明確に述べられていない項目は null にしてください。",
      "出力は必ず outputSchema の JSON 形式で返してください。",
      "",
      "【地域の記入ルール】",
      "- 47 都道府県名 (東京都/大阪府/北海道/神奈川県 等) は必ず preferredPrefecture に入れること",
      "- 「東京」「大阪」など末尾のない呼び方も preferredPrefecture (フル形 '東京都'/'大阪府' で正規化して) 入れる",
      "- 市区町村名 (新宿区/横浜市/船橋市 等) は preferredCity に入れる",
      "- 同じ値を preferredPrefecture と preferredCity の両方に入れないこと",
    ].join("\n"),
    outputFormat: "JSON",
    outputSchema: {
      type: "object",
      properties: {
        license: {
          type: ["string", "null"],
          description: "保有資格 (正看護師 / 准看護師 / 介護福祉士 など)",
        },
        experienceYears: {
          type: ["number", "null"],
          description: "実務経験年数",
        },
        preferredPrefecture: {
          type: ["string", "null"],
          description: "希望勤務地の都道府県",
        },
        preferredCity: {
          type: ["string", "null"],
          description: "希望勤務地の市区町村",
        },
        preferredEmploymentType: {
          type: ["string", "null"],
          enum: ["full_time", "part_time", "contract", "dispatch", null],
        },
        wantsNightShift: {
          type: ["boolean", "null"],
          description: "夜勤可能ならtrue",
        },
        hourlyWageMinJpy: {
          type: ["number", "null"],
          description: "希望時給の下限 (円)",
        },
        tags: {
          type: ["array", "null"],
          items: { type: "string" },
          description: "その他希望条件のフリータグ",
        },
      },
      required: [
        "license",
        "experienceYears",
        "preferredPrefecture",
        "preferredCity",
        "preferredEmploymentType",
        "wantsNightShift",
        "hourlyWageMinJpy",
        "tags",
      ],
      additionalProperties: false,
    },
  },
  {
    envKey: "TWILIO_OPERATOR_TALKLIST_ID",
    displayName: "talklist_check",
    description:
      "オペレータが行うべきトークリスト項目それぞれが会話中に達成されたかを判定する",
    prompt: [
      "あなたはコールセンターの通話品質評価器です。",
      "以下のトークリスト項目それぞれについて、オペレータが達成したかどうかを判定してください。",
      "- greeting: 挨拶と自己紹介",
      "- confirm_identity: 本人確認",
      "- confirm_license: 保有資格の確認",
      "- confirm_experience: 経験年数の確認",
      "- ask_preferred_location: 希望勤務地のヒアリング",
      "- ask_employment_type: 希望雇用形態のヒアリング",
      "- ask_night_shift: 夜勤可否のヒアリング",
      "- ask_wage: 希望時給/年収のヒアリング",
      "- propose_next_step: 次のステップ (面談/面接/資料送付) の提案",
      "各キーに { done: boolean, evidence: string|null } を返してください。evidence は判断根拠となった短い発言引用 (無ければ null)。",
    ].join("\n"),
    outputFormat: "JSON",
    outputSchema: {
      type: "object",
      properties: Object.fromEntries(
        TALKLIST_ITEM_IDS.map((id) => [id, talklistItemSchema]),
      ),
      required: [...TALKLIST_ITEM_IDS],
      additionalProperties: false,
    },
  },
  {
    envKey: "TWILIO_OPERATOR_CALL_SUMMARY_ID",
    displayName: "call_summary",
    description: "通話の要約と次のアクションを日本語で作成する",
    prompt: [
      "通話全体を読み、以下を含む要約を日本語 200-400 字で作成してください。",
      "1. 顧客が求めている条件のサマリ",
      "2. 特に強調された点や制約",
      "3. 次に取るべきアクション",
    ].join("\n"),
    outputFormat: "TEXT",
  },
  {
    envKey: "TWILIO_OPERATOR_SENTIMENT_ID",
    displayName: "sentiment",
    description: "通話全体の感情スコア",
    prompt:
      "この通話全体の顧客側の感情を positive / neutral / negative で分類してください。",
    outputFormat: "CLASSIFICATION",
    outputSchema: {
      type: "object",
      properties: {
        label: {
          type: "string",
          enum: ["positive", "neutral", "negative"],
        },
      },
    },
  },
];

async function listOperators(): Promise<any[]> {
  try {
    const r = await intel("GET", "/ControlPlane/Operators");
    return r.operators || r.items || [];
  } catch {
    return [];
  }
}

async function ensureOperator(spec: OperatorSpec, existing: any[]): Promise<string> {
  const found = existing.find((o) => o.displayName === spec.displayName);
  if (found) {
    console.log(`- Operator exists: ${spec.displayName} (${found.id})`);
    return found.id;
  }
  const body: Record<string, unknown> = {
    displayName: spec.displayName,
    description: spec.description,
    prompt: spec.prompt,
    outputFormat: spec.outputFormat,
  };
  if (spec.outputSchema) body.outputSchema = spec.outputSchema;
  const created = await intel("POST", "/ControlPlane/Operators", body);
  console.log(`+ Created Operator: ${spec.displayName} (${created.id})`);
  return created.id;
}

/* ------------------------------------------------------------------ */
/* Intelligence Configuration (with rules embedded)                    */
/* ------------------------------------------------------------------ */

function buildRules(
  operatorIds: Record<string, string>,
  base: string,
): unknown[] {
  return [
    {
      operators: [
        { id: operatorIds.TWILIO_OPERATOR_CALLER_PROFILE_ID },
        { id: operatorIds.TWILIO_OPERATOR_TALKLIST_ID },
      ],
      // Twilio の response で `parameters: None` になるフィールドが正解。
      // top-level `every: 3` は silent drop されるので parameters に入れる。
      triggers: [{ on: "COMMUNICATION", parameters: { every: 3 } }],
      actions: [
        {
          type: "WEBHOOK",
          method: "POST",
          url: `${base}/twilio/ci/rule`,
        },
      ],
    },
    {
      operators: [
        { id: operatorIds.TWILIO_OPERATOR_CALL_SUMMARY_ID },
        { id: operatorIds.TWILIO_OPERATOR_SENTIMENT_ID },
      ],
      triggers: [{ on: "CONVERSATION_END", parameters: null }],
      actions: [
        {
          type: "WEBHOOK",
          method: "POST",
          url: `${base}/twilio/ci/end`,
        },
      ],
    },
  ];
}

async function ensureIntelligenceConfig(
  operatorIds: Record<string, string>,
  base: string,
): Promise<string> {
  const rules = buildRules(operatorIds, base);
  const existing = process.env.TWILIO_INTELLIGENCE_CONFIG_ID;
  if (existing && existing.startsWith("intelligence_configuration_")) {
    await intel("PUT", `/ControlPlane/Configurations/${existing}`, {
      displayName: "operator-help-demo",
      description: "Operator Help Demo intelligence config",
      rules,
    });
    console.log(`= Updated Intelligence Configuration: ${existing}`);
    return existing;
  }
  const created = await intel("POST", "/ControlPlane/Configurations", {
    displayName: "operator-help-demo",
    description: "Operator Help Demo intelligence config",
    rules,
  });
  console.log(`+ Created Intelligence Configuration: ${created.id}`);
  return created.id;
}

/* ------------------------------------------------------------------ */
/* Conversation Configuration                                          */
/* ------------------------------------------------------------------ */

async function ensureConversationConfig(
  memoryStoreId: string,
  intelligenceConfigId: string,
): Promise<string> {
  const callerId = envOrDie("TWILIO_CALLER_ID");
  const body: Record<string, unknown> = {
    displayName: "operator-help-demo",
    description: "Voice conversations captured for Operator Help Demo",
    conversationGroupingType: "GROUP_BY_PARTICIPANT_ADDRESSES_AND_CHANNEL_TYPE",
    memoryStoreId,
    channelSettings: {
      VOICE: {
        statusTimeouts: { inactive: 5, closed: 30 },
        captureRules: [
          { from: callerId, to: "*" },
          { from: "*", to: callerId },
        ],
      },
    },
    intelligenceConfigurationIds: [intelligenceConfigId],
    memoryExtractionEnabled: true,
  };
  const existing = process.env.TWILIO_CONVERSATION_CONFIG_ID;
  if (existing) {
    await conv("PUT", `/ControlPlane/Configurations/${existing}`, body);
    console.log(`= Updated Conversation Configuration: ${existing}`);
    return existing;
  }
  const created = await conv("POST", "/ControlPlane/Configurations", body);
  const id = created.id || created.sid;
  console.log(`+ Created Conversation Configuration: ${id}`);
  return id;
}

/* ------------------------------------------------------------------ */
/* TwiML App (Voice)                                                   */
/* ------------------------------------------------------------------ */

const TWIML_APP_FRIENDLY_NAME = "operator-help-demo";

async function ensureTwimlApp(): Promise<string> {
  const existing = process.env.TWILIO_TWIML_APP_SID;
  if (existing && existing.startsWith("AP") && !/^AP0{20,}/.test(existing)) {
    console.log(`- TwiML App exists (env): ${existing}`);
    return existing;
  }
  const accountSid = envOrDie("TWILIO_ACCOUNT_SID");
  const apiKey = envOrDie("TWILIO_API_KEY_SID");
  const apiSecret = envOrDie("TWILIO_API_KEY_SECRET");
  const client = twilio(apiKey, apiSecret, { accountSid });

  const list = await client.applications.list({
    friendlyName: TWIML_APP_FRIENDLY_NAME,
    limit: 1,
  });
  if (list[0]) {
    console.log(`- TwiML App exists (by name): ${list[0].sid}`);
    return list[0].sid;
  }

  const created = await client.applications.create({
    friendlyName: TWIML_APP_FRIENDLY_NAME,
    voiceUrl: "https://placeholder.example.com/twilio/voice/outbound",
    voiceMethod: "POST",
  });
  console.log(`+ Created TwiML App: ${created.sid}`);
  return created.sid;
}

/* ------------------------------------------------------------------ */
/* env writer                                                          */
/* ------------------------------------------------------------------ */

async function appendEnv(patch: Record<string, string>) {
  const p = path.resolve(process.cwd(), ".env");
  let text = "";
  try {
    text = await fs.readFile(p, "utf8");
  } catch {
    text = "";
  }
  let updated = text;
  for (const [k, v] of Object.entries(patch)) {
    const re = new RegExp(`^${k}=.*$`, "m");
    if (re.test(updated)) {
      updated = updated.replace(re, `${k}=${v}`);
    } else {
      updated += `\n${k}=${v}`;
    }
  }
  await fs.writeFile(p, updated.trimStart().replace(/\n{3,}/g, "\n\n") + "\n");
  console.log(`- backend/.env updated`);
}

/* ------------------------------------------------------------------ */
/* main                                                                */
/* ------------------------------------------------------------------ */

async function main() {
  // PUBLIC_BASE_URL は Rules の webhook URL 用 placeholder。
  // 実運用では backend 起動時に syncWebhooks() が ngrok URL で上書きする。
  const base = (process.env.PUBLIC_BASE_URL || "https://placeholder.example.com").replace(
    /\/$/,
    "",
  );

  const twimlAppSid = await ensureTwimlApp();

  const memoryStoreId = await ensureMemoryStore();
  await ensureCandidateTraitGroup(memoryStoreId);

  const existingOps = await listOperators();
  const operatorIds: Record<string, string> = {};
  for (const spec of OPERATORS) {
    operatorIds[spec.envKey] = await ensureOperator(spec, existingOps);
  }

  const intelligenceConfigId = await ensureIntelligenceConfig(
    operatorIds,
    base,
  );

  const conversationConfigId = await ensureConversationConfig(
    memoryStoreId,
    intelligenceConfigId,
  );

  await appendEnv({
    TWILIO_TWIML_APP_SID: twimlAppSid,
    TWILIO_MEMORY_STORE_ID: memoryStoreId,
    TWILIO_INTELLIGENCE_CONFIG_ID: intelligenceConfigId,
    TWILIO_CONVERSATION_CONFIG_ID: conversationConfigId,
    ...operatorIds,
  });

  console.log("\nDone.");
  console.log("次のステップ:");
  console.log(
    "  1) backend/.env に NGROK_AUTHTOKEN を入れる (dashboard.ngrok.com)",
  );
  console.log(
    "  2) `npm run dev` を起動 — ngrok トンネル + webhook 同期が自動で走る",
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
