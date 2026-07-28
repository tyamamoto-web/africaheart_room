"use client";

/* ============================================================
   近況への「リアクション」（匿名・YouTubeコメント風）：Supabase(REST) データ層（依存ライブラリ不要）
   ------------------------------------------------------------
   メンバープロフィールの「近況」に対して、他のメンバーが匿名で短い
   リアクション（例「猫満御礼」「入場料いくらすかー？」）を付けられる。
   YouTubeのコメント欄のような使い心地。全員で共有・永続化する。

   ★ SQL不要（新テーブルを作らない）:
     既存の共有テーブル `homework_result` を間借りする。
     宿題は id=1、当日の部屋番号は id=2、リアクションは id=3 を使う（衝突しない）。
     全リアクションを id=3 の themes(text[]) に「1件＝JSON文字列」で格納する。
   ※ member_profiles とは別テーブルなので、リアクションを付けてもプロフィールの
     updated_at は変わらない（＝「新着」バッジは点かない）。
   ============================================================ */

const SUPA_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://klwfhpyftnirkxxcmjff.supabase.co";
const SUPA_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "sb_publishable_7xk88rvHPopcdMd9MyyE_A_XKvS1MIi";

// 宿題結果・部屋番号と同じテーブルを共用。リアクションは id=3。
const ENDPOINT = `${SUPA_URL}/rest/v1/homework_result`;
const ROW_ID = 3; // 宿題=1 / 部屋番号=2 / リアクション=3

export const REACTION_MAX_LEN = 20; // リアクションは20文字まで（メンバー要望「20文字程度」）
export const REACTION_MAX_PER_PROFILE = 30; // 1人の近況に付けられるリアクションの上限

export type Reaction = {
  id: string; // 一意ID（端末ID＋時刻＋乱数）。表示キー・削除に使う
  pid: string; // 対象プロフィールID（member_profiles.id）
  text: string; // リアクション本文
  by: string; // 投稿者の端末ID（匿名。画面には出さず「あなた」判定にだけ使う）
  at: string; // 投稿時刻 ISO
};

function headers(extra: Record<string, string> = {}): Record<string, string> {
  return {
    apikey: SUPA_KEY ?? "",
    Authorization: `Bearer ${SUPA_KEY ?? ""}`,
    "Content-Type": "application/json",
    ...extra,
  };
}

// 1件を JSON 文字列へ（themes text[] の1要素として保存）
function encode(r: Reaction): string {
  return JSON.stringify(r);
}
// themes の1要素を Reaction へ復号（壊れた要素は null＝表示・保存から除外）
function parse(s: unknown): Reaction | null {
  if (typeof s !== "string") return null;
  try {
    const o = JSON.parse(s) as Record<string, unknown>;
    if (
      o &&
      typeof o.id === "string" &&
      typeof o.pid === "string" &&
      typeof o.text === "string"
    ) {
      return {
        id: o.id,
        pid: o.pid,
        text: o.text,
        by: typeof o.by === "string" ? o.by : "",
        at: typeof o.at === "string" ? o.at : "",
      };
    }
  } catch {
    /* JSON でない要素は無視 */
  }
  return null;
}

// 本文の整形：改行を空白へ・連続空白をまとめ・前後trim・上限で切り詰め
function clean(text: string): string {
  return text.replace(/\s+/g, " ").trim().slice(0, REACTION_MAX_LEN);
}

function newId(by: string): string {
  return `${by || "anon"}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
}

// id=3 の themes(text[]) を「生の文字列配列」で取得（未知要素も保持できるよう復号前）。
// 表示・保存の土台。失敗時は空配列（表示優先で例外を投げない）。
async function fetchRaw(): Promise<string[]> {
  let res: Response;
  try {
    res = await fetch(`${ENDPOINT}?id=eq.${ROW_ID}&select=themes`, {
      headers: headers(),
      cache: "no-store",
    });
  } catch {
    return [];
  }
  if (!res.ok) return [];
  const rows = (await res.json()) as Array<{ themes?: unknown }>;
  const arr =
    Array.isArray(rows) && Array.isArray(rows[0]?.themes)
      ? (rows[0]!.themes as unknown[])
      : [];
  return arr.filter((x): x is string => typeof x === "string");
}

// id=3 を upsert（themes に全リアクションの生配列を丸ごと保存）。
async function upsert(raw: string[]): Promise<void> {
  const body = {
    id: ROW_ID,
    themes: raw,
    updated_by: "", // 行に投稿者名は持たせない（各リアクションの by は要素側に格納）
    updated_at: new Date().toISOString(),
  };
  const res = await fetch(`${ENDPOINT}?on_conflict=id`, {
    method: "POST",
    headers: headers({ Prefer: "resolution=merge-duplicates,return=minimal" }),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    let txt = "";
    try {
      txt = await res.text();
    } catch {
      /* no-op */
    }
    throw new Error(`リアクションの保存に失敗しました (${res.status}) ${txt.slice(0, 120)}`);
  }
}

/** 全メンバー分のリアクションを取得（未設定・失敗時も例外を投げず空配列）。 */
export async function listReactions(): Promise<Reaction[]> {
  const raw = await fetchRaw();
  return raw.map(parse).filter((r): r is Reaction => r !== null);
}

/**
 * 近況にリアクションを追加（匿名）。書き込み直前に最新を再取得してマージするため、
 * 同時に付いた他メンバーのリアクションを取りこぼしにくい。更新後の全件を返す。
 */
export async function addReaction(
  pid: string,
  text: string,
  by: string
): Promise<Reaction[]> {
  const t = clean(text);
  if (!pid || !t) return listReactions();
  const raw = await fetchRaw(); // 最新を土台にする（他の追加/削除を保持）
  const cur = raw.map(parse).filter((r): r is Reaction => r !== null);
  if (cur.filter((r) => r.pid === pid).length >= REACTION_MAX_PER_PROFILE) {
    throw new Error(`このメンバーへのリアクションは${REACTION_MAX_PER_PROFILE}件までです`);
  }
  const entry: Reaction = { id: newId(by), pid, text: t, by, at: new Date().toISOString() };
  await upsert([...raw, encode(entry)]);
  return [...cur, entry];
}

/**
 * リアクションを1件削除（id指定）。最新を再取得してから該当idだけ除外して保存するため、
 * 同時に付いた別のリアクションを巻き込まない。更新後の全件を返す。
 */
export async function removeReaction(id: string): Promise<Reaction[]> {
  const raw = await fetchRaw();
  const kept = raw.filter((s) => {
    const p = parse(s);
    return !p || p.id !== id; // 復号できない要素は保持、対象idだけ除外
  });
  await upsert(kept);
  return kept.map(parse).filter((r): r is Reaction => r !== null);
}
