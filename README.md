# Operator Help Demo

医療系人材紹介コールセンター向けの **オペレータ支援 Web アプリのデモ実装**。

Twilio Voice + Twilio Conversation Intelligence (v3) + Conversation Memory を組み合わせ、通話中に候補者情報を自動抽出しながら「次に聞くべき質問」「確認済み情報」「候補となる求人」をオペレータの画面にリアルタイム表示します。

![License: MIT](https://img.shields.io/badge/license-MIT-green)
![Node](https://img.shields.io/badge/node-20%2B-brightgreen)
![Twilio](https://img.shields.io/badge/Twilio-Voice%20%2B%20Conversation%20Intelligence-red)

---

## デモ体験できる機能

- **実通話**: ブラウザから架電/受電 (`@twilio/voice-sdk` によるソフトフォン)
- **リアルタイム文字起こし**: `<Start><Transcription>` (Setup 画面から Google Speech / Deepgram、モデル、医療用語 hints、追加語彙を切替)
- **候補者属性の自動抽出**: 資格 / 経験年数 / 希望勤務地 (都道府県/市区町村) / 雇用形態 / 夜勤可否 / 希望時給 を会話から抽出。都道府県名が誤って市区町村フィールドに入った場合は backend 側で自動補正
- **トークリスト自動チェック**: 挨拶・本人確認・資格・経験・勤務地・雇用形態・夜勤・時給・次アクション の 9 項目達成判定 (`talklist_check` operator が 3 発話ごとに実行)
- **確認項目の手動編集 + Memory 保存**: CI 抽出値を人が確定できる。編集後「Memory に保存」ボタンで Twilio Conversation Memory の `Candidate` trait group と local contacts.json 両方に反映
- **プログレッシブ求人マッチング**: 抽出属性に基づき 25 件の求人マスタから hard filter (資格・勤務地・雇用形態・夜勤) を適用して段階的に絞り込み (通話開始時 0 件 → 属性増える毎に候補数が絞れる → 最終 3〜4 件)
- **Conversation Memory**: 通話内容が Twilio Memory に自動蓄積、次回通話時に前回情報を参照
- **多言語 UI**: 日本語 / English / 中文 切替

## 画面構成

3 カラムレイアウト:
- **左**: 通話相手プロファイル + 確認項目 (編集可能、Memory に保存可)
- **中央**: リアルタイム文字起こし (パーシャル対応)
- **右**: 次に会話すべきリスト + 求人提案

## アーキテクチャ

```
[Twilio Voice / Conversations Orchestrator]
        │
        │  captureRules で通話を自動キャプチャ
        │  → talklist_check / caller_profile_extract Operator
        │
        ▼ Webhook (POST)
[Node.js Backend (Express + ws)]
        │
        ├─ /api/*    : token / contacts / jobs / templates / transcription config
        ├─ /twilio/* : voice TwiML / transcription content / CI Rule / CI End
        └─ /ws/live  : verdict / transcript / call-status を browser へ push
        │
        ▼ WebSocket
[React Frontend (Vite / Zustand / Tailwind)]
```

## 前提条件

- Node.js 20+
- Twilio アカウント (Programmable Voice + Conversation Intelligence v3 + Memory)
- ngrok アカウント (Hobbyist 以上推奨。Free だとレート制限で Real-Time Transcription が捌けない)

## セットアップ

### 1. 依存インストール

```bash
npm run install:all
```

### 2. Twilio 認証情報の設定

```bash
cp backend/.env.example backend/.env
```

`backend/.env` を編集して以下を入力:

```
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...
TWILIO_API_KEY_SID=SK...    # Console → Account → API keys & tokens → Create (Standard)
TWILIO_API_KEY_SECRET=...
TWILIO_CALLER_ID=+81...     # Twilio で購入した電話番号
NGROK_AUTHTOKEN=...         # dashboard.ngrok.com からトークン取得
NGROK_DOMAIN=your-name.ngrok.io  # 有償プランの reserved domain (任意)
```

### 3. Twilio 側リソースを自動作成

```bash
npm run setup:ci
```

以下が冪等に作られ、生成された SID が `.env` に追記されます:

- TwiML App
- Conversation Memory Store + Candidate Trait Group
- Intelligence Configuration + 4 つの Operator + 2 つの Rule
- Conversation Configuration + VOICE capture rules

### 4. 開発モードで起動

```bash
npm run dev
```

- Frontend (Vite HMR): http://localhost:5173
- Backend + ngrok: http://localhost:4000 → 自動でトンネル張られ、Twilio 側 Webhook も自動同期

### 5. デモモード (単一 URL で外部からアクセス可能)

```bash
npm run demo
```

Frontend をビルドして backend が `dist/` を serve します。ngrok の Public URL (`https://<your-domain>.ngrok.io`) で UI + API 全部提供。

## デモの流れ

1. ブラウザで開いてログイン (任意の名前)
2. 初期設定で以下を選択:
   - UI 表示言語 (JA/EN/ZH)
   - Transcription プロバイダ (Google / Deepgram)
   - Speech model (Google なら `long` / `telephony` / `short`、Deepgram なら `nova-3-general` / `nova-2`)
   - ドメイン語彙 hints の on/off + 追加語彙
3. Contacts モーダルで候補者を選ぶ or 新規追加 (checklist と同じ 7 項目を optional で登録可、Twilio Memory の Candidate trait に mirror)
4. 発信ボタン → 実通話
5. 会話中:
   - 中央にリアルタイム transcript (partial → final)
   - 左上の caller profile カードに Memory から取得した過去の観察履歴
   - 左下の確認項目が CI 抽出で自動埋め (「AI 抽出」バッジ)
   - オペレータが値を手動編集すると「手動」バッジに切替 → AI 上書きされない
   - 「Memory に保存」で確定値を Twilio Memory + contacts.json に永続化
   - 右上のトークリスト 9 項目が達成判定で自動チェック
   - 右下の求人が抽出属性に応じてプログレッシブに絞り込まれる (0 → 6 → 5 → 4 → 3 件)
6. 切断後: post-call サマリと sentiment が modal で表示

## プロジェクト構成

```
Operator-help-demo/
├── backend/                # Node.js + Express + ws + twilio SDK
│   ├── scripts/
│   │   ├── setup-ci.ts     # Twilio リソース (Memory Store / Operators / Rules / Conv Config) 冪等作成
│   │   ├── set-webhooks.ts # ngrok URL 変更時の一括再同期 (通常は backend 起動で自動)
│   │   └── testmatch.ts    # 求人マッチングのシミュレータ CLI
│   └── src/
│       ├── routes/         # /api/*, /twilio/*, /ws/live のエンドポイント
│       ├── services/       # twilioClient / ciWebhook / memory / matchJobs / tunnel
│       │                   # transcription(Hints|Config) / locationNormalize / syncWebhooks 他
│       ├── data/           # contacts / jobs / checklist・talklist template (JSON)
│       └── types/          # 共通型
├── frontend/               # Vite + React 18 + TS + Tailwind + Zustand + react-i18next
│   ├── src/
│   │   ├── screens/        # Login / Setup / Main
│   │   ├── components/     # TopBar 家族 (ContactsManagerModal 含む) + パネル各種
│   │   ├── store/          # Zustand (useAppStore / useCallStore)
│   │   ├── api/            # http / live (WS) / twilioClient
│   │   ├── i18n/           # ja / en / zh
│   │   └── utils/          # safeAgentId 等
│   └── dist/               # `npm run build:frontend` の出力。backend が SPA fallback で serve
├── docs/
│   ├── memo.md             # 初期要件
│   └── talklist-flow.pptx  # トークリスト検知フロー解説スライド
├── LICENSE
└── README.md
```

## 主な設計判断

- **判定は Twilio 側で完結**: LLM 呼び出しは Twilio Intelligence の Operator (`talklist_check` / `caller_profile_extract` / `call_summary` / `sentiment`) が担当。我々のバックエンドは OpenAI/Anthropic の API キーを持たない
- **求人マッチングは自前**: 抽出結果を我々のマッチングロジック (`services/matchJobs.ts`) で job master (`data/jobs.json`) と突合。プロンプトに求人カタログを丸投げしない
- **Memory の Trait Group**: `Contact` (Twilio 標準) と `Candidate` (このアプリで定義した候補者用グループ) の 2 系統に分ける
- **識別子は phone**: Twilio Memory はプロファイルを内部発行 ID (`mem_profile_...`) で管理し、外部 ID では引けない。我々は phone 番号を identifier として登録して `GET /Profiles?identifier=<phone>` で lookup

## 開発時のヒント

- `backend/scripts/testmatch.ts` — 求人マッチングを段階的に検証する CLI (`npx tsx scripts/testmatch.ts`)
- 通話中に `caller_profile_extract` と `talklist_check` の raw JSON が backend log に出るので判定の debug に使える
- ngrok reserved domain (有償) を使うと backend 再起動しても URL 不変 → webhook 再同期不要
- **Twilio Real-Time Transcription の `hints` 属性は `speechModel="telephony"` と非互換** (32651 "Configuration Rejected" が返る)。日本語で hints を使うなら **`speechModel="long"`** を選ぶ。Setup 画面で切替可、`.env.example` の初期値は `long`
- **Twilio Voice Client identity** は `0-9A-Za-z._-` のみ許可。日本語オペレータ名は backend の `toSafeAgentId()` で `agent-<hash>` に正規化される
- ngrok が corp Zscaler 環境でブロックされる可能性あり。Twilio Cloud → ngrok の webhook は corp NW を経由しないので機能自体は動作する

## ライセンス

MIT License — see [LICENSE](LICENSE)

## Disclaimer

これはデモ実装です。本番運用には認証・レート制限・エラーハンドリング・監査ログ・PII マスキング等の追加が必要です。

---

# Operator Help Demo (English)

A **demo implementation of an operator assistance web app** for medical staffing call centers.

By combining Twilio Voice + Twilio Conversation Intelligence (v3) + Conversation Memory, candidate information is automatically extracted during the call, and "the next questions to ask", "confirmed information", and "candidate job openings" are displayed in real-time on the operator's screen.

![License: MIT](https://img.shields.io/badge/license-MIT-green)
![Node](https://img.shields.io/badge/node-20%2B-brightgreen)
![Twilio](https://img.shields.io/badge/Twilio-Voice%20%2B%20Conversation%20Intelligence-red)

---

## Features Available in the Demo

- **Live calls**: Make/receive calls from the browser (softphone via `@twilio/voice-sdk`)
- **Real-time transcription**: `<Start><Transcription>` (switch between Google Speech / Deepgram, model, medical terminology hints, and additional vocabulary from the Setup screen)
- **Automatic extraction of candidate attributes**: Extracts qualifications / years of experience / preferred work location (prefecture/city) / employment type / night shift availability / desired hourly wage from conversation. If a prefecture name is mistakenly entered into the city field, the backend auto-corrects it
- **Automatic talk list checking**: Achievement judgment of 9 items — greeting, identity verification, qualifications, experience, work location, employment type, night shift, hourly wage, and next action (executed by the `talklist_check` operator every 3 utterances)
- **Manual editing of confirmation items + save to Memory**: Human operators can confirm CI-extracted values. After editing, the "Save to Memory" button reflects changes to both the Twilio Conversation Memory `Candidate` trait group and the local contacts.json
- **Progressive job matching**: Based on extracted attributes, hard filters (qualifications, work location, employment type, night shift) are applied to 25 job master entries, progressively narrowing down (0 candidates at call start → narrows as attributes increase → final 3–4 candidates)
- **Conversation Memory**: Call content is automatically stored in Twilio Memory, referencing past information for future calls
- **Multilingual UI**: Switch between Japanese / English / Chinese

## Screen Layout

3-column layout:
- **Left**: Caller profile + confirmation items (editable, can be saved to Memory)
- **Center**: Real-time transcription (partial supported)
- **Right**: List of what to talk about next + job suggestions

## Architecture

```
[Twilio Voice / Conversations Orchestrator]
        │
        │  Automatic call capture via captureRules
        │  → talklist_check / caller_profile_extract Operator
        │
        ▼ Webhook (POST)
[Node.js Backend (Express + ws)]
        │
        ├─ /api/*    : token / contacts / jobs / templates / transcription config
        ├─ /twilio/* : voice TwiML / transcription content / CI Rule / CI End
        └─ /ws/live  : push verdict / transcript / call-status to browser
        │
        ▼ WebSocket
[React Frontend (Vite / Zustand / Tailwind)]
```

## Prerequisites

- Node.js 20+
- Twilio account (Programmable Voice + Conversation Intelligence v3 + Memory)
- ngrok account (Hobbyist or higher recommended. Free tier may not handle Real-Time Transcription due to rate limits)

## Setup

### 1. Install dependencies

```bash
npm run install:all
```

### 2. Configure Twilio credentials

```bash
cp backend/.env.example backend/.env
```

Edit `backend/.env` and enter the following:

```
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...
TWILIO_API_KEY_SID=SK...    # Console → Account → API keys & tokens → Create (Standard)
TWILIO_API_KEY_SECRET=...
TWILIO_CALLER_ID=+81...     # Phone number purchased on Twilio
NGROK_AUTHTOKEN=...         # Get token from dashboard.ngrok.com
NGROK_DOMAIN=your-name.ngrok.io  # Reserved domain on paid plan (optional)
```

### 3. Auto-create Twilio-side resources

```bash
npm run setup:ci
```

The following are idempotently created, and generated SIDs are appended to `.env`:

- TwiML App
- Conversation Memory Store + Candidate Trait Group
- Intelligence Configuration + 4 Operators + 2 Rules
- Conversation Configuration + VOICE capture rules

### 4. Launch in development mode

```bash
npm run dev
```

- Frontend (Vite HMR): http://localhost:5173
- Backend + ngrok: http://localhost:4000 → tunnel is automatically established, and Twilio webhooks are auto-synced

### 5. Demo mode (single URL accessible from outside)

```bash
npm run demo
```

The frontend is built and served by the backend from `dist/`. The ngrok public URL (`https://<your-domain>.ngrok.io`) provides the full UI + API.

## Demo Flow

1. Open in browser and log in (any name)
2. In initial setup, select:
   - UI display language (JA/EN/ZH)
   - Transcription provider (Google / Deepgram)
   - Speech model (Google: `long` / `telephony` / `short`, Deepgram: `nova-3-general` / `nova-2`)
   - Domain vocabulary hints on/off + additional vocabulary
3. In the Contacts modal, select a candidate or add a new one (optionally register the same 7 items as the checklist, mirrored to the Twilio Memory Candidate trait)
4. Press call button → live call
5. During the call:
   - Real-time transcript in the center (partial → final)
   - Caller profile card in the upper left shows past observation history retrieved from Memory
   - Confirmation items in the lower left are automatically filled by CI extraction ("AI Extracted" badge)
   - If the operator manually edits a value, it switches to a "Manual" badge → won't be overwritten by AI
   - "Save to Memory" persists the confirmed values to Twilio Memory + contacts.json
   - Talk list of 9 items in the upper right is automatically checked based on achievement judgment
   - Jobs in the lower right are progressively narrowed based on extracted attributes (0 → 6 → 5 → 4 → 3 candidates)
6. After disconnection: post-call summary and sentiment displayed in a modal

## Project Structure

```
Operator-help-demo/
├── backend/                # Node.js + Express + ws + twilio SDK
│   ├── scripts/
│   │   ├── setup-ci.ts     # Idempotent creation of Twilio resources (Memory Store / Operators / Rules / Conv Config)
│   │   ├── set-webhooks.ts # Bulk re-sync when ngrok URL changes (usually auto-run on backend startup)
│   │   └── testmatch.ts    # Job matching simulator CLI
│   └── src/
│       ├── routes/         # Endpoints for /api/*, /twilio/*, /ws/live
│       ├── services/       # twilioClient / ciWebhook / memory / matchJobs / tunnel
│       │                   # transcription(Hints|Config) / locationNormalize / syncWebhooks etc.
│       ├── data/           # contacts / jobs / checklist / talklist template (JSON)
│       └── types/          # Shared types
├── frontend/               # Vite + React 18 + TS + Tailwind + Zustand + react-i18next
│   ├── src/
│   │   ├── screens/        # Login / Setup / Main
│   │   ├── components/     # TopBar family (including ContactsManagerModal) + various panels
│   │   ├── store/          # Zustand (useAppStore / useCallStore)
│   │   ├── api/            # http / live (WS) / twilioClient
│   │   ├── i18n/           # ja / en / zh
│   │   └── utils/          # safeAgentId etc.
│   └── dist/               # Output of `npm run build:frontend`. Backend serves via SPA fallback
├── docs/
│   ├── memo.md             # Initial requirements
│   └── talklist-flow.pptx  # Talk list detection flow explanation slides
├── LICENSE
└── README.md
```

## Key Design Decisions

- **Judgment is complete on the Twilio side**: LLM calls are handled by Twilio Intelligence Operators (`talklist_check` / `caller_profile_extract` / `call_summary` / `sentiment`). Our backend does not hold any OpenAI/Anthropic API keys
- **Job matching is done in-house**: Extraction results are matched against the job master (`data/jobs.json`) using our matching logic (`services/matchJobs.ts`). The job catalog is not dumped into the prompt
- **Memory Trait Groups**: Separated into 2 systems — `Contact` (Twilio standard) and `Candidate` (a candidate-specific group defined for this app)
- **Identifier is phone**: Twilio Memory manages profiles with an internally issued ID (`mem_profile_...`) and cannot be queried by external IDs. We register phone numbers as identifiers and lookup via `GET /Profiles?identifier=<phone>`

## Development Tips

- `backend/scripts/testmatch.ts` — CLI for progressively verifying job matching (`npx tsx scripts/testmatch.ts`)
- During calls, raw JSON of `caller_profile_extract` and `talklist_check` is logged to the backend, useful for debugging judgments
- Using an ngrok reserved domain (paid) keeps the URL constant even after backend restart → no need to re-sync webhooks
- **Twilio Real-Time Transcription's `hints` attribute is incompatible with `speechModel="telephony"`** (returns 32651 "Configuration Rejected"). To use hints in Japanese, select **`speechModel="long"`**. Switchable in the Setup screen; the default in `.env.example` is `long`
- **Twilio Voice Client identity** only allows `0-9A-Za-z._-`. Japanese operator names are normalized to `agent-<hash>` via the backend's `toSafeAgentId()`
- ngrok may be blocked in corp Zscaler environments. Webhooks from Twilio Cloud → ngrok do not go through the corp network, so the functionality itself works

## License

MIT License — see [LICENSE](LICENSE)

## Disclaimer

This is a demo implementation. Production use requires additional features such as authentication, rate limiting, error handling, audit logs, and PII masking.
