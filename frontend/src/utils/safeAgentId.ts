/**
 * Twilio Voice Client identity は `0-9 A-Z a-z - _ .` のみ許可。
 * 生の表示名に日本語や空白が含まれると Client leg のルーティングに失敗するため、
 * ここで決定論的に安全な id (`agent-*`) に変換する。
 * backend の toSafeAgentId() と等価な結果を返す (非ASCII → SHA-1 12桁 hex)。
 */
export function toSafeAgentId(raw: string): string {
  const stripped = (raw || "")
    .normalize("NFKC")
    .replace(/[^0-9A-Za-z._-]/g, "")
    .slice(0, 32);
  if (stripped) return `agent-${stripped}`;
  return `agent-${simpleHashHex(raw || "").slice(0, 12)}`;
}

// backend が crypto.sha1() を使っているのに対し、ブラウザ側は Web Crypto API が
// async のため簡易同期ハッシュを使う。安全化された名前が同じ入力なら backend と
// 一致するので、ASCII 名しか使わないユースケースでは十分。日本語のみのケースでは
// 一致しないが、その場合は backend が `/api/token` レスポンスで正解 identity を
// 返してくるので、frontend は最終的にそちらを採用する。
function simpleHashHex(s: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < s.length; i++) {
    const ch = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  const hex = ((h1 >>> 0).toString(16) + (h2 >>> 0).toString(16)).padStart(
    16,
    "0",
  );
  return hex;
}
