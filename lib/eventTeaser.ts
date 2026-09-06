"use client";

/* ============================================================
   翌月のオフ会の予告（会員の画面「準備」に出す一行）
   ------------------------------------------------------------
   いま準備している回の、その次の回のお知らせ。
   日にちと名前だけを先に出して、「次はこれがある」と分かるようにする。

   【書き換えるのはここだけ】
     下の eventTeaser を書き換える。出したくないときは null にする。
     日にちは "2026-10-31" の形で（曜日は画面のほうで数える）。

   【いつまで出るか】
     いま準備している回より後で、まだ来ていない日のあいだだけ出る（showTeaser）。
     その回が来てしまえば、ひとりでに消える。消し忘れて古い予告が
     残ることがないようにするため。

   【なぜ Supabase ではないのか】
     開催の概要（lib/eventOverview.ts）は役員が画面から書き換えるが、
     予告はまだ日にちと名前しか決まっていない下書きなので、ここに置いてある。
     画面から書き換えたくなったら、共有の置き場所（lib/sharedRow.ts に行を足す）へ移す。
   ============================================================ */

import { daysBetween, isoYmd, type Ymd } from "./eventOverview";

export type EventTeaser = {
  /** "2026-10-31" */
  date: string;
  /** 会の名前。例「ハロウィンイベント」 */
  title: string;
};

/** いま出している予告。出さないときは null。 */
export const eventTeaser: EventTeaser | null = {
  date: "2026-10-31",
  title: "ハロウィンイベント",
};

/**
 * この予告をいま出してよいか。
 * ・いま準備している回（currentIso）より後の日であること
 * ・今日より後の日であること（当日と過ぎたぶんは出さない）
 * currentIso が空（開催日がまだ入っていない）のときは、日にちの先後だけで決める。
 */
export function showTeaser(t: EventTeaser | null, currentIso: string, today: Ymd): boolean {
  if (!t) return false;
  const teaser = isoYmd(t.date);
  if (!teaser) return false;
  if (daysBetween(today, teaser) <= 0) return false; // 今日か、過ぎている
  const current = isoYmd(currentIso);
  if (current && daysBetween(current, teaser) <= 0) return false; // 今回より前か同じ日
  return true;
}
