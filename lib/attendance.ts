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

   ── しまい方（themes: text[] の中）──────────────
     回ごとのかたまりを、そのまま並べて持つ。
       "2026-09-26"   ← 開催日の行。ここから下がその回のぶん
       "参加:くる"
       "不参加:みや"
       "2026-08-22"   ← 次の開催日の行。ここから下が前の回のぶん
       "参加:くる"
     開催日の行は "0000-00-00" の形ちょうど、人の行は必ず "：" を含むので、
     読むときに取り違えない。

   ── 消えないようにしてあること（9/7 追加）────────
     ひとつ前までは、頭の1行だけが開催日で、そこと違う回のぶんは
     まるごと捨てていた。だから役員が開催日を打ち直すと、
     それまでに出た出欠がすべて消えていた（気づけないまま消える）。
     いまは回ごとに分けて持つので、日にちを直しても前の回のぶんは残る。
     直した日にちを元に戻せば、出ていたぶんもそのまま戻る。
     書き込みは毎回「最新をDBから取り直す → 自分の1人ぶんだけ当てる →
     版くらべで上書き」（lib/sharedRow.ts）。ほかの人が同時に出しても、
     どちらも消えない。

     置いておく回の数は MAX_EVENTS（24回ぶん）まで。
     それを超えたら、古い回から落とす（2年ぶんは残る計算）。

     9/7 より前に入れたぶん（頭が開催日、あとは名前だけ）は、
     この読み方でそのまま読める。名前だけの行は「参加」として読む。
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

/** 置いておく回の数。これを超えたら古い回から落とす。 */
const MAX_EVENTS = 24;

const DATE_LINE = /^\d{4}-\d{2}-\d{2}$/;

const BY_LABEL: Record<string, AttendanceStatus> = {
  参加: "going",
  不参加: "absent",
  未定: "undecided",
};

/** 人の行を読む。頭に「参加:」などが無ければ、9/7より前のぶんとみなす。 */
function decodeEntry(line: string): { name: string; status: AttendanceStatus } | null {
  const i = line.indexOf(":");
  if (i > 0) {
    const status = BY_LABEL[line.slice(0, i)];
    if (status) {
      const name = line.slice(i + 1).trim();
      return name ? { name, status } : null;
    }
  }
  // 名前だけ＝9/7より前に役員が入れたぶん。参加として読む。
  return { name: line, status: "going" };
}

/** 保存してあるもの全部を、開催日ごとのかたまりに分ける。 */
function decodeAll(raw: string[]): Map<string, AttendanceMap> {
  const out = new Map<string, AttendanceMap>();
  let current: AttendanceMap | null = null;
  for (const line0 of raw) {
    const line = (line0 ?? "").trim();
    if (!line) continue;
    if (DATE_LINE.test(line)) {
      if (!out.has(line)) out.set(line, {});
      current = out.get(line) ?? null;
      continue;
    }
    // 開催日の行より前にあるものは、どの回のぶんか分からないので置いておかない
    if (!current) continue;
    const e = decodeEntry(line);
    if (e) current[e.name] = e.status;
  }
  return out;
}

/**
 * 開催日ごとのかたまりを、保存する形に戻す。新しい回から順に並べる。
 * いま見ている回（keep）は、まだ誰も出していなくても必ず残す。
 * 誰も出していない古い回は落とす（見出しだけが溜まらないように）。
 */
function encodeAll(sections: Map<string, AttendanceMap>, keep: string): string[] {
  const others = Array.from(sections.keys())
    .filter((d) => d !== keep && Object.keys(sections.get(d) ?? {}).length > 0)
    .sort()
    .reverse();
  const dates = [keep, ...others].slice(0, MAX_EVENTS).sort().reverse();

  const out: string[] = [];
  for (const d of dates) {
    out.push(d);
    const map = sections.get(d) ?? {};
    for (const name of Object.keys(map)) out.push(`${ATTENDANCE_LABEL[map[name]]}:${name}`);
  }
  return out;
}

/** 今回の回のぶん。まだ誰も出していなければ空。 */
export async function readAttendance(eventDate: string): Promise<AttendanceMap> {
  if (!eventDate) return {};
  return decodeAll(await readSharedLenient(SHARED_ROW.attendance)).get(eventDate) ?? {};
}

/**
 * 1人ぶんを書き換える。null を渡すと、その人のぶんを消して「未回答」に戻す。
 * 書けたあとの、今回の回の全員ぶんを返す。
 * 触るのは今回の回のかたまりだけ。ほかの回のぶんはそのまま持ち越す。
 */
export async function setAttendance(
  eventDate: string,
  name: string,
  status: AttendanceStatus | null
): Promise<AttendanceMap> {
  const raw = await writeSharedRow(SHARED_ROW.attendance, (prev) => {
    const sections = decodeAll(prev);
    const map = { ...(sections.get(eventDate) ?? {}) };
    if (status) map[name] = status;
    else delete map[name];
    sections.set(eventDate, map);
    return encodeAll(sections, eventDate);
  });
  return decodeAll(raw).get(eventDate) ?? {};
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
