"use client";

/* ============================================================
   役員専用2：オフ会運営のRACIチャートを全員で共同編集：Supabase(REST) データ層
   ------------------------------------------------------------
   何のための表か：
     アフリカハートを続けていくうえで必要な仕事を1行ずつ書き出し、
     そのひとつずつに「だれが・どう関わるか」を決めておくRACIチャート。
     1回のイベントの進行表ではなく、毎月まわしていく運営そのものを対象にする。
     表の形はRACIの基本どおりで、左が「やることの特定」、右が「人ごとの役割」。

   左の5列は、見出しも中身も自分たちで書ける空の列にしてある。
   何を軸に並べるか（分野・まとまり・いつ など）は使いながら決められる。
   右のRACIの4人は形を保つため固定。

   ★ SQL不要（新テーブルを作らない）:
     既存の共有テーブル `homework_result` を間借りする。
     宿題=1 / 部屋番号=2 / リアクション=3 / MoSCoW=4 / 役員RACI=5 /
     役員専用2の表=6 / マニュアルRACI=7 / マニュアルのチェック=8。
     themes(text[]) の1要素＝1行（JSON文字列）。列の見出しだけは k:"cols" の1要素で持つ。

   ※ 書き込みは毎回「最新を再取得 → その行だけ差し替え → 保存」でマージするので、
     同じ時間に別の行を書いている人の入力を消してしまうことがない。
     同じ行の同じ欄を2人が同時に書いた場合だけ、あとから保存したほうが残る。
   ============================================================ */

import { RACI_PEOPLE, type RaciRole } from "./officerRaci";

const SUPA_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://klwfhpyftnirkxxcmjff.supabase.co";
const SUPA_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "sb_publishable_7xk88rvHPopcdMd9MyyE_A_XKvS1MIi";

const ENDPOINT = `${SUPA_URL}/rest/v1/homework_result`;
const ROW_ID = 6; // 役員専用2の表だけが使う行

/** 自分たちで見出しを書ける列の数（RACIの4人はこれとは別に固定）。 */
export const COLUMN_COUNT = 5;

/** 表の1行。id は行を見分けるための不変値で、画面に出す番号とは別。 */
export type OfficerTableRow = {
  id: string;
  cells: string[]; // 左の5列の中身（COLUMN_COUNT個）
  roles: Record<string, RaciRole>; // 役割（personId → 担当者/責任者/相談役/お知らせ）
};

/** 列の見出しと行をまとめたもの。 */
export type OfficerTableData = {
  columns: string[]; // 左の5列の見出し（COLUMN_COUNT個。空欄でもよい）
  rows: OfficerTableRow[];
};

/** 空の表の初期行。idを固定しておくと、2人が同時に開いても行が二重にならない。 */
export const SEED_ROW_IDS = [
  "b01", "b02", "b03", "b04", "b05", "b06",
  "b07", "b08", "b09", "b10", "b11", "b12",
];

/** 長さをCOLUMN_COUNTにそろえる（列の数を変えたときに欠けないように）。 */
function fit(list: unknown, max: number): string[] {
  const arr = Array.isArray(list) ? list : [];
  return Array.from({ length: COLUMN_COUNT }, (_, i) =>
    typeof arr[i] === "string" ? (arr[i] as string).slice(0, max) : ""
  );
}

export function emptyColumns(): string[] {
  return Array.from({ length: COLUMN_COUNT }, () => "");
}

export function emptyRow(id: string): OfficerTableRow {
  return { id, cells: emptyColumns(), roles: {} };
}

/** 「行を追加」で使う、他の人とぶつからない行の識別子。 */
export function newRowId(): string {
  return `n${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

const VALID_ROLE = new Set<string>(["r", "a", "c", "i"]);
const VALID_PERSON = new Set(RACI_PEOPLE.map((p) => p.id));

function headers(extra: Record<string, string> = {}): Record<string, string> {
  return {
    apikey: SUPA_KEY ?? "",
    Authorization: `Bearer ${SUPA_KEY ?? ""}`,
    "Content-Type": "application/json",
    ...extra,
  };
}

// themes の1要素（JSON文字列）を読む。列の見出しなら "cols"、行なら行そのもの。
function parseEntry(s: unknown): { kind: "cols"; labels: string[] } | { kind: "row"; row: OfficerTableRow } | null {
  if (typeof s !== "string") return null;
  let o: unknown;
  try {
    o = JSON.parse(s);
  } catch {
    return null;
  }
  if (!o || typeof o !== "object") return null;
  const r = o as Record<string, unknown>;

  if (r.k === "cols") return { kind: "cols", labels: fit(r.labels, 40) };

  const id = typeof r.id === "string" ? r.id.slice(0, 40) : "";
  if (!id) return null;

  const roles: Record<string, RaciRole> = {};
  if (r.roles && typeof r.roles === "object") {
    for (const [person, role] of Object.entries(r.roles as Record<string, unknown>)) {
      if (VALID_PERSON.has(person) && typeof role === "string" && VALID_ROLE.has(role)) {
        roles[person] = role as RaciRole;
      }
    }
  }
  return { kind: "row", row: { id, cells: fit(r.cells, 400), roles } };
}

function rawToData(raw: string[]): OfficerTableData {
  let columns = emptyColumns();
  const rows: OfficerTableRow[] = [];
  const seen = new Set<string>();
  for (const s of raw) {
    const e = parseEntry(s);
    if (!e) continue;
    if (e.kind === "cols") {
      columns = e.labels;
      continue;
    }
    if (seen.has(e.row.id)) continue; // 同じidが2件あれば先のほうを採用
    seen.add(e.row.id);
    rows.push(e.row);
  }
  return { columns, rows };
}

function dataToRaw(data: OfficerTableData): string[] {
  return [
    JSON.stringify({ k: "cols", labels: data.columns }),
    ...data.rows.map((r) => JSON.stringify(r)),
  ];
}

// id=6 の themes を取得。失敗時は空配列（表示を止めないため例外を投げない）。
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
  const body = (await res.json()) as Array<{ themes?: unknown }>;
  const arr =
    Array.isArray(body) && Array.isArray(body[0]?.themes) ? (body[0]!.themes as unknown[]) : [];
  return arr.filter((x): x is string => typeof x === "string");
}
/* 書き込みの決まりごと（ここが「同時に書いても消えない」の要）
   ------------------------------------------------------------
   これまでの書き方（最新を読む → 自分の変更を当てる → 全件を上書き）には、
   端末をまたいだ取り合いを防ぐ仕組みが無かった。
   Aが読んでから書くまでの隙間（実測でこの回線でも0.2〜0.3秒、スマホならもっと長い）に
   Bの保存が入ると、Bの変更が配列ごと消える。しかも消えたことに誰も気づけない。

   そこで updated_by 列を「版の札」に使う。
     読むとき  ：中身といっしょに札も持ち帰る。
     書くとき  ：「札が読んだときのままなら書く」という条件を付けて送る。
                誰かが先に書いていれば0件更新で返ってくるので、
                取り直して自分の変更を当て直し、やり直す（最大5回）。
   updated_by はもともと「最後に更新した人の名前」だが、名前を表示に使っているのは
   宿題(id=1)と部屋番号(id=2)だけ。この表(id=6)では未使用なので札に転用できる。
   SQLは実行しない。列も行も増やさない。 */

// 1回に送れる大きさの目安。これを超えたら書かずに知らせる。
const MAX_BYTES = 400_000;

// exists は「id=6 の行そのものが在るか」。札が空なのと、行が無いのは別ものなので分けて持つ。
type Snapshot = { raw: string[]; token: string; exists: boolean };

// 札を作る（中身に意味は無い。前回と違う値であればよい）。
function newToken(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID().replace(/-/g, "");
  }
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
}

// 書き込みの土台に使う厳密版。読み取りに失敗したら例外を投げる（空を土台にして全消しする事故を防ぐ）。
async function readSnapshot(): Promise<Snapshot> {
  let res: Response;
  try {
    res = await fetch(`${ENDPOINT}?id=eq.${ROW_ID}&select=themes,updated_by`, {
      headers: headers(),
      cache: "no-store",
    });
  } catch {
    throw new Error("最新の取得に失敗しました（保存を中止しました）");
  }
  if (!res.ok) throw new Error(`最新の取得に失敗しました (${res.status})（保存を中止しました）`);
  const body = (await res.json()) as Array<{ themes?: unknown; updated_by?: unknown }>;
  const row = Array.isArray(body) ? body[0] : undefined;
  const arr = Array.isArray(row?.themes) ? (row!.themes as unknown[]) : [];
  return {
    raw: arr.filter((x): x is string => typeof x === "string"),
    token: typeof row?.updated_by === "string" ? row.updated_by : "",
    exists: !!row,
  };
}

async function bodyText(res: Response): Promise<string> {
  try {
    return await res.text();
  } catch {
    return "";
  }
}

/* 札が読んだときのままなら書く。誰かが先に書いていたら0件更新＝false（やり直す）。
   札が空文字のときも `updated_by=eq.` で「空のままなら書く」として効く（実機で確認済み）。
   これが効くおかげで、古い版のアプリが札を空に戻していっても取り合いにならない。 */
async function patchIfSame(raw: string[], prevToken: string, nextToken: string): Promise<boolean> {
  const url =
    `${ENDPOINT}?id=eq.${ROW_ID}&updated_by=eq.${encodeURIComponent(prevToken)}&select=id`;
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
    throw new Error("表の保存に失敗しました（通信を確認してください）");
  }
  if (!res.ok) {
    throw new Error(`表の保存に失敗しました (${res.status}) ${(await bodyText(res)).slice(0, 120)}`);
  }
  const hit = (await res.json()) as unknown;
  return Array.isArray(hit) && hit.length > 0;
}

// id=6 の行そのものがまだ無いとき（まっさらなデータベース）に作る。
// 同じ瞬間に他の人も作っていた場合は入れ違いになるので、書いたあと札を確かめてやり直す。
async function insertRow(raw: string[], nextToken: string): Promise<boolean> {
  let res: Response;
  try {
    res = await fetch(`${ENDPOINT}?on_conflict=id`, {
      method: "POST",
      headers: headers({ Prefer: "resolution=merge-duplicates,return=minimal" }),
      body: JSON.stringify({
        id: ROW_ID,
        themes: raw,
        updated_by: nextToken,
        updated_at: new Date().toISOString(),
      }),
    });
  } catch {
    throw new Error("表の保存に失敗しました（通信を確認してください）");
  }
  if (!res.ok) {
    throw new Error(`表の保存に失敗しました (${res.status}) ${(await bodyText(res)).slice(0, 120)}`);
  }
  return (await readSnapshot()).token === nextToken;
}

// 書き込みを1件ずつ順番に流すキュー（officerRaci / officerPlan と同じ考え方）。
// 同じタブの中の連続操作が互いを上書きしないようにする（別の端末どうしは版くらべが受け持つ）。
let writeChain: Promise<unknown> = Promise.resolve();
function enqueue<T>(work: () => Promise<T>): Promise<T> {
  const run = writeChain.then(work, work);
  writeChain = run.then(() => undefined, () => undefined);
  return run;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/*
 * 表を書き換える土台。「読む → change で自分の変更だけを当てる → 版くらべで書く」。
 * 誰かが先に書いていたら、取り直して change をやり直す（最大5回、少しずつ間をずらす）。
 * change は何度も呼ばれるので、渡された値だけで結果を作ること（外の状態を書き換えない）。
 */
function writeTable(change: (data: OfficerTableData) => OfficerTableData): Promise<OfficerTableData> {
  return enqueue(async () => {
    for (let i = 0; i < 5; i++) {
      const snap = await readSnapshot();
      const next = change(rawToData(snap.raw));
      const raw = dataToRaw(next);
      if (new TextEncoder().encode(JSON.stringify(raw)).length > MAX_BYTES) {
        throw new Error("中身が大きくなりすぎました（保存を中止しました）。行を減らすか、文章を短くしてください");
      }
      const token = newToken();
      const ok = snap.exists
        ? await patchIfSame(raw, snap.token, token)
        : await insertRow(raw, token);
      if (ok) return next;
      // 同時にやり直してまたぶつからないよう、少しずらしてから取り直す
      await sleep(120 + Math.floor(Math.random() * 240));
    }
    throw new Error("ほかの人の保存と重なりました（もう一度お試しください）");
  });
}

/** 共有中の表を取得（未設定・失敗時も例外を投げず空で返す）。 */
export async function getOfficerTable(): Promise<OfficerTableData> {
  return rawToData(await fetchRaw());
}

/**
 * まだ1行もないときだけ、空の12行を作る。
 * idを固定しているので、2人が同時に開いても行が二重にならない。
 */
export function seedOfficerTable(): Promise<OfficerTableData> {
  return writeTable((data) =>
    data.rows.length > 0 ? data : { columns: emptyColumns(), rows: SEED_ROW_IDS.map(emptyRow) }
  );
}

/** 列の見出しを保存（全員に共有）。行はそのまま残す。 */
export function saveOfficerTableColumns(columns: string[]): Promise<OfficerTableData> {
  return writeTable((data) => ({ columns: fit(columns, 40), rows: data.rows }));
}

/**
 * 1行を保存（全員に共有）。すでにある行なら同じ位置のまま更新し、無ければ末尾に足す。
 * 同じ行の同じ欄を2人が同時に書いたときだけ、あとから保存したほうが残る。
 */
export function saveOfficerTableRow(row: OfficerTableRow): Promise<OfficerTableData> {
  return writeTable((data) => {
    const rows = data.rows.slice();
    const at = rows.findIndex((r) => r.id === row.id);
    if (at >= 0) rows[at] = row;
    else rows.push(row);
    return { columns: data.columns, rows };
  });
}

/** 1行を削除（全員に共有）。 */
export function deleteOfficerTableRow(id: string): Promise<OfficerTableData> {
  return writeTable((data) => ({
    columns: data.columns,
    rows: data.rows.filter((r) => r.id !== id),
  }));
}
