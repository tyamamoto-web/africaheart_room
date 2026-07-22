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
  { id: "15", nickname: "なち",       role: "regular" },
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
// 女(F):2くる 7青空 14きい 15なち 11すー(G) 12じゅり(G) 13リノ(G)  ※G=ゲスト
// ※みや(旧id9)・めぐ(旧id10)は2026-07-26 欠席で除外。きい(id14・18:00退席)・なち(id15・終日)が
//   当日参加で追加＝計13名・6M7F。
//
// 退席で各コマの在室者が変動（途中参加者はなし。なちは終日在室）：
//   青空15:00 ハッシー16:00 すー16:30 シュウ18:00 きい18:00 ヒィ18:00-18:30 Take19:00 退席。
// コマ①②(12:30-15:00)＝各3部屋(A/B/C・5/4/4)、コマ③(17-18)＝2部屋(5/5)、コマ④(18-19)＝2部屋(4/4)、
// コマ⑤(19-20)＝2部屋(3/3)。宿題(15-16)・デュエット(16-17)は全員1部屋（青空以外の全ペアはここで同席）。
//
// 焼きなまし＋手動ロックで最適化（2026-07-26 みや・めぐ欠席→11名→きい12名→なち終日参加で13名）：
//  ①同席カバレッジ…会える78ペア(全ペア)中74ペアが同席。未同席4組は全て青空絡み。青空は15時退席で
//    午前2コマのみ在室＝物理的下限だが5名部屋化で会える12名中8名と同席まで向上。
//    青空以外は宿題/デュエット等で全員と同席。きい・なちも会える12名全員と同席。
//  ②各部屋の男女比を均等…全室に男女1名以上・部屋内|M-F|は全室1以内（女性のみ/ゲストのみ部屋なし）。
//  ③ゲスト(すー/じゅり/リノ)のみの部屋を作らない。
//  ・同席の偏り抑制…小部屋(コマ①〜⑤)の同席はどのペアも最多3回（宿題/デュエットの全員集合は対象外）。
//  ・きい(久しぶり参加)の小部屋同席を確保…コマ③でリノ↔きいを入替し くる×きい を1回同室に
//    （全セッションでは宿題/デュエット込みで3回）。最多3回・青空カバレッジ8名は維持。
//  ・ユーザー指定ロック維持：コマ①青空=C/ヒィ=A・なち=C(青空と同室で なち↔青空 確保)、
//    コマ③ヒィ=A/よしのすけ=B、コマ④よしのすけ=A/じゅり=B。コマ⑤は6名で2部屋に分割。
export const defaultRotations: Record<string, Record<string, "A" | "B" | "C">> = {
  // コマ①(12:30-14:00) A:しゃちょー・ヒィ・すー・じゅり  B:よしのすけ・ハッシー・きい・リノ  C:くる・Take・シュウ・青空・なち
  //   ※ロック維持：ヒィ=A/青空=C（ユーザー指定のヒィ↔青空入替）。なちはC(青空と同室)＝なち↔青空を確保。
  koma1: {
    "3": "A", "6": "A", "11": "A", "12": "A",
    "1": "B", "8": "B", "13": "B", "14": "B",
    "2": "C", "4": "C", "5": "C", "7": "C", "15": "C",
  },
  // コマ②(14:00-15:00) A:よしのすけ・しゃちょー・青空・すー・きい  B:シュウ・ヒィ・なち・リノ  C:くる・Take・ハッシー・じゅり
  koma2: {
    "1": "A", "3": "A", "7": "A", "11": "A", "14": "A",
    "5": "B", "6": "B", "13": "B", "15": "B",
    "2": "C", "4": "C", "8": "C", "12": "C",
  },
  // コマ③(17:00-18:00) A:しゃちょー・Take・ヒィ・リノ・なち  B:よしのすけ・くる・シュウ・きい・じゅり
  //   ※ロック維持：ヒィ=A/よしのすけ=B（ユーザー指定のよしのすけ↔ヒィ入替）。
  //   ※きい↔リノ入替＝くる(B)と きい を同室に（きい久しぶり参加で小部屋の同席を1回確保）。
  koma3: {
    "3": "A", "4": "A", "6": "A", "13": "A", "15": "A",
    "1": "B", "2": "B", "5": "B", "14": "B", "12": "B",
  },
  // コマ④(18:00-19:00) A:よしのすけ・くる・ヒィ・なち  B:しゃちょー・Take・じゅり・リノ
  //   ※ロック維持：よしのすけ=A/じゅり=B（ユーザー指定のよしのすけ↔じゅり入替）。なち追加で全室2M2F。
  koma4: {
    "1": "A", "2": "A", "6": "A", "15": "A",
    "3": "B", "4": "B", "12": "B", "13": "B",
  },
  // コマ⑤(19:00-20:00) 6名を2部屋(3/3)に分割 A:よしのすけ・じゅり・なち  B:くる・しゃちょー・リノ
  koma5: {
    "1": "A", "12": "A", "15": "A",
    "2": "B", "3": "B", "13": "B",
  },
};
