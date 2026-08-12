"use client";

/* ============================================================
   役員専用ページ：やること別の「担当・役割」(RACIチャート)を全員で共有：Supabase(REST) データ層
   ------------------------------------------------------------
   各やること(小分類)について、誰が(よしのすけ/くる/しゃちょー)どの役割で動くかを
   RACI（R=担当 / A=責任者 / C=相談役 / I=共有）で決める。複数人が同じ表に入力し、
   互いの入力がリアルタイム（約6秒ごと）に見える。優先度(MoSCoW)とは別の共有行に保存する。

   ★ SQL不要（新テーブルを作らない）:
     既存の共有テーブル `homework_result` を間借りする。
     宿題=1 / 部屋番号=2 / リアクション=3 / 役員プラン(MoSCoW)=4 / 役員RACI=5 を使う（衝突しない）。
     各セルを themes(text[]) に「1件＝"taskId|person=role"」の文字列で格納する。
   ※ 書き込みは毎回「最新を再取得→該当セルだけ差し替え」でマージするため、
     同時に別のセルへ入力した他メンバーの変更を巻き込まない。
   ============================================================ */

const SUPA_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://klwfhpyftnirkxxcmjff.supabase.co";
const SUPA_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "sb_publishable_7xk88rvHPopcdMd9MyyE_A_XKvS1MIi";

// 宿題結果・部屋番号・リアクション・MoSCoWと同じテーブルを共用。役員RACIは id=5。
const ENDPOINT = `${SUPA_URL}/rest/v1/homework_result`;
const ROW_ID = 5; // 宿題=1 / 部屋番号=2 / リアクション=3 / MoSCoW=4 / RACI=5

// 担当できる人（表の列＝この3人）。id は保存キーに使う不変値、name/role は表示用。
export type RaciPerson = { id: string; name: string; role: "leader" | "subleader" };
export const RACI_PEOPLE: RaciPerson[] = [
  { id: "yoshi",  name: "よしのすけ", role: "leader"    },
  { id: "kuru",   name: "くる",       role: "subleader" },
  { id: "shacho", name: "しゃちょー", role: "subleader" },
];

export type RaciRole = "r" | "a" | "c" | "i";
// キーは `${taskId}|${personId}`。値はその人のそのタスクでの役割。
export type OfficerRaci = Record<string, RaciRole>;

const VALID_ROLE: RaciRole[] = ["r", "a", "c", "i"];
const VALID_PERSON = new Set(RACI_PEOPLE.map((p) => p.id));

/** 表示・保存で使う合成キー（taskId と personId から一意なキーを作る）。 */
export function raciKey(taskId: string, personId: string): string {
  return `${taskId}|${personId}`;
}

function headers(extra: Record<string, string> = {}): Record<string, string> {
  return {
    apikey: SUPA_KEY ?? "",
    Authorization: `Bearer ${SUPA_KEY ?? ""}`,
    "Content-Type": "application/json",
    ...extra,
  };
}

// themes の1要素 "taskId|person=role" を [key, role] へ復号（不正はnull＝無視）
function parseEntry(s: unknown): [string, RaciRole] | null {
  if (typeof s !== "string") return null;
  const eq = s.indexOf("=");
  if (eq <= 0) return null;
  const left = s.slice(0, eq).trim();
  const role = s.slice(eq + 1).trim() as RaciRole;
  const bar = left.indexOf("|");
  if (bar <= 0) return null;
  const taskId = left.slice(0, bar).trim();
  const person = left.slice(bar + 1).trim();
  if (!taskId || !VALID_PERSON.has(person) || !VALID_ROLE.includes(role)) return null;
  return [raciKey(taskId, person), role];
}

function rawToRaci(raw: string[]): OfficerRaci {
  const map: OfficerRaci = {};
  for (const s of raw) {
    const e = parseEntry(s);
    if (e) map[e[0]] = e[1]; // 重複時は後の要素を採用
  }
  return map;
}
function raciToRaw(map: OfficerRaci): string[] {
  // キー `taskId|person` はそのまま "taskId|person=role" の左辺になる。
  return Object.entries(map).map(([key, role]) => `${key}=${role}`);
}

// id=5 の themes(text[]) を生の文字列配列で取得。失敗時は空配列（表示優先で例外を投げない）。
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
// これがないと、取得失敗（＝一時的に空に見える）を土台に全件upsertして他メンバーのセルを丸ごと消す事故が起きる。
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

// id=5 を upsert（themes に担当マップの全件を丸ごと保存）。
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
    throw new Error(`担当（RACI）の保存に失敗しました (${res.status}) ${txt.slice(0, 120)}`);
  }
}

// 書き込みを直列化するキュー（officerPlan と同じ考え方）。連続操作でも各書き込みが
// 「直前の書き込み結果」を土台に再取得→マージするので互いを上書きしない。
let writeChain: Promise<unknown> = Promise.resolve();
function enqueue<T>(work: () => Promise<T>): Promise<T> {
  const run = writeChain.then(work, work);
  writeChain = run.then(() => undefined, () => undefined);
  return run;
}

/** 共有中の担当マップを取得（未設定・失敗時も例外を投げず空で返す）。 */
export async function getOfficerRaci(): Promise<OfficerRaci> {
  return rawToRaci(await fetchRaw());
}

/**
 * 1人×1タスクの役割を設定/解除（全員に共有）。書き込み直前に最新を再取得してから
 * 該当セルだけ差し替えるため、他メンバーが別セルに付けた変更を巻き込まない。
 * role が null のときは解除。更新後の全マップを返す。書き込みは直列化される。
 */
export function setOfficerRaci(
  taskId: string,
  personId: string,
  role: RaciRole | null
): Promise<OfficerRaci> {
  return enqueue(async () => {
    const map = rawToRaci(await fetchRawStrict()); // 直前の書き込み結果を土台にする（取得失敗時は例外＝上書きしない）
    const key = raciKey(taskId, personId);
    if (role === null) delete map[key];
    else map[key] = role;
    await upsert(raciToRaw(map));
    return map;
  });
}

/** 全員ぶんの担当（RACI）をすべて消去（リセット）。 */
export function clearOfficerRaci(): Promise<void> {
  return enqueue(async () => {
    await upsert([]);
  });
}
