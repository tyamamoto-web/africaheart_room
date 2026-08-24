"use client";

/* ============================================================
   参加状況：今回のオフ会に来る人を、全員で共有する
   ------------------------------------------------------------
   出欠そのものはLINEのオープンチャットで決まる。前日24時までの表明を、
   役員が会員名簿（lib/roster.ts）を見ながらチェックして入れる。
   ここはその「チェックした結果」の置き場所。

   ★ SQL不要（新しいテーブルを作らない）:
     既存の共有テーブル homework_result の行を間借りする（lib/sharedRow.ts）。
     割り当ては SHARED_ROW.attendance（=11）。

   しまい方（themes: text[] の中）:
     raw[0]  … どの回のぶんか（開催日 "2026-09-20"）
     raw[1..] … 参加する人の名前

   開催日が変わったら、前の回のチェックは持ち越さない（空から始める）。
   同じ回の中では、誰かが別の人をチェックしていても取り合いにならないよう、
   毎回「最新を取り直して、その人ぶんだけ足す／外す」で書く。
   ============================================================ */

import { SHARED_ROW, readSharedLenient, writeSharedRow } from "./sharedRow";

/** 保存してあるものを、この回のぶんとして読めるかどうかで振り分ける。 */
function pick(raw: string[], eventDate: string): string[] {
  if (raw.length === 0) return [];
  const [storedDate, ...names] = raw;
  if (!eventDate || storedDate !== eventDate) return [];
  return names.filter((n) => n.trim() !== "");
}

/** 今回の回に参加する人の名前。まだ誰も入れていなければ空。 */
export async function readAttendance(eventDate: string): Promise<string[]> {
  return pick(await readSharedLenient(SHARED_ROW.attendance), eventDate);
}

/**
 * 1人ぶんのチェックを入れる／外す。書けたあとの全員ぶんを返す。
 * 名簿にいる順ではなく、入れた順に並ぶ（並べ替えは呼ぶ側でする）。
 */
export async function setAttendance(
  eventDate: string,
  name: string,
  on: boolean
): Promise<string[]> {
  const raw = await writeSharedRow(SHARED_ROW.attendance, (prev) => {
    const set = new Set(pick(prev, eventDate));
    if (on) set.add(name);
    else set.delete(name);
    return [eventDate, ...Array.from(set)];
  });
  return pick(raw, eventDate);
}
