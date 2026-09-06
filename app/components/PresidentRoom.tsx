"use client";

/* ============================================================
   社長室：これからのアフリカハートTOPページの下書き
   ------------------------------------------------------------
   ここは本番の画面ではない。今のTOP・会員ページ・管理画面を
   作り直すための試作場所として使う。納得できる形になったら、
   ここの中身を既存のページへ移していく。

   【いまのスコープ】左のメニューと、「Member Screen UI/UX」（会員画面の試作）と「設定 ＞ 会員名簿・アーカイブ」だけ。
     MENU の label を書き換えれば名前は差し替わる。
     足すときは MENU に一行足すだけでよい（id は空いている番号を使う）。

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
// children を持たせると、その項目の下にぶら下がるページになる。
type MenuNode = { id: string; label: string; children?: { id: string; label: string }[] };

const MENU: MenuNode[] = [
  // 会員がスマホで見る画面の下書き（見た目だけ）。中身は app/components/MemberDraft.tsx。
  // メニューの名前は英語表記（会員画面UIUX → Member Screen UI/UX）。
  { id: "m17", label: "Member Screen UI/UX" },
  // 以前ここに「1〜15」という名前も中身も無い枠が並んでいたが、
  // 何も入っていない行がメニューを長くするだけだったので外した。
  // 項目を足すときは、ここに一行足す。id は "m1"〜"m9"・"m11"〜"m16" が空いている
  // （"m10" は設定、"m17" は Member Screen UI/UX が使っている）。
  {
    id: "m10", label: "設定",
    children: [
      { id: "m10-roster", label: "会員名簿" },
      // これまでのオフ会（タイムテーブルと参加者）。中身は app/components/PresidentArchive.tsx。
      { id: "m10-archive", label: "アーカイブ" },
    ],
  },
];

export default function PresidentRoom() {
  const [current, setCurrent] = useState(MENU[0].id);
  const [opened,  setOpened]  = useState<string[]>([]); // 下の階層を開いている項目
  const [drawer,  setDrawer]  = useState(false);        // スマホでメニューを引き出しているか

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

  // 下にページを持つ項目：選ぶと同時に開く。開いているものをもう一度押すと閉じる。
  // 開いた中身を見せたいので、この場合はスマホの引き出しを閉じない。
  function chooseParent(node: MenuNode) {
    if (!node.children?.length) { choose(node.id); return; }
    const isOpen = opened.includes(node.id);
    setCurrent(node.id);
    setOpened(isOpen && current === node.id
      ? opened.filter((x) => x !== node.id)
      : [...opened.filter((x) => x !== node.id), node.id]);
  }

  // 行き先が決まる項目：選んだらスマホの引き出しは閉じる
  function choose(id: string) {
    setCurrent(id);
    setDrawer(false);
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
          {MENU.map((m) => {
            const kids = m.children ?? [];
            const on = m.id === current;
            const isOpen = kids.length > 0 && opened.includes(m.id);
            return (
              <div key={m.id}>
                <button
                  type="button"
                  className="pr-item"
                  aria-current={on ? "page" : undefined}
                  aria-expanded={kids.length > 0 ? isOpen : undefined}
                  onClick={() => chooseParent(m)}
                  style={{
                    // 幅は内寄せのぶんだけ縮め、減らした左右は padding で足す
                    // （字の位置は内寄せ前と同じ 20px のまま）
                    width: `calc(100% - ${SEL_INSET * 2}px)`,
                    height: 38,
                    margin: `2px ${SEL_INSET}px`,
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: `0 ${20 - SEL_INSET}px`,
                    border: "none",
                    borderRadius: SEL_R,
                    // 選んでいないときは地を書かない。ここに transparent と書くと
                    // インライン指定が勝ってしまい、CSSのホバーが効かなくなる。
                    background: on ? SEL_BG : undefined,
                    // 選んでいないときの色は globals.css の .pr-item が持つ
                    color: on ? INK : undefined,
                    fontSize: 13,
                    fontWeight: on ? 600 : 500,
                    letterSpacing: "0.04em",
                    fontVariantNumeric: "tabular-nums",
                    textAlign: "left",
                    cursor: "pointer",
                  }}
                >
                  <span style={{ flex: 1, minWidth: 0 }}>{m.label}</span>
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

                {isOpen && kids.map((c) => {
                  const cOn = c.id === current;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      className="pr-item"
                      aria-current={cOn ? "page" : undefined}
                      onClick={() => choose(c.id)}
                      style={{
                        width: `calc(100% - ${SEL_INSET * 2}px)`,
                        height: 34,
                        margin: `2px ${SEL_INSET}px`,
                        display: "flex",
                        alignItems: "center",
                        padding: `0 ${20 - SEL_INSET}px 0 ${36 - SEL_INSET}px`,
                        border: "none",
                        borderRadius: SEL_R,
                        background: cOn ? SEL_BG : undefined,
                        color: cOn ? INK : undefined,
                        fontSize: 12.5,
                        fontWeight: cOn ? 600 : 500,
                        letterSpacing: "0.04em",
                        textAlign: "left",
                        cursor: "pointer",
                      }}
                    >
                      {c.label}
                    </button>
                  );
                })}
              </div>
            );
          })}
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

        {/* 本文。中身があるのは Member Screen UI/UX（会員画面の試作）と、設定の会員名簿・アーカイブ。 */}
        {current === "m17" && <MemberDraft />}
        {current === "m10-roster" && <PresidentTable />}
        {current === "m10-archive" && <PresidentArchive />}

      </div>
    </div>
  );
}
