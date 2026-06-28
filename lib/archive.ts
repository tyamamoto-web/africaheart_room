import type { Member, TimeSlot } from "./data";

/* ============================================================
   過去オフ会のアーカイブ
   ------------------------------------------------------------
   新しい会を追加するには archivedEvents 配列の先頭に1件追加します。
   （members / timeSlots / rotations は、その会の確定内容をそのまま貼り付け）
   ※ 現行イベント(lib/data.ts)とは独立した「凍結コピー」です。
   ============================================================ */

export type ArchivedEvent = {
  id: string;
  title: string;
  date: string;
  venue: string;
  note?: string;
  members: Member[];
  timeSlots: TimeSlot[];
  rotations: Record<string, Record<string, "A" | "B" | "C">>;
};

export const archivedEvents: ArchivedEvent[] = [
  {
    id: "2026-06-27",
    title: "アフリカハート カラオケオフ会",
    date: "2026年6月27日（土）",
    venue: "ジャパレン松本店",
    note: "参加8名（ハッシー・青空 欠席／なち 参加・じゅり 16時〜）。2部屋ローテーション。",
    members: [
      { id: "1", nickname: "よし", role: "leader" },
      { id: "2", nickname: "くる", role: "subleader" },
      { id: "3", nickname: "しゃちょー", role: "regular" },
      { id: "4", nickname: "たけ", role: "regular" },
      { id: "5", nickname: "シュウ", role: "regular" },
      { id: "8", nickname: "yurino", role: "guest" },
      { id: "9", nickname: "じゅり", role: "guest" },
      { id: "10", nickname: "なち", role: "regular" },
    ],
    timeSlots: [
      { id: "opening", startTime: "12:30", endTime: "12:50", type: "opening", label: "ご飯・トイレ・自己紹介", detail: "Aルームに全員集合してスタート！", color: "yellow" },
      { id: "koma1", startTime: "12:50", endTime: "13:50", type: "rotation", label: "コマ ①" },
      { id: "koma2", startTime: "14:00", endTime: "15:00", type: "rotation", label: "コマ ②" },
      { id: "homework", startTime: "15:10", endTime: "16:10", type: "all", label: "宿題タイム", detail: "お題：①梅雨・雨の日に聞きたい/歌いたい曲 ②しっとりした曲 ③初夏のドライブで聞きたい曲 ④梅雨を吹き飛ばそう！気分が晴れる最強ソング ─ いずれかから1曲\nAルームに全員集合 ／ じゅり 入場（16時〜）", color: "green" },
      { id: "duet", startTime: "16:20", endTime: "17:20", type: "all", label: "デュエットタイム", detail: "Aルームに全員集合してデュエット", color: "pink" },
      { id: "koma3", startTime: "17:30", endTime: "18:30", type: "rotation", label: "コマ ③" },
      { id: "koma4", startTime: "18:40", endTime: "19:40", type: "rotation", label: "コマ ④" },
      { id: "lastsong", startTime: "19:40", endTime: "19:55", type: "all", label: "挨拶・ラストソング", detail: "Aルームに全員で最後の一曲", color: "orange" },
      { id: "cleanup", startTime: "19:55", endTime: "20:00", type: "end", label: "片付け", detail: "忘れ物のないよう確認お願いします" },
    ],
    rotations: {
      koma1: { "4": "A", "5": "A", "8": "A", "10": "A", "1": "B", "2": "B", "3": "B" },
      koma2: { "1": "A", "3": "A", "5": "A", "8": "A", "2": "B", "4": "B", "10": "B" },
      koma3: { "3": "A", "8": "A", "9": "A", "10": "A", "1": "B", "2": "B", "4": "B", "5": "B" },
      koma4: { "3": "A", "4": "A", "5": "A", "9": "A", "1": "B", "2": "B", "8": "B", "10": "B" },
    },
  },
];
