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
   メニューはグレーだけで組む。オレンジはロゴが持っているので、
   ボタンや選択の印には使わない。選んでいる場所は、地をひと段沈ませ、
   左端に濃いグレーの線を1本立て、字を少し濃く太くして示す。
   色の差は小さく、形と濃さで伝える＝大人のオフ会に似合う静かな見え方。

   【幅の考え方】
   ・パソコン（768px以上）＝左にメニューを出したままにする
   ・スマホ（768px未満）＝メニューはしまっておき、ボタンで引き出す
   ============================================================ */

import { useEffect, useState } from "react";

/* すべて色味を持たない中間色のグレー。
   以前は暖色寄りのグレーにしていたが、画面ではベージュに見えてしまうため、
   赤み・黄みを抜いた本物のグレーにそろえている。 */
const INK      = "#1B1C1E"; // 主要テキスト（ほぼ黒）
const MUTED    = "#63666C"; // 補助テキスト
const LINE     = "#DFE1E4"; // 繊細な罫線
const SIDE_BG  = "#EDEEF0"; // メニューの地（落ち着いたグレー）
const SEL_BG   = "#DEE0E3"; // 選んでいる行の地（ひと段沈ませる）
const SEL_MARK = "#35373C"; // 選んでいる行の左端に立てる線（濃いグレー）
const SURFACE  = "#FFFFFF"; // 本文の面

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

        {/* サークルのしるし。TOPページと同じロゴを使う */}
        <div style={{ padding: "22px 20px 20px" }}>
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
                  background: on ? SEL_BG : "transparent",
                  boxShadow: on ? `inset 2px 0 0 ${SEL_MARK}` : "none",
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

        {/* 本文。どのメニューを選んでも、いまは意図的に空にしてある。 */}

      </div>
    </div>
  );
}
