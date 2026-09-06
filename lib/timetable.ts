"use client";

/* ============================================================
   当日の部屋割（時間・部屋番号・企画・名前）：全員で共有する保存
   ------------------------------------------------------------
   当日の画面に出す部屋割り表の中身。過去の回では lib/data.ts の karaokeRooms に
   直接書いていたが、ここでは役員が画面から手で入れる。

   列は 時間｜部屋番号｜企画｜名前 の4つ。
   1行が「その時間に、その部屋で、何をして、誰がいるか」。
     例  13:20〜14:20 ｜ 26 ｜ コマ① ｜ よっちゃん、くる
         13:20〜14:20 ｜ 32 ｜ コマ① ｜ しゃちょー、すー
   コマを2部屋でやるときは、同じ時間の行を部屋のぶんだけ書く（表では時間がまとまる）。
   名前が空の行は「全員で集まる行」（例 12:00〜12:20 ｜ 26 ｜ オープニング ｜ ）。

   ★ SQL不要（新しいテーブルを作らない）:
     既存の共有テーブル homework_result の行を間借りする（lib/sharedRow.ts）。
     割り当ては SHARED_ROW.timetable（=12）。行が無ければ初回の保存で作られる。

   しまい方（themes: text[] の中）:
     raw[i] … 1行ぶんを JSON にしたもの [時間, 部屋番号, 企画, 名前の配列]
              例 ["13:20〜14:20","26","コマ①",["よっちゃん","くる"]]
     （9/6 に A室・B室の2列から、この4列の形に変えた。変えた時点で行は空だったので、
       前の形のものは残っていない）

   回ごとに分けない。役員が毎回書き換える前提で、前回のものが下敷きに残るほうが
   打ちやすい（毎回ほぼ同じ骨組みになるため）。
   ============================================================ */

import { SHARED_ROW, readSharedLenient, writeSharedRow } from "./sharedRow";

export type TimetableRow = {
  time: string; // "13:20〜14:20"
  room: string; // "26"（部屋番号。「A」のような記号でもよい）
  title: string; // "コマ①"
  names: string[]; // その部屋の顔ぶれ。空なら「全員」
};

export const blankTimetableRow = (): TimetableRow => ({ time: "", room: "", title: "", names: [] });

/**
 * 表（app/components/PlanTable.tsx）に出すときの行。TimetableRow に、行の下へ小さく添える
 * メモ（note）を足したもの。メモは当日の部屋割には無く、ここにも保存しない。
 * 設定 ＞ アーカイブの過去の回で、集合や宿題の枠に付いていた補足
 * （退席の時刻、宿題のお題など。lib/archive.ts の detail）を出すのに使う。
 */
export type PlanRow = TimetableRow & { note?: string };

function toNames(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && x.trim() !== "") : [];
}

function parseLine(line: string): TimetableRow | null {
  try {
    const v = JSON.parse(line) as unknown;
    if (!Array.isArray(v)) return null;
    const [time, room, title, names] = v as unknown[];
    return {
      time: typeof time === "string" ? time : "",
      room: typeof room === "string" ? room : "",
      title: typeof title === "string" ? title : "",
      names: toNames(names),
    };
  } catch {
    return null;
  }
}

function decode(raw: string[]): TimetableRow[] {
  return raw.map(parseLine).filter((r): r is TimetableRow => r !== null);
}

/** 何も入っていない行は残さない。前後の空白も落とす。 */
function encode(rows: TimetableRow[]): string[] {
  return rows
    .map((r) => ({
      time: r.time.trim(),
      room: r.room.trim(),
      title: r.title.trim(),
      names: r.names.map((n) => n.trim()).filter(Boolean),
    }))
    .filter((r) => r.time !== "" || r.room !== "" || r.title !== "" || r.names.length > 0)
    .map((r) => JSON.stringify([r.time, r.room, r.title, r.names]));
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
 * 触るのは役員だけで一度に一人なので、行ごとの取り合いは考えない
 * （版くらべの仕組みは lib/sharedRow.ts が持っているので、書き込み自体は安全）。
 */
export async function saveTimetable(rows: TimetableRow[]): Promise<TimetableRow[]> {
  const body = encode(rows);
  return decode(await writeSharedRow(SHARED_ROW.timetable, () => body));
}
