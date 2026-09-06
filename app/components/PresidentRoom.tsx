"use client";

/* ============================================================
   アフリカハートのTOPページ（もとは社長室の下書き）
   ------------------------------------------------------------
   管理画面 ＞ 社長室 で試作していた画面を、9/6 にそのままTOP（app/page.tsx）へ移した。
   管理画面の社長室タブにも同じものが出る（暗証番号は移したときに外した）。

   【いまのスコープ】左のメニューと、「会員ページ」（会員がスマホで見る画面）と
     「設定」。設定の下は 9/6 から2つに分かれていて、
       会員メニュー … アーカイブ／デュエット／宿題ルーレット／歌唱順ルーレット／
                      プロフィール／ギャラリー（合言葉は要らない）
       役員専用     … 会員名簿／役員専用／役員専用2／アンケート（合言葉810の後ろ）
     MENU の label を書き換えれば名前は差し替わる。
     足すときは MENU に一行足すだけでよい（id は空いている番号を使う）。
     ただし設定の下の5機能だけは app/components/memberFeatures.tsx の一覧から作っているので、
     名前を変える・機能を足すのはそちらで（会員メニューにも同時に反映される）。
     会員ページの「このあとの準備」の3行からも、設定の下のその機能へ直に移れる
     （9/6。下の openFeature が、機能の id をメニューの項目の id に読み替えている）。

   【色の方針】
   メニューはグレーだけで組む。オレンジはロゴが持っているので、
   ボタンや選択の印には使わない。面は本文と同じ白にして、区切りは右の罫線1本。
   選んでいる場所は、薄いグレーの角丸をひとつ敷いて「押されているボタン」として
   見せ、字を少し濃く太くする。左右を少し内側に寄せてあるので、地の白との間に
   余白ができ、帯ではなくボタンに見える。
   色の差は小さく、形と濃さで伝える＝大人のオフ会に似合う静かな見え方。

   【幅の考え方】
   ・パソコン（768px以上）＝左にメニューを出したままにする
   ・スマホ（768px未満）＝メニューはしまっておき、ボタンで引き出す
   ============================================================ */

import { useEffect, useState } from "react";
import PresidentTable from "@/app/components/PresidentTable";
import MemberDraft from "@/app/components/MemberDraft";
import PresidentArchive from "@/app/components/PresidentArchive";
import PresidentFeature from "@/app/components/PresidentFeature";
import PresidentSurvey from "@/app/components/PresidentSurvey";
// 役員だけが使う2つ。9/6 に 管理画面 ＞ 役員専用・役員専用2 から場所を広げた（管理画面にも残してある）。
import OfficerGate from "@/app/components/OfficerGate";
import OfficerPlan from "@/app/components/OfficerPlan";
import OfficerRoleTable from "@/app/components/OfficerRoleTable";
import { features } from "@/app/components/memberFeatures";

/* すべて色味を持たない中間色のグレー。
   以前は暖色寄りのグレーにしていたが、画面ではベージュに見えてしまうため、
   赤み・黄みを抜いた本物のグレーにそろえている。 */
const INK      = "#1B1C1E"; // 主要テキスト（ほぼ黒）
// 補助テキストの #63666C は globals.css の .pr-item が持っている（ホバーを効かせるため）
const LINE     = "#DFE1E4"; // 繊細な罫線
const SIDE_BG  = "#FFFFFF"; // メニューの地（本文と同じ白。区切りは右の罫線だけ）
/* 白 → マウスを乗せた行(#F1F2F4) → 選んでいる行(#E1E2E5) の三段。

   選んでいる行の色は、明るさを少し落として密度を持たせたピューター（錫）寄りの
   グレーにしている。淡すぎるグレーは「既定の灰色」に見えて安っぽく、
   青みが強いグレーは冷たく事務的に見える。青と赤の差を4におさえた
   ほぼ中間色のまま、明るさだけ落とすと、静かで上質な面になる。
   （暖色寄りのグレーは画面でベージュに見えてしまうので使わない） */
const SEL_BG   = "#E1E2E5"; // 選んでいる行の地（これだけで選択を示す）
const SEL_R    = 8;         // 選んでいる行の角の丸み（ボタンに見せる）
const SEL_INSET = 10;       // 左右の内寄せ。この分だけ白が残ってボタンに見える
const SURFACE  = "#FFFFFF"; // 本文の面

// 名前は決まったものから差し替えていく。並び順もここで決まる。
// id は保存に使う値なので、名前を変えても id は変えないこと。
// children を持たせると、その項目の下にぶら下がる。下の下まで（3段）出せる。
type MenuNode = { id: string; label: string; children?: MenuNode[] };

const MENU: MenuNode[] = [
  // 会員がスマホで見る画面。中身は app/components/MemberDraft.tsx。
  // 名前は 会員画面UIUX → Member Screen UI/UX → TOPページ → 会員ページ（いずれも 9/6）と
  // 変えてきた。名前だけを変えていて、id の "m17" はそのまま（id は変えないこと）。
  { id: "m17", label: "会員ページ" },
  // 以前ここに「1〜15」という名前も中身も無い枠が並んでいたが、
  // 何も入っていない行がメニューを長くするだけだったので外した。
  // 項目を足すときは、ここに一行足す。id は "m1"〜"m9"・"m11"〜"m16" が空いている
  // （"m10" は設定、"m17" は 会員ページ が使っている）。
  {
    // 設定の下は「会員メニュー」と「役員専用」の2つだけ（9/6 にこの形にした）。
    // それまでは9つのページが1列に並んでいて、会員が見てよいものと役員だけのものが
    // 混ざっていた。誰のためのページかで2つに分けて、役員側にだけ合言葉を立てている。
    id: "m10", label: "設定",
    children: [
      {
        // 会員が見てよいもの。合言葉は要らない。
        id: "m10-member", label: "会員メニュー",
        children: [
          // これまでのオフ会（タイムテーブルと参加者）。中身は app/components/PresidentArchive.tsx。
          { id: "m10-archive", label: "アーカイブ" },
          // 会員メニューの5つの機能（デュエット／宿題ルーレット／歌唱順ルーレット／プロフィール／ギャラリー）。
          // 9/6 に会員メニューから場所を移した。並びと名前は app/components/memberFeatures.tsx のまま。
          // 中身は app/components/PresidentFeature.tsx（会員メニューと同じ部品を出すだけ）。
          ...features.map((f) => ({ id: `m10-${f.id}`, label: f.tab })),
        ],
      },
      {
        // 役員だけのもの。この4つは合言葉（810）の後ろに置く（9/6）。
        // 名簿は会員の呼び名がぜんぶ並ぶ表、アンケートは全員の回答が読める。
        // どちらも人のことが書いてあるので、役員側に寄せた。
        // 束ねる枠の id は "m10-staff"。中の「役員専用」のページは "m10-officer" のままで、
        // 名前は同じでも別のもの（id は変えないこと）。
        id: "m10-staff", label: "役員専用",
        children: [
          { id: "m10-roster", label: "会員名簿" },
          // 9/6 に 管理画面 ＞ 役員専用・役員専用2 から、中身も見た目も変えずに広げた
          // （管理画面のタブもそのまま残してある。どちらから開いても書いたものは同じ）。
          { id: "m10-officer",  label: "役員専用" },
          { id: "m10-officer2", label: "役員専用2" },
          // 参加者アンケート。/survey と同じものを出す（app/components/PresidentSurvey.tsx）。
          { id: "m10-survey", label: "アンケート" },
        ],
      },
    ],
  },
];

// 合言葉（810）の後ろに置くページ。ここに id を足すと、そのページも聞かれるようになる。
// 4つで1つの OfficerGate を分け合うので、どれかで一度入れれば残りも開く。
const STAFF_IDS = ["m10-roster", "m10-officer", "m10-officer2", "m10-survey"];

// その項目にたどり着くまでに通る親の id を、上から順に返す（無ければ null）。
// 「このあとの準備」から機能へ飛ぶとき、途中の枠をぜんぶ開くのに使う。
function pathTo(nodes: MenuNode[], id: string, trail: string[] = []): string[] | null {
  for (const n of nodes) {
    if (n.id === id) return trail;
    const hit = n.children ? pathTo(n.children, id, [...trail, n.id]) : null;
    if (hit) return hit;
  }
  return null;
}

/* メニューの1項目。下にぶら下がりがある項目は、押すと開いて中が出る。
   深さで字下げ・高さ・字の大きさを変える（設定 → 役員専用 → 会員名簿 の3段）。
   段が下がるほど小さく、右に寄る。選んでいる印（薄いグレーの角丸）はどの段でも同じ。 */
const ITEM_STYLE = [
  { height: 38, indent: 20, size: 13   }, // 会員ページ・設定
  { height: 34, indent: 34, size: 12.5 }, // 会員メニュー・役員専用
  { height: 32, indent: 48, size: 12   }, // その下のページ
];

function MenuItem({
  node, depth, current, opened, onSelect,
}: {
  node: MenuNode;
  depth: number;
  current: string;
  opened: string[];
  onSelect: (node: MenuNode) => void;
}) {
  const kids = node.children ?? [];
  const on = node.id === current;
  const isOpen = kids.length > 0 && opened.includes(node.id);
  const s = ITEM_STYLE[Math.min(depth, ITEM_STYLE.length - 1)];
  return (
    <div>
      <button
        type="button"
        className="pr-item"
        aria-current={on ? "page" : undefined}
        aria-expanded={kids.length > 0 ? isOpen : undefined}
        onClick={() => onSelect(node)}
        style={{
          // 幅は内寄せのぶんだけ縮め、減らした左右は padding で足す
          // （字の位置は内寄せ前と同じ indent のまま）
          width: `calc(100% - ${SEL_INSET * 2}px)`,
          height: s.height,
          margin: `2px ${SEL_INSET}px`,
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: `0 ${20 - SEL_INSET}px 0 ${s.indent - SEL_INSET}px`,
          border: "none",
          borderRadius: SEL_R,
          // 選んでいないときは地を書かない。ここに transparent と書くと
          // インライン指定が勝ってしまい、CSSのホバーが効かなくなる。
          background: on ? SEL_BG : undefined,
          // 選んでいないときの色は globals.css の .pr-item が持つ
          color: on ? INK : undefined,
          fontSize: s.size,
          fontWeight: on ? 600 : 500,
          letterSpacing: "0.04em",
          fontVariantNumeric: "tabular-nums",
          textAlign: "left",
          cursor: "pointer",
        }}
      >
        <span style={{ flex: 1, minWidth: 0 }}>{node.label}</span>
        {kids.length > 0 && (
          <svg
            className="pr-chev"
            width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
            style={{ flexShrink: 0, transform: isOpen ? "rotate(90deg)" : "none", opacity: 0.7 }}
          >
            <polyline points="9 6 15 12 9 18" />
          </svg>
        )}
      </button>

      {isOpen && kids.map((c) => (
        <MenuItem
          key={c.id}
          node={c}
          depth={depth + 1}
          current={current}
          opened={opened}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}

export default function PresidentRoom() {
  const [current, setCurrent] = useState(MENU[0].id);
  const [opened,  setOpened]  = useState<string[]>([]); // 下の階層を開いている項目
  const [drawer,  setDrawer]  = useState(false);        // スマホでメニューを引き出しているか
  // 設定の下の会員メニューの機能を選んでいるとき、その機能の id（"duet" など）。それ以外は空
  const featureId = features.some((f) => `m10-${f.id}` === current) ? current.slice("m10-".length) : "";

  // 引き出している間は、後ろの画面が動かないようにする
  useEffect(() => {
    if (!drawer) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setDrawer(false); };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [drawer]);

  // メニューの項目を押したとき。
  // 下にぶら下がりがある枠（設定・会員メニュー・役員専用）は、選ぶと同時に開く。
  // 開いているものをもう一度押すと閉じる。開いた中身を見せたいので、
  // この場合はスマホの引き出しを閉じない。
  // 行き先が決まるページは、選んだら引き出しを閉じる。
  function select(node: MenuNode) {
    if (!node.children?.length) {
      setCurrent(node.id);
      setDrawer(false);
      return;
    }
    const isOpen = opened.includes(node.id);
    setCurrent(node.id);
    setOpened(isOpen && current === node.id
      ? opened.filter((x) => x !== node.id)
      : [...opened.filter((x) => x !== node.id), node.id]);
  }

  // 会員ページの「このあとの準備」の行から、設定の下のその機能へ移る（9/6）。
  // 受け取るのは app/components/memberFeatures.tsx の id（"homework" など）で、
  // メニューの項目の id は "m10-<id>"。この対応を知っているのはここだけにして、
  // 会員ページ側（MemberDraft.tsx）はメニューの作りを知らないままにしてある。
  // 途中の枠（設定 → 会員メニュー）もぜんぶ開くので、移った先が左のメニューでも分かる。
  // 押すのは長い画面の下のほうなので、上まで戻してから見せる。
  function openFeature(featureId: string) {
    const id = `m10-${featureId}`;
    const trail = pathTo(MENU, id);
    if (!trail) return; // id を書き換えないかぎり、ここには来ない
    setCurrent(id);
    setOpened((o) => [...o, ...trail.filter((x) => !o.includes(x))]);
    setDrawer(false);
    window.scrollTo({ top: 0 });
  }

  return (
    <div className="pr-shell" style={{ background: SURFACE }}>

      {/* ── 左のメニュー ── */}
      <aside className={`pr-side${drawer ? " is-open" : ""}`} style={{ background: SIDE_BG, borderRight: `1px solid ${LINE}` }}>

        {/* サークルのしるし。TOPページと同じロゴを、メニューの幅の中央に置く */}
        <div style={{ display: "flex", justifyContent: "center", padding: "22px 20px 20px" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/africaheart-logo.png"
            alt="アフリカハート"
            width={557}
            height={364}
            className="select-none pointer-events-none"
            style={{ display: "block", width: 128, height: "auto" }}
          />
        </div>

        <nav aria-label="メニュー" style={{ paddingBottom: 24 }}>
          {MENU.map((m) => (
            <MenuItem
              key={m.id}
              node={m}
              depth={0}
              current={current}
              opened={opened}
              onSelect={select}
            />
          ))}
        </nav>
      </aside>

      {/* スマホでメニューを引き出したときの背景の覆い */}
      {drawer && <div className="pr-backdrop" onClick={() => setDrawer(false)} aria-hidden="true" />}

      {/* ── 本文 ── */}
      <div className="pr-main" style={{ background: SURFACE }}>

        {/* スマホだけに出る、メニューを引き出すための帯 */}
        <div className="pr-bar" style={{ borderBottom: `1px solid ${LINE}` }}>
          <button
            type="button"
            className="pr-menubtn"
            onClick={() => setDrawer(true)}
            aria-label="メニューを開く"
            aria-expanded={drawer}
            style={{ border: `1px solid ${LINE}`, background: SURFACE, color: INK }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
              <line x1="4" y1="7"  x2="20" y2="7" />
              <line x1="4" y1="12" x2="20" y2="12" />
              <line x1="4" y1="17" x2="20" y2="17" />
            </svg>
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/africaheart-logo.png"
            alt="アフリカハート"
            width={557}
            height={364}
            className="select-none pointer-events-none"
            style={{ display: "block", width: 72, height: "auto" }}
          />
        </div>

        {/* 本文。会員ページ（会員がスマホで見る画面）と、設定の下のページ。
            設定の下は「会員メニュー」（アーカイブと5機能）と
            「役員専用」（会員名簿・役員専用・役員専用2・アンケート）の2つに分かれていて、
            役員専用の4つは合言葉（810）の後ろに置いてある。
            4つで1つの OfficerGate を分け合っているので、一度入れれば4つとも開く
            （ページを行き来しても聞き直さない）。 */}
        {current === "m17" && <MemberDraft onOpenFeature={openFeature} />}
        {current === "m10-archive" && <PresidentArchive />}
        {featureId !== "" && <PresidentFeature key={featureId} id={featureId} />}

        {STAFF_IDS.includes(current) && (
          <OfficerGate>
            {current === "m10-roster" && <PresidentTable />}
            {current === "m10-officer" && <OfficerPlan />}
            {current === "m10-officer2" && <OfficerRoleTable />}
            {current === "m10-survey" && <PresidentSurvey />}
          </OfficerGate>
        )}

      </div>
    </div>
  );
}
