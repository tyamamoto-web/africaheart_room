"use client";

/* ============================================================
   社長室：これからのアフリカハートTOPページの下書き
   ------------------------------------------------------------
   ここは本番の画面ではない。今のTOP・会員ページ・管理画面を
   作り直すための試作場所として使う。納得できる形になったら、
   ここの中身を既存のページへ移していく。

   【いまのスコープ】左のメニュー10個だけ。本文は空。
     名前は追って決めるので、いまは 1〜10 を並べてある。
     MENU の label を書き換えれば名前は差し替わる。

   【色の方針】
   サークルのテーマカラーはロゴから採ったオレンジ（#F09800）。
   ただし画面の大半は落ち着いた温かみのあるグレーで作り、
   オレンジは「いま選んでいる場所」を示すときだけ使う。
   大人のオフ会に似合う、静かで質のある見え方をねらう。

   【幅の考え方】
   ・パソコン（768px以上）＝左にメニューを出したままにする
   ・スマホ（768px未満）＝メニューはしまっておき、ボタンで引き出す
   ============================================================ */

import { useEffect, useState } from "react";

const ORANGE      = "#F09800"; // ロゴのオレンジ（サークルの色）
const ORANGE_WASH = "#FBF3E6"; // 選んでいる行の地

const INK     = "#201D1A"; // 主要テキスト（温かみのある黒）
const MUTED   = "#6E675E"; // 補助テキスト
const LINE    = "#E7E2D9"; // 繊細な罫線
const SIDE_BG = "#F7F5F1"; // メニューの地（落ち着いたグレー）
const SURFACE = "#FFFFFF"; // 本文の面

// 名前は追って差し替える。並び順もここで決まる。
const MENU = Array.from({ length: 10 }, (_, i) => ({ id: `m${i + 1}`, label: String(i + 1) }));

export default function PresidentRoom() {
  const [current, setCurrent] = useState(MENU[0].id);
  const [drawer, setDrawer] = useState(false); // スマホでメニューを引き出しているか

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

  function choose(id: string) {
    setCurrent(id);
    setDrawer(false);
  }

  return (
    <div className="pr-shell" style={{ background: SURFACE }}>

      {/* ── 左のメニュー ── */}
      <aside className={`pr-side${drawer ? " is-open" : ""}`} style={{ background: SIDE_BG, borderRight: `1px solid ${LINE}` }}>

        {/* サークル名。オレンジの細い線を1本だけ添える */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "22px 20px 18px" }}>
          <span aria-hidden="true" style={{ width: 2, height: 15, background: ORANGE, flexShrink: 0 }} />
          <span style={{ fontSize: 13, fontWeight: 600, letterSpacing: "0.10em", color: INK }}>
            アフリカハート
          </span>
        </div>

        <nav aria-label="メニュー" style={{ paddingBottom: 24 }}>
          {MENU.map((m) => {
            const on = m.id === current;
            return (
              <button
                key={m.id}
                type="button"
                className="pr-item"
                aria-current={on ? "page" : undefined}
                onClick={() => choose(m.id)}
                style={{
                  width: "100%",
                  height: 42,
                  display: "flex",
                  alignItems: "center",
                  padding: "0 20px",
                  border: "none",
                  background: on ? ORANGE_WASH : "transparent",
                  boxShadow: on ? `inset 2px 0 0 ${ORANGE}` : "none",
                  color: on ? INK : MUTED,
                  fontSize: 13,
                  fontWeight: on ? 600 : 500,
                  letterSpacing: "0.04em",
                  fontVariantNumeric: "tabular-nums",
                  textAlign: "left",
                  cursor: "pointer",
                }}
              >
                {m.label}
              </button>
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
          <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.08em", color: MUTED }}>
            アフリカハート
          </span>
        </div>

        {/* 本文。どのメニューを選んでも、いまは意図的に空にしてある。 */}

      </div>
    </div>
  );
}
