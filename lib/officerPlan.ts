"use client";

/* ============================================================
   役員専用ページ：オフ会運営タスクの優先度（MoSCoW）を全員で共有：Supabase(REST) データ層
   ------------------------------------------------------------
   役員が各タスクにつけた優先度（必ず/なるべく/できたら/今回はやらない）を
   全員で共有・同期する。複数人が同じ表に入力し、互いの入力がリアルタイムに見える。

   ★ SQL不要（新テーブルを作らない）:
     既存の共有テーブル `homework_result` を間借りする。
     宿題=1 / 部屋番号=2 / リアクション=3 / 役員プラン=4 を使う（衝突しない）。
     各タスクの優先度を themes(text[]) に「1件＝"taskId=priority"」の文字列で格納する。
   ※ 書き込みは毎回「最新を再取得→該当タスクだけ差し替え」でマージするため、
     同時に別タスクへ入力した他メンバーの変更を巻き込まない。
   ============================================================ */

const SUPA_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://gdajpgbfngvigrdbiwsw.supabase.co";
const SUPA_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "sb_publishable_MBRlmw3t4j58uDQkWJ92Ng_xglG2rB0";

// 宿題結果・部屋番号・リアクションと同じテーブルを共用。役員プランは id=4。
const ENDPOINT = `${SUPA_URL}/rest/v1/homework_result`;
const ROW_ID = 4; // 宿題=1 / 部屋番号=2 / リアクション=3 / 役員プラン=4

export type OfficerPriority = "must" | "should" | "could" | "wont";
export type OfficerPlan = Record<string, OfficerPriority>;

const VALID: OfficerPriority[] = ["must", "should", "could", "wont"];

function headers(extra: Record<string, string> = {}): Record<string, string> {
  return {
    apikey: SUPA_KEY ?? "",
    Authorization: `Bearer ${SUPA_KEY ?? ""}`,
    "Content-Type": "application/json",
    ...extra,
  };
}

// themes の1要素 "taskId=priority" を [taskId, priority] へ復号（不正はnull＝無視）
function parseEntry(s: unknown): [string, OfficerPriority] | null {
  if (typeof s !== "string") return null;
  const i = s.indexOf("=");
  if (i <= 0) return null;
  const id = s.slice(0, i).trim();
  const p = s.slice(i + 1).trim() as OfficerPriority;
  if (!id || !VALID.includes(p)) return null;
  return [id, p];
}

function rawToPlan(raw: string[]): OfficerPlan {
  const plan: OfficerPlan = {};
  for (const s of raw) {
    const e = parseEntry(s);
    if (e) plan[e[0]] = e[1]; // 重複時は後の要素を採用
  }
  return plan;
}
function planToRaw(plan: OfficerPlan): string[] {
  return Object.entries(plan).map(([id, p]) => `${id}=${p}`);
}

// id=4 の themes(text[]) を生の文字列配列で取得。失敗時は空配列（表示優先で例外を投げない）。
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

// 書き込みの「土台」に使う厳密版の取得。読み取りに失敗したら例外を投げる（空配列で握りつぶさない）。
// これがないと、取得失敗（＝一時的に空に見える）を土台に全件upsertして他メンバーの入力を丸ごと消す事故が起きる。
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
    Array.isArray(rows) && Array.isArray(rows[0]?.themes)
      ? (rows[0]!.themes as unknown[])
      : [];
  return arr.filter((x): x is string => typeof x === "string");
}

// id=4 を upsert（themes に優先度マップの全件を丸ごと保存）。
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
    throw new Error(`役員プランの保存に失敗しました (${res.status}) ${txt.slice(0, 120)}`);
  }
}

// 書き込みを直列化するキュー。連続操作（同一端末で素早く複数の丸を押す等）でも、
// 各書き込みが「直前の書き込み結果」を土台に再取得→マージするので互いを上書きしない。
// （別端末どうしの完全同時書き込みは約6秒ポーリングで整合する）
let writeChain: Promise<unknown> = Promise.resolve();
function enqueue<T>(work: () => Promise<T>): Promise<T> {
  const run = writeChain.then(work, work); // 前の成否に関わらず必ず走らせる
  writeChain = run.then(() => undefined, () => undefined); // チェーンはエラーで止めない
  return run;
}

/** 共有中の優先度マップを取得（未設定・失敗時も例外を投げず空で返す）。 */
export async function getOfficerPlan(): Promise<OfficerPlan> {
  return rawToPlan(await fetchRaw());
}

/**
 * 1タスクの優先度を設定/解除（全員に共有）。書き込み直前に最新を再取得してから
 * 該当タスクだけ差し替えるため、他メンバーが別タスクに付けた変更を巻き込まない。
 * priority が null のときは解除。更新後の全マップを返す。書き込みは直列化される。
 */
export function setOfficerPriority(
  taskId: string,
  priority: OfficerPriority | null
): Promise<OfficerPlan> {
  return enqueue(async () => {
    const plan = rawToPlan(await fetchRawStrict()); // 直前の書き込み結果を土台にする（取得失敗時は例外＝上書きしない）
    if (priority === null) delete plan[taskId];
    else plan[taskId] = priority;
    await upsert(planToRaw(plan));
    return plan;
  });
}

/** 全員ぶんの優先度をすべて消去（リセット）。 */
export function clearOfficerPlan(): Promise<void> {
  return enqueue(async () => {
    await upsert([]);
  });
}

/**
 * 端末に残っていた入力（旧localStorage）を共有へ一度だけ移行するためのシード。
 * 既に共有にあるタスクは上書きしない（＝先に入っている他メンバーの入力を尊重）。
 * 追加があった時だけ書き込む。移行後の全マップを返す。書き込みは直列化される。
 */
export function seedOfficerPlan(local: OfficerPlan): Promise<OfficerPlan> {
  return enqueue(async () => {
    const plan = rawToPlan(await fetchRawStrict()); // 取得失敗時は例外＝空を土台に移行して他メンバーの入力を消す事故を防ぐ
    let changed = false;
    for (const [id, p] of Object.entries(local)) {
      if (VALID.includes(p) && !(id in plan)) {
        plan[id] = p;
        changed = true;
      }
    }
    if (changed) await upsert(planToRaw(plan));
    return plan;
  });
}
