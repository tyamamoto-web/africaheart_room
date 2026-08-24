"use client";

/* ============================================================
   会員名簿（社長室 ＞ 設定）：全員で共有する保存
   ------------------------------------------------------------
   これまで名簿は打ち込んでも保存されず、画面を離れると消えていた。
   ここで共有の置き場所に残すようにする。

   ★ SQL不要（新しいテーブルを作らない）:
     既存の共有テーブル homework_result の行を間借りする（lib/sharedRow.ts）。
     割り当ては SHARED_ROW.roster（=10）。

   しまい方（themes: text[] の中）:
     raw[0]  … 列の見出しを JSON にしたもの   例 ["名前","ふりがな"]
     raw[1..] … 1行ぶんを JSON にしたもの      例 ["くる",""]

   名簿は「名前の並び」としても使う。1列目を名前とみなす（rosterNames）。
   参加状況（lib/attendance.ts）はここから名前を引く。
   ============================================================ */

import { SHARED_ROW, readSharedLenient, writeSharedRow } from "./sharedRow";

export type Roster = {
  columns: string[];
  rows: string[][];
};

/** はじめて開いたときの形。1列目は名前と決めてある。 */
export const EMPTY_ROSTER: Roster = {
  columns: ["名前", "", "", "", ""],
  rows: Array.from({ length: 8 }, () => ["", "", "", "", ""]),
};

function toStrings(v: unknown): string[] {
  return Array.isArray(v) ? v.map((x) => (typeof x === "string" ? x : "")) : [];
}

function parseLine(line: string): string[] {
  try {
    return toStrings(JSON.parse(line));
  } catch {
    return [];
  }
}

/** 列の数を見出しにそろえる（足りなければ空を足し、多ければ切る）。 */
function fit(row: string[], n: number): string[] {
  const out = row.slice(0, n);
  while (out.length < n) out.push("");
  return out;
}

function decode(raw: string[]): Roster | null {
  if (raw.length === 0) return null;
  const columns = parseLine(raw[0]);
  if (columns.length === 0) return null;
  const rows = raw.slice(1).map((line) => fit(parseLine(line), columns.length));
  return { columns, rows };
}

function encode(r: Roster): string[] {
  const n = r.columns.length;
  return [JSON.stringify(r.columns), ...r.rows.map((row) => JSON.stringify(fit(row, n)))];
}

/** 名簿を読む。まだ何も保存されていなければ null。失敗しても例外は投げない。 */
export async function readRoster(): Promise<Roster | null> {
  return decode(await readSharedLenient(SHARED_ROW.roster));
}

/**
 * 名簿をまるごと保存する。
 * 名簿を触るのは役員だけで、しかも一度に一人なので、行ごとの取り合いは考えない
 * （版くらべの仕組みは lib/sharedRow.ts が持っているので、書き込み自体は安全）。
 */
export async function saveRoster(r: Roster): Promise<void> {
  const body = encode(r);
  await writeSharedRow(SHARED_ROW.roster, () => body);
}

/** 名簿から名前だけを取り出す（1列目・空行はとばす・重複はまとめる）。 */
export function rosterNames(r: Roster | null): string[] {
  if (!r) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const row of r.rows) {
    const name = (row[0] ?? "").trim();
    if (!name || seen.has(name)) continue;
    seen.add(name);
    out.push(name);
  }
  return out;
}
