"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { timeSlots, defaultMembers, type Member, type MemberRole } from "@/lib/data";
import { getMembers, addMember, updateMember, deleteMember, resetToDefault } from "@/lib/memberStore";
import { getEventSetup, setAttendance, setMemberRoom } from "@/lib/eventStore";
import type { RoomKey } from "@/lib/eventStore";
import { getRoomNumbers, saveRoomNumbers, RoomNumbersSetupError } from "@/lib/roomNumbers";
import { getOfficerPlan, setOfficerPriority, clearOfficerPlan, seedOfficerPlan } from "@/lib/officerPlan";
import {
  getOfficerRaci, setOfficerRaci, clearOfficerRaci, raciKey,
  RACI_PEOPLE, type OfficerRaci, type RaciRole,
} from "@/lib/officerRaci";
import { raciDefs, raciPersonSubLabel } from "@/lib/raciDefs";
import { OFFICER_PASSCODE, OFFICER_UNLOCK_KEY } from "@/lib/officerGate";
import {
  getOfficerTable, saveOfficerTableRow, saveOfficerTableColumns, deleteOfficerTableRow,
  seedOfficerTable, emptyRow, emptyColumns, newRowId, SEED_ROW_IDS,
  type OfficerTableRow, type OfficerTableData,
} from "@/lib/officerTable";

const roomCfg = {
  A: { gradient: "linear-gradient(135deg,#8E1252,#A8175F)", color: "#A8175F", bg: "#F6E1EB" },
  B: { gradient: "linear-gradient(135deg,#A8175F,#C81E77)", color: "#C81E77", bg: "#F9E6EF" },
  C: { gradient: "linear-gradient(135deg,#C0246F,#D6478E)", color: "#C0246F", bg: "#FCEDF4" },
} as const;

const roleConfig: Record<MemberRole, { label: string; bg: string; text: string }> = {
  leader:    { label: "リーダー", bg: "#fff0f0", text: "#ff6b6b" },
  subleader: { label: "サブ",     bg: "#f5f0ff", text: "#845ef7" },
  regular:   { label: "メンバー", bg: "#f4f0ea", text: "#888" },
  guest:     { label: "ゲスト",   bg: "#fffbe6", text: "#f59e0b" },
};
const roleOrder: MemberRole[] = ["leader", "subleader", "regular", "guest"];

const rotationSlots = timeSlots.filter((s) => s.type === "rotation");

// ── 役員専用ページ：オフ会運営タスクの優先度づけ（MoSCoW法）──────────
// リストの全項目を表にして、役員が自分たちで各タスクの優先度を手動で設定する。
// 専門用語は使わず、平易な日本語ラベルで4段階に分ける。
// 参考：MoSCoW法（Must / Should / Could / Won't）
type Priority = "must" | "should" | "could" | "wont";

// 4段階の優先度。ラベル・説明はすべて平易な言葉づかいに統一。
const priorityDefs: { key: Priority; label: string; hint: string; accent: string; tint: string }[] = [
  { key: "must",   label: "必ずやる",       hint: "これが無いとオフ会が成り立たない", accent: "#1c1a17", tint: "rgba(28,26,23,0.05)"  },
  { key: "should", label: "なるべくやる",   hint: "あると良い。無くても開催はできる", accent: "#a9823f", tint: "rgba(169,130,63,0.09)" },
  { key: "could",  label: "できたらやる",   hint: "あればもっと良い。優先度は低め",   accent: "#9c917d", tint: "rgba(156,145,125,0.10)"},
  { key: "wont",   label: "今回はやらない", hint: "今回は見送り（次回以降に考える）", accent: "#b4a992", tint: "rgba(180,169,146,0.10)"},
];

// ── 役割（だれが・どう関わるか）──────────────────────────────
// 定義・言葉づかいは lib/raciDefs.ts に集約（イベント運営マニュアルと共通）。
// 保存先の行だけが別（役員専用＝id5 ／ マニュアル＝id7）で、入力内容は互いに影響しない。

// リストのやることを 大分類 → 中分類 → 小分類（やること）に体系化。
// 元リスト（先方提供）の全項目を漏れなく収録。重複しやすいものは同じグループにまとめている。
// ※ サブリーダーMTGは第4土曜ではないと確認済みのため曜日表記を削除。定例会議に「役員会議」を上に追加。
//   「オフ会の日程を決める」の（第4土曜）は元リストの記述を暫定で残置（要確認）。
type OfficerTask = { id: string; label: string };
type OfficerTaxonomy = { no: string; major: string; groups: { mid: string; tasks: OfficerTask[] }[] }[];

const officerTaxonomy: OfficerTaxonomy = [
  {
    no: "01", major: "会の運営・体制",
    groups: [
      { mid: "定例会議", tasks: [
        { id: "t36", label: "役員MTG（リーダー・サブリーダー）" },
        { id: "t01", label: "役員MTG（サブリーダー）" },
      ] },
      { mid: "ルール・決め方", tasks: [
        { id: "t02", label: "ルールづくり" },
        { id: "t03", label: "物事の決め方（意思決定）" },
      ] },
      { mid: "アプリ・ツール",  tasks: [{ id: "t04", label: "アプリの運用" }] },
    ],
  },
  {
    no: "02", major: "オフ会の準備・当日",
    groups: [
      { mid: "日程・会場を決める", tasks: [
        { id: "t05", label: "オフ会の日程を決める（第4土曜）" },
        { id: "t06", label: "会場を松本駅前へ変更（JOYJOY・カラオケ館）" },
      ] },
      { mid: "予約・部屋の準備", tasks: [
        { id: "t07", label: "カラオケの予約" },
        { id: "t08", label: "部屋の準備（張り紙）" },
      ] },
      { mid: "案内・出欠（アプリ）", tasks: [
        { id: "t09", label: "イベントの作成（アプリ）" },
        { id: "t10", label: "締め切りの1週間前に案内" },
        { id: "t11", label: "出欠の管理" },
      ] },
      { mid: "当日の進行", tasks: [{ id: "t12", label: "タイムテーブル・部屋割り" }] },
    ],
  },
  {
    no: "03", major: "お金（会計）",
    groups: [
      { mid: "管理", tasks: [{ id: "t13", label: "お金の管理・出納帳" }] },
      { mid: "報告", tasks: [{ id: "t14", label: "会計報告" }] },
    ],
  },
  {
    no: "04", major: "企画・盛り上げ",
    groups: [
      { mid: "誕生日のお祝い", tasks: [
        { id: "t15", label: "誕生日プレゼントの手配" },
        { id: "t16", label: "ケーキ・イントロクイズ" },
      ] },
      { mid: "当日の楽しみ",       tasks: [{ id: "t17", label: "フリー部屋" }] },
      { mid: "季節・単発イベント", tasks: [{ id: "t18", label: "塩尻ハロウィン" }] },
      { mid: "ゲリラ企画", tasks: [
        { id: "t19", label: "ゲリライベント" },
        { id: "t20", label: "ゲリラ開催のオフ会" },
        { id: "t21", label: "中島みゆき ゲリラオフ会" },
      ] },
    ],
  },
  {
    no: "05", major: "交流・情報発信",
    groups: [
      { mid: "メンバー間の交流", tasks: [
        { id: "t22", label: "他メンバーの紹介・本人からの自己紹介" },
        { id: "t23", label: "メンバー同士の交流を活発にする" },
      ] },
      { mid: "グループLINE（グルチャ）", tasks: [
        { id: "t24", label: "グルチャを部屋分け（雑談・イベントなど）" },
        { id: "t25", label: "グルチャ投稿の役割分担" },
        { id: "t26", label: "LINEスタンプ" },
      ] },
    ],
  },
  {
    no: "06", major: "記録（写真・動画）",
    groups: [
      { mid: "撮影・管理", tasks: [
        { id: "t27", label: "イベントの写真・動画の撮影" },
        { id: "t28", label: "集合写真・動画の管理" },
      ] },
      { mid: "共有ルール", tasks: [{ id: "t29", label: "写真・動画の共有ルールの案内" }] },
    ],
  },
  {
    no: "07", major: "新規メンバー募集（ジモティ）",
    groups: [
      { mid: "出稿の準備", tasks: [
        { id: "t30", label: "ジモティのイベント作成" },
        { id: "t31", label: "ジモティの紹介文の作成" },
      ] },
      { mid: "対応・ルール", tasks: [
        { id: "t32", label: "ジモティ経由の新規希望者とのやりとり" },
        { id: "t33", label: "ジモティの年齢制限" },
      ] },
    ],
  },
  {
    no: "08", major: "安全・トラブル対応",
    groups: [
      { mid: "注意喚起",       tasks: [{ id: "t34", label: "お酒の飲みすぎ注意の案内" }] },
      { mid: "困りごと対応",   tasks: [{ id: "t35", label: "トラブル対応" }] },
    ],
  },
];

// フラットなやること一覧（件数集計に使用）
const officerTasks: OfficerTask[] = officerTaxonomy.flatMap((m) => m.groups.flatMap((g) => g.tasks));

/* ── 係（大分類をだれの持ち場としてまとめるか）──────────────────
   大分類が8つあると「これは誰の持ち場か」が一目で言えないので、その上に係の列をかぶせる。
   区分はサークル運営の一般的な5つの係に合わせた
   （主催者／イベント担当（企画・進行）／広報担当（SNS・告知）／会計担当（予算管理）／
     コミュニケーション担当（参加者フォロー））。
   ※ 大分類・中分類・やることの中身と並び順は一切変えていない。この列は上にかぶせる見出しだけ。
     並びを変えていないので、同じ係が離れて2回出ることがある（イベント担当・コミュニケーション担当）。
     並べ替えて1か所にまとめることもできるが、大分類の通し番号（01〜08）が飛ぶので今回は見送った。 */
type OfficerDept = { key: string; label: string; note: string };
const officerDepts: OfficerDept[] = [
  { key: "lead",  label: "主催",                     note: "会の舵取り" },
  { key: "event", label: "イベント担当",             note: "企画・進行" },
  { key: "money", label: "会計担当",                 note: "お金の管理" },
  { key: "pr",    label: "広報担当",                 note: "募集・記録" },
  { key: "comm",  label: "コミュニケーション担当",   note: "参加者フォロー" },
];
// 大分類の通し番号 → 係
const officerDeptOfMajor: Record<string, string> = {
  "01": "lead",  // 会の運営・体制（役員MTG・ルール・意思決定・アプリ）
  "02": "event", // オフ会の準備・当日（日程/会場・予約・案内/出欠・進行）
  "03": "money", // お金（会計）
  "04": "event", // 企画・盛り上げ（誕生日・フリー部屋・季節/ゲリラ）
  "05": "comm",  // 交流・情報発信（メンバー紹介・グルチャ運用）
  "06": "pr",    // 記録（写真・動画）
  "07": "pr",    // 新規メンバー募集（ジモティ）
  "08": "comm",  // 安全・トラブル対応
};
// 表の行データ（係・大分類・中分類のセル結合＝rowSpan 用のフラグつき）
type OfficerRow = {
  task: OfficerTask;
  dept?: string; deptSpan?: number;
  majorNo?: string; major?: string; majorSpan?: number;
  mid?: string; midSpan?: number;
};
const officerRows: OfficerRow[] = (() => {
  // 隣り合う大分類が同じ係なら、係のセルを縦に結合する
  const blocks: { dept: string; majors: OfficerTaxonomy }[] = [];
  for (const m of officerTaxonomy) {
    const dept = officerDeptOfMajor[m.no] ?? "";
    const last = blocks[blocks.length - 1];
    if (last && last.dept === dept) last.majors.push(m);
    else blocks.push({ dept, majors: [m] });
  }
  const rows: OfficerRow[] = [];
  for (const b of blocks) {
    const deptSpan = b.majors.reduce(
      (s, m) => s + m.groups.reduce((t, g) => t + g.tasks.length, 0), 0
    );
    let firstOfDept = true;
    for (const m of b.majors) {
      const majorSpan = m.groups.reduce((s, g) => s + g.tasks.length, 0);
      let firstOfMajor = true;
      for (const g of m.groups) {
        g.tasks.forEach((task, ti) => {
          rows.push({
            task,
            dept:      firstOfDept ? b.dept : undefined,
            deptSpan:  firstOfDept ? deptSpan : undefined,
            majorNo:   firstOfMajor ? m.no : undefined,
            major:     firstOfMajor ? m.major : undefined,
            majorSpan: firstOfMajor ? majorSpan : undefined,
            mid:     ti === 0 ? g.mid : undefined,
            midSpan: ti === 0 ? g.tasks.length : undefined,
          });
          firstOfDept = false;
          firstOfMajor = false;
        });
      }
    }
  }
  return rows;
})();

// 役員が設定した優先度の保存キー（この端末に保存）。体系化に伴い版数を v2 に更新。
const OFFICER_MOSCOW_KEY = "africaheart-officer-moscow-v2";

// 合言葉は lib/officerGate.ts に集約（参加者アンケートの「みんなの回答」とも共通）。

/* ── 役員専用2：オフ会運営のRACIチャート（役員全員で共同編集）───────
   表の形はRACIの基本どおり。左が「やることの特定」、右が「人ごとの役割」。
     左：見出しも中身も自分たちで書ける空の5列（＋通し番号のNo）
     右：よしのすけ／くる／しゃちょー／メンバー（担当者・責任者・相談役・お知らせ）

   左を空の5列にしてある理由：
     この表が扱うのは1回のイベントの進行ではなく、毎月まわしていく運営そのもの。
     何を軸に並べるか（分野・まとまり・いつ など）は、書きながら決めたほうが早い。
     見出しも全員で共有されるので、1人が直せば他の人の画面にも同じ見出しが出る。
     右のRACIの4人は、表の型を保つため固定。

   見た目の考え方：白い紙に活字を組んだ誌面として扱う。
     色は足さず、わずかに暖かい白の階調と、強さの決まった2本の罫だけで作る。
       強い罫：見出しの下の2px（表の背骨）
       弱い罫：1行ごとの細い罫（どの行も同じ濃さでそろえる）
     行を数える手がかりは、左端に貼り付くNo列の柱と、桁のそろった等幅の数字が受け持つ。
     書く5列のあいだに縦罫は引かず、余白と記入欄の下線で分ける。
     赤紫（アプリの色）はこの表では使わない。60個ある記入欄のどこにでも出るため、
     いちばん目立つ色が「たまたま今さわっている欄」に付いてしまうので。

   保存は lib/officerTable.ts（homework_result の id=6 を間借り）。
   文字は打ち終わってから少し待って自動保存。役割のプルダウンは押した時点で保存。
   ほかの人の変更は約6秒ごとに入ってくる。
   ------------------------------------------------------------------ */

// 表の色。紙（地）・罫（線）・インク（文字）の3組に分けてある。
// 灰色はどれも赤よりも青をわずかに落とした、ごく弱い暖色寄り（無彩色だと表計算ソフトの顔になる）。
const T = {
  // 紙。上から順に、白 → だんだん沈む
  paper: "#ffffff", // 表の地。記入欄の地
  rowHov: "#faf9f6", // マウスを乗せた行
  rowOn: "#f8f6f1", // いま自分が書いている行
  cellHov: "#f4f2ed", // 記入欄・ボタン・×にマウスを乗せたとき
  no: "#f2f0eb", // No列の地。左端をつらぬく柱
  noHov: "#edeae4", // No列（行にマウスを乗せたとき）
  noOn: "#e7e4dc", // No列（いま書いている行）
  // 罫。弱い順に3段。いちばん強いのは見出しの下の2px（ink）
  hair: "#e6e3dc", // 1行ごとの細い罫・人と人の間・No列の右
  rule: "#cbc7be", // 表の外枠・ボタンの枠
  block: "#b8b3a8", // 書く5列と役割の4列を分ける仕切り
  guide: "#dedbd3", // 記入欄の下に常時引く線（ここに書けるという合図）
  // インク
  ink: "#33302a", // 本文・人名・見出しの下の2px罫・責任者の地
  sub: "#57544d", // Noの数字
  cap: "#6b6860", // 肩書き・状態表示・×・書いている欄の枠
  faint: "#8a867d", // 押せないときの文字
  warn: "#7a5a2e", // 責任者が1人に決まっていない印
};

/* マウスを乗せたとき・書いているときの見た目はCSSで書く。
   このファイルはインラインstyleが主体で :hover が書けないため、
   この表の中（.rtbl）だけに効く短いCSSを1つ置く。色は T から差し込む。
   ※ 行の地色はここが受け持つので、tdのインラインstyleに background を書かないこと
     （インラインが必ず勝ってしまう）。No列だけ className="no" を付ける。 */
const TABLE_CSS = `
.rtbl tbody td { background:${T.paper}; border-bottom:1px solid ${T.hair}; }
.rtbl tbody td.no { background:${T.no}; }
.rtbl tbody tr:hover td { background:${T.rowHov}; }
.rtbl tbody tr:hover td.no { background:${T.noHov}; }
.rtbl tbody tr.on td { background:${T.rowOn}; }
.rtbl tbody tr.on td.no { background:${T.noOn}; box-shadow: inset 3px 0 0 ${T.ink}; }
.rtbl tbody tr:last-child td { border-bottom-color:transparent; }
.rtbl textarea, .rtbl thead input {
  border:1px solid transparent; border-radius:3px; background:transparent;
  transition: background .12s, border-color .12s, box-shadow .12s;
}
.rtbl textarea { border-bottom-color:${T.guide}; }
.rtbl textarea:hover { background:${T.cellHov}; border-bottom-color:${T.block}; }
.rtbl thead input:hover { background:${T.cellHov}; }
.rtbl textarea:focus, .rtbl thead input:focus {
  background:${T.paper}; border-color:${T.cap}; box-shadow:0 0 0 3px rgba(51,48,42,0.10);
}
.rtbl select:hover { border-color:${T.cap} !important; }
.rtbl select:focus { border-color:${T.cap} !important; box-shadow:0 0 0 3px rgba(51,48,42,0.10); }
.rtbl .addbtn:hover:not(:disabled) { background:${T.cellHov}; border-color:${T.block}; }
.rtbl .delbtn:hover { background:${T.cellHov}; color:${T.ink}; }
`;

/* 役割4種の見た目。言葉と意味は lib/raciDefs.ts のまま使い、色だけこの表で上書きする
   （raciDefs は役員専用タブと共用なので触らない）。
   見分けは4つの性質を重ねてある：面の有無 / 面の明るさ / 灰色の温度 / 文字の太さ。
   白黒に落としても 濃い面 → 中間の面 → 白抜き＋濃い枠 → 薄い面 の順に軽くなり、
   「決める → 手を動かす → 意見を言う → 知らせるだけ」の重さの順と一致する。 */
const ROLE_UI: Record<RaciRole, { bg: string; fg: string; bd: string; weight: number }> = {
  a: { bg: "#33302a", fg: "#ffffff", bd: "#33302a", weight: 700 }, // 責任者：濃く塗る。1行に1人だけなので目印になる
  r: { bg: "#dbd6ca", fg: "#322e26", bd: "#8f8670", weight: 700 }, // 担当者：暖かい薄灰で塗る
  c: { bg: "#ffffff", fg: "#3b3833", bd: "#6f6b63", weight: 600 }, // 相談役：白く抜いて、枠をいちばん濃くする
  i: { bg: "#e8ebef", fg: "#363c43", bd: "#80868d", weight: 500 }, // お知らせ：冷たい薄灰で塗る
};
const ROLE_NONE = { bg: "transparent", fg: "#66635c", bd: "#8f8a81", weight: 500 };

// プルダウンの三角を自分で描く（環境ごとの見た目の差をなくす）。
function chevron(color: string): string {
  const c = encodeURIComponent(color);
  return `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='7' height='5' viewBox='0 0 7 5'><path d='M0.7 0.9 L3.5 3.8 L6.3 0.9' fill='none' stroke='${c}' stroke-width='1.2' stroke-linecap='round' stroke-linejoin='round'/></svg>")`;
}

const tblTh: React.CSSProperties = {
  background: T.paper,
  color: T.cap,
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: "0.04em",
  textAlign: "left",
  padding: "10px 10px 8px",
  verticalAlign: "bottom", // 見出しの文字を、下の太い罫のすぐ上にそろえる
  whiteSpace: "nowrap",
};
const tblTd: React.CSSProperties = { padding: "3px 5px", verticalAlign: "top" };

/** 自由に書く欄。書いた分だけ縦に伸びるので、行の中でスクロールバーが出ない。 */
function CellText({
  value,
  onChange,
  onFocus,
  onBlur,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  onFocus: () => void;
  onBlur: () => void;
  label: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.max(32, el.scrollHeight)}px`;
  }, [value]);

  return (
    <textarea
      ref={ref}
      rows={1}
      value={value}
      aria-label={label}
      onChange={(e) => onChange(e.target.value)}
      onFocus={onFocus}
      onBlur={onBlur}
      style={{
        width: "100%",
        display: "block",
        resize: "none",
        overflow: "hidden",
        fontSize: 12,
        lineHeight: 1.6,
        color: T.ink,
        padding: "6px 8px",
        outline: "none",
        fontFamily: "inherit",
      }}
    />
  );
}

/** 列の見出し。見出しそのものを書き替えられる（全員に共有される）。 */
function HeadInput({
  value,
  onChange,
  onFocus,
  onBlur,
  index,
}: {
  value: string;
  onChange: (v: string) => void;
  onFocus: () => void;
  onBlur: () => void;
  index: number;
}) {
  return (
    <input
      type="text"
      value={value}
      aria-label={`${index + 1}つめの列の名前`}
      onChange={(e) => onChange(e.target.value)}
      onFocus={onFocus}
      onBlur={onBlur}
      style={{
        width: "100%",
        color: T.ink,
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: "0.04em",
        padding: "4px 6px",
        outline: "none",
        fontFamily: "inherit",
      }}
    />
  );
}

function OfficerRoleTable() {
  const [columns, setColumns] = useState<string[]>(emptyColumns());
  const [rows, setRows] = useState<OfficerTableRow[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [focusRow, setFocusRow] = useState<string | null>(null); // いま自分が書いている行
  const [more, setMore] = useState(false); // 右にまだ表が続くか

  const dataRef = useRef<OfficerTableData>({ columns: emptyColumns(), rows: [] }); // 保存はいつもこの手元の値を使う
  const pending = useRef(0); // 保存中の件数。0より大きいあいだは取り込みを止める
  const editing = useRef<string | null>(null); // 入力中の行（見出しは "cols"）は上書きしない
  const dirty = useRef<Set<string>>(new Set()); // まだ保存していない行
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const scrollRef = useRef<HTMLDivElement>(null);

  const COLS_KEY = "cols"; // 見出しをタイマー・入力中の目印で扱うときのキー

  // 画面の表示と手元の値を同時に更新する
  function commit(next: OfficerTableData) {
    dataRef.current = next;
    setColumns(next.columns);
    setRows(next.rows);
  }

  async function run(key: string, work: () => Promise<unknown>) {
    pending.current += 1;
    setSaving(true);
    try {
      await work();
      dirty.current.delete(key);
      setErr(null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "保存に失敗しました");
    } finally {
      pending.current -= 1;
      if (pending.current === 0) setSaving(false);
    }
  }

  // 1行ぶんの変更。immediate は「押した時点で保存する」もの（役割のプルダウン）。
  function patchRow(id: string, change: Partial<OfficerTableRow>, immediate: boolean) {
    const next: OfficerTableData = {
      columns: dataRef.current.columns,
      rows: dataRef.current.rows.map((r) => (r.id === id ? { ...r, ...change } : r)),
    };
    commit(next);
    const row = next.rows.find((r) => r.id === id);
    if (!row) return;
    if (immediate) {
      void run(id, () => saveOfficerTableRow(row));
      return;
    }
    dirty.current.add(id);
    clearTimeout(timers.current[id]);
    timers.current[id] = setTimeout(() => void run(id, () => saveOfficerTableRow(row)), 800);
  }

  // 列の見出しの変更（全員に共有される）
  function patchColumn(index: number, value: string) {
    const nextCols = dataRef.current.columns.map((c, i) => (i === index ? value : c));
    commit({ columns: nextCols, rows: dataRef.current.rows });
    dirty.current.add(COLS_KEY);
    clearTimeout(timers.current[COLS_KEY]);
    timers.current[COLS_KEY] = setTimeout(
      () => void run(COLS_KEY, () => saveOfficerTableColumns(nextCols)),
      800
    );
  }

  function startEdit(key: string) {
    editing.current = key;
    setFocusRow(key === COLS_KEY ? null : key);
  }

  // 欄から離れたら、待たずに保存する
  function flush(key: string) {
    editing.current = null;
    setFocusRow(null);
    if (!dirty.current.has(key)) return;
    clearTimeout(timers.current[key]);
    if (key === COLS_KEY) {
      const cols = dataRef.current.columns;
      void run(COLS_KEY, () => saveOfficerTableColumns(cols));
      return;
    }
    const row = dataRef.current.rows.find((r) => r.id === key);
    if (row) void run(key, () => saveOfficerTableRow(row));
  }

  function addRow() {
    const row = emptyRow(newRowId());
    commit({ columns: dataRef.current.columns, rows: [...dataRef.current.rows, row] });
    void run(row.id, () => saveOfficerTableRow(row));
  }

  function removeRow(row: OfficerTableRow) {
    const hasText = row.cells.some((s) => s.trim());
    if (hasText && !window.confirm("この行を消します。ほかの人の画面からも消えます。よろしいですか。")) return;
    clearTimeout(timers.current[row.id]);
    dirty.current.delete(row.id);
    commit({
      columns: dataRef.current.columns,
      rows: dataRef.current.rows.filter((r) => r.id !== row.id),
    });
    void run(row.id, () => deleteOfficerTableRow(row.id));
  }

  // 最初の読み込み。まだ1行も無ければ空の12行を作る（idは固定なので二重にならない）。
  useEffect(() => {
    let alive = true;
    (async () => {
      let data = await getOfficerTable();
      if (data.rows.length === 0) {
        try {
          data = await seedOfficerTable();
        } catch {
          data = { columns: emptyColumns(), rows: SEED_ROW_IDS.map(emptyRow) };
        }
      }
      if (!alive) return;
      commit(data);
      setLoaded(true);
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ほかの人の変更を取り込む（約6秒ごと）。
  useEffect(() => {
    const t = setInterval(async () => {
      if (pending.current > 0) return; // 保存中は取り込まない
      const remote = await getOfficerTable();
      if (remote.rows.length === 0) return; // 読めなかったときは今の表を残す
      const key = editing.current;
      if (!key) {
        commit(remote);
        return;
      }
      // 入力中の見出し・行だけは自分の手元を残し、ほかは共有側に合わせる
      const cols = key === COLS_KEY ? dataRef.current.columns : remote.columns;
      const mine = key === COLS_KEY ? undefined : dataRef.current.rows.find((r) => r.id === key);
      commit({
        columns: cols,
        rows: mine ? remote.rows.map((r) => (r.id === mine.id ? mine : r)) : remote.rows,
      });
    }, 6000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 画面を離れるときに、待機中の保存を片づける
  useEffect(() => {
    const t = timers.current;
    return () => {
      Object.values(t).forEach(clearTimeout);
    };
  }, []);

  // 右にまだ表が続いているかを見張る（続いているときだけ右端をぼかす）
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const check = () => setMore(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
    check();
    el.addEventListener("scroll", check, { passive: true });
    window.addEventListener("resize", check);
    return () => {
      el.removeEventListener("scroll", check);
      window.removeEventListener("resize", check);
    };
  }, [loaded, rows.length]);

  return (
    // 左5列＋RACI4人＋Noで横に長いので、広い画面では収まるところまで枠を広げる。
    <div className="rtbl px-4 pt-3 pb-8 mx-auto" style={{ maxWidth: 1240 }}>
      <style>{TABLE_CSS}</style>

      <div className="flex items-center justify-between gap-3" style={{ marginBottom: 10 }}>
        <button
          onClick={addRow}
          disabled={!loaded}
          className="addbtn"
          style={{
            background: T.paper,
            border: `1px solid ${loaded ? T.rule : T.hair}`,
            borderRadius: 3,
            padding: "7px 16px",
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.04em",
            color: loaded ? T.ink : T.faint,
            cursor: loaded ? "pointer" : "default",
          }}
        >
          行を追加
        </button>
        {/* ふだんは何も出さない。保存に失敗したときだけ、その場で知らせる。 */}
        {err && <span style={{ fontSize: 11, letterSpacing: "0.02em", color: T.warn }}>{err}</span>}
      </div>

      <div style={{ position: "relative" }}>
        <div
          ref={scrollRef}
          style={{
            border: `1px solid ${T.rule}`,
            borderRadius: 4,
            overflowX: "auto",
            overflowY: "hidden",
            background: T.paper,
          }}
        >
          <table
            style={{
              minWidth: 1199,
              width: "100%",
              borderCollapse: "separate", // No列を左に貼り付けても罫線が消えないように
              borderSpacing: 0,
              tableLayout: "fixed",
            }}
          >
            <colgroup>
              <col style={{ width: 36 }} />
              {columns.map((_, i) => (
                <col key={i} style={{ width: 159 }} />
              ))}
              {RACI_PEOPLE.map((p) => (
                <col key={p.id} style={{ width: 84 }} />
              ))}
              <col style={{ width: 32 }} />
            </colgroup>
            <thead>
              <tr>
                <th
                  rowSpan={2}
                  style={{
                    ...tblTh,
                    textAlign: "center",
                    padding: "10px 0 8px",
                    background: T.no,
                    borderRight: `1px solid ${T.hair}`,
                    borderBottom: `2px solid ${T.ink}`,
                    position: "sticky",
                    left: 0,
                    zIndex: 3,
                  }}
                >
                  No
                </th>
                {columns.map((label, i) => (
                  <th
                    key={i}
                    rowSpan={2}
                    style={{
                      ...tblTh,
                      padding: "10px 6px 7px",
                      paddingRight: i === columns.length - 1 ? 14 : 6,
                      borderBottom: `2px solid ${T.ink}`,
                      borderRight: i === columns.length - 1 ? `1px solid ${T.block}` : undefined,
                    }}
                  >
                    <HeadInput
                      value={label}
                      index={i}
                      onChange={(v) => patchColumn(i, v)}
                      onFocus={() => startEdit(COLS_KEY)}
                      onBlur={() => flush(COLS_KEY)}
                    />
                  </th>
                ))}
                <th
                  colSpan={RACI_PEOPLE.length}
                  style={{
                    ...tblTh,
                    textAlign: "center",
                    padding: "10px 8px 7px",
                    fontSize: 10,
                    borderBottom: `1px solid ${T.hair}`,
                  }}
                >
                  役割（だれが・どう関わる）
                </th>
                <th
                  rowSpan={2}
                  style={{
                    ...tblTh,
                    padding: "10px 2px 8px",
                    borderLeft: `1px solid ${T.hair}`,
                    borderBottom: `2px solid ${T.ink}`,
                  }}
                />
              </tr>
              <tr>
                {RACI_PEOPLE.map((p, pi) => (
                  <th
                    key={p.id}
                    style={{
                      ...tblTh,
                      textAlign: "center",
                      padding: "6px 4px 9px",
                      borderBottom: `2px solid ${T.ink}`,
                      borderRight: pi === RACI_PEOPLE.length - 1 ? undefined : `1px solid ${T.hair}`,
                    }}
                  >
                    <div style={{ color: T.ink, fontSize: 12, fontWeight: 600, letterSpacing: "0.02em" }}>
                      {p.name}
                    </div>
                    <div style={{ marginTop: 3, fontSize: 10, fontWeight: 500, letterSpacing: "0.02em", color: T.cap }}>
                      {raciPersonSubLabel(p.role)}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => {
                const written = row.cells.some((c) => c.trim());
                const aCount = Object.values(row.roles).filter((v) => v === "a").length;
                const needsOwner = written && aCount !== 1;
                const on = focusRow === row.id;
                return (
                  <tr key={row.id} className={on ? "on" : undefined}>
                    <td
                      className="no"
                      style={{
                        ...tblTd,
                        padding: "12px 0 0",
                        textAlign: "center",
                        position: "sticky",
                        left: 0,
                        zIndex: 1,
                        borderRight: `1px solid ${T.hair}`,
                      }}
                    >
                      <div
                        style={{
                          fontSize: 11,
                          letterSpacing: "0.02em",
                          fontVariantNumeric: "tabular-nums",
                          color: on ? T.ink : T.sub,
                          fontWeight: on ? 700 : 400,
                        }}
                      >
                        {i + 1}
                      </div>
                      {needsOwner && (
                        <div
                          title="責任者が1人に決まっていません"
                          style={{ width: 5, height: 5, borderRadius: "50%", background: T.warn, margin: "6px auto 0" }}
                        />
                      )}
                    </td>

                    {/* 自分たちで見出しをつけた5列 */}
                    {row.cells.map((cell, ci) => (
                      <td
                        key={ci}
                        style={{
                          ...tblTd,
                          paddingRight: ci === row.cells.length - 1 ? 14 : 5,
                          borderRight: ci === row.cells.length - 1 ? `1px solid ${T.block}` : undefined,
                        }}
                      >
                        <CellText
                          value={cell}
                          onChange={(v) =>
                            patchRow(row.id, { cells: row.cells.map((c, k) => (k === ci ? v : c)) }, false)
                          }
                          onFocus={() => startEdit(row.id)}
                          onBlur={() => flush(row.id)}
                          label={`${i + 1}行目の${columns[ci] || `${ci + 1}つめの列`}`}
                        />
                      </td>
                    ))}

                    {/* 役割（だれが・どう関わる） */}
                    {RACI_PEOPLE.map((p, pi) => {
                      const role = row.roles[p.id];
                      const ui = role ? ROLE_UI[role] : ROLE_NONE;
                      return (
                        <td
                          key={p.id}
                          style={{
                            ...tblTd,
                            padding: "6px 5px",
                            textAlign: "center",
                            verticalAlign: "middle",
                            borderRight: pi === RACI_PEOPLE.length - 1 ? undefined : `1px solid ${T.hair}`,
                          }}
                        >
                          <select
                            value={role ?? ""}
                            onChange={(e) => {
                              const next = { ...row.roles };
                              if (e.target.value) next[p.id] = e.target.value as RaciRole;
                              else delete next[p.id];
                              patchRow(row.id, { roles: next }, true);
                            }}
                            aria-label={`${i + 1}行目の${p.name}さんの役割`}
                            style={{
                              width: "100%",
                              // 既定の見た目を切らないと、Safariが背景と枠をまとめて無視する
                              appearance: "none",
                              WebkitAppearance: "none",
                              MozAppearance: "none",
                              fontSize: 11,
                              fontWeight: ui.weight,
                              letterSpacing: "0.02em",
                              color: ui.fg,
                              backgroundColor: ui.bg,
                              backgroundImage: chevron(ui.fg),
                              backgroundRepeat: "no-repeat",
                              backgroundPosition: "right 6px center",
                              backgroundSize: "7px 5px",
                              border: `1px solid ${ui.bd}`,
                              borderRadius: 3,
                              padding: "6px 16px 6px 8px",
                              cursor: "pointer",
                              outline: "none",
                              fontFamily: "inherit",
                              transition: "border-color .12s, box-shadow .12s",
                            }}
                          >
                            <option value="">—</option>
                            {raciDefs.map((d) => (
                              <option key={d.key} value={d.key}>
                                {d.short}
                              </option>
                            ))}
                          </select>
                        </td>
                      );
                    })}

                    <td
                      style={{
                        ...tblTd,
                        padding: "7px 4px",
                        textAlign: "center",
                        verticalAlign: "middle",
                        borderLeft: `1px solid ${T.hair}`,
                      }}
                    >
                      <button
                        onClick={() => removeRow(row)}
                        className="delbtn"
                        aria-label={`${i + 1}行目を消す`}
                        title="この行を消す"
                        style={{
                          width: 22,
                          height: 22,
                          borderRadius: 3,
                          border: "none",
                          background: "transparent",
                          color: T.cap,
                          fontSize: 13,
                          lineHeight: 1,
                          padding: 0,
                          cursor: "pointer",
                        }}
                      >
                        ×
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* 右にまだ表が続くときだけ、右端をぼかして先があることを示す */}
        {more && (
          <div
            aria-hidden
            style={{
              position: "absolute",
              top: 1,
              right: 1,
              bottom: 1,
              width: 28,
              pointerEvents: "none",
              borderRadius: "0 4px 4px 0",
              background: "linear-gradient(90deg, rgba(255,255,255,0), #ffffff)",
            }}
          />
        )}
      </div>
    </div>
  );
}

type FormState = { nickname: string; role: MemberRole };

export default function AdminPage() {
  const [members,      setMembers]      = useState<Member[]>([]);
  const [attendance,   setAttState]     = useState<Set<string>>(new Set());
  const [rotations,    setRotations]    = useState<Record<string, Record<string, RoomKey>>>({});
  const [activeSlot,   setActiveSlot]   = useState<string>(rotationSlots[0]?.id ?? "");
  const [modal,        setModal]        = useState<{ open: boolean; editId: string | null }>({ open: false, editId: null });
  const [form,         setForm]         = useState<FormState>({ nickname: "", role: "regular" });
  const [confirmReset, setConfirmReset] = useState(false);
  // 当日の実部屋番号（A/B/C→番号）。Supabaseで全員共有。
  const [roomNos,      setRoomNos]      = useState<{ A: string; B: string; C: string }>({ A: "", B: "", C: "" });
  const [roomSaving,   setRoomSaving]   = useState(false);
  const [roomMsg,      setRoomMsg]      = useState<{ kind: "ok" | "err" | "setup"; text: string } | null>(null);
  // 管理画面のタブ（左=部屋割り・メンバー / 中=役員専用 / 右=役員専用2）。既定は左。
  // 右の2つは合言葉を入れないと中身を出さない。役員専用2は中身がこれから決まる空のタブ。
  const [tab, setTab] = useState<"officer" | "officer2" | "admin">("admin");
  // 役員専用タブの解錠状態と、合言葉の入力欄。解錠はタブを閉じるまで保持する。
  const [unlocked, setUnlocked] = useState(false);
  const [passInput, setPassInput] = useState("");
  const [passError, setPassError] = useState(false);
  // 役員専用：各タスクに手動でつけた優先度（この端末に保存）
  const [priorities, setPriorities] = useState<Record<string, Priority>>({});
  // 役員専用：各やることの担当・役割（RACI）。全員でSupabase共有。キーは `taskId|personId`。
  const [raci, setRaci] = useState<OfficerRaci>({});
  const [confirmMoscowReset, setConfirmMoscowReset] = useState(false);
  // 役員専用：保存失敗などの一時メッセージ（成功や次回同期で自動的に消える）
  const [officerMsg, setOfficerMsg] = useState<string | null>(null);
  // 共有書き込み中／直近の編集を検知し、ポーリングが「自分の入力」を巻き戻さないためのガード
  const pendingWrites = useRef(0);
  const editSeq = useRef(0);

  useEffect(() => {
    const m = getMembers();
    setMembers(m);
    const setup = getEventSetup();
    setAttState(new Set(setup.attendanceIds));
    setRotations(setup.rotations);
    getRoomNumbers()
      .then((r) => setRoomNos({ A: r.A, B: r.B, C: r.C }))
      .catch(() => {});
    // 役員RACI（担当・役割）も全員で共有（Supabase）。初期表示ぶんを取り込む。
    getOfficerRaci()
      .then(setRaci)
      .catch(() => {});
    // 役員プランは全員で共有（Supabase）。初回だけ、この端末に残っていた旧入力を共有へ移行する。
    (async () => {
      let local: Record<string, Priority> = {};
      try {
        const raw = localStorage.getItem(OFFICER_MOSCOW_KEY);
        if (raw) local = JSON.parse(raw);
      } catch { /* 読めなくても続行 */ }
      const migratedKey = OFFICER_MOSCOW_KEY + "-migrated";
      let migrated = false;
      try { migrated = !!localStorage.getItem(migratedKey); } catch { /* no-op */ }
      try {
        let plan;
        if (Object.keys(local).length && !migrated) {
          plan = await seedOfficerPlan(local);              // 端末の入力を共有へ吸い上げ（既存は尊重）
          try { localStorage.setItem(migratedKey, "1"); } catch { /* no-op */ }
        } else {
          plan = await getOfficerPlan();                    // 以降は共有が正
        }
        setPriorities(plan);
      } catch { /* 取得失敗時は空のまま（表示優先） */ }
    })();
  }, []);

  // 前に合言葉を入れていれば、そのタブを開いているあいだは聞き直さない。
  useEffect(() => {
    try {
      if (sessionStorage.getItem(OFFICER_UNLOCK_KEY) === "1") setUnlocked(true);
    } catch { /* 読めなくても続行（合言葉を聞くだけ） */ }
  }, []);

  // 合言葉の判定。合っていれば解錠し、違っていれば入力欄を空にしてやり直してもらう。
  function submitPasscode() {
    if (passInput.trim() !== OFFICER_PASSCODE) {
      setPassError(true);
      setPassInput("");
      return;
    }
    setUnlocked(true);
    setPassError(false);
    setPassInput("");
    try { sessionStorage.setItem(OFFICER_UNLOCK_KEY, "1"); } catch { /* 保存できなくても解錠は有効 */ }
  }

  // 施錠に戻す（人に画面を渡すときなど）。次に開くときはまた合言葉を聞く。
  function lockOfficer() {
    setUnlocked(false);
    setPassInput("");
    setPassError(false);
    try { sessionStorage.removeItem(OFFICER_UNLOCK_KEY); } catch { /* no-op */ }
  }

  // 役員専用タブを開いている間は、他メンバーの入力を約6秒ごとに取り込む（共有・同期）。
  // 施錠中は中身を出していないので取りに行かない。
  useEffect(() => {
    if (tab !== "officer" || !unlocked) return;
    let alive = true;
    const iv = setInterval(async () => {
      if (pendingWrites.current > 0) return; // 書き込み中はスキップ（自分の入力の巻き戻り防止）
      const seqAtStart = editSeq.current;
      try {
        const [plan, r] = await Promise.all([getOfficerPlan(), getOfficerRaci()]);
        // 取得中に自分が編集/保存していたら適用しない（巻き戻り防止・次回のポーリングで整合）
        if (alive && pendingWrites.current === 0 && editSeq.current === seqAtStart) {
          setPriorities(plan); setRaci(r); setOfficerMsg(null);
        }
      } catch { /* 一時的な失敗は無視して次回に */ }
    }, 6000);
    return () => { alive = false; clearInterval(iv); };
  }, [tab, unlocked]);

  // タスクの優先度を設定（同じものを再度押すと解除）。全員に共有（Supabase）。
  function setTaskPriority(taskId: string, p: Priority) {
    const cleared = priorities[taskId] === p;
    editSeq.current++;
    // まず画面を即更新（体感を良く）。
    setPriorities((prev) => {
      const next = { ...prev };
      if (cleared) delete next[taskId];
      else next[taskId] = p;
      return next;
    });
    // 共有へ保存（サーバ側で最新にマージ）→ 返ってきた全マップで確定させる。
    pendingWrites.current++;
    setOfficerPriority(taskId, cleared ? null : p)
      .then((plan) => { setPriorities(plan); setOfficerMsg(null); })
      .catch(() => { setOfficerMsg("保存に失敗しました。通信状況をご確認ください（数秒後に自動でやり直します）"); })
      .finally(() => { pendingWrites.current--; });
  }
  // やること×人 の役割（RACI）を設定（空欄を選ぶと解除）。全員に共有（Supabase）。
  function setTaskAssignee(taskId: string, personId: string, role: RaciRole | null) {
    const key = raciKey(taskId, personId);
    editSeq.current++;
    // まず画面を即更新（体感を良く）。
    setRaci((prev) => {
      const next = { ...prev };
      if (role === null) delete next[key];
      else next[key] = role;
      return next;
    });
    // 共有へ保存（サーバ側で最新にマージ）→ 返ってきた全マップで確定させる。
    pendingWrites.current++;
    setOfficerRaci(taskId, personId, role)
      .then((map) => { setRaci(map); setOfficerMsg(null); })
      .catch(() => { setOfficerMsg("保存に失敗しました。通信状況をご確認ください（数秒後に自動でやり直します）"); })
      .finally(() => { pendingWrites.current--; });
  }
  function resetPriorities() {
    setPriorities({});
    setRaci({});
    clearOfficerPlan().catch(() => { /* 失敗時は次回のポーリングで整合 */ });
    clearOfficerRaci().catch(() => { /* 失敗時は次回のポーリングで整合 */ });
    try { localStorage.removeItem(OFFICER_MOSCOW_KEY); } catch { /* no-op */ }
    setConfirmMoscowReset(false);
  }

  async function handleSaveRoomNumbers() {
    setRoomSaving(true);
    setRoomMsg(null);
    try {
      await saveRoomNumbers(roomNos, "管理");
      setRoomMsg({ kind: "ok", text: "保存しました（TOPの部屋割り表に反映・全員に共有）" });
    } catch (e) {
      if (e instanceof RoomNumbersSetupError) {
        setRoomMsg({ kind: "setup", text: "room_numbers テーブルが未作成です。Supabaseのセットアップが必要です。" });
      } else {
        setRoomMsg({ kind: "err", text: "保存に失敗しました。通信状況をご確認ください。" });
      }
    } finally {
      setRoomSaving(false);
    }
  }

  function refreshMembers() { setMembers(getMembers()); }

  function openAdd() {
    setForm({ nickname: "", role: "regular" });
    setModal({ open: true, editId: null });
  }
  function openEdit(m: Member) {
    setForm({ nickname: m.nickname, role: m.role });
    setModal({ open: true, editId: m.id });
  }
  function closeModal() { setModal({ open: false, editId: null }); }

  function handleSubmit() {
    const nickname = form.nickname.trim();
    if (!nickname) return;
    if (modal.editId) updateMember(modal.editId, { nickname, role: form.role });
    else addMember({ nickname, role: form.role });
    refreshMembers();
    closeModal();
  }
  function handleDelete(id: string) {
    if (!confirm("削除しますか？")) return;
    deleteMember(id);
    refreshMembers();
  }
  function handleReset() {
    resetToDefault();
    refreshMembers();
    setConfirmReset(false);
  }

  function toggleAttendance(id: string) {
    const next = new Set(attendance);
    if (next.has(id)) next.delete(id); else next.add(id);
    setAttState(next);
    setAttendance(Array.from(next));
  }
  function setAll(val: boolean) {
    const ids = val ? members.map((m) => m.id) : [];
    setAttState(new Set(ids));
    setAttendance(ids);
  }

  function handleRoomChange(slotId: string, memberId: string, val: string) {
    const room = val ? (val as RoomKey) : null;
    setMemberRoom(slotId, memberId, room);
    setRotations((prev) => {
      const slot = { ...(prev[slotId] ?? {}) };
      if (!room) delete slot[memberId];
      else slot[memberId] = room;
      return { ...prev, [slotId]: slot };
    });
  }

  const sorted        = [...members].sort((a, b) => roleOrder.indexOf(a.role) - roleOrder.indexOf(b.role));
  const attendingCount = members.filter((m) => attendance.has(m.id)).length;
  const attendingList  = sorted.filter((m) => attendance.has(m.id));
  const activeAssign   = rotations[activeSlot] ?? {};
  const assignedCount  = attendingList.filter((m) => activeAssign[m.id]).length;
  const moscowSetCount = officerTasks.filter((t) => priorities[t.id]).length;
  // 担当（RACI）を1人でも決めた「やること」の数
  const raciTaskCount  = officerTasks.filter((t) => RACI_PEOPLE.some((p) => raci[raciKey(t.id, p.id)])).length;

  return (
    <main className="min-h-screen pb-16" style={{ background: "#ffffff" }}>
      {/* Top bar */}
      <div className="sticky top-0 z-50 px-4 py-3 flex items-center gap-3" style={{ background: "#ffffff", borderBottom: "1px solid #eee" }}>
        <Link href="/" className="flex items-center gap-1.5 text-sm font-semibold px-3 py-2 rounded-xl card" style={{ color: "#555" }}>
          ← 戻る
        </Link>
        <h1 className="text-base font-black" style={{ color: "#2c2c2c" }}>管理画面</h1>
        {tab === "admin" && (
          <button
            onClick={openAdd}
            className="ml-auto flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold text-white"
            style={{ background: "linear-gradient(135deg,#A8175F,#C81E77)", boxShadow: "0 3px 10px rgba(168,23,95,0.3)" }}
          >
            ＋ 追加
          </button>
        )}
      </div>

      {/* ── タブ切替（部屋割り・メンバー / 役員専用 / 役員専用2）── */}
      <div className="px-4 pt-3 max-w-lg mx-auto">
        <div className="flex gap-1 p-1 rounded-xl" style={{ background: "#f4f0ea" }}>
          {([
            { key: "admin", label: "部屋割り・メンバー" },
            { key: "officer", label: "役員専用" },
            { key: "officer2", label: "役員専用2" },
          ] as const).map((t) => {
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className="flex-1 py-2.5 rounded-lg text-sm font-bold transition-colors"
                style={
                  active
                    ? { background: "linear-gradient(135deg,#A8175F,#C81E77)", color: "#fff", boxShadow: "0 2px 8px rgba(168,23,95,0.25)" }
                    : { background: "transparent", color: "#888" }
                }
              >
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── 役員専用タブ（ロックなし）── */}
      {/* このタブのみ高級感のある白基調・ミニマムなUI。全スタイルをインラインで自己完結させ、
          他画面のピンク系テーマを継承しない。優先度は役員が表で手動設定する。 */}
      {/* ── 合言葉の入力（役員専用・役員専用2で共通）── */}
      {/* 合言葉を入れるまで、右2つのタブの中身は一切描かない。片方を開ければもう片方も開く。 */}
      {(tab === "officer" || tab === "officer2") && !unlocked && (
        <div className="px-4 pt-5 pb-8 max-w-lg mx-auto">
          <div
            style={{
              background: "linear-gradient(180deg,#ffffff,#fdfcfa)",
              border: "1px solid #eee7db",
              borderRadius: 22,
              padding: "30px 26px 26px",
              boxShadow: "0 18px 50px -30px rgba(70,58,34,0.35)",
            }}
          >
            <p style={{ fontSize: 10.5, letterSpacing: "0.30em", color: "#bcb09c", fontWeight: 600, textTransform: "uppercase" }}>
              Officer
            </p>
            <h2 style={{ fontSize: 20, fontWeight: 800, color: "#1c1a17", marginTop: 8, letterSpacing: "0.01em" }}>
              合言葉を入れてください
            </h2>
            <p style={{ marginTop: 10, fontSize: 12.5, lineHeight: 1.9, color: "#8b8274" }}>
              ここから先は役員だけが使うページです。合言葉は役員のあいだで共有しています。
            </p>

            <form
              onSubmit={(e) => { e.preventDefault(); submitPasscode(); }}
              style={{ marginTop: 18, display: "flex", gap: 8 }}
            >
              <input
                type="password"
                inputMode="numeric"
                autoComplete="off"
                value={passInput}
                onChange={(e) => { setPassInput(e.target.value); setPassError(false); }}
                placeholder="合言葉"
                aria-label="合言葉"
                style={{
                  flex: 1,
                  padding: "11px 14px",
                  borderRadius: 11,
                  border: `1px solid ${passError ? "#c96a6a" : "#e3dccf"}`,
                  background: "#fff",
                  color: "#1c1a17",
                  fontSize: 15,
                  letterSpacing: "0.18em",
                  outline: "none",
                }}
              />
              <button
                type="submit"
                style={{
                  padding: "11px 22px",
                  borderRadius: 11,
                  border: "none",
                  background: "#1c1a17",
                  color: "#fff",
                  fontSize: 13.5,
                  fontWeight: 700,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                }}
              >
                開く
              </button>
            </form>

            {passError && (
              <p style={{ marginTop: 10, fontSize: 12, color: "#b25a5a" }}>
                合言葉が違います。もう一度入れてください。
              </p>
            )}

            <p style={{ marginTop: 16, fontSize: 11, lineHeight: 1.9, color: "#b3a794" }}>
              ※ 一度入れると、このタブを閉じるまで聞き直しません。ブラウザを閉じるとまた合言葉を聞きます。
            </p>
          </div>
        </div>
      )}

      {tab === "officer" && unlocked && (
        <div className="px-4 pt-5 pb-8 max-w-5xl mx-auto">
          <div
            style={{
              background: "linear-gradient(180deg,#ffffff,#fdfcfa)",
              border: "1px solid #eee7db",
              borderRadius: 22,
              padding: "30px 26px 26px",
              boxShadow: "0 18px 50px -30px rgba(70,58,34,0.35)",
            }}
          >
            {/* ヘッダー（読みやすさのため横幅を抑える）*/}
            <div style={{ maxWidth: 660 }}>
              <p style={{ fontSize: 10.5, letterSpacing: "0.30em", color: "#bcb09c", fontWeight: 600, textTransform: "uppercase" }}>
                Officers Only
              </p>
              <h2 style={{ marginTop: 12, fontSize: 23, fontWeight: 600, color: "#1c1a16", letterSpacing: "0.01em", lineHeight: 1.3 }}>
                オフ会運営タスク
              </h2>
              <p style={{ marginTop: 7, fontSize: 12.5, color: "#a2988a", letterSpacing: "0.05em" }}>
                やることリスト　｜　分類して、みんなで優先度を決める
              </p>

              <div style={{ height: 1, background: "#efe8dc", margin: "20px 0 16px" }} />

              {/* 優先度の説明（凡例）*/}
              <div>
                {priorityDefs.map((d) => (
                  <div key={d.key} style={{ display: "flex", alignItems: "baseline", gap: 10, padding: "6px 0" }}>
                    <span style={{ flexShrink: 0, width: 11, height: 11, borderRadius: "50%", background: d.accent, transform: "translateY(1px)" }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: "#33302a" }}>{d.label}</span>
                      <span style={{ fontSize: 11.5, color: "#9c927f", marginLeft: 8 }}>{d.hint}</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* 進み具合（優先度）*/}
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginTop: 16, marginBottom: 10 }}>
                <span style={{ fontSize: 11.5, color: "#a2988a" }}>各行で1つ選ぶ・みんなで共有</span>
                <span style={{ fontSize: 12, color: "#8b8274" }}>
                  設定済み <b style={{ fontFamily: "Georgia,serif", fontWeight: 400, color: "#5f5747" }}>{moscowSetCount}</b>
                  <span style={{ color: "#bcb09c" }}> / {officerTasks.length}</span>
                </span>
              </div>

              {/* ── 担当・役割（RACIチャート）の説明 ── */}
              <div style={{ height: 1, background: "#efe8dc", margin: "20px 0 14px" }} />
              <p style={{ fontSize: 12.5, fontWeight: 700, color: "#33302a", letterSpacing: "0.04em" }}>役割（だれが・どう関わるか）</p>
              <p style={{ marginTop: 6, fontSize: 11.5, color: "#a2988a", lineHeight: 1.7 }}>
                表の右側で、やることごとに「だれが、どう関わるか」を、次の4つの役割から決めます。名前ごとにプルダウンで選ぶだけ・みんなで共有されます。
              </p>
              <div style={{ marginTop: 10 }}>
                {raciDefs.map((d) => (
                  <div key={d.key} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "7px 0" }}>
                    <span style={{ flexShrink: 0, width: 11, height: 11, borderRadius: "50%", background: d.accent, transform: "translateY(4px)" }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: "#33302a" }}>{d.label}</span>
                      <div style={{ marginTop: 3, fontSize: 11.5, color: "#9c927f", lineHeight: 1.65 }}>{d.hint}</div>
                      <div style={{ marginTop: 3, fontSize: 11, color: "#b3a794", lineHeight: 1.6 }}>
                        <span style={{ color: "#c0a469", fontWeight: 700 }}>例</span>　{d.example}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <p style={{ marginTop: 10, fontSize: 11.5, color: "#8b8274", lineHeight: 1.7 }}>
                役割をつける人：
                {RACI_PEOPLE.map((p, i) => (
                  <span key={p.id}>
                    {i > 0 && "・"}
                    <b style={{ color: "#5c5646" }}>{p.name}</b>
                    <span style={{ color: "#b3a794" }}>（{raciPersonSubLabel(p.role)}）</span>
                  </span>
                ))}
              </p>

              {/* 進み具合（役割）*/}
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginTop: 12, marginBottom: 2 }}>
                <span style={{ fontSize: 11.5, color: "#a2988a" }}>「責任者」は1つにつき1人・「担当者」は何人でも・みんなで共有</span>
                <span style={{ fontSize: 12, color: "#8b8274" }}>
                  役割を決めた数 <b style={{ fontFamily: "Georgia,serif", fontWeight: 400, color: "#5f5747" }}>{raciTaskCount}</b>
                  <span style={{ color: "#bcb09c" }}> / {officerTasks.length}</span>
                </span>
              </div>

            </div>

            {officerMsg && (
              <div style={{ margin: "4px 0 12px", padding: "8px 12px", borderRadius: 10, background: "rgba(176,137,72,0.10)", border: "1px solid #e7d8bf", fontSize: 11.5, color: "#8a6b32", lineHeight: 1.6 }}>
                {officerMsg}
              </div>
            )}
            {/* 大きな横長の表：スマホは横スクロール／PCは大きく表示 */}
            <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
              {/* 折り返しをやめたぶん、全列が潰れない幅を確保（狭い画面では従来どおり横スクロール） */}
              <table style={{ width: "100%", minWidth: 1600, borderCollapse: "collapse" }}>
                <colgroup>
                  <col style={{ width: "11%" }} />
                  <col style={{ width: "12.5%" }} />
                  <col style={{ width: "10.5%" }} />
                  <col style={{ width: "19%" }} />
                  <col style={{ width: "5.5%" }} />
                  <col style={{ width: "5.5%" }} />
                  <col style={{ width: "5.5%" }} />
                  <col style={{ width: "5.5%" }} />
                  <col style={{ width: "6.25%" }} />
                  <col style={{ width: "6.25%" }} />
                  <col style={{ width: "6.25%" }} />
                  <col style={{ width: "6.25%" }} />
                </colgroup>
                <thead>
                  {/* 1段目：セクションの見出し（優先度／担当）*/}
                  <tr style={{ background: "#fff" }}>
                    <th rowSpan={2} style={{ textAlign: "left", padding: "10px 12px", borderBottom: "2px solid #e7dfd1", borderRight: "2px solid #e3d7c2", fontSize: 12, fontWeight: 700, color: "#8b8274", verticalAlign: "middle" }}>係（持ち場）</th>
                    <th rowSpan={2} style={{ textAlign: "left", padding: "10px 12px", borderBottom: "2px solid #e7dfd1", borderRight: "1px solid #eadfce", fontSize: 12, fontWeight: 700, color: "#8b8274", verticalAlign: "middle" }}>大分類</th>
                    <th rowSpan={2} style={{ textAlign: "left", padding: "10px 12px", borderBottom: "2px solid #e7dfd1", borderRight: "1px solid #f0ebe1", fontSize: 12, fontWeight: 700, color: "#8b8274", verticalAlign: "middle" }}>中分類</th>
                    <th rowSpan={2} style={{ textAlign: "left", padding: "10px 12px", borderBottom: "2px solid #e7dfd1", fontSize: 12, fontWeight: 700, color: "#8b8274", verticalAlign: "middle" }}>やること（小分類）</th>
                    <th colSpan={4} style={{ textAlign: "center", padding: "8px 6px", borderBottom: "1px solid #eadfce", borderLeft: "2px solid #eee3d2", fontSize: 11, fontWeight: 700, color: "#8b8274", letterSpacing: "0.06em", whiteSpace: "nowrap" }}>優先度（どれか1つ）</th>
                    <th colSpan={RACI_PEOPLE.length} style={{ textAlign: "center", padding: "8px 6px", borderBottom: "1px solid #eadfce", borderLeft: "2px solid #e3d7c2", fontSize: 11, fontWeight: 700, color: "#8b8274", letterSpacing: "0.06em", whiteSpace: "nowrap" }}>役割（だれが・どう関わる）</th>
                  </tr>
                  {/* 2段目：各列の見出し */}
                  <tr style={{ background: "#fff" }}>
                    {priorityDefs.map((d, di) => (
                      <th key={d.key} style={{ textAlign: "center", padding: "10px 4px", borderBottom: "2px solid #e7dfd1", borderLeft: di === 0 ? "2px solid #eee3d2" : undefined, fontSize: 11, fontWeight: 700, color: d.accent, whiteSpace: "nowrap" }}>
                        {d.label}
                      </th>
                    ))}
                    {RACI_PEOPLE.map((p, pi) => (
                      <th key={p.id} style={{ textAlign: "center", padding: "10px 6px", borderBottom: "2px solid #e7dfd1", borderLeft: pi === 0 ? "2px solid #e3d7c2" : "1px solid #f0ebe1", fontSize: 11.5, fontWeight: 700, color: "#5c5646", whiteSpace: "nowrap" }}>
                        {p.name}
                        <div style={{ marginTop: 2, fontSize: 9.5, fontWeight: 600, color: "#b3a794", letterSpacing: "0.04em" }}>{raciPersonSubLabel(p.role)}</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {officerRows.map((row, i) => {
                    const task = row.task;
                    const cur = priorities[task.id];
                    const dept = row.dept ? officerDepts.find((d) => d.key === row.dept) : undefined;
                    const majorEnd = i === officerRows.length - 1 || Boolean(officerRows[i + 1].major);
                    const rowBorder = majorEnd ? "1px solid #e7dfd1" : "1px solid #f4efe6";
                    // 「A 責任者」が複数ついている行は注意表示（1人が目安）
                    const aCount = RACI_PEOPLE.filter((p) => raci[raciKey(task.id, p.id)] === "a").length;
                    // 表の背景は全行とも白で統一（優先度による色分けはしない）。区切りは罫線のみ。
                    return (
                      <tr key={task.id} style={{ background: "#fff" }}>
                        {row.dept && (
                          <td rowSpan={row.deptSpan} style={{ background: "#fdfbf7", borderRight: "2px solid #e3d7c2", borderBottom: "1px solid #e3d7c2", verticalAlign: "middle", padding: "14px 12px" }}>
                            <div style={{ fontSize: 13, fontWeight: 700, color: "#5c5646", lineHeight: 1.45 }}>
                              {dept?.label}
                            </div>
                            <div style={{ marginTop: 3, fontSize: 10.5, fontWeight: 600, color: "#b3a794", letterSpacing: "0.04em" }}>
                              {dept?.note}
                            </div>
                          </td>
                        )}
                        {row.major && (
                          <td rowSpan={row.majorSpan} style={{ background: "#fff", borderRight: "1px solid #eadfce", borderBottom: "1px solid #e7dfd1", verticalAlign: "middle", padding: "14px 12px" }}>
                            <div style={{ fontFamily: "Georgia,serif", fontSize: 12, color: "#c3b48f", letterSpacing: "0.06em", marginBottom: 5 }}>{row.majorNo}</div>
                            <div style={{ fontSize: 13.5, fontWeight: 700, color: "#2e2a22", lineHeight: 1.45, whiteSpace: "nowrap" }}>{row.major}</div>
                          </td>
                        )}
                        {row.mid && (
                          <td rowSpan={row.midSpan} style={{ background: "#fff", borderRight: "1px solid #f0ebe1", borderBottom: "1px solid #efe6d6", verticalAlign: "middle", padding: "12px 12px" }}>
                            <span style={{ fontSize: 12.5, fontWeight: 600, color: "#5c5646", lineHeight: 1.5, whiteSpace: "nowrap" }}>{row.mid}</span>
                          </td>
                        )}
                        {/* やること名は折り返さない（2行になると結合セルとの高さが崩れるため）。列幅は内容に合わせて伸びる（表は横スクロール可） */}
                        <td style={{ padding: "12px 12px", borderBottom: rowBorder, verticalAlign: "middle" }}>
                          <span style={{ fontSize: 13, fontWeight: 500, color: "#241f18", lineHeight: 1.5, whiteSpace: "nowrap" }}>{task.label}</span>
                          {aCount >= 2 && (
                            <div style={{ marginTop: 4, fontSize: 10.5, color: "#b08948", lineHeight: 1.5 }}>※「責任者」が複数います。1人にしぼるのがおすすめ</div>
                          )}
                        </td>
                        {priorityDefs.map((d, di) => {
                          const on = cur === d.key;
                          return (
                            <td key={d.key} style={{ textAlign: "center", padding: "9px 4px", borderBottom: rowBorder, borderLeft: di === 0 ? "2px solid #eee3d2" : undefined, verticalAlign: "middle" }}>
                              <button
                                type="button"
                                onClick={() => setTaskPriority(task.id, d.key)}
                                aria-label={`「${task.label}」を「${d.label}」にする`}
                                aria-pressed={on}
                                style={{
                                  width: 26, height: 26, borderRadius: "50%", padding: 0, cursor: "pointer",
                                  border: on ? `1.5px solid ${d.accent}` : "1.5px solid #dad2c4",
                                  background: on ? d.accent : "transparent",
                                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                                  transition: "background .12s, border-color .12s",
                                }}
                              >
                                {on && <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#fff" }} />}
                              </button>
                            </td>
                          );
                        })}
                        {/* 担当・役割（RACI）：名前ごとにプルダウンで選ぶ・全員で共有 */}
                        {RACI_PEOPLE.map((p, pi) => {
                          const role = raci[raciKey(task.id, p.id)];
                          const def = raciDefs.find((d) => d.key === role);
                          return (
                            <td key={p.id} style={{ textAlign: "center", padding: "8px 6px", borderBottom: rowBorder, borderLeft: pi === 0 ? "2px solid #e3d7c2" : "1px solid #f4efe6", verticalAlign: "middle" }}>
                              <select
                                value={role ?? ""}
                                onChange={(e) => setTaskAssignee(task.id, p.id, e.target.value ? (e.target.value as RaciRole) : null)}
                                aria-label={`「${task.label}」の${p.name}さんの役割`}
                                style={{
                                  width: "100%", maxWidth: 98, fontSize: 11.5, padding: "5px 4px", borderRadius: 8, cursor: "pointer",
                                  border: def ? `1.5px solid ${def.accent}` : "1px solid #dad2c4",
                                  background: def ? def.tint : "#fff",
                                  color: def ? def.accent : "#8b8274",
                                  fontWeight: def ? 700 : 500,
                                }}
                              >
                                <option value="">—</option>
                                {raciDefs.map((d) => (
                                  <option key={d.key} value={d.key}>{d.short}</option>
                                ))}
                              </select>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* 集計 */}
            <div style={{ maxWidth: 660, display: "flex", flexWrap: "wrap", gap: "7px 16px", marginTop: 18, paddingTop: 14, borderTop: "1px solid #efe8dc" }}>
              {priorityDefs.map((d) => {
                const n = officerTasks.filter((t) => priorities[t.id] === d.key).length;
                return (
                  <span key={d.key} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11.5, color: "#7d7568" }}>
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: d.accent }} />
                    {d.label}
                    <b style={{ fontFamily: "Georgia,serif", fontWeight: 400, color: d.accent }}>{n}</b>
                  </span>
                );
              })}
              <span style={{ fontSize: 11.5, color: "#b3a794" }}>未設定 {officerTasks.length - moscowSetCount}</span>
            </div>

            {/* 集計（担当・RACI：だれが何件の「担当(R)」か）*/}
            <div style={{ maxWidth: 660, display: "flex", flexWrap: "wrap", alignItems: "center", gap: "7px 16px", marginTop: 10 }}>
              <span style={{ fontSize: 11.5, color: "#a2988a" }}>「担当者」の数：</span>
              {RACI_PEOPLE.map((p) => {
                const n = officerTasks.filter((t) => raci[raciKey(t.id, p.id)] === "r").length;
                return (
                  <span key={p.id} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11.5, color: "#7d7568" }}>
                    {p.name}
                    <b style={{ fontFamily: "Georgia,serif", fontWeight: 400, color: "#a9823f" }}>{n}</b>
                  </span>
                );
              })}
            </div>

            {/* リセット */}
            <div style={{ marginTop: 20 }}>
              {!confirmMoscowReset ? (
                <button
                  type="button"
                  onClick={() => setConfirmMoscowReset(true)}
                  style={{ fontSize: 11.5, color: "#b0a794", background: "transparent", border: "none", cursor: "pointer", textDecoration: "underline", textUnderlineOffset: 3, padding: 0 }}
                >
                  入力をすべてリセット（優先度・役割）
                </button>
              ) : (
                <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
                  <span style={{ fontSize: 12, color: "#8b8274" }}>全員ぶんの優先度と役割をすべて消しますか？（元に戻せません）</span>
                  <button type="button" onClick={() => setConfirmMoscowReset(false)} style={{ fontSize: 12, padding: "6px 13px", borderRadius: 9, border: "1px solid #e3dccf", background: "#fff", color: "#8b8274", cursor: "pointer" }}>
                    やめる
                  </button>
                  <button type="button" onClick={resetPriorities} style={{ fontSize: 12, padding: "6px 13px", borderRadius: 9, border: "none", background: "#1c1a17", color: "#fff", cursor: "pointer" }}>
                    リセット
                  </button>
                </div>
              )}
            </div>

            {/* フッター注記 */}
            <p style={{ maxWidth: 660, marginTop: 18, fontSize: 11, lineHeight: 1.9, color: "#b3a794" }}>
              ※ 左側は「必ず／なるべく／できたら／今回はやらない」の4段階で優先度をつける進め方（MoSCoW法を参考）、右側は「担当者／責任者／相談役／お知らせ」の4つで役割を分ける表（RACIという役割分担の考え方を参考）です。分類は内容から推し量った暫定です。役員MTGで話しながら見直していきましょう。
            </p>
          </div>
        </div>
      )}

      {/* ── 役員専用2タブ ── */}
      {/* マニュアルにあった表の見た目と操作感だけを置いてある。中身はこれから入れる。 */}
      {tab === "officer2" && unlocked && <OfficerRoleTable />}

      {/* 施錠に戻す（人に画面を渡すときなど）。解錠中だけ、目立たない形で出す。 */}
      {(tab === "officer" || tab === "officer2") && unlocked && (
        <div className="px-4 pb-10 max-w-5xl mx-auto">
          <button
            type="button"
            onClick={lockOfficer}
            style={{ fontSize: 11.5, color: "#b0a794", background: "transparent", border: "none", cursor: "pointer", textDecoration: "underline", textUnderlineOffset: 3, padding: 0 }}
          >
            合言葉の入力に戻す
          </button>
        </div>
      )}

      {tab === "admin" && (
      <div className="px-4 pt-3 max-w-lg mx-auto flex flex-col gap-4">

        {/* ── 部屋番号（当日の実部屋番号を全員に共有）── */}
        <div className="card overflow-hidden">
          <div className="px-4 py-4 border-b" style={{ borderColor: "#f4f0ea" }}>
            <p className="text-base font-black" style={{ color: "#2c2c2c" }}>部屋番号（当日）</p>
            <p className="text-sm mt-0.5 leading-relaxed" style={{ color: "#aaa" }}>
              A / B / C の実際の部屋番号を入力して保存すると、TOPの部屋割り表に表示され、全員がこのアプリから確認できます。
            </p>
          </div>
          <div className="px-4 py-4 flex flex-col gap-3">
            {(["A", "B", "C"] as const).map((r) => (
              <div key={r} className="flex items-center gap-3">
                <span
                  className="flex-shrink-0 inline-flex items-center justify-center rounded-lg text-white text-sm font-black"
                  style={{ width: 40, height: 40, background: roomCfg[r].gradient }}
                >
                  {r}
                </span>
                <input
                  value={roomNos[r]}
                  onChange={(e) => setRoomNos((p) => ({ ...p, [r]: e.target.value }))}
                  placeholder="例：305号室 / 大部屋 など"
                  maxLength={20}
                  className="flex-1 min-w-0 px-3 py-2.5 rounded-xl text-sm"
                  style={{ border: "1px solid #e5e7eb", background: "#fff", color: "#2c2c2c" }}
                />
              </div>
            ))}
            <button
              onClick={handleSaveRoomNumbers}
              disabled={roomSaving}
              className="mt-1 py-2.5 rounded-xl text-sm font-bold text-white"
              style={{ background: "linear-gradient(135deg,#A8175F,#C81E77)", opacity: roomSaving ? 0.6 : 1 }}
            >
              {roomSaving ? "保存中…" : "保存して全員に共有"}
            </button>
            {roomMsg && (
              <p
                className="text-xs font-bold leading-relaxed"
                style={{ color: roomMsg.kind === "ok" ? "#10b981" : roomMsg.kind === "setup" ? "#A8175F" : "#ff6b6b" }}
              >
                {roomMsg.text}
              </p>
            )}
          </div>
        </div>

        {/* ── 出欠確認 ── */}
        <div className="card overflow-hidden">
          <div className="px-4 py-4 flex items-center justify-between border-b" style={{ borderColor: "#f4f0ea" }}>
            <div>
              <p className="text-base font-black" style={{ color: "#2c2c2c" }}>出欠確認</p>
              <p className="text-sm mt-0.5" style={{ color: "#aaa" }}>参加：{attendingCount}名 / 全{members.length}名</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setAll(true)}  className="text-sm px-3 py-2.5 rounded-xl font-bold" style={{ background: "#f3f4f6", color: "#6b7280" }}>全員参加</button>
              <button onClick={() => setAll(false)} className="text-sm px-3 py-2.5 rounded-xl font-bold" style={{ background: "#fff0f0", color: "#ff6b6b" }}>全員不参加</button>
            </div>
          </div>
          <div className="px-3 py-3 grid grid-cols-2 gap-2">
            {sorted.map((m) => {
              const isAtt = attendance.has(m.id);
              return (
                <button
                  key={m.id}
                  onClick={() => toggleAttendance(m.id)}
                  className="flex items-center gap-2.5 px-3 py-3.5 rounded-2xl text-left transition-all duration-150"
                  style={{
                    background: isAtt ? "#ffffff" : "#f4f4f4",
                    border: `2px solid ${isAtt ? "#6b7280" : "transparent"}`,
                  }}
                >
                  <span
                    className="flex-shrink-0 inline-block rounded-md"
                    style={{
                      width: 18,
                      height: 18,
                      background: isAtt ? "#6b7280" : "transparent",
                      border: `2px solid ${isAtt ? "#6b7280" : "#cfcfcf"}`,
                    }}
                  />
                  <span className="text-sm font-semibold truncate" style={{ color: isAtt ? "#374151" : "#888" }}>
                    {m.nickname}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── 部屋割り設定 ── */}
        <div className="card overflow-hidden">
          <div className="px-4 py-4 border-b" style={{ borderColor: "#f4f0ea" }}>
            <p className="text-base font-black" style={{ color: "#2c2c2c" }}>部屋割り設定</p>
            <p className="text-sm mt-0.5" style={{ color: "#aaa" }}>ローテーションごとに部屋を選んでください</p>
          </div>

          {/* Slot selector tabs */}
          {rotationSlots.length > 0 && (
            <div className="px-3 pt-3 pb-2 flex gap-2 overflow-x-auto">
              {rotationSlots.map((slot) => {
                const isSel = activeSlot === slot.id;
                return (
                  <button
                    key={slot.id}
                    onClick={() => setActiveSlot(slot.id)}
                    className="flex-shrink-0 px-4 py-2.5 rounded-2xl text-sm font-black transition-all"
                    style={{
                      background: isSel ? "linear-gradient(135deg,#A8175F,#C81E77)" : "#f0ece5",
                      color: isSel ? "white" : "#aaa",
                      boxShadow: isSel ? "0 3px 10px rgba(168,23,95,0.3)" : "none",
                    }}
                  >
                    {slot.label}
                  </button>
                );
              })}
            </div>
          )}

          {/* Active slot info bar */}
          {rotationSlots.length > 0 && (
            <div className="px-4 py-2.5 flex items-center justify-between" style={{ background: "#fafaf8" }}>
              <p className="text-sm font-semibold" style={{ color: "#888" }}>
                {rotationSlots.find((s) => s.id === activeSlot)?.startTime}〜
                {rotationSlots.find((s) => s.id === activeSlot)?.endTime}
              </p>
              <p className="text-sm font-bold" style={{ color: assignedCount === attendingList.length && attendingList.length > 0 ? "#10b981" : "#aaa" }}>
                {assignedCount}/{attendingList.length}名 設定済み
              </p>
            </div>
          )}

          {/* Member assignment list */}
          {attendingList.length === 0 ? (
            <div className="px-4 py-10 text-center">
              <p className="text-base" style={{ color: "#ccc" }}>出欠確認で参加者を選択してください</p>
            </div>
          ) : (
            <div className="divide-y" style={{ borderColor: "#f4f0ea" }}>
              {attendingList.map((m) => {
                const current = activeAssign[m.id] ?? "";
                return (
                  <div key={m.id} className="flex items-center gap-3 px-4 py-3.5">
                    <p className="text-base font-bold flex-1" style={{ color: "#2c2c2c" }}>{m.nickname}</p>
                    <div className="flex gap-2">
                      {(["", "A", "B", "C"] as const).map((val) => {
                        const isCur = current === val;
                        const label = val || "未";
                        const cfgKey = val as RoomKey;
                        const btnBg = isCur
                          ? (val ? roomCfg[cfgKey].gradient : "linear-gradient(135deg,#888,#aaa)")
                          : "#f0ece5";
                        return (
                          <button
                            key={val}
                            onClick={() => handleRoomChange(activeSlot, m.id, val)}
                            className="rounded-2xl font-black text-sm transition-all"
                            style={{
                              background: btnBg,
                              color: isCur ? "white" : "#bbb",
                              width: "48px",
                              height: "44px",
                              flexShrink: 0,
                            }}
                          >
                            {label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── メンバー一覧 ── */}
        <div className="card overflow-hidden">
          <div className="px-4 py-4 border-b" style={{ borderColor: "#f4f0ea" }}>
            <p className="text-base font-black" style={{ color: "#2c2c2c" }}>メンバー一覧</p>
          </div>
          {sorted.length === 0 ? (
            <div className="py-12 text-center" style={{ color: "#bbb" }}>
              <p className="text-base">メンバーがいません</p>
            </div>
          ) : (
            <div className="divide-y" style={{ borderColor: "#f4f0ea" }}>
              {sorted.map((m) => {
                const cfg = roleConfig[m.role];
                return (
                  <div key={m.id} className="flex items-center gap-3 px-4 py-3.5">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 text-base font-black" style={{ background: cfg.bg, color: cfg.text }}>
                      {m.nickname.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-base font-bold truncate" style={{ color: "#2c2c2c" }}>{m.nickname}</p>
                      <span className="text-xs font-semibold px-1.5 py-0.5 rounded-md" style={{ background: cfg.bg, color: cfg.text }}>
                        {cfg.label}
                      </span>
                    </div>
                    <button onClick={() => openEdit(m)} className="px-3 py-2 rounded-xl text-xs font-bold" style={{ background: "#f4f0ea", color: "#888" }}>編集</button>
                    <button onClick={() => handleDelete(m.id)} className="px-3 py-2 rounded-xl text-xs font-bold" style={{ background: "#fff0f0", color: "#ff6b6b" }}>削除</button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* アーカイブ・動作確認ページへ */}
        <div className="flex gap-2">
          <Link
            href="/archive"
            className="flex-1 py-3.5 rounded-xl text-sm font-semibold text-center"
            style={{ background: "#f4f0ea", color: "#888" }}
          >
            部屋割りアーカイブ
          </Link>
          <Link
            href="/test"
            className="flex-1 py-3.5 rounded-xl text-sm font-semibold text-center"
            style={{ background: "#f4f0ea", color: "#888" }}
          >
            会員メニュー
          </Link>
        </div>

        {/* Reset */}
        {!confirmReset ? (
          <button onClick={() => setConfirmReset(true)} className="w-full py-3.5 rounded-xl text-sm font-semibold" style={{ background: "#f4f0ea", color: "#aaa" }}>
            デフォルトメンバーに戻す
          </button>
        ) : (
          <div className="card p-4 text-center">
            <p className="text-base font-semibold mb-3" style={{ color: "#555" }}>本当にリセットしますか？</p>
            <div className="flex gap-2">
              <button onClick={() => setConfirmReset(false)} className="flex-1 py-3 rounded-xl text-base font-semibold" style={{ background: "#f4f0ea", color: "#888" }}>キャンセル</button>
              <button onClick={handleReset} className="flex-1 py-3 rounded-xl text-base font-bold text-white" style={{ background: "#ff6b6b" }}>リセット</button>
            </div>
          </div>
        )}
      </div>
      )}

      {/* ── Add/Edit Modal ── */}
      {modal.open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center"
          style={{ background: "rgba(0,0,0,0.4)" }}
          onClick={(e) => e.target === e.currentTarget && closeModal()}
        >
          <div className="w-full max-w-lg rounded-t-3xl p-6 pop-in" style={{ background: "#fff" }}>
            <div className="w-10 h-1 rounded-full mx-auto mb-5" style={{ background: "#e0e0e0" }} />
            <h2 className="text-lg font-black mb-5" style={{ color: "#2c2c2c" }}>
              {modal.editId ? "メンバーを編集" : "メンバーを追加"}
            </h2>
            <div className="mb-4">
              <label className="text-sm font-bold mb-2 block" style={{ color: "#888" }}>ニックネーム</label>
              <input
                type="text"
                value={form.nickname}
                onChange={(e) => setForm((f) => ({ ...f, nickname: e.target.value }))}
                placeholder="例：よしの助"
                className="w-full rounded-xl px-4 py-3.5 text-base font-medium focus:outline-none"
                style={{ background: "#f4f0ea", color: "#2c2c2c", border: "2px solid transparent" }}
                onFocus={(e) => (e.target.style.border = "2px solid #C81E7760")}
                onBlur={(e)  => (e.target.style.border = "2px solid transparent")}
                autoFocus
              />
            </div>
            <div className="mb-6">
              <label className="text-sm font-bold mb-2 block" style={{ color: "#888" }}>ロール</label>
              <div className="grid grid-cols-4 gap-2">
                {roleOrder.map((role) => {
                  const cfg = roleConfig[role];
                  const selected = form.role === role;
                  return (
                    <button
                      key={role}
                      onClick={() => setForm((f) => ({ ...f, role }))}
                      className="py-3 rounded-xl text-sm font-bold transition-all"
                      style={{
                        background: selected ? cfg.bg : "#f4f0ea",
                        color:      selected ? cfg.text : "#aaa",
                        border:     selected ? `2px solid ${cfg.text}40` : "2px solid transparent",
                      }}
                    >
                      {cfg.label}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={closeModal} className="flex-1 py-3.5 rounded-xl text-base font-semibold" style={{ background: "#f4f0ea", color: "#888" }}>
                キャンセル
              </button>
              <button
                onClick={handleSubmit}
                disabled={!form.nickname.trim()}
                className="flex-1 py-3.5 rounded-xl text-base font-bold text-white transition-opacity"
                style={{
                  background: "linear-gradient(135deg,#A8175F,#C81E77)",
                  boxShadow: "0 3px 10px rgba(168,23,95,0.3)",
                  opacity: form.nickname.trim() ? 1 : 0.4,
                }}
              >
                {modal.editId ? "保存" : "追加"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
