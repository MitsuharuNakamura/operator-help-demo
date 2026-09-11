/**
 * scripts/set-webhooks.ts
 *
 * 手動で ngrok URL を .env に貼って呼び出す用の CLI エントリ。
 * 実処理は backend/src/services/syncWebhooks.ts に集約。
 * backend 起動時は自動で syncWebhooks() が走るので、ngrok を自前で立てる
 * デバッグ時以外は基本このスクリプトを叩く必要はない。
 */

import "dotenv/config";
import { syncWebhooks } from "../src/services/syncWebhooks.js";

function envOrDie(k: string): string {
  const v = process.env[k];
  if (!v) {
    console.error(`Missing env: ${k}`);
    process.exit(1);
  }
  return v;
}

async function main() {
  const base = envOrDie("PUBLIC_BASE_URL");
  const result = await syncWebhooks(base);
  console.log(JSON.stringify(result, null, 2));
  if (result.errors.length > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
