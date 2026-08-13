"use client";

/* ============================================================
   イベント運営マニュアル：やることのチェック（済み／未済）を全員で共有：Supabase(REST) データ層
   ------------------------------------------------------------
   表のボタンを押すと「済み」になり、全員の画面に反映される。
   誰が押したかは記録しない（運営全体の進み具合を見るためのもの）。

   ★ SQL不要（新テーブルを作らない）:
     既存の共有テーブル `homework_result` を間借りする。
     宿題=1 / 部屋番号=2 / リアクション=3 / MoSCoW=4 / 役員RACI=5 / 予備=6 /
     マニュアルRACI=7 / マニュアルのチェック=8。
     themes(text[]) に「1件＝済みにしたやることのid」をそのまま入れる。
   ※ 書き込みは毎回「最新を再取得→該当のidだけ足す/外す」でマージするため、
     同時に別の項目を押した人の変更を巻き込まない。
   ============================================================ */

const SUPA_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://klwfhpyftnirkxxcmjff.supabase.co";
const SUPA_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "sb_publishable_7xk88rvHPopcdMd9MyyE_A_XKvS1MIi";

const ENDPOINT = `${SUPA_URL}/rest/v1/homework_result`;
const ROW_ID = 8; // マニュアルのチェック専用の行

/** 済みにしたやることの id の集合。 */
export type EventCheck = Set<string>;

function headers(extra: Record<string, string> = {}): Record<string, string> {
  return {
    apikey: SUPA_KEY ?? "",
    Authorization: `Bearer ${SUPA_KEY ?? ""}`,
    "Content-Type": "application/json",
    ...extra,
  };
}

function rawToSet(raw: string[]): EventCheck {
  const s = new Set<string>();
  for (const x of raw) {
    const id = typeof x === "string" ? x.trim() : "";
    if (id) s.add(id);
  }
  return s;
}

// id=8 の themes を取得。失敗時は空配列（表示優先で例外を投げない）。
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
    Array.isArray(rows) && Array.isArray(rows[0]?.themes) ? (rows[0]!.themes as unknown[]) : [];
  return arr.filter((x): x is string => typeof x === "string");
}

// 書き込みの土台に使う厳密版。読み取りに失敗したら例外を投げる（空を土台にして全消しする事故を防ぐ）。
async function fetchRawStrict(): Promise<string[]> {
  let res: Response;
  try {
    res = await fetch(`${ENDPOINT}?id=eq.${ROW_ID}&select=themes`, {
      headers: headers(),
      cache: "no-store",
    });
  } catch {
    throw new Error("最新の取得に失敗しました（保存を中止しました）");
  }
  if (!res.ok) throw new Error(`最新の取得に失敗しました (${res.status})（保存を中止しました）`);
  const rows = (await res.json()) as Array<{ themes?: unknown }>;
  const arr =
    Array.isArray(rows) && Array.isArray(rows[0]?.themes) ? (rows[0]!.themes as unknown[]) : [];
  return arr.filter((x): x is string => typeof x === "string");
}

async function upsert(raw: string[]): Promise<void> {
  const body = {
    id: ROW_ID,
    themes: raw,
    updated_by: "",
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
    throw new Error(`チェックの保存に失敗しました (${res.status}) ${txt.slice(0, 120)}`);
  }
}

// 書き込みを直列化するキュー。
let writeChain: Promise<unknown> = Promise.resolve();
function enqueue<T>(work: () => Promise<T>): Promise<T> {
  const run = writeChain.then(work, work);
  writeChain = run.then(() => undefined, () => undefined);
  return run;
}

/** 共有中のチェック状態を取得（未設定・失敗時も例外を投げず空で返す）。 */
export async function getEventCheck(): Promise<EventCheck> {
  return rawToSet(await fetchRaw());
}

/**
 * 1つのやることのチェックを付ける/外す（全員に共有）。書き込み直前に最新を再取得してから
 * 該当のidだけ足す/外すため、他メンバーが別の項目に付けたチェックを巻き込まない。
 * 更新後の全集合を返す。
 */
export function setEventCheck(taskId: string, done: boolean): Promise<EventCheck> {
  return enqueue(async () => {
    const set = rawToSet(await fetchRawStrict());
    if (done) set.add(taskId);
    else set.delete(taskId);
    await upsert(Array.from(set));
    return set;
  });
}

/** チェックをすべて外す（リセット）。 */
export function clearEventCheck(): Promise<void> {
  return enqueue(async () => {
    await upsert([]);
  });
}
