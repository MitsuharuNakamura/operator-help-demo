/**
 * caller_profile_extract の出力を後処理して、
 * 都道府県名が誤って preferredCity に入った場合に
 * preferredPrefecture へ移動する。
 *
 * LLM が「東京都」「大阪」だけ言われた時にどちらの slot に入れるか揺れる問題への対策。
 */

const PREFECTURES = new Set<string>([
  "北海道",
  "青森県",
  "岩手県",
  "宮城県",
  "秋田県",
  "山形県",
  "福島県",
  "茨城県",
  "栃木県",
  "群馬県",
  "埼玉県",
  "千葉県",
  "東京都",
  "神奈川県",
  "新潟県",
  "富山県",
  "石川県",
  "福井県",
  "山梨県",
  "長野県",
  "岐阜県",
  "静岡県",
  "愛知県",
  "三重県",
  "滋賀県",
  "京都府",
  "大阪府",
  "兵庫県",
  "奈良県",
  "和歌山県",
  "鳥取県",
  "島根県",
  "岡山県",
  "広島県",
  "山口県",
  "徳島県",
  "香川県",
  "愛媛県",
  "高知県",
  "福岡県",
  "佐賀県",
  "長崎県",
  "熊本県",
  "大分県",
  "宮崎県",
  "鹿児島県",
  "沖縄県",
]);

// suffix なしで言及されたときの正規化 (例: "東京" → "東京都")
const BARE_TO_FULL: Record<string, string> = {
  東京: "東京都",
  大阪: "大阪府",
  京都: "京都府",
  神奈川: "神奈川県",
  千葉: "千葉県",
  埼玉: "埼玉県",
  兵庫: "兵庫県",
  愛知: "愛知県",
  福岡: "福岡県",
  北海道: "北海道",
  沖縄: "沖縄県",
};

function isPrefectureFull(s: string | undefined): boolean {
  return !!s && PREFECTURES.has(s.trim());
}

function toFullPrefecture(s: string | undefined): string | undefined {
  if (!s) return undefined;
  const trimmed = s.trim();
  if (PREFECTURES.has(trimmed)) return trimmed;
  if (BARE_TO_FULL[trimmed]) return BARE_TO_FULL[trimmed];
  return undefined;
}

/**
 * caller_profile_extract の JSON を破壊的でない形で正規化する。
 *  - preferredCity が実は都道府県名なら → preferredPrefecture へ移動 (元は clear)
 *  - preferredPrefecture が suffix 無し ("東京") なら full 形 ("東京都") へ正規化
 *  - preferredPrefecture と preferredCity が同一値なら preferredCity を clear
 */
export function normalizeExtractLocation(
  extract: Record<string, unknown>,
): Record<string, unknown> {
  const out = { ...extract };

  const rawPref = typeof out.preferredPrefecture === "string" ? (out.preferredPrefecture as string).trim() : "";
  const rawCity = typeof out.preferredCity === "string" ? (out.preferredCity as string).trim() : "";

  // 1) prefecture を full 形に正規化 (suffix 無し → 補完)
  const normPref = toFullPrefecture(rawPref);
  if (normPref) {
    out.preferredPrefecture = normPref;
  } else if (rawPref === "") {
    // undefined のまま
  }

  // 2) city が都道府県名なら prefecture へ移動
  if (rawCity && isPrefectureFull(rawCity)) {
    // prefecture が未設定 or bare 形 or 同名なら上書き
    if (!out.preferredPrefecture || out.preferredPrefecture === rawCity) {
      out.preferredPrefecture = rawCity;
    }
    // city は clear (都道府県ではなく市区町村を入れる場所)
    out.preferredCity = null;
  }

  // 3) city が bare 形の都道府県 ("東京" 等) の場合も移動
  else if (rawCity && BARE_TO_FULL[rawCity]) {
    const promoted = BARE_TO_FULL[rawCity];
    if (!out.preferredPrefecture) {
      out.preferredPrefecture = promoted;
    }
    out.preferredCity = null;
  }

  // 4) 完全同名なら city を clear (重複除去)
  else if (
    rawCity &&
    typeof out.preferredPrefecture === "string" &&
    out.preferredPrefecture === rawCity
  ) {
    out.preferredCity = null;
  }

  return out;
}
