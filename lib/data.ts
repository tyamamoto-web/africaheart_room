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
  subtitle: "カラオケオフ会",
  date: "2026年7月26日（日）",
  startTime: "12:20",
  venue: "ジャパレン松本店",
};

export const defaultMembers: Member[] = [
  { id: "1",  nickname: "よしのすけ", role: "leader" },
  { id: "2",  nickname: "くる",       role: "subleader" },
  { id: "3",  nickname: "しゃちょー", role: "regular" },
  { id: "4",  nickname: "Take",       role: "regular" },
  { id: "5",  nickname: "シュウ",     role: "regular" },
  { id: "6",  nickname: "ヒィ",       role: "regular" },
  { id: "7",  nickname: "青空",       role: "regular" },
  { id: "8",  nickname: "ハッシー",   role: "regular" },
  { id: "9",  nickname: "みや",       role: "regular" },
  { id: "10", nickname: "めぐ",       role: "regular" },
  { id: "11", nickname: "すー",       role: "guest" },
  { id: "12", nickname: "じゅり",     role: "guest" },
  { id: "13", nickname: "リノ",       role: "guest" },
];

export const timeSlots: TimeSlot[] = [
  {
    id: "opening",
    startTime: "12:20",
    endTime: "12:30",
    type: "opening",
    label: "集合・スタート",
    detail:
      "12:20集合 ／ 12:30スタート\n【途中参加】めぐ（17:00〜）\n【退席】青空 15:00 ／ ハッシー 16:00 ／ すー 16:30 ／ シュウ 18:00 ／ ヒィ 18:00〜18:30 ／ Take 19:00",
    color: "yellow",
  },
  { id: "koma1", startTime: "12:30", endTime: "13:00", type: "rotation", label: "コマ ①" },
  { id: "koma2", startTime: "13:00", endTime: "14:00", type: "rotation", label: "コマ ②" },
  { id: "koma3", startTime: "14:00", endTime: "15:00", type: "rotation", label: "コマ ③" },
  {
    id: "homework",
    startTime: "15:00",
    endTime: "16:00",
    type: "all",
    label: "宿題タイム",
    detail: "全員で1部屋に集合して宿題タイム。",
    color: "green",
  },
  {
    id: "duet",
    startTime: "16:00",
    endTime: "17:00",
    type: "all",
    label: "デュエットタイム",
    detail: "全員で1部屋に集合してデュエット。",
    color: "pink",
  },
  { id: "koma4", startTime: "17:00", endTime: "18:00", type: "rotation", label: "コマ ④" },
  { id: "koma5", startTime: "18:00", endTime: "19:00", type: "rotation", label: "コマ ⑤" },
  { id: "koma6", startTime: "19:00", endTime: "20:00", type: "rotation", label: "コマ ⑥" },
];

// デフォルトの部屋割り（メンバーID → 部屋）
// 1:よしのすけ 2:くる 3:しゃちょー 4:Take 5:シュウ 6:ヒィ 7:青空 8:ハッシー
// 9:みや 10:めぐ 11:すー(ゲスト) 12:じゅり(ゲスト) 13:リノ(ゲスト)
//
// 退席/途中参加で各コマの在室者が変動：
//   青空15:00 ハッシー16:00 すー16:30 シュウ18:00 ヒィ18:00-18:30 Take19:00 退席／めぐ17:00参加。
// 午前(12:30-15:00)は3部屋(A/B/C・各4名)、夕方(17:00-20:00)は2部屋(A/B)。
// 宿題(15-16)・デュエット(16-17)は全員1部屋のため部屋割りなし。
// 焼きなましで同席被りを最小化：最大同席3回／どのペアも3コマ連続同室なし。
export const defaultRotations: Record<string, Record<string, "A" | "B" | "C">> = {
  // コマ1  A:じゅり・ヒィ・みや・青空  B:くる・よしのすけ・Take・ハッシー  C:すー・しゃちょー・リノ・シュウ
  koma1: {
    "12": "A", "6": "A", "9": "A", "7": "A",
    "2": "B", "1": "B", "4": "B", "8": "B",
    "11": "C", "3": "C", "13": "C", "5": "C",
  },
  // コマ2  A:じゅり・すー・よしのすけ・ヒィ  B:リノ・シュウ・Take・みや  C:くる・青空・しゃちょー・ハッシー
  koma2: {
    "12": "A", "11": "A", "1": "A", "6": "A",
    "13": "B", "5": "B", "4": "B", "9": "B",
    "2": "C", "7": "C", "3": "C", "8": "C",
  },
  // コマ3  A:みや・すー・Take・くる  B:ヒィ・ハッシー・リノ・しゃちょー  C:シュウ・じゅり・よしのすけ・青空
  koma3: {
    "9": "A", "11": "A", "4": "A", "2": "A",
    "6": "B", "8": "B", "13": "B", "3": "B",
    "5": "C", "12": "C", "1": "C", "7": "C",
  },
  // コマ4  A:じゅり・Take・よしのすけ・しゃちょー・リノ  B:みや・ヒィ・めぐ・シュウ・くる
  koma4: {
    "12": "A", "4": "A", "1": "A", "3": "A", "13": "A",
    "9": "B", "6": "B", "10": "B", "5": "B", "2": "B",
  },
  // コマ5  A:みや・Take・しゃちょー・じゅり・めぐ  B:くる・ヒィ・リノ・よしのすけ
  koma5: {
    "9": "A", "4": "A", "3": "A", "12": "A", "10": "A",
    "2": "B", "6": "B", "13": "B", "1": "B",
  },
  // コマ6  A:リノ・めぐ・じゅり・くる  B:よしのすけ・みや・しゃちょー
  koma6: {
    "13": "A", "10": "A", "12": "A", "2": "A",
    "1": "B", "9": "B", "3": "B",
  },
};
