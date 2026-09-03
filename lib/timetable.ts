"use client";

/* ============================================================
   当日のタイムテーブル（時間・企画名）：全員で共有する保存
   ------------------------------------------------------------
   当日の画面に出す表。時間も企画名も役員が手で打ち込む。

   ★ SQL不要（新しいテーブルを作らない）:
     既存の共有テーブル homework_result の行を間借りする（lib/sharedRow.ts）。
     割り当ては SHARED_ROW.timetable（=12）。行が無ければ初回の保存で作られる。

   しまい方（themes: text[] の中）:
     raw[i] … 1行ぶんを JSON にしたもの   例 ["12:00","集合"]

   回ごとに分けない。役員が毎回書き換える前提で、前回のものが下敷きに残るほうが
   打ちやすい（毎回ほぼ同じ骨組みになるため）。
   ============================================================ */

import { SHARED_ROW, readSharedLenient, writeSharedRow } from "./sharedRow";

export type TimetableRow = { time: string; title: string };

function parseLine(line: string): TimetableRow | null {
  try {
    const v = JSON.parse(line) as unknown;
    if (!Array.isArray(v)) return null;
    const [time, title] = v as unknown[];
    return {
      time: typeof time === "string" ? time : "",
      title: typeof title === "string" ? title : "",
    };
  } catch {
    return null;
  }
}

function decode(raw: string[]): TimetableRow[] {
  return raw.map(parseLine).filter((r): r is TimetableRow => r !== null);
}

/** 時間も企画名も空の行は残さない。前後の空白も落とす。 */
function encode(rows: TimetableRow[]): string[] {
  return rows
    .map((r) => ({ time: r.time.trim(), title: r.title.trim() }))
    .filter((r) => r.time !== "" || r.title !== "")
    .map((r) => JSON.stringify([r.time, r.title]));
}

/** 表を読む。まだ何も無ければ空。失敗しても例外は投げない。 */
export async function readTimetable(): Promise<TimetableRow[]> {
  return decode(await readSharedLenient(SHARED_ROW.timetable));
}

/**
 * 表をまるごと保存し、保存できた結果を返す。
 * 触るのは役員だけで一度に一人なので、行ごとの取り合いは考えない
 * （版くらべの仕組みは lib/sharedRow.ts が持っているので、書き込み自体は安全）。
 */
export async function saveTimetable(rows: TimetableRow[]): Promise<TimetableRow[]> {
  const body = encode(rows);
  return decode(await writeSharedRow(SHARED_ROW.timetable, () => body));
}
