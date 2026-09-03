"use client";

/* ============================================================
   当日の部屋割（時間・企画名・A室とB室の顔ぶれ）：全員で共有する保存
   ------------------------------------------------------------
   当日の画面に出す部屋割り表の中身。過去の回では lib/data.ts の karaokeRooms に
   直接書いていたが、ここでは役員が画面から手で入れる。

   ★ SQL不要（新しいテーブルを作らない）:
     既存の共有テーブル homework_result の行を間借りする（lib/sharedRow.ts）。
     割り当ては SHARED_ROW.timetable（=12）。行が無ければ初回の保存で作られる。

   しまい方（themes: text[] の中）:
     raw[i] … 1枠ぶんを JSON にしたもの
              例 ["13:20〜14:20","コマ①",["よっちゃん","くる"],["しゃちょー","すー"]]
     A室もB室も空の枠は「全員で集まる枠」（例 ["12:00〜12:20","オープニング",[],[]]）。

   回ごとに分けない。役員が毎回書き換える前提で、前回のものが下敷きに残るほうが
   打ちやすい（毎回ほぼ同じ骨組みになるため）。
   ============================================================ */

import { SHARED_ROW, readSharedLenient, writeSharedRow } from "./sharedRow";

export type TimetableRow = {
  time: string; // "13:20〜14:20"
  title: string; // "コマ①"
  a: string[]; // A室の顔ぶれ
  b: string[]; // B室の顔ぶれ
};

export const blankTimetableRow = (): TimetableRow => ({ time: "", title: "", a: [], b: [] });

function toNames(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && x.trim() !== "") : [];
}

function parseLine(line: string): TimetableRow | null {
  try {
    const v = JSON.parse(line) as unknown;
    if (!Array.isArray(v)) return null;
    const [time, title, a, b] = v as unknown[];
    return {
      time: typeof time === "string" ? time : "",
      title: typeof title === "string" ? title : "",
      a: toNames(a),
      b: toNames(b),
    };
  } catch {
    return null;
  }
}

function decode(raw: string[]): TimetableRow[] {
  return raw.map(parseLine).filter((r): r is TimetableRow => r !== null);
}

/** 何も入っていない枠は残さない。前後の空白も落とす。 */
function encode(rows: TimetableRow[]): string[] {
  return rows
    .map((r) => ({
      time: r.time.trim(),
      title: r.title.trim(),
      a: r.a.map((n) => n.trim()).filter(Boolean),
      b: r.b.map((n) => n.trim()).filter(Boolean),
    }))
    .filter((r) => r.time !== "" || r.title !== "" || r.a.length > 0 || r.b.length > 0)
    .map((r) => JSON.stringify([r.time, r.title, r.a, r.b]));
}

/** 「よっちゃん、くる」のように区切って書かれた名前を配列にする（区切りは 、，, ／ / 改行）。 */
export function splitNames(text: string): string[] {
  return text
    .split(/[、，,／/\n]/)
    .map((n) => n.trim())
    .filter(Boolean);
}

/** 配列の名前を、入力欄に出す形（「、」区切り）にする。 */
export function joinNames(names: string[]): string {
  return names.join("、");
}

/** 表を読む。まだ何も無ければ空。失敗しても例外は投げない。 */
export async function readTimetable(): Promise<TimetableRow[]> {
  return decode(await readSharedLenient(SHARED_ROW.timetable));
}

/**
 * 表をまるごと保存し、保存できた結果を返す。
 * 触るのは役員だけで一度に一人なので、枠ごとの取り合いは考えない
 * （版くらべの仕組みは lib/sharedRow.ts が持っているので、書き込み自体は安全）。
 */
export async function saveTimetable(rows: TimetableRow[]): Promise<TimetableRow[]> {
  const body = encode(rows);
  return decode(await writeSharedRow(SHARED_ROW.timetable, () => body));
}
