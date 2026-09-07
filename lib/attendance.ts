"use client";

/* ============================================================
   出欠席：来るか来ないかを、ひとりずつ自分で出す
   ------------------------------------------------------------
   9/7 まで：出欠はLINEで決まり、それを役員が名簿を見ながら
     チェックして入れていた（入れられるのは役員だけだった）。
   9/7 から：会員がそれぞれ、自分のぶんを自分で出す。
     出せるものは3つ ── 参加・不参加・未定。
     まだ出していない人は「未回答」。未回答は保存しない
     （書いていないこと自体が「まだ出していない」の印になる）。

   ★ SQL不要（新しいテーブルを作らない）:
     既存の共有テーブル homework_result の行を間借りする（lib/sharedRow.ts）。
     割り当ては SHARED_ROW.attendance（=11）。ここは変えていない。

   しまい方（themes: text[] の中）:
     raw[0]  … どの回のぶんか（開催日 "2026-09-26"）
     raw[1..] … 1人ぶん。"参加:くる" "不参加:くる" "未定:くる"

     9/7 より前に入れたぶんは名前だけが入っている（"くる"）。
     これは「参加」として読む。前の回のチェックを消さないため。

   開催日が変わったら、前の回のぶんは持ち越さない（空から始める）。
   同じ回の中では、何人が同時に出しても取り合いにならないよう、
   毎回「最新を取り直して、その人ぶんだけ書き換える」で書く。
   ============================================================ */

import { SHARED_ROW, readSharedLenient, writeSharedRow } from "./sharedRow";

/** 出せる3つ。この文字そのものが保存の鍵になるので、あとから変えない。 */
export type AttendanceStatus = "going" | "absent" | "undecided";

/** 名前 → その人が出したもの。入っていない名前は「未回答」。 */
export type AttendanceMap = Record<string, AttendanceStatus>;

/** 画面に出す言葉。保存にも同じ言葉を使う（Supabaseを直に見ても読めるように）。 */
export const ATTENDANCE_LABEL: Record<AttendanceStatus, string> = {
  going: "参加",
  absent: "不参加",
  undecided: "未定",
};

/** 並べる順。参加・不参加・未定の順で出す。 */
export const ATTENDANCE_ORDER: AttendanceStatus[] = ["going", "absent", "undecided"];

const BY_LABEL: Record<string, AttendanceStatus> = {
  参加: "going",
  不参加: "absent",
  未定: "undecided",
};

/** 保存してある1行を読む。頭に「参加:」などが無ければ、9/7より前のぶんとみなす。 */
function decodeEntry(line: string): { name: string; status: AttendanceStatus } | null {
  const t = line.trim();
  if (!t) return null;
  const i = t.indexOf(":");
  if (i > 0) {
    const status = BY_LABEL[t.slice(0, i)];
    if (status) {
      const name = t.slice(i + 1).trim();
      return name ? { name, status } : null;
    }
  }
  // 名前だけ＝9/7より前に役員が入れたぶん。参加として読む。
  return { name: t, status: "going" };
}

/** 保存してあるものを、この回のぶんとして読めるかどうかで振り分ける。 */
function pick(raw: string[], eventDate: string): AttendanceMap {
  if (raw.length === 0) return {};
  const [storedDate, ...lines] = raw;
  if (!eventDate || storedDate !== eventDate) return {};
  const out: AttendanceMap = {};
  for (const line of lines) {
    const e = decodeEntry(line);
    if (e) out[e.name] = e.status;
  }
  return out;
}

function encode(eventDate: string, map: AttendanceMap): string[] {
  return [eventDate, ...Object.keys(map).map((n) => `${ATTENDANCE_LABEL[map[n]]}:${n}`)];
}

/** 今回の回のぶん。まだ誰も出していなければ空。 */
export async function readAttendance(eventDate: string): Promise<AttendanceMap> {
  return pick(await readSharedLenient(SHARED_ROW.attendance), eventDate);
}

/**
 * 1人ぶんを書き換える。null を渡すと、その人のぶんを消して「未回答」に戻す。
 * 書けたあとの全員ぶんを返す。
 */
export async function setAttendance(
  eventDate: string,
  name: string,
  status: AttendanceStatus | null
): Promise<AttendanceMap> {
  const raw = await writeSharedRow(SHARED_ROW.attendance, (prev) => {
    const map = pick(prev, eventDate);
    if (status) map[name] = status;
    else delete map[name];
    return encode(eventDate, map);
  });
  return pick(raw, eventDate);
}

/** 名簿にいる人だけを数える。名簿から消えた人のぶんは数に入れない。 */
export function countAttendance(
  map: AttendanceMap,
  names: string[]
): { going: number; absent: number; undecided: number; unanswered: number } {
  let going = 0;
  let absent = 0;
  let undecided = 0;
  for (const n of names) {
    const s = map[n];
    if (s === "going") going += 1;
    else if (s === "absent") absent += 1;
    else if (s === "undecided") undecided += 1;
  }
  return { going, absent, undecided, unanswered: names.length - going - absent - undecided };
}
