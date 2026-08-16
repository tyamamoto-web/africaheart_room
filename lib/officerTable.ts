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
     共有テーブル `homework_result` の id=6 を間借りする（行の割り当ては lib/sharedRow.ts）。
     themes(text[]) の1要素＝1行（JSON文字列）。列の見出しだけは k:"cols" の1要素で持つ。

   ※ 読み書きの土台（版くらべ・書き込みの順番待ち）は lib/sharedRow.ts に集約した。
     書き込みは毎回「最新を再取得 → その行だけ差し替え → 版くらべで保存」なので、
     同じ時間に別の行を書いている人の入力を消してしまうことがない。
     同じ行の同じ欄を2人が同時に書いた場合だけ、あとから保存したほうが残る。
   ============================================================ */

import { RACI_PEOPLE, type RaciRole } from "./officerRaci";
import { SHARED_ROW, readSharedLenient, writeSharedRow } from "./sharedRow";

const ROW_ID = SHARED_ROW.officerTable;

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

/*
 * 表を書き換える土台。「読む → change で自分の変更だけを当てる → 版くらべで書く」。
 * 誰かが先に書いていたら、取り直して change をやり直す（lib/sharedRow.ts が受け持つ）。
 * change は何度も呼ばれるので、渡された値だけで結果を作ること（外の状態を書き換えない）。
 */
function writeTable(change: (data: OfficerTableData) => OfficerTableData): Promise<OfficerTableData> {
  return writeSharedRow(ROW_ID, (raw) => dataToRaw(change(rawToData(raw)))).then(rawToData);
}

/** 共有中の表を取得（未設定・失敗時も例外を投げず空で返す）。 */
export async function getOfficerTable(): Promise<OfficerTableData> {
  return rawToData(await readSharedLenient(ROW_ID));
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

/**
 * 1行を、指定した行のすぐ上に差し込んで保存（全員に共有）。
 * 位置を「何番目」ではなく「どの行の上か」で決めているので、
 * 差し込むまでのあいだに別の人が行を足していても、狙った場所に入る。
 * 目印の行が消えていたときだけ、末尾に足す。
 */
export function insertOfficerTableRowBefore(row: OfficerTableRow, beforeId: string): Promise<OfficerTableData> {
  return writeTable((data) => {
    const rows = data.rows.filter((r) => r.id !== row.id); // やり直しのとき二重に入らないように
    const at = rows.findIndex((r) => r.id === beforeId);
    if (at >= 0) rows.splice(at, 0, row);
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
