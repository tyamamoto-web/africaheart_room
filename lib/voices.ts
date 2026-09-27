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

/** 画面に出す1件。id はその回のあいだ変わらない札で、返信がこれを指す。 */
export type Voice = { id: string; name: string; text: string; at: number };

/**
 * ひとことへの返信。
 * to は返信先のひとことの札。名前で指さないのは、取り消して別の内容を書き直されたとき、
 * 古い返信が新しい文のほうにぶら下がってしまうため。toName は画面に出すための控え。
 * id はその返信そのものの札。ひとことと違って1人が何件でも書けるので、
 * 書き替え・取り消しの相手を名前だけでは決められない。
 */
export type Reply = { id: string; to: string; toName: string; name: string; text: string; at: number };

/** その回のひとことと返信をまとめたもの。画面はこれを1つ持てばよい。 */
export type VoiceBoard = { voices: Voice[]; replies: Reply[] };

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

/* 共有の1行に入る1件。to と id があれば返信、無ければひとこと本体。
   古い（to も id も無い）ぶんはそのまま本体として読めるので、
   すでに入っている8月・9月のひとことは何もしなくても残る。 */
type Entry = {
  d: string;
  n: string;
  t: string;
  a: number;
  v?: string;  // ひとことの札（返信が指す先）
  to?: string; // 返信先のひとことの札
  tn?: string; // 返信先の名前（画面に出すための控え）
  id?: string; // 返信そのものの札
};

const DATE_ONLY = /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/;

/** 返信の札を作る。保存のやり直しで札が変わらないよう、呼ぶのは1回だけにすること。 */
function newReplyId(): string {
  try {
    return crypto.randomUUID().replace(/-/g, "").slice(0, 16);
  } catch {
    return `${Date.now().toString(36)}${Math.floor(Math.random() * 1e8).toString(36)}`;
  }
}

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
  const to = typeof r.to === "string" ? r.to.trim() : "";
  const id = typeof r.id === "string" ? r.id.trim() : "";
  const base = { d, n, t: t.slice(0, VOICE_MAX), a };
  if (!to) {
    // 札の無い古いひとことには、回と名前から決まる札を当てる（1回に1人1件なので重ならない）
    const v = typeof r.v === "string" && r.v.trim() ? r.v.trim() : `${d}|${n}`;
    return { ...base, v };
  }
  const tn = typeof r.tn === "string" ? r.tn.trim() : "";
  // 返信先はあるのに札が無いもの（手で足した等）は、中身から決まる札を当てて拾う
  return { ...base, to, tn, id: id || `${d}|${n}|${to}|${a}` };
}

function encodeEntry(e: Entry): string {
  return e.to
    ? JSON.stringify({ d: e.d, n: e.n, t: e.t, a: e.a, to: e.to, tn: e.tn, id: e.id })
    : JSON.stringify({ d: e.d, n: e.n, t: e.t, a: e.a, v: e.v });
}

/** 同じものが2件あれば、あとのほうを採る。ひとことは「回＋名前」、返信は札で見分ける。 */
function keyOf(e: Entry): string {
  return e.id ? `r:${e.id}` : `v:${e.d}|${e.n}`;
}

function decodeAll(raw: string[]): Entry[] {
  const out: Entry[] = [];
  const at = new Map<string, number>();
  for (const s of raw) {
    const e = parseEntry(s);
    if (!e) continue;
    const k = keyOf(e);
    const i = at.get(k);
    if (i === undefined) {
      at.set(k, out.length);
      out.push(e);
    } else {
      out[i] = e;
    }
  }
  return out;
}

/* 保存する並び。新しい回から、回のなかでは新しく書かれたものから。
   1件も落とさない（並べ替えるだけ）。
   並べておくのは、共有の中身を直に覗いたときに読み取れるようにするため。 */
function orderAll(list: Entry[]): Entry[] {
  return [...list].sort((x, y) => (x.d === y.d ? y.a - x.a : x.d < y.d ? 1 : -1));
}

/** その回のひとこと（返信でないもの）を、新しいものから順に取り出す。 */
function pick(list: Entry[], eventDate: string): Voice[] {
  return list
    .filter((e) => e.d === eventDate && !e.to)
    .sort((x, y) => y.a - x.a)
    .map((e) => ({ id: e.v || `${e.d}|${e.n}`, name: e.n, text: e.t, at: e.a }));
}

/** その回の返信を、古いものから順に取り出す（話の流れに沿って読めるように）。 */
function pickReplies(list: Entry[], eventDate: string): Reply[] {
  return list
    .filter((e) => e.d === eventDate && !!e.to && !!e.id)
    .sort((x, y) => x.a - y.a)
    .map((e) => ({
      id: e.id as string,
      to: e.to as string,
      toName: e.tn || "",
      name: e.n,
      text: e.t,
      at: e.a,
    }));
}

/** その回のひとことを読む（まだ無ければ空。読めなかったときも空で返す）。 */
export async function readVoices(eventDate: string): Promise<Voice[]> {
  return pick(decodeAll(await readSharedLenient(SHARED_ROW.voices)), eventDate);
}

/** その回のひとことと返信をまとめて読む。 */
export async function readVoiceBoard(eventDate: string): Promise<VoiceBoard> {
  const all = decodeAll(await readSharedLenient(SHARED_ROW.voices));
  return { voices: pick(all, eventDate), replies: pickReplies(all, eventDate) };
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

  // 何度やり直しても同じ結果になるよう、時刻と札はここで1回だけ決める
  const at = Date.now();
  const fresh = newReplyId();
  const raw = await writeSharedRow(SHARED_ROW.voices, (prev) => {
    const all = decodeAll(prev);
    /* 札は書き替えでは引き継ぎ、取り消してから書き直したときは新しくする。
       引き継がないと書き直すたびに返信が外れ、引き継ぎ続けると
       取り消して別の話を書いたときに前の返信がその下にぶら下がる。 */
    const before = all.find((e) => e.d === eventDate && e.n === who && !e.to);
    const vid = before?.v || fresh;
    // 自分のひとことだけを外してから書いたものを足す（返信は外さない）
    const rest = all.filter((e) => !(e.d === eventDate && e.n === who && !e.to));
    const next = body ? [...rest, { d: eventDate, n: who, t: body, a: at, v: vid }] : rest;
    return orderAll(next).map(encodeEntry);
  });
  return pick(decodeAll(raw), eventDate);
}

/**
 * ひとことへの返信を置く。
 * id を渡すとその返信を書き替え、渡さなければ新しく足す。
 * text を空にすると、その返信を取り消す（id が要る）。
 * 書き替え・取り消しができるのは、その返信を書いた名前のぶんだけ。
 */
export async function saveReply(
  eventDate: string,
  to: string,
  toName: string,
  name: string,
  text: string,
  id?: string
): Promise<VoiceBoard> {
  const whom = to.trim();
  const whomName = toName.trim();
  const who = name.trim();
  const body = text.trim().slice(0, VOICE_MAX);
  if (!DATE_ONLY.test(eventDate) || !who || !whom) return readVoiceBoard(eventDate);
  if (!body && !id) return readVoiceBoard(eventDate);

  // 札と時刻は、やり直しても変わらないようにここで1回だけ決める
  const rid = id || newReplyId();
  const at = Date.now();
  const raw = await writeSharedRow(SHARED_ROW.voices, (prev) => {
    const all = decodeAll(prev);
    // 書き替え・取り消しは、自分が書いたものだけ。人のぶんには触らない。
    const rest = all.filter((e) => !(e.id === rid && e.n === who));
    const next = body
      ? [...rest, { d: eventDate, n: who, t: body, a: at, to: whom, tn: whomName, id: rid }]
      : rest;
    return orderAll(next).map(encodeEntry);
  });
  const all = decodeAll(raw);
  return { voices: pick(all, eventDate), replies: pickReplies(all, eventDate) };
}

/** 一覧のなかから、その名前のぶんを探す（無ければ null）。 */
export function findVoice(list: Voice[], name: string): Voice | null {
  const who = name.trim();
  if (!who) return null;
  return list.find((v) => v.name === who) ?? null;
}

/**
 * ひとことと返信を突き合わせて、画面に出す形にする。
 *
 * 返信先のひとことが取り消されると、返信だけが宙に浮く。
 * 書いた人の言葉を黙って隠さないよう、そういうぶんは orphans にまとめて返す。
 * 2つの画面（ふりかえり・ギャラリー）で同じ扱いにしたいので、ここに置く。
 */
export function groupReplies(
  voices: Voice[],
  replies: Reply[]
): { under: (voiceId: string) => Reply[]; orphans: { name: string; replies: Reply[] }[] } {
  const alive = new Set(voices.map((v) => v.id));
  const under = (voiceId: string) => replies.filter((r) => r.to === voiceId);

  const lost = new Map<string, { name: string; replies: Reply[] }>();
  for (const r of replies) {
    if (alive.has(r.to)) continue;
    const g = lost.get(r.to);
    if (g) g.replies.push(r);
    else lost.set(r.to, { name: r.toName || "だれか", replies: [r] });
  }
  const orphans: { name: string; replies: Reply[] }[] = [];
  lost.forEach((g) => orphans.push(g));
  return { under, orphans };
}
