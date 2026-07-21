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
// 女(F):2くる 7青空 10めぐ 11すー(G) 12じゅり(G) 13リノ(G)  ※G=ゲスト
// ※みや(旧id9)は2026-07-26 欠席となり除外（男女比 6M6F）。
//
// 退席/途中参加で各コマの在室者が変動：
//   青空15:00 ハッシー16:00 すー16:30 シュウ18:00 ヒィ18:00-18:30 Take19:00 退席／めぐ17:00参加。
// 午前は2コマ(コマ①12:30-14:00 / コマ②14:00-15:00)＝各3部屋(A/B/C・4/4/3名)、
// 夕方(17:00-20:00)は3コマ＝各2部屋(A/B)。宿題(15-16)・デュエット(16-17)は全員1部屋
// （青空/めぐ以外の全ペアはここで同席）。
//
// 3条件を同時達成するよう焼きなましで最適化（2026-07-26 みや欠席に伴い12名で再調整）：
//  ①同席カバレッジ最大化…会える63ペア中59ペアが同席。未同席4組は全て青空絡み
//    （青空は15時退席＝午前2コマ×最大3名で6名までしか会えない物理的下限。6/10名と同席）。
//    青空以外は全員が会える相手全員と同席、めぐも夕方8/8。
//  ②各部屋の男女比を均等…4名部屋は全室2M2F、3名部屋は2M1F/1M2F（全室に男女1名以上、
//    女性のみ/ゲストのみ部屋なし。部屋内|M-F|の最大は1で最適）。
//  ③ゲスト(すー/じゅり/リノ)のみの部屋を作らない。
export const defaultRotations: Record<string, Record<string, "A" | "B" | "C">> = {
  // コマ①(12:30-14:00) A:ヒィ・ハッシー・すー・リノ  B:よしのすけ・くる・Take・青空  C:しゃちょー・シュウ・じゅり
  koma1: {
    "6": "A", "8": "A", "11": "A", "13": "A",
    "1": "B", "2": "B", "4": "B", "7": "B",
    "3": "C", "5": "C", "12": "C",
  },
  // コマ②(14:00-15:00) A:シュウ・ヒィ・青空・リノ  B:くる・Take・ハッシー・じゅり  C:よしのすけ・しゃちょー・すー
  koma2: {
    "5": "A", "6": "A", "7": "A", "13": "A",
    "2": "B", "4": "B", "8": "B", "12": "B",
    "1": "C", "3": "C", "11": "C",
  },
  // コマ③(17:00-18:00) A:しゃちょー・Take・シュウ・めぐ・リノ  B:よしのすけ・くる・ヒィ・じゅり
  koma3: {
    "3": "A", "4": "A", "5": "A", "10": "A", "13": "A",
    "1": "B", "2": "B", "6": "B", "12": "B",
  },
  // コマ④(18:00-19:00) A:よしのすけ・Take・じゅり・リノ  B:くる・しゃちょー・ヒィ・めぐ
  koma4: {
    "1": "A", "4": "A", "12": "A", "13": "A",
    "2": "B", "3": "B", "6": "B", "10": "B",
  },
  // コマ⑤(19:00-20:00) A:くる・しゃちょー・リノ  B:よしのすけ・めぐ・じゅり
  koma5: {
    "2": "A", "3": "A", "13": "A",
    "1": "B", "10": "B", "12": "B",
  },
};
