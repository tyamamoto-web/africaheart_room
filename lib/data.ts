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
      "12:20集合 ／ 12:30スタート\n【退席】青空 15:00 ／ ハッシー 16:00 ／ すー 16:30 ／ シュウ 18:00 ／ ヒィ 18:00〜18:30 ／ Take 19:00",
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
// 女(F):2くる 7青空 11すー(G) 12じゅり(G) 13リノ(G)  ※G=ゲスト
// ※みや(旧id9)・めぐ(旧id10)は2026-07-26 欠席となり除外（残り11名・男女比6M5F）。
//
// 退席で各コマの在室者が変動（途中参加者はなし）：
//   青空15:00 ハッシー16:00 すー16:30 シュウ18:00 ヒィ18:00-18:30 Take19:00 退席。
// 午前は2コマ(コマ①12:30-14:00 / コマ②14:00-15:00)＝各3部屋(A/B/C・4/4/3名)、
// 夕方(17:00-20:00)はコマ③④が2部屋(A/B・4/4→4/3)、コマ⑤(19-20)は残り5名を1部屋(A)に集約。
// 宿題(15-16)・デュエット(16-17)は全員1部屋（青空以外の全ペアはここで同席）。
//
// 3条件を同時達成するよう焼きなましで最適化（2026-07-26 みや・めぐ欠席に伴い11名で再調整。
// レビュー指摘でコマ①②③を再調整し同席の偏り＝じゅり×しゃちょーを分離）：
//  ①同席カバレッジ最大化…会える55ペア中51ペアが同席。未同席4組は全て青空絡み
//    （青空は15時退席＝午前2コマ×最大3名で6名までしか会えない物理的下限。会える10名中6名と同席）。
//    青空以外は宿題/デュエット等で全員が会える相手全員と同席。
//  ②各部屋の男女比を均等…全室に男女1名以上（女性のみ/ゲストのみ部屋なし）。部屋内|M-F|は
//    ほぼ0-1。コマ③Aは3M1F（コマ③=5M3Fを4/4に割る構造上避けられない）、コマ④Aも3M1F
//    （よしのすけ↔じゅりのユーザー指定入替による）。いずれも男女とも在室・ゲストのみ部屋なし。
//    コマ⑤は残り5名を1部屋に集約(2M3F)＝2人だけの部屋を避けるためBを廃しAへまとめる。
//  ③ゲスト(すー/じゅり/リノ)のみの部屋を作らない。
//  ・同席の偏り抑制…小部屋の最多同室は3回（じゅり×しゃちょーは手動固定のコマ④⑤の2回のみ）。
export const defaultRotations: Record<string, Record<string, "A" | "B" | "C">> = {
  // コマ①(12:30-14:00) A:よしのすけ・くる・Take・青空  B:シュウ・ハッシー・じゅり・リノ  C:しゃちょー・ヒィ・すー
  koma1: {
    "1": "A", "2": "A", "4": "A", "7": "A",
    "5": "B", "8": "B", "12": "B", "13": "B",
    "3": "C", "6": "C", "11": "C",
  },
  // コマ②(14:00-15:00) A:シュウ・ヒィ・青空・じゅり  B:よしのすけ・くる・ハッシー・すー  C:しゃちょー・Take・リノ
  koma2: {
    "5": "A", "6": "A", "7": "A", "12": "A",
    "1": "B", "2": "B", "8": "B", "11": "B",
    "3": "C", "4": "C", "13": "C",
  },
  // コマ③(17:00-18:00) A:よしのすけ・しゃちょー・シュウ・リノ  B:くる・Take・ヒィ・じゅり
  koma3: {
    "1": "A", "3": "A", "5": "A", "13": "A",
    "2": "B", "4": "B", "6": "B", "12": "B",
  },
  // コマ④(18:00-19:00) A:Take・ヒィ・よしのすけ・リノ  B:じゅり・くる・しゃちょー
  //   ※よしのすけ↔じゅりはユーザー指定で入替（Aは3M1Fになるが男女とも在室・ゲストのみ部屋なし）
  koma4: {
    "1": "A", "4": "A", "6": "A", "13": "A",
    "2": "B", "3": "B", "12": "B",
  },
  // コマ⑤(19:00-20:00) 残り5名は1部屋(A)に集約 A:よしのすけ・くる・しゃちょー・じゅり・リノ
  koma5: {
    "1": "A", "2": "A", "3": "A", "12": "A", "13": "A",
  },
};
