export type MemberRole = "leader" | "subleader" | "regular" | "guest";

export type Member = {
  id: string;
  nickname: string;
  role: MemberRole;
};

export type SlotType = "opening" | "rotation" | "all" | "end";
export type SlotColor = "yellow" | "pink" | "blue" | "green" | "orange";

export type TimeSlot = {
  id: string;
  startTime: string;
  endTime: string;
  type: SlotType;
  label: string;
  detail?: string;
  color?: SlotColor;
};

export const eventInfo = {
  title: "アフリカハート",
  subtitle: "社会人カラオケオフ会",
  date: "2026年6月27日（土）",
  startTime: "12:50",
  venue: "ジャパレン松本店",
};

export const defaultMembers: Member[] = [
  { id: "1", nickname: "よし",       role: "leader" },
  { id: "2", nickname: "くる",       role: "subleader" },
  { id: "3", nickname: "しゃちょー", role: "regular" },
  { id: "4", nickname: "たけ",       role: "regular" },
  { id: "5", nickname: "シュウ",     role: "regular" },
  { id: "6", nickname: "ハッシー",   role: "regular" },
  { id: "7", nickname: "青空",       role: "regular" },
  { id: "8", nickname: "yurino",     role: "guest" },
  { id: "9", nickname: "じゅり",     role: "guest" },
];

export const timeSlots: TimeSlot[] = [
  {
    id: "opening",
    startTime: "12:30",
    endTime: "12:50",
    type: "opening",
    label: "ご飯・トイレ・自己紹介 🎤",
    detail: "Aルームに全員集合してスタート！",
    color: "yellow",
  },
  { id: "koma1", startTime: "12:50", endTime: "13:50", type: "rotation", label: "コマ ①" },
  { id: "koma2", startTime: "14:00", endTime: "15:00", type: "rotation", label: "コマ ②" },
  {
    id: "homework",
    startTime: "15:10",
    endTime: "16:10",
    type: "all",
    label: "宿題タイム 📝",
    detail: "Aルームに全員集合 ／ 青空 退場・じゅり 入場（16時〜）",
    color: "green",
  },
  {
    id: "duet",
    startTime: "16:20",
    endTime: "17:20",
    type: "all",
    label: "デュエットタイム 🎵",
    detail: "Aルームに全員集合してデュエット♪",
    color: "pink",
  },
  { id: "koma3", startTime: "17:30", endTime: "18:30", type: "rotation", label: "コマ ③" },
  { id: "koma4", startTime: "18:40", endTime: "19:40", type: "rotation", label: "コマ ④" },
  {
    id: "lastsong",
    startTime: "19:40",
    endTime: "19:55",
    type: "all",
    label: "挨拶・ラストソング 🎤",
    detail: "Aルームに全員で最後の一曲",
    color: "orange",
  },
  {
    id: "cleanup",
    startTime: "19:55",
    endTime: "20:00",
    type: "end",
    label: "片付け 🧹",
    detail: "忘れ物のないよう確認お願いします",
  },
];

// デフォルトの部屋割り（メンバーID → 部屋）
// 1:よし 2:くる 3:しゃちょー 4:たけ 5:シュウ 6:ハッシー(欠席) 7:青空 8:yurino 9:じゅり
// ハッシー欠席で各コマ7名・2部屋(4/3)。同席被りを最小化（最大2回・3回以上ゼロ）
export const defaultRotations: Record<string, Record<string, "A" | "B" | "C">> = {
  // コマ1  A:しゃちょー・たけ・シュウ・青空  B:よし・くる・yurino
  koma1: {
    "3": "A", "4": "A", "5": "A", "7": "A",
    "1": "B", "2": "B", "8": "B",
  },
  // コマ2  A:よし・シュウ・青空・yurino  B:くる・しゃちょー・たけ
  koma2: {
    "1": "A", "5": "A", "7": "A", "8": "A",
    "2": "B", "3": "B", "4": "B",
  },
  // コマ3  A:よし・くる・たけ・シュウ  B:しゃちょー・yurino・じゅり
  koma3: {
    "1": "A", "2": "A", "4": "A", "5": "A",
    "3": "B", "8": "B", "9": "B",
  },
  // コマ4  A:くる・しゃちょー・シュウ・yurino  B:よし・たけ・じゅり
  koma4: {
    "2": "A", "3": "A", "5": "A", "8": "A",
    "1": "B", "4": "B", "9": "B",
  },
};
