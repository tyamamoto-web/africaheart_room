"use client";

/* ============================================================
   ふりかえりの「ひとこと」：オフ会の感想を、来た人がめいめい書く
   ------------------------------------------------------------
   会が終わったあと、その回について思ったことをひとことずつ置いていく場所。
   書いたものは、会員ページのふりかえりに全員ぶん並ぶ。

   このアプリにログインは無いので、名前は会員名簿から選んでもらう
   （lib/me.ts。出欠席で選んだ名前をそのまま使う）。

   1人につき1件。同じ名前でもう一度送ると、前のものを書き替える。
   件数をどんどん足していく形にしないのは、
     ・だれが何と言ったかが上から順に読めるほうが、次の会の相談に使える
     ・同じ人の書き直しが並ぶと、どれが今の気持ちなのか分からなくなる
   から。書き替えられるのは、その端末で選んだ名前のぶんだけ。

   回ごとに日付で分けて持つので、次の回になっても前の回のぶんは残る
   （画面に出るのは、その画面が見ている回のぶんだけ）。

   ★ SQL不要（新しいテーブルを作らない）:
     共有テーブル `homework_result` の id=13 を間借りする（割り当ては lib/sharedRow.ts）。
     themes(text[]) の1要素＝1件で、中身は JSON 文字列。
     読み書きの土台（版くらべ・順番待ち）は lib/sharedRow.ts が受け持つので、
     2人が同じ時間に送っても、あとから送ったほうが前のを消してしまうことはない。
   ============================================================ */

import { SHARED_ROW, readSharedLenient, writeSharedRow } from "./sharedRow";

/** 画面に出す1件。 */
export type Voice = { name: string; text: string; at: number };

/** 1件の長さの上限。長めの文も置けるが、際限なく伸ばさない。 */
export const VOICE_MAX = 400;

/* ── 書いたものを、こちらから消さないこと ─────────────────
   はじめは「12回ぶんだけ残して、古い回から落とす」ようにしていた。
   それは、共有の1行に入る大きさ（SHARED_MAX_BYTES＝400,000バイト）を
   自分で守るためだったが、会員の書いた言葉を黙って捨てることになる。
   何回目のオフ会の話かは覚えていても、いつ消えたかは誰も分からない。

   なので、こちらから落とすのはやめた。全部の回のぶんを持ち続ける。

   大きさの見積り：1件はおおよそ
     日付・名前・時刻の決まった部分で約60バイト＋本文（日本語1文字3バイト）。
   ふつうの長さ（100字くらい）なら1件400バイト弱、21名で1回8キロバイトほど。
     400,000 ÷ 8,000 ＝ 50回ぶん（毎月なら4年以上）
   全員が上限の400字いっぱいまで書いた場合でも
     1回27キロバイトほどで、15回ぶん（1年以上）
   入る。

   それでも満杯になったときは、`writeSharedRow` が保存を中止して
   「中身が大きくなりすぎました」と返す（画面にそのまま出る）。
   黙って消えるより、書けないと分かるほうがよい。
   そうなったら、役員が古い回のぶんを別の場所に移すことになる。 */

type Entry = { d: string; n: string; t: string; a: number };

const DATE_ONLY = /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/;

// themes の1要素を1件に戻す（読めないものは無視して、画面を止めない）。
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
  const t = typeof r.t === "string" ? r.t : "";
  if (!DATE_ONLY.test(d) || !n || !t.trim()) return null;
  const a = typeof r.a === "number" && Number.isFinite(r.a) ? r.a : 0;
  return { d, n, t: t.slice(0, VOICE_MAX), a };
}

function encodeEntry(e: Entry): string {
  return JSON.stringify({ d: e.d, n: e.n, t: e.t, a: e.a });
}

function decodeAll(raw: string[]): Entry[] {
  const out: Entry[] = [];
  for (const s of raw) {
    const e = parseEntry(s);
    if (!e) continue;
    // 同じ回・同じ名前が2件あれば、あとのほうを採る
    const at = out.findIndex((x) => x.d === e.d && x.n === e.n);
    if (at >= 0) out[at] = e;
    else out.push(e);
  }
  return out;
}

/* 保存する並び。新しい回から、回のなかでは新しく書かれたものから。
   1件も落とさない（並べ替えるだけ）。
   並べておくのは、共有の中身を直に覗いたときに読み取れるようにするため。 */
function orderAll(list: Entry[]): Entry[] {
  return [...list].sort((x, y) => (x.d === y.d ? y.a - x.a : x.d < y.d ? 1 : -1));
}

/** その回のぶんだけを、新しいものから順に取り出す。 */
function pick(list: Entry[], eventDate: string): Voice[] {
  return list
    .filter((e) => e.d === eventDate)
    .sort((x, y) => y.a - x.a)
    .map((e) => ({ name: e.n, text: e.t, at: e.a }));
}

/** その回のひとことを読む（まだ無ければ空。読めなかったときも空で返す）。 */
export async function readVoices(eventDate: string): Promise<Voice[]> {
  return pick(decodeAll(await readSharedLenient(SHARED_ROW.voices)), eventDate);
}

/**
 * その回の、その名前のひとことを置く（同じ名前のぶんがあれば書き替える）。
 * text を空にすると、その人のぶんを取り消す。
 * 戻り値は書いたあとの一覧（新しいものから順）。
 */
export async function saveVoice(eventDate: string, name: string, text: string): Promise<Voice[]> {
  const who = name.trim();
  const body = text.trim().slice(0, VOICE_MAX);
  if (!DATE_ONLY.test(eventDate) || !who) return readVoices(eventDate);

  const raw = await writeSharedRow(SHARED_ROW.voices, (prev) => {
    // 自分のぶんを外してから書いたものを足す（何度呼ばれても同じ結果になるように）
    const rest = decodeAll(prev).filter((e) => !(e.d === eventDate && e.n === who));
    const next = body ? [...rest, { d: eventDate, n: who, t: body, a: Date.now() }] : rest;
    return orderAll(next).map(encodeEntry);
  });
  return pick(decodeAll(raw), eventDate);
}

/** 一覧のなかから、その名前のぶんを探す（無ければ null）。 */
export function findVoice(list: Voice[], name: string): Voice | null {
  const who = name.trim();
  if (!who) return null;
  return list.find((v) => v.name === who) ?? null;
}
