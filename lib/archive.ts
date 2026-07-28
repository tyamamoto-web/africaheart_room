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
    id: "2026-07-26",
    title: "アフリカハート カラオケオフ会",
    date: "2026年7月26日（日）",
    venue: "ジャパレン松本店",
    note: "参加12名（みや・めぐ・きい 欠席）。実部屋番号 A=215／B=220。コマ①②は3部屋(A/B/C)、コマ③〜⑤は2部屋(A/B)。",
    members: [
      { id: "1",  nickname: "よしのすけ", role: "leader" },
      { id: "2",  nickname: "くる",       role: "subleader" },
      { id: "3",  nickname: "しゃちょー", role: "regular" },
      { id: "4",  nickname: "Take",       role: "regular" },
      { id: "5",  nickname: "シュウ",     role: "regular" },
      { id: "6",  nickname: "ヒィ",       role: "regular" },
      { id: "7",  nickname: "青空",       role: "regular" },
      { id: "8",  nickname: "ハッシー",   role: "regular" },
      { id: "15", nickname: "なち",       role: "regular" },
      { id: "11", nickname: "すー",       role: "guest" },
      { id: "12", nickname: "じゅり",     role: "guest" },
      { id: "13", nickname: "リノ",       role: "guest" },
    ],
    timeSlots: [
      { id: "opening", startTime: "12:20", endTime: "12:30", type: "opening", label: "集合・スタート", detail: "12:20集合 ／ 12:30スタート\n退席：青空 15:00・ハッシー 16:00・すー 16:30・シュウ 18:00・ヒィ 18:00〜18:30・Take 19:00・よしのすけ（未確定）", color: "yellow" },
      { id: "koma1", startTime: "12:30", endTime: "14:00", type: "rotation", label: "コマ ①" },
      { id: "koma2", startTime: "14:00", endTime: "15:00", type: "rotation", label: "コマ ②" },
      { id: "homework", startTime: "15:00", endTime: "16:00", type: "all", label: "宿題タイム", detail: "全員で1部屋に集合して宿題タイム。", color: "rose" },
      { id: "duet", startTime: "16:00", endTime: "17:00", type: "all", label: "デュエットタイム", detail: "全員で1部屋に集合してデュエット。", color: "magenta" },
      { id: "koma3", startTime: "17:00", endTime: "18:00", type: "rotation", label: "コマ ③" },
      { id: "koma4", startTime: "18:00", endTime: "19:00", type: "rotation", label: "コマ ④" },
      { id: "koma5", startTime: "19:00", endTime: "20:00", type: "rotation", label: "コマ ⑤" },
    ],
    rotations: {
      koma1: { "3": "A", "6": "A", "11": "A", "12": "A", "1": "B", "2": "B", "8": "B", "13": "B", "4": "C", "5": "C", "7": "C", "15": "C" },
      koma2: { "1": "A", "3": "A", "7": "A", "11": "A", "5": "B", "6": "B", "13": "B", "15": "B", "2": "C", "4": "C", "8": "C", "12": "C" },
      koma3: { "3": "A", "4": "A", "6": "A", "13": "A", "15": "A", "1": "B", "2": "B", "5": "B", "12": "B" },
      koma4: { "1": "A", "2": "A", "6": "A", "15": "A", "3": "B", "4": "B", "12": "B", "13": "B" },
      koma5: { "1": "A", "12": "A", "15": "A", "2": "B", "3": "B", "13": "B" },
    },
  },
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
