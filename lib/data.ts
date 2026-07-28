export type MemberRole = "leader" | "subleader" | "regular" | "guest";

export type Member = {
  id: string;
  nickname: string;
  role: MemberRole;
};

export type SlotType = "opening" | "rotation" | "all" | "end";
export type SlotColor = "yellow" | "pink" | "blue" | "green" | "orange" | "rose" | "magenta";

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

// 次回イベントの状態。"scheduled"=開催内容（部屋割り・クロス表）を表示／
// "adjusting"=TOPを「次回日程調整中」プレースホルダに切替（会員メニューは常時利用可）。
// 次回告知時は "scheduled" に戻し、eventInfo・timeSlots・defaultRotations を更新する（版数+1）。
export const eventStatus: "scheduled" | "adjusting" = "adjusting";

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
      "12:20集合 ／ 12:30スタート\n【退席】青空 15:00 ／ ハッシー 16:00 ／ すー 16:30 ／ シュウ 18:00 ／ ヒィ 18:00〜18:30 ／ Take 19:00 ／ よしのすけ（未確定）",
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
    color: "rose",
  },
  {
    id: "duet",
    startTime: "16:00",
    endTime: "17:00",
    type: "all",
    label: "デュエットタイム",
    detail: "全員で1部屋に集合してデュエット。",
    color: "magenta",
  },
  { id: "koma3", startTime: "17:00", endTime: "18:00", type: "rotation", label: "コマ ③" },
  { id: "koma4", startTime: "18:00", endTime: "19:00", type: "rotation", label: "コマ ④" },
  { id: "koma5", startTime: "19:00", endTime: "20:00", type: "rotation", label: "コマ ⑤" },
];

// デフォルトの部屋割り（メンバーID → 部屋）
// 男(M):1よしのすけ 3しゃちょー 4Take 5シュウ 6ヒィ 8ハッシー
// 女(F):2くる 7青空 15なち 11すー(G) 12じゅり(G) 13リノ(G)  ※G=ゲスト
// ※みや(旧id9)・めぐ(旧id10)に続き、きい(id14)も2026-07-26 欠席で除外＝計12名・6M6F。
//   （きいは会員として defaultMembers には残す＝出欠で不参加。部屋割り由来の出席者から自動的に外れる）
//
// 退席で各コマの在室者が変動（途中参加者はなし。なちは終日在室）：
//   青空15:00 ハッシー16:00 すー16:30 シュウ18:00 ヒィ18:00-18:30 Take19:00 退席。
//   ※よしのすけは所用で抜ける可能性ありだが時間未確定＝部屋割りには全コマ残す。集合カードの退席欄に
//     「よしのすけ（未確定）」を表示するのみ（在室/同席計算には不算入・rotationsは不変）。
// コマ①②(12:30-15:00)＝各3部屋(A/B/C・4/4/4)、コマ③(17-18)＝2部屋(5/4)、コマ④(18-19)＝2部屋(4/4)、
// コマ⑤(19-20)＝2部屋(3/3)。宿題(15-16)・デュエット(16-17)は全員1部屋（青空以外の全ペアはここで同席）。
//
// 焼きなまし＋手動ロックで最適化（2026-07-26 みや・めぐ・きい欠席で12名6M6Fに再最適化）：
//  ①同席カバレッジ…全66ペア中61ペアが同席。未同席5組は全て青空絡み。青空は15時退席で
//    午前2コマのみ在室＝物理的下限。12名は4/4/4に割れるため青空の部屋は4名＝会える他11名中6名と同席
//    （2つの4名部屋を重複なしにして最大化。5名部屋にすれば8名だがマイク時間の公平性=均等割りを優先）。
//    青空以外は宿題/デュエット等で全員と同席。なちも会える11名全員と同席。
//  ②各部屋の男女比を均等…全室に男女1名以上・コマ①②は全室2M2F（女性のみ/ゲストのみ部屋なし）。
//  ③ゲスト(すー/じゅり/リノ)のみの部屋を作らない。
//  ・同席の偏り抑制…小部屋(コマ①〜⑤)の同席はどのペアも最多3回（宿題/デュエットの全員集合は対象外）。
//  ・ユーザー指定ロック維持：コマ①青空=C・なち=C(青空と同室で なち↔青空 確保)、
//    コマ③ヒィ=A/よしのすけ=B、コマ④よしのすけ=A/じゅり=B。コマ④⑤はきい不在(18:00退席)で従来通り変更なし。
export const defaultRotations: Record<string, Record<string, "A" | "B" | "C">> = {
  // コマ①(12:30-14:00) A:しゃちょー・ヒィ・すー・じゅり  B:よしのすけ・くる・ハッシー・リノ  C:Take・シュウ・青空・なち
  //   ※ロック維持：青空=C・なち=C(なち↔青空を確保)。きい欠席でBを再均等化(くるをCから移動)＝全室4名2M2F。
  koma1: {
    "3": "A", "6": "A", "11": "A", "12": "A",
    "1": "B", "2": "B", "8": "B", "13": "B",
    "4": "C", "5": "C", "7": "C", "15": "C",
  },
  // コマ②(14:00-15:00) A:よしのすけ・しゃちょー・青空・すー  B:シュウ・ヒィ・リノ・なち  C:くる・Take・ハッシー・じゅり
  //   ※きい欠席でA=4名に。全室4名2M2F・青空=A(すー等と同席)。
  koma2: {
    "1": "A", "3": "A", "7": "A", "11": "A",
    "5": "B", "6": "B", "13": "B", "15": "B",
    "2": "C", "4": "C", "8": "C", "12": "C",
  },
  // コマ③(17:00-18:00) A:しゃちょー・Take・ヒィ・リノ・なち  B:よしのすけ・くる・シュウ・じゅり
  //   ※ロック維持：ヒィ=A/よしのすけ=B（ユーザー指定のよしのすけ↔ヒィ入替）。きい欠席でB=4名(5/4)。
  koma3: {
    "3": "A", "4": "A", "6": "A", "13": "A", "15": "A",
    "1": "B", "2": "B", "5": "B", "12": "B",
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

// 全員集合スロット(宿題15:00-16:00 / デュエット16:00-17:00)の「退席済み＝不在」メンバー。
// クロス表の同席集計で使用（該当スロットは残り全員が1部屋に集合）。
//  宿題(15:00-16:00)：青空(15:00退席)が不在。
//  デュエット(16:00-17:00)：青空・ハッシー(16:00退席)が不在（すーは16:30まで在室のため在室扱い）。
export const allSlotAbsent: Record<string, string[]> = {
  homework: ["7"],
  duet: ["7", "8"],
};
