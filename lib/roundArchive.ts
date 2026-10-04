"use client";

/* ============================================================
   終わった回の記録（部屋割り・概要・参加者）
   ------------------------------------------------------------
   当日の部屋割り（lib/timetable.ts）と開催の概要（lib/eventOverview.ts）は、
   どちらも回ごとに分けず、同じ1か所を毎回書き換えて使っている。
   毎回ほぼ同じ骨組みになるので前の回を下敷きにして打てるほうが早い、という
   決め方なのだが、そのぶん次の回の準備を始めた時点で前の回の中身は消える。
   実際、当日お店で聞いた部屋番号や、どのコマで誰がどちらの部屋にいたかは、
   そこにしか残っていない。

   消える前に、回ごとの記録としてここへ写す。
   写したものは、終わったあとも誰でも見られる（設定 ＞ アーカイブ）。

   ★ なぜリポジトリに書かないか
     6/27・7/26・8/22 の3回は lib/archive.ts と lib/data.ts に直接書いてある。
     ただ、このリポジトリは公開していて、いまの名簿にはここに書けない呼び名がある。
     だからこれから先の回は、呼び名を含む記録は Supabase にだけ置き、
     画面に出すときに読む（lib/eventArchive.ts で過去3回のぶんと合わせて並べる）。

   ★ SQL不要（新しいテーブルを作らない）:
     共有テーブル homework_result の id=15 を間借りする（lib/sharedRow.ts）。
     行がまだ無ければ、初めての保存で作られる（writeSharedRow の insertRow）。
     空いて見える id=7・8 は使わない。lib/eventRaci.ts と lib/eventCheck.ts が
     その番号を直書きで持っていて、どちらにも「すべて消す」経路がある。

   しまい方（themes: text[] の中）:
     1要素が1回ぶん。中身は JSON ひとつ。
       k  開催日（"2026-09-26"）。この回の鍵。同じ鍵のものは置き換える
       p  場所（アーカイブの見出しに出す。住所を含めてよい）
       n  補足（人数・退席の時刻など。空でよい）
       s  開始時刻 "11:00" ／ e  終了時刻 "19:00"
       r  部屋数 ／ f  会費（どちらも文字。入っていなければ空）
       t  部屋割りの行。lib/timetable.ts と同じ並び
          [時間, 部屋, 企画, 名前の配列, 部屋番号]
       m  参加した人（出欠で「参加」と出した人）
       a  書いた時刻(ms)
     1回ぶんは2キロバイト前後。1行の上限は400キロバイト（SHARED_MAX_BYTES）なので、
     毎月1回ずつ足しても200回ぶんは入る。
   ============================================================ */

import { SHARED_ROW, readSharedLenient, readSharedStrict, writeSharedRow } from "./sharedRow";
import type { TimetableRow } from "./timetable";

/** 1回ぶんの記録。 */
export type RoundRecord = {
  key: string; // "2026-09-26"
  place: string;
  note: string;
  start: string; // "11:00"
  end: string; // "19:00"
  rooms: string; // "2"
  fee: string; // "1380"
  rows: TimetableRow[];
  participants: string[];
  at: number; // 書いた時刻(ms)
};

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

function text(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function toStrings(v: unknown): string[] {
  return Array.isArray(v)
    ? v.filter((x): x is string => typeof x === "string" && x.trim() !== "")
    : [];
}

function toRow(v: unknown): TimetableRow | null {
  if (!Array.isArray(v)) return null;
  const [time, room, title, names, roomNo] = v as unknown[];
  return {
    time: text(time),
    room: text(room),
    title: text(title),
    names: toStrings(names),
    roomNo: text(roomNo),
  };
}

function parseOne(s: unknown): RoundRecord | null {
  if (typeof s !== "string") return null;
  let o: unknown;
  try {
    o = JSON.parse(s);
  } catch {
    return null;
  }
  if (!o || typeof o !== "object") return null;
  const r = o as Record<string, unknown>;
  const key = text(r.k);
  if (!DATE_ONLY.test(key)) return null;
  const rows = Array.isArray(r.t)
    ? (r.t as unknown[]).map(toRow).filter((x): x is TimetableRow => x !== null)
    : [];
  return {
    key,
    place: text(r.p),
    note: text(r.n),
    start: text(r.s),
    end: text(r.e),
    rooms: text(r.r),
    fee: text(r.f),
    rows,
    participants: toStrings(r.m),
    at: typeof r.a === "number" && Number.isFinite(r.a) ? r.a : 0,
  };
}

function encodeOne(rec: RoundRecord): string {
  return JSON.stringify({
    k: rec.key,
    p: rec.place,
    n: rec.note,
    s: rec.start,
    e: rec.end,
    r: rec.rooms,
    f: rec.fee,
    // 部屋番号が空の行は4つのままにして、lib/timetable.ts の書き方とそろえる
    t: rec.rows.map((x) =>
      (x.roomNo ?? "") === ""
        ? [x.time, x.room, x.title, x.names]
        : [x.time, x.room, x.title, x.names, x.roomNo]
    ),
    m: rec.participants,
    a: rec.at,
  });
}

/** 新しい回が先。 */
function order(list: RoundRecord[]): RoundRecord[] {
  return [...list].sort((a, b) => (a.key < b.key ? 1 : a.key > b.key ? -1 : 0));
}

function decodeAll(raw: string[]): RoundRecord[] {
  const out: RoundRecord[] = [];
  for (const s of raw) {
    const rec = parseOne(s);
    if (!rec) continue;
    // 同じ回が2件あれば、あとのほうを採る
    const at = out.findIndex((x) => x.key === rec.key);
    if (at >= 0) out[at] = rec;
    else out.push(rec);
  }
  return order(out);
}

/** 記録を全部読む（新しい回が先）。読めなくても例外は投げず、空で返す。 */
export async function readRoundArchive(): Promise<RoundRecord[]> {
  return decodeAll(await readSharedLenient(SHARED_ROW.roundArchive));
}

/**
 * 1回ぶんを記録に残す。同じ開催日のものがあれば置き換える（何度押しても増えない）。
 * ほかの回のぶんは必ず持ち越す。
 */
export async function saveRoundRecord(rec: RoundRecord): Promise<RoundRecord[]> {
  if (!DATE_ONLY.test(rec.key)) throw new Error("開催日が読めません");
  const raw = await writeSharedRow(SHARED_ROW.roundArchive, (prev) => {
    const rest = decodeAll(prev).filter((x) => x.key !== rec.key);
    return order([...rest, rec]).map(encodeOne);
  });
  return decodeAll(raw);
}

/**
 * リポジトリに凍結してある回（lib/archive.ts と lib/data.ts）。
 * ここへ自動で書くと、アーカイブの画面でリポジトリのぶんを押しのけてしまうので、
 * 開催日を打ち間違えてこの日になったときのために除いておく。
 * lib/eventArchive.ts から引くと import が循環するので、鍵だけを写してある。
 */
const FROZEN_KEYS = ["2026-08-22", "2026-07-26", "2026-06-27"];

/**
 * 開催日を次の回に進める直前に、いまの回を記録へ写す。
 *
 * 当日の部屋割り（lib/timetable.ts）は回ごとに分かれていないので、
 * 次の回の準備で書き換えると前の回の中身は消える。役員が「記録に残す」を
 * 押し忘れても消えないよう、開催日を書き換える操作にこれを挟む。
 *
 * 写すのは、次がすべてそろったときだけ。
 *   ・前の開催日が今日か、もう過ぎていること（まだ先の日を、前の回の表で埋めない）
 *   ・リポジトリに凍結してある回でないこと
 *   ・いまある記録を読めて、その回の記録がまだ無いこと
 *     （読めなかったのを「無い」と取り違えると、あとから直した記録を潰してしまう）
 *   ・部屋割りが1行でもあること
 *   ・その日の出欠に1人でもいること（打ち間違えた日付で、幻の回を作らないため）
 * 写したら true。何もしなければ false。失敗しても例外は投げない
 * （概要の保存そのものを止めないため。記録はあとからでも残せる）。
 */
export async function archiveBeforeRollover(
  prev: { date: string; start: string; end: string; place: string; rooms: string; fee: string },
  today: string,
  readRows: () => Promise<TimetableRow[]>,
  readGoing: (key: string) => Promise<string[]>
): Promise<boolean> {
  try {
    if (!DATE_ONLY.test(prev.date) || prev.date > today) return false;
    if (FROZEN_KEYS.includes(prev.date)) return false;
    // ここだけは、読めなかったら書かない（readRoundArchive は読めなくても空を返すため）
    const already = decodeAll(await readSharedStrict(SHARED_ROW.roundArchive));
    if (already.some((r) => r.key === prev.date)) return false;
    const rows = await readRows();
    if (rows.length === 0) return false;
    const participants = await readGoing(prev.date);
    if (participants.length === 0) return false;
    await saveRoundRecord({
      key: prev.date,
      place: prev.place,
      note: "",
      start: prev.start,
      end: prev.end,
      rooms: prev.rooms,
      fee: prev.fee,
      rows,
      participants,
      at: Date.now(),
    });
    return true;
  } catch {
    return false;
  }
}

/** 部屋割りの行から、名前の出てくる順に参加者を作る（同じ名前はひとつに）。 */
export function namesInRows(rows: TimetableRow[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const r of rows) {
    for (const n of r.names) {
      if (seen.has(n)) continue;
      seen.add(n);
      out.push(n);
    }
  }
  return out;
}
