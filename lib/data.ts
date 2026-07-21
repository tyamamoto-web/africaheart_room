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
  { id: "14", nickname: "きい",       role: "regular" },
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
      "12:20集合 ／ 12:30スタート\n【退席】青空 15:00 ／ ハッシー 16:00 ／ すー 16:30 ／ シュウ 18:00 ／ きい 18:00 ／ ヒィ 18:00〜18:30 ／ Take 19:00",
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
// 女(F):2くる 7青空 14きい 11すー(G) 12じゅり(G) 13リノ(G)  ※G=ゲスト
// ※みや(旧id9)・めぐ(旧id10)は2026-07-26 欠席で除外。きい(id14)は当日参加(18:00退席)で追加＝計12名・6M6F。
//
// 退席で各コマの在室者が変動（途中参加者はなし）：
//   青空15:00 ハッシー16:00 すー16:30 シュウ18:00 きい18:00 ヒィ18:00-18:30 Take19:00 退席。
// 午前は2コマ(コマ①12:30-14:00 / コマ②14:00-15:00)＝各3部屋(A/B/C・各4名)、
// 夕方はコマ③(17-18)が2部屋(5/4)、コマ④(18-19)が2部屋(4/3)、コマ⑤(19-20)は残り5名を1部屋(A)に集約。
// 宿題(15-16)・デュエット(16-17)は全員1部屋（青空以外の全ペアはここで同席）。
//
// 3条件を焼きなまし＋手動調整で最適化（2026-07-26 みや・めぐ欠席→11名→きい当日参加で12名）：
//  ①同席カバレッジ…会える66ペア(全ペア)中61ペアが同席。未同席5組は全て青空絡み。青空は15時退席で
//    午前2コマのみ在室＝最大6名までしか会えない物理的下限（会える11名中6名と同席）。
//    青空以外は宿題/デュエット等で全員と同席。きいも会える11名全員と同席。
//  ②各部屋の男女比を均等…全室に男女1名以上（女性のみ/ゲストのみ部屋なし）。部屋内|M-F|は
//    ほぼ0-1。唯一コマ④Aが3M1F（よしのすけ↔じゅりのユーザー指定入替による）。男女とも在室。
//    コマ⑤は残り5名を1部屋に集約(2M3F)＝2人だけの部屋を避けるためBを廃しAへまとめる。
//  ③ゲスト(すー/じゅり/リノ)のみの部屋を作らない。
//  ・同席の偏り抑制…ユーザー要望でコマ①②③を再最適化し、小部屋(コマ①〜⑤)の同席は
//    どのペアも最多3回に（宿題/デュエットの全員集合は対象外。最多3回=くる×しゃちょー/よしのすけ×リノ）。
//  ・きい(18:00退席)はコマ①でC(青空と同室)＝きい↔青空を確保し青空カバレッジも6へ回復。コマ④⑤は不在。
export const defaultRotations: Record<string, Record<string, "A" | "B" | "C">> = {
  // コマ①(12:30-14:00) A:シュウ・ヒィ・すー・じゅり  B:くる・Take・ハッシー・リノ  C:よしのすけ・しゃちょー・青空・きい
  //   ※ロック維持：ヒィ=A/青空=C（ユーザー指定のヒィ↔青空入替）。きいはC(青空と同室)＝きい↔青空を確保。
  koma1: {
    "5": "A", "6": "A", "11": "A", "12": "A",
    "2": "B", "4": "B", "8": "B", "13": "B",
    "1": "C", "3": "C", "7": "C", "14": "C",
  },
  // コマ②(14:00-15:00) A:しゃちょー・ヒィ・すー・リノ  B:よしのすけ・くる・シュウ・きい  C:Take・青空・ハッシー・じゅり
  koma2: {
    "3": "A", "6": "A", "11": "A", "13": "A",
    "1": "B", "2": "B", "5": "B", "14": "B",
    "4": "C", "7": "C", "8": "C", "12": "C",
  },
  // コマ③(17:00-18:00) A:くる・しゃちょー・Take・ヒィ・きい  B:よしのすけ・シュウ・じゅり・リノ
  //   ※ロック維持：ヒィ=A/よしのすけ=B（ユーザー指定のよしのすけ↔ヒィ入替）。
  koma3: {
    "2": "A", "3": "A", "4": "A", "6": "A", "14": "A",
    "1": "B", "5": "B", "12": "B", "13": "B",
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
