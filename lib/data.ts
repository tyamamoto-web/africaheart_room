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
  startTime: "12:30",
  venue: "ジャパレン松本店",
};

export const defaultMembers: Member[] = [
  { id: "1",  nickname: "よしの助",     role: "leader" },
  { id: "2",  nickname: "しゃちょー",   role: "subleader" },
  { id: "3",  nickname: "くる",         role: "subleader" },
  { id: "4",  nickname: "Take",         role: "regular" },
  { id: "5",  nickname: "きい",         role: "regular" },
  { id: "6",  nickname: "あきな",       role: "regular" },
  { id: "7",  nickname: "あんちゃん",   role: "regular" },
  { id: "8",  nickname: "いとっちゃん", role: "regular" },
  { id: "9",  nickname: "なち",         role: "regular" },
  { id: "10", nickname: "ひとみ",       role: "regular" },
  { id: "11", nickname: "まっきー",     role: "regular" },
  { id: "12", nickname: "みや",         role: "regular" },
  { id: "13", nickname: "めぐみ",       role: "regular" },
  { id: "14", nickname: "シュウ",       role: "regular" },
  { id: "15", nickname: "ノリ",         role: "regular" },
  { id: "16", nickname: "ハッシー",     role: "regular" },
  { id: "17", nickname: "ヒィ",         role: "regular" },
  { id: "18", nickname: "次元",         role: "regular" },
  { id: "19", nickname: "青空",         role: "regular" },
];

export const timeSlots: TimeSlot[] = [
  {
    id: "opening",
    startTime: "12:30",
    endTime: "13:20",
    type: "opening",
    label: "オフ会スタート！",
    detail: "Aルームでまずは自己紹介と一曲 🎤",
    color: "yellow",
  },
  { id: "rot1", startTime: "13:30", endTime: "14:20", type: "rotation", label: "ローテーション ①" },
  { id: "rot2", startTime: "14:30", endTime: "15:20", type: "rotation", label: "ローテーション ②" },
  { id: "rot3", startTime: "15:30", endTime: "16:20", type: "rotation", label: "ローテーション ③" },
  { id: "rot4", startTime: "16:30", endTime: "17:20", type: "rotation", label: "ローテーション ④" },
  {
    id: "game",
    startTime: "17:30",
    endTime: "18:20",
    type: "all",
    label: "Aルームでゲームコーナー！ 🎮",
    detail: "一人一曲お題に沿って歌ってもらいます。一人用の特別なお題も♡",
    color: "blue",
  },
  {
    id: "duet",
    startTime: "18:30",
    endTime: "19:50",
    type: "all",
    label: "デュエット TIME！！ 🎵",
    detail: "最後に「世界に一つだけの花」を皆で歌いましょう",
    color: "pink",
  },
  {
    id: "cleanup",
    startTime: "19:50",
    endTime: "20:00",
    type: "end",
    label: "片付け 🧹",
    detail: "忘れ物のないよう確認お願いします",
  },
];

// デフォルトの部屋割り（メンバーID → 部屋）
export const defaultRotations: Record<string, Record<string, "A" | "B" | "C">> = {
  rot1: {
    "1":"A","13":"A","17":"A","6":"A","10":"A","11":"A","19":"A",
    "2":"B","5":"B","4":"B","16":"B","15":"B","14":"B",
    "3":"C","12":"C","7":"C","8":"C","9":"C","18":"C",
  },
  rot2: {
    "1":"A","3":"A","5":"A","16":"A","9":"A","18":"A","11":"A",
    "2":"B","12":"B","7":"B","17":"B","10":"B","19":"B",
    "4":"C","13":"C","15":"C","6":"C","8":"C","14":"C",
  },
  rot3: {
    "1":"A","2":"A","15":"A","6":"A","8":"A","14":"A",
    "4":"B","12":"B","17":"B","16":"B","9":"B","11":"B",
    "3":"C","5":"C","13":"C","7":"C","10":"C","18":"C","19":"C",
  },
  rot4: {
    "1":"A","4":"A","17":"A","8":"A","10":"A","14":"A","19":"A",
    "2":"B","16":"B","3":"B","7":"B","18":"B","11":"B",
    "5":"C","13":"C","12":"C","15":"C","6":"C","9":"C",
  },
};
