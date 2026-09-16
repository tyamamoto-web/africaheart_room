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
     来る時間（in） … "" ＝はじめから ／ "未定" ／ "19:00"
     帰る時間（out）… "" ＝最後まで   ／ "未定" ／ "20:30"
   「途中で抜けて、また戻る」は持たない。持てる形を増やすと、
   入れる人の手間も、役員が読む手間も増える。まず2つで始める。

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
   1件はおよそ80バイト。遅れる人・帰る人のぶんしか作らないが、
   最悪21名全員が毎回入れても1回1.7キロバイトで、
     400,000 ÷ 1,700 ＝ 230回ぶん（毎月なら19年）
   入る。満杯になれば writeSharedRow が保存を中止して
   「中身が大きくなりすぎました」と返し、その文がそのまま画面に出る。
   ============================================================ */

import { SHARED_ROW, readSharedLenient, writeSharedRow } from "./sharedRow";

/** 時刻がまだ分からない、を表す値。保存にもこの文字を使う（Supabaseを直に見ても読めるように）。 */
export const TIME_UNKNOWN = "未定";

/** 来る時間・帰る時間。"" は決まりどおり（はじめから／最後まで）。 */
export type AttendanceTime = { in: string; out: string };

/** 名前 → その人の出入り。入っていない名前は「はじめから最後まで」。 */
export type AttendanceTimeMap = Record<string, AttendanceTime>;

/** 何も出していない状態。押すところの初期値に使う（undefined を作らない）。 */
export const EMPTY_TIME: AttendanceTime = { in: "", out: "" };

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE_ONLY = /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/;

/** 30分きざみで肢を作る。細かくすると、年配の方が長い車輪を回すことになる。 */
const STEP = 30;
/** 肢の数の頭打ち。長すぎる開催時間を入れ間違えても、車輪が伸び続けないように。 */
const MAX_CHOICES = 24;

/** 読めた値だけを通す。読めないものは「決まりどおり」に倒す（画面を止めない）。 */
function cleanValue(v: unknown): string {
  if (typeof v !== "string") return "";
  const s = v.trim();
  if (s === TIME_UNKNOWN) return TIME_UNKNOWN;
  return HHMM.test(s) ? s : "";
}

/** 決まりどおりか（2つとも空）。true なら、その人のぶんは保存しない。 */
export function isEmptyTime(t: AttendanceTime | null | undefined): boolean {
  return !t || (!t.in && !t.out);
}

/**
 * 画面に出す言葉。決まりどおりなら ""（その行そのものを出さない）。
 *   "19:00" / ""      → 19:00から
 *   ""      / "20:30" → 20:30まで
 *   "19:00" / "20:30" → 19:00から20:30まで
 *   "未定"  / ""      → 遅れて参加
 *   "19:00" / "未定"  → 19:00から・途中で退席
 */
export function formatAttendanceTime(t: AttendanceTime | null | undefined): string {
  if (!t) return "";
  const a = t.in === TIME_UNKNOWN ? "遅れて参加" : t.in ? `${t.in}から` : "";
  const b = t.out === TIME_UNKNOWN ? "途中で退席" : t.out ? `${t.out}まで` : "";
  if (!a || !b) return a || b;
  // 「19:00から20:30まで」はひと続きで読めるので、区切りを挟まない。
  if (t.in !== TIME_UNKNOWN && t.out !== TIME_UNKNOWN) return `${a}${b}`;
  return `${a}・${b}`;
}

function toMinutes(s: string): number | null {
  if (!HHMM.test(s)) return null;
  return Number(s.slice(0, 2)) * 60 + Number(s.slice(3, 5));
}

function toText(m: number): string {
  const h = Math.floor(m / 60) % 24;
  const mi = m % 60;
  return `${String(h).padStart(2, "0")}:${String(mi).padStart(2, "0")}`;
}

/**
 * 開催時間から、選べる時刻を作る。
 * 開始ちょうど・終了ちょうどは入れない（それは遅れてもいないし、途中で帰ってもいない）。
 * 終了が入っていなければ、開始の6時間後までで打ち切る。
 * 開始が読めなければ空（そのときは時刻を選ばせず、「遅れて行く」だけを受ける）。
 */
export function timeChoices(start: string, end: string): string[] {
  const s = toMinutes(start);
  if (s === null) return [];
  const e0 = toMinutes(end);
  // 終わりが日をまたぐ回（22:00〜翌1:00）もあるので、後ろに回っていれば1日足して数える。
  const e = e0 === null || e0 === s ? s + 6 * 60 : e0 > s ? e0 : e0 + 24 * 60;

  const out: string[] = [];
  for (let m = Math.floor(s / STEP) * STEP + STEP; m < e && out.length < MAX_CHOICES; m += STEP) {
    out.push(toText(m));
  }
  return out;
}

/**
 * 保存してある時刻が肢に無ければ、時間順の位置に差し込んで返す。
 * 役員が開催時間を打ち直したとき、保存は 21:00 のままなのに
 * 画面だけ「まだ分かりません」に見える、という嘘を防ぐ。
 * （"HH:MM" は文字の大小がそのまま時間の前後になる。日をまたぐ回（22:00〜翌1:00 など）で
 *   0時台を保存していると、時間の順ではなく先頭に付く。並びが揃わないだけで、
 *   選んだものは選ばれたまま出るので、そこまでは面倒を見ない）
 */
export function withSaved(choices: string[], saved: string): string[] {
  if (!HHMM.test(saved) || choices.includes(saved)) return choices;
  const at = choices.findIndex((c) => c > saved);
  if (at < 0) return [...choices, saved];
  return [...choices.slice(0, at), saved, ...choices.slice(at)];
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
