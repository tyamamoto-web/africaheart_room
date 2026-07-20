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
  startTime: "12:20", // 集合
  openTime: "12:30",  // スタート
  endTime: "20:00",   // 終了
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
  { id: "koma1", startTime: "12:30", endTime: "14:00", type: "rotation", label: "コマ ①" },
  { id: "koma2", startTime: "14:00", endTime: "15:00", type: "rotation", label: "コマ ②" },
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
  { id: "koma3", startTime: "17:00", endTime: "18:00", type: "rotation", label: "コマ ③" },
  { id: "koma4", startTime: "18:00", endTime: "19:00", type: "rotation", label: "コマ ④" },
  { id: "koma5", startTime: "19:00", endTime: "20:00", type: "rotation", label: "コマ ⑤" },
];

// デフォルトの部屋割り（メンバーID → 部屋）
// 男(M):1よしのすけ 3しゃちょー 4Take 5シュウ 6ヒィ 8ハッシー
// 女(F):2くる 7青空 9みや 10めぐ 11すー(G) 12じゅり(G) 13リノ(G)  ※G=ゲスト
//
// 退席/途中参加で各コマの在室者が変動：
//   青空15:00 ハッシー16:00 すー16:30 シュウ18:00 ヒィ18:00-18:30 Take19:00 退席／めぐ17:00参加。
// 午前は2コマ(コマ①12:30-14:00 / コマ②14:00-15:00)＝各3部屋(A/B/C・各4名)、
// 夕方(17:00-20:00)は3コマ＝各2部屋(A/B)。宿題(15-16)・デュエット(16-17)は全員1部屋
// （青空/めぐ以外の全ペアはここで同席）。
//
// 3条件を同時達成するよう焼きなましで最適化（2026-07-20 午前統合に伴い再調整）：
//  ①同席カバレッジ最大化…会える75ペア中70ペアが同席。未同席5組は全て青空絡み
//    （青空は15時退席＝午前2コマ×4名で最大6名までしか会えない物理的下限。6/11名と同席）。
//    青空以外は全員が会える相手全員と同席、めぐも9/9。
//  ②各部屋の男女比を均等…午前は全室2M2F。夕方も在室比の範囲で最大限均等（全室に男性1名以上、
//    女性のみ/ゲストのみ部屋なし）。
//  ③ゲスト(すー/じゅり/リノ)のみの部屋を作らない。
export const defaultRotations: Record<string, Record<string, "A" | "B" | "C">> = {
  // コマ①(12:30-14:00) A:しゃちょー・ヒィ・すー・じゅり  B:よしのすけ・Take・青空・リノ  C:ハッシー・シュウ・みや・くる
  koma1: {
    "3": "A", "6": "A", "11": "A", "12": "A",
    "1": "B", "4": "B", "7": "B", "13": "B",
    "8": "C", "5": "C", "9": "C", "2": "C",
  },
  // コマ②(14:00-15:00) A:よしのすけ・ヒィ・みや・すー  B:シュウ・しゃちょー・青空・くる  C:ハッシー・Take・じゅり・リノ
  koma2: {
    "1": "A", "6": "A", "9": "A", "11": "A",
    "5": "B", "3": "B", "7": "B", "2": "B",
    "8": "C", "4": "C", "12": "C", "13": "C",
  },
  // コマ③(17:00-18:00) A:Take・シュウ・みや・めぐ・しゃちょー  B:ヒィ・じゅり・よしのすけ・リノ・くる
  koma3: {
    "4": "A", "5": "A", "9": "A", "10": "A", "3": "A",
    "6": "B", "12": "B", "1": "B", "13": "B", "2": "B",
  },
  // コマ④(18:00-19:00) A:ヒィ・しゃちょー・めぐ・リノ・くる  B:Take・よしのすけ・じゅり・みや
  koma4: {
    "6": "A", "3": "A", "10": "A", "13": "A", "2": "A",
    "4": "B", "1": "B", "12": "B", "9": "B",
  },
  // コマ⑤(19:00-20:00) A:よしのすけ・くる・めぐ・じゅり  B:しゃちょー・みや・リノ
  koma5: {
    "1": "A", "2": "A", "10": "A", "12": "A",
    "3": "B", "9": "B", "13": "B",
  },
};
