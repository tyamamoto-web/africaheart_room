/* ============================================================
   アーカイブ（設定 ＞ アーカイブ）に出す、これまでのオフ会
   ------------------------------------------------------------
   回ごとに「タイムテーブル（時間｜部屋番号｜企画｜名前）」と「参加者」を持つ。
   表の形は当日の部屋割（lib/timetable.ts の TimetableRow）と同じにしてあるので、
   同じ表（app/components/PlanTable.tsx）でそのまま描ける。

   【元にしているもの】（名前をここに書き写さず、元から組み立てる）
     ・lib/archive.ts の archivedEvents … 6/27（松本）と 7/26（松本）の凍結コピー。
       コマの行は rotations（誰がどの部屋か）から部屋ごとに作り、
       全員で集まる枠（opening / all / end）は1行にして名前を空にする（＝「全員」）。
     ・lib/data.ts の karaokeRooms … 8/22（諏訪）の部屋割り表そのもの。
   このアプリで部屋割りを組んだのはこの3回で、それより前の回の記録は無い。

   【部屋番号】
     A・B の記号に、当日の実際の部屋番号が分かっている回は「A 215」のように添える。
       7/26 … A=215／B=220（lib/archive.ts の note より。C室の番号は記録が無い）
       8/22 … A=26／B=32（当日に共有した番号。lib/roomNumbers.ts の行は次の回で
              書き換わるので、ここに書き留めておく）
       6/27 … 記録が無いので記号だけ
     全員で集まる枠は A（広いほう。過去の表と同じ決め方）。

   次の回が終わったら、ここに1件足す（当日の部屋割 lib/timetable.ts の中身を
   その回の記録として写す。名前の書き方は当日の表のまま）。
   ============================================================ */

import { archivedEvents, type ArchivedEvent } from "./archive";
import { karaokeRooms } from "./data";
import type { TimetableRow } from "./timetable";

/** 1回ぶんの記録。key は開催日（"2026-08-22"）で、並び順と見出しに使う。 */
export type ArchiveEvent = {
  key: string;
  place: string;
  /** その回のひとこと（欠席・部屋の使い方など）。無ければ出さない。 */
  note?: string;
  rows: TimetableRow[];
  participants: string[];
};

type RoomKey = "A" | "B" | "C";
const ROOM_ORDER: RoomKey[] = ["A", "B", "C"];

/** 当日の実際の部屋番号（分かっている回だけ）。 */
const ROOM_NUMBERS: Record<string, Partial<Record<RoomKey, string>>> = {
  "2026-07-26": { A: "215", B: "220" },
  "2026-08-22": { A: "26", B: "32" },
};

/** 「A 215」のように、記号と番号を並べる。番号が無ければ記号だけ。 */
function roomLabel(eventKey: string, room: RoomKey): string {
  const n = ROOM_NUMBERS[eventKey]?.[room];
  return n ? `${room} ${n}` : room;
}

/** lib/archive.ts の凍結コピー（時間割＋誰がどの部屋か）を、4列の表の行にする。 */
function fromFrozen(ev: ArchivedEvent): ArchiveEvent {
  const rows: TimetableRow[] = [];
  for (const slot of ev.timeSlots) {
    const time = `${slot.startTime}〜${slot.endTime}`;
    if (slot.type === "rotation") {
      const assign = ev.rotations[slot.id] ?? {};
      for (const room of ROOM_ORDER) {
        // 名簿の並び順のまま、その部屋の人を拾う
        const names = ev.members.filter((m) => assign[m.id] === room).map((m) => m.nickname);
        if (names.length > 0) rows.push({ time, room: roomLabel(ev.id, room), title: slot.label, names });
      }
    } else {
      // 集合・宿題・デュエット・ラストソング・片付けは全員で1部屋
      rows.push({ time, room: roomLabel(ev.id, "A"), title: slot.label, names: [] });
    }
  }
  return {
    key: ev.id,
    place: ev.venue,
    note: ev.note,
    rows,
    participants: ev.members.map((m) => m.nickname),
  };
}

/** 8/22 諏訪。lib/data.ts の karaokeRooms（表そのもの）から。 */
const SUWA_KEY = "2026-08-22";
const suwa: ArchiveEvent = {
  key: SUWA_KEY,
  place: "JOYJOY 諏訪インター店",
  note: "夏の歌宴 完全燃焼 in 諏訪。カラオケは12:00〜17:40で、そのあと焼肉と花火。",
  participants: karaokeRooms.attendees,
  rows: karaokeRooms.slots.flatMap((s): TimetableRow[] =>
    s.rooms && s.rooms.length > 0
      ? s.rooms.map((r) => ({ time: s.time, room: roomLabel(SUWA_KEY, r.key), title: s.label, names: r.members }))
      : [{ time: s.time, room: roomLabel(SUWA_KEY, karaokeRooms.allRoom), title: s.label, names: [] }]
  ),
};

/** すべての回。新しいほうが先。 */
export const archiveEvents: ArchiveEvent[] = [suwa, ...archivedEvents.map(fromFrozen)].sort((a, b) =>
  a.key < b.key ? 1 : a.key > b.key ? -1 : 0
);
