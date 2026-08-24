"use client";

/* ============================================================
   共有テーブル `homework_result` の1行を、取り合いにならないように読み書きする土台
   ------------------------------------------------------------
   このアプリは新しいテーブルを作れない（SQLを実行できない）ので、共有したいものは
   すべて homework_result の themes(text[]) に、行(id)ごとに間借りしている。

   素直に「最新を読む → 自分の変更を当てる → 全件を上書き」と書くと、端末をまたいだ
   取り合いを防げない。Aが読んでから書くまでの隙間（本番実測で中央値218ms、スマホなら
   さらに長い）にBの保存が入ると、Bの変更が配列ごと消え、しかも誰も気づけない。

   そこで updated_by 列を「版の札」に使う。
     読むとき：中身といっしょに札も持ち帰る。
     書くとき：「札が読んだときのままなら書く」という条件を付けて送る。
              誰かが先に書いていれば0件更新で返るので、取り直して当て直す。
   札が空文字のときも `updated_by=eq.` で条件が効く（実機で確認済み）。
   updated_by を名前の表示に使っているのは宿題(id=1)と部屋番号(id=2)だけなので、
   ここで扱う id=4 以降では札に転用してよい。SQLは実行せず、列も行も増やさない。

   ※ service_role は使わない。publishable key はクライアントに置く前提（公開されている）。
   ============================================================ */

const SUPA_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://gdajpgbfngvigrdbiwsw.supabase.co";
const SUPA_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "sb_publishable_MBRlmw3t4j58uDQkWJ92Ng_xglG2rB0";

const ENDPOINT = `${SUPA_URL}/rest/v1/homework_result`;

/** homework_result の行の割り当て。行を足すときは必ずここに書く（二重取りを防ぐ）。 */
export const SHARED_ROW = {
  homework: 1, // 宿題の抽選結果
  roomNumbers: 2, // 当日の部屋番号
  reactions: 3, // 近況へのリアクション
  officerPlan: 4, // 役員専用：優先度（MoSCoW）
  officerRaci: 5, // 役員専用：役割（RACI）
  officerTable: 6, // 役員専用2：RACIチャート
  legacyManualRaci: 7, // 旧イベント運営マニュアルの役割（今は未使用・中身は空）
  legacyManualCheck: 8, // 旧イベント運営マニュアルのチェック（今は未使用・中身は空）
  survey: 9, // 参加者アンケートの回答
  roster: 10, // 社長室：会員名簿（設定）
  attendance: 11, // 社長室：参加状況（今回の回に来る人）
} as const;

/** 1回に送れる大きさの目安。これを超えたら書かずに知らせる。 */
export const SHARED_MAX_BYTES = 400_000;

// exists は「その行そのものが在るか」。札が空なのと、行が無いのは別ものなので分けて持つ。
type Snapshot = { raw: string[]; token: string; exists: boolean };

function headers(extra: Record<string, string> = {}): Record<string, string> {
  return {
    apikey: SUPA_KEY ?? "",
    Authorization: `Bearer ${SUPA_KEY ?? ""}`,
    "Content-Type": "application/json",
    ...extra,
  };
}

// 札を作る（中身に意味は無い。前回と違う値であればよい）。
function newToken(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID().replace(/-/g, "");
  }
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
}

async function bodyText(res: Response): Promise<string> {
  try {
    return await res.text();
  } catch {
    return "";
  }
}

function toRaw(themes: unknown): string[] {
  const arr = Array.isArray(themes) ? (themes as unknown[]) : [];
  return arr.filter((x): x is string => typeof x === "string");
}

/** 表示用のゆるい読み取り。失敗しても例外を投げず空で返す（画面を止めない）。 */
export async function readSharedLenient(rowId: number): Promise<string[]> {
  try {
    const res = await fetch(`${ENDPOINT}?id=eq.${rowId}&select=themes`, {
      headers: headers(),
      cache: "no-store",
    });
    if (!res.ok) return [];
    const body = (await res.json()) as Array<{ themes?: unknown }>;
    return toRaw(Array.isArray(body) ? body[0]?.themes : undefined);
  } catch {
    return [];
  }
}

// 書き込みの土台に使う厳密版。読めなければ例外（空を土台にして全消しする事故を防ぐ）。
async function readSnapshot(rowId: number): Promise<Snapshot> {
  let res: Response;
  try {
    res = await fetch(`${ENDPOINT}?id=eq.${rowId}&select=themes,updated_by`, {
      headers: headers(),
      cache: "no-store",
    });
  } catch {
    throw new Error("最新の取得に失敗しました（保存を中止しました）");
  }
  if (!res.ok) throw new Error(`最新の取得に失敗しました (${res.status})（保存を中止しました）`);
  const body = (await res.json()) as Array<{ themes?: unknown; updated_by?: unknown }>;
  const row = Array.isArray(body) ? body[0] : undefined;
  return {
    raw: toRaw(row?.themes),
    token: typeof row?.updated_by === "string" ? row.updated_by : "",
    exists: !!row,
  };
}

// 札が読んだときのままなら書く。誰かが先に書いていたら0件更新＝false（やり直す）。
async function patchIfSame(
  rowId: number,
  raw: string[],
  prevToken: string,
  nextToken: string
): Promise<boolean> {
  const url = `${ENDPOINT}?id=eq.${rowId}&updated_by=eq.${encodeURIComponent(prevToken)}&select=id`;
  let res: Response;
  try {
    res = await fetch(url, {
      method: "PATCH",
      headers: headers({ Prefer: "return=representation" }),
      body: JSON.stringify({
        themes: raw,
        updated_by: nextToken,
        updated_at: new Date().toISOString(),
      }),
    });
  } catch {
    throw new Error("保存に失敗しました（通信を確認してください）");
  }
  if (!res.ok) {
    throw new Error(`保存に失敗しました (${res.status}) ${(await bodyText(res)).slice(0, 120)}`);
  }
  const hit = (await res.json()) as unknown;
  return Array.isArray(hit) && hit.length > 0;
}

// その行そのものがまだ無いとき（初めて使う行）に作る。
// 同じ瞬間に他の人も作っていた場合は入れ違いになるので、書いたあと札を確かめてやり直す。
async function insertRow(rowId: number, raw: string[], nextToken: string): Promise<boolean> {
  let res: Response;
  try {
    res = await fetch(`${ENDPOINT}?on_conflict=id`, {
      method: "POST",
      headers: headers({ Prefer: "resolution=merge-duplicates,return=minimal" }),
      body: JSON.stringify({
        id: rowId,
        themes: raw,
        updated_by: nextToken,
        updated_at: new Date().toISOString(),
      }),
    });
  } catch {
    throw new Error("保存に失敗しました（通信を確認してください）");
  }
  if (!res.ok) {
    throw new Error(`保存に失敗しました (${res.status}) ${(await bodyText(res)).slice(0, 120)}`);
  }
  return (await readSnapshot(rowId)).token === nextToken;
}

// 同じ行への書き込みを1件ずつ順番に流すキュー。
// 同じタブの中の連続操作が互いを上書きしないようにする（別の端末どうしは版くらべが受け持つ）。
const chains = new Map<number, Promise<unknown>>();
function enqueue<T>(rowId: number, work: () => Promise<T>): Promise<T> {
  const prev = chains.get(rowId) ?? Promise.resolve();
  const run = prev.then(work, work); // 前の成否に関わらず必ず走らせる
  chains.set(rowId, run.then(() => undefined, () => undefined));
  return run;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * 1行を書き換える。手順は「読む → mutate で自分の変更だけを当てる → 版くらべで書く」。
 * 誰かが先に書いていたら、取り直して mutate をやり直す（最大5回、少しずつ間をずらす）。
 * mutate は何度も呼ばれるので、渡された値だけで結果を作ること（外の状態を書き換えない）。
 */
export function writeSharedRow(
  rowId: number,
  mutate: (raw: string[]) => string[]
): Promise<string[]> {
  return enqueue(rowId, async () => {
    for (let i = 0; i < 5; i++) {
      const snap = await readSnapshot(rowId);
      const next = mutate(snap.raw);
      if (new TextEncoder().encode(JSON.stringify(next)).length > SHARED_MAX_BYTES) {
        throw new Error("中身が大きくなりすぎました（保存を中止しました）。件数を減らすか、文章を短くしてください");
      }
      const token = newToken();
      const ok = snap.exists
        ? await patchIfSame(rowId, next, snap.token, token)
        : await insertRow(rowId, next, token);
      if (ok) return next;
      // 同時にやり直してまたぶつからないよう、少しずらしてから取り直す
      await sleep(120 + Math.floor(Math.random() * 240));
    }
    throw new Error("ほかの人の保存と重なりました（もう一度お試しください）");
  });
}
