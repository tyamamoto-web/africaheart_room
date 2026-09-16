"use client";

/* ============================================================
   出欠席の「来る時間・帰る時間」：遅れて行く人・途中で帰る人
   ------------------------------------------------------------
   参加と出した人のうち、何人かは頭から終わりまでいるわけではない。
   これまでその出入りは、LINEや当日の口頭で役員に伝わっていた
   （過去の回の記録にも「【退席】◯◯ 15:00 ／ △△ 16:00」と残っている）。
   当日の部屋割りは、誰がどのコマにいるかで組むので、
   ここが分からないと組めない。だから出欠と同じ場所で受ける。

   持つのは1人につき2つだけ。
     来る時間（in） … "" ＝はじめから ／ "未定" ／ 本人が書いた字
     帰る時間（out）… "" ＝最後まで   ／ "未定" ／ 本人が書いた字
   「途中で抜けて、また戻る」は持たない。持てる形を増やすと、
   入れる人の手間も、役員が読む手間も増える。まず2つで始める。

   ★ 時刻は選ばせず、本人に書いてもらう（2026-09-16 に変更）。
     はじめは30分きざみのプルダウンにしていたが、実際に出てくるのは
     「13時ごろ」「仕事が終わり次第」「30分くらい遅れます」のような言い方で、
     刻みの合う時刻を選ばせると、そのどれも出せなかった。
     ここを読むのは役員（人）であって計算ではないので、書いてもらうほうがよく伝わる。
     そのぶん、並べ替えや自動の割り当てには使えない。長さだけ WHEN_MAX で押さえる。
     押しただけで何も書いていない状態は "未定"（TIME_UNKNOWN）で持つ。

   ★ 出欠そのもの（lib/attendance.ts / 共有の id=11）は1文字も触らない。
     あちらの人の行は "参加:くる" の形で、コロンから後ろが全部名前になる
     （lib/attendance.ts の decodeEntry）。そこへ時刻を混ぜると、
     まだ新しい画面になっていない端末が「くる|19:00」という名前の人として読み、
     名簿と合わないので、その人が未回答あつかいになって参加人数が減る。
     知らないうちに人数が狂うのがいちばん困るので、別の行に分けた。

   ★ SQL不要（新しいテーブルを作らない）:
     共有テーブル `homework_result` の id=14 を間借りする（割り当ては lib/sharedRow.ts）。
     themes(text[]) の1要素＝1人ぶんで、中身は JSON 文字列。
     読み書きの土台（版くらべ・順番待ち）は lib/sharedRow.ts が受け持つので、
     2人が同じ時間に押しても、あとの人が前の人のぶんを消してしまうことはない。

   ── 消さないこと ──────────────────────────
   参加 → 不参加 に変えても、ここのぶんは消さない。出すかどうかは
   画面の側だけで決める（参加の人のぶんだけ出す）。押し間違えて戻した人が
   打ち直しにならないし、まだ新しい画面になっていない端末から不参加にされた
   ときに、こちらから消しに行けないから（消し込みを当てにした作りは、
   そもそも安全にならない）。自分で消したいときは、2つとも外せばよい
   ── そのときは in も out も "" になるので、その人の件ごと配列から消える。

   古い回のぶんも、こちらからは落とさない（lib/voices.ts と同じ考え方）。
   1件は、決まった部分が約70バイト＋書いた字（日本語1文字3バイト）。
   ふつうの短い書き方なら1件100バイト前後で、遅れる人・帰る人のぶんしか作らない。
   最悪、21名全員が毎回2つとも WHEN_MAX いっぱい（30字）まで書いても
     1件250バイト × 21名 ＝ 1回5.3キロバイト
     400,000 ÷ 5,300 ＝ 75回ぶん（毎月なら6年）
   入る。満杯になれば writeSharedRow が保存を中止して
   「中身が大きくなりすぎました」と返し、その文がそのまま画面に出る。
   ============================================================ */

import { SHARED_ROW, readSharedLenient, writeSharedRow } from "./sharedRow";

/** 押しただけで、まだ何も書いていない状態。保存にもこの文字を使う
    （Supabaseを直に見ても読めるように）。本人が「未定」と書いた場合も同じ扱いでよい。 */
export const TIME_UNKNOWN = "未定";

/** 1つぶんに書ける長さ。時間のことをひとこと書ければよいので、短く押さえる
    （長いと、みんなの一覧で1人の行だけが何行にも伸びる）。 */
export const WHEN_MAX = 30;

/** 来る時間・帰る時間。"" は決まりどおり（はじめから／最後まで）。 */
export type AttendanceTime = { in: string; out: string };

/** 名前 → その人の出入り。入っていない名前は「はじめから最後まで」。 */
export type AttendanceTimeMap = Record<string, AttendanceTime>;

/** 何も出していない状態。押すところの初期値に使う（undefined を作らない）。 */
export const EMPTY_TIME: AttendanceTime = { in: "", out: "" };

const DATE_ONLY = /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/;

/* 読めた値だけを通す。
   本人が書いた字をそのまま持つが、改行やタブが混じると
   みんなの一覧の1行が崩れるので、続きの空白はひとつに詰める。 */
function cleanValue(v: unknown): string {
  if (typeof v !== "string") return "";
  return v.replace(/\s+/g, " ").trim().slice(0, WHEN_MAX);
}

/** 決まりどおりか（2つとも空）。true なら、その人のぶんは保存しない。 */
export function isEmptyTime(t: AttendanceTime | null | undefined): boolean {
  return !t || (!t.in && !t.out);
}

/**
 * 画面に出す言葉。決まりどおりなら ""（その行そのものを出さない）。
 * 本人が書いた字は、何と書いてあっても文として通るように、括弧に入れて添える。
 *   "未定"     / ""         → 遅れて参加
 *   "13時ごろ" / ""         → 遅れて参加（13時ごろ）
 *   ""         / "17時ごろ" → 途中で退席（17時ごろ）
 *   "13時ごろ" / "17時ごろ" → 遅れて参加（13時ごろ）・途中で退席（17時ごろ）
 */
export function formatAttendanceTime(t: AttendanceTime | null | undefined): string {
  if (!t) return "";
  const part = (v: string, head: string) =>
    !v ? "" : v === TIME_UNKNOWN ? head : `${head}（${v}）`;
  const a = part(t.in, "遅れて参加");
  const b = part(t.out, "途中で退席");
  return a && b ? `${a}・${b}` : a || b;
}

/**
 * 参加の人のうち、出入りを出している人の数。
 * lib/attendance.ts の countAttendance には混ぜない。あちらの going は
 * 当日の部屋割りの総人数にもなっているので、足し引きすると人数が黙って変わる。
 */
export function countAttendanceTimes(
  times: AttendanceTimeMap,
  isGoing: (name: string) => boolean,
  names: string[]
): number {
  let n = 0;
  for (const name of names) {
    if (isGoing(name) && !isEmptyTime(times[name])) n += 1;
  }
  return n;
}

/* ── しまい方（themes: text[] の中）────────────────
   1要素が1人ぶん。d＝開催日、n＝名前、in／out＝時刻、a＝書いた時刻。
     {"d":"2026-09-26","n":"◯◯","in":"19:00","out":"","a":1758950000000}
   a を持っておくと、同じ人のぶんが2件あったときに、あとに書いたほうを採れる。 */
type Entry = { d: string; n: string; in: string; out: string; a: number };

function parseEntry(s: unknown): Entry | null {
  if (typeof s !== "string") return null;
  let o: unknown;
  try {
    o = JSON.parse(s);
  } catch {
    return null;
  }
  if (!o || typeof o !== "object") return null;
  const r = o as Record<string, unknown>;
  const d = typeof r.d === "string" ? r.d : "";
  const n = typeof r.n === "string" ? r.n.trim() : "";
  if (!DATE_ONLY.test(d) || !n) return null;
  const at = cleanValue(r.in);
  const out = cleanValue(r.out);
  if (!at && !out) return null; // 決まりどおりの件は持たない
  const a = typeof r.a === "number" && Number.isFinite(r.a) ? r.a : 0;
  return { d, n, in: at, out, a };
}

function encodeEntry(e: Entry): string {
  return JSON.stringify({ d: e.d, n: e.n, in: e.in, out: e.out, a: e.a });
}

function decodeAll(raw: string[]): Entry[] {
  const list: Entry[] = [];
  for (const s of raw) {
    const e = parseEntry(s);
    if (!e) continue;
    // 同じ回・同じ名前が2件あれば、あとのほうを採る
    const at = list.findIndex((x) => x.d === e.d && x.n === e.n);
    if (at >= 0) list[at] = e;
    else list.push(e);
  }
  return list;
}

/* 保存する並び。新しい回から、回のなかでは新しく書かれたものから。
   1件も落とさない（並べ替えるだけ）。
   並べておくのは、共有の中身を直に覗いたときに読み取れるようにするため。 */
function orderAll(list: Entry[]): Entry[] {
  return [...list].sort((x, y) => (x.d === y.d ? y.a - x.a : x.d < y.d ? 1 : -1));
}

function pick(list: Entry[], eventDate: string): AttendanceTimeMap {
  const out: AttendanceTimeMap = {};
  for (const e of list) {
    if (e.d === eventDate) out[e.n] = { in: e.in, out: e.out };
  }
  return out;
}

/** その回のぶんを読む（まだ無ければ空。読めなかったときも空で返す）。 */
export async function readAttendanceTimes(eventDate: string): Promise<AttendanceTimeMap> {
  if (!DATE_ONLY.test(eventDate)) return {};
  return pick(decodeAll(await readSharedLenient(SHARED_ROW.attendanceTimes)), eventDate);
}

/**
 * 1人ぶんを書き換える。2つとも空なら、その人の件ごと消す（本人が取り消したとき）。
 * 戻り値は、書けたあとのその回の全員ぶん。
 */
export async function setAttendanceTime(
  eventDate: string,
  name: string,
  time: AttendanceTime
): Promise<AttendanceTimeMap> {
  const who = name.trim();
  if (!DATE_ONLY.test(eventDate) || !who) return readAttendanceTimes(eventDate);

  const at = cleanValue(time.in);
  const out = cleanValue(time.out);

  const raw = await writeSharedRow(SHARED_ROW.attendanceTimes, (prev) => {
    // 自分のぶんを外してから書いたものを足す（何度呼ばれても同じ結果になるように）
    const rest = decodeAll(prev).filter((e) => !(e.d === eventDate && e.n === who));
    const next =
      at || out ? [...rest, { d: eventDate, n: who, in: at, out, a: Date.now() }] : rest;
    return orderAll(next).map(encodeEntry);
  });
  return pick(decodeAll(raw), eventDate);
}
