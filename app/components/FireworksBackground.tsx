"use client";

import type { CSSProperties } from "react";

/* ============================================================
   花火大会テーマの背景（eventStatus === "announced" の回だけ描画）
   夜の湖に浮かぶ打ち上げ花火。純CSSアニメーション（ライブラリ不要）。
   ------------------------------------------------------------
   おしゃれに見せる工夫：
   - 粒は丸ではなく「外へ尾を引く光条」（globals.css .fw-p）
   - 粒ごとに微小な時間差をつけて一斉でなく“ふわっ”と開かせる
   - 打ち上げは加速→頂点で減速（自然な放物線の余韻）
   - 打ち上げ間隔にクラスター（単発→間→連発）を作り緩急を出す。
     各花火は固有の周期で無限ループするため、周回ごとに自然にズレて単調にならない。
   type: peony=牡丹（二重）/ chrys=菊（大玉・二色）/ ring=輪 /
         willow=しだれ柳（垂れる）/ spark=小花火（高所でパッと）
   ============================================================ */

// カスタムプロパティ(--a 等)を style に渡すための緩い型
type FWStyle = CSSProperties & Record<string, string | number>;

type FWType = "peony" | "chrys" | "ring" | "willow" | "spark";

type FW = {
  left: number; // 画面幅に対する%
  top: number; // 画面高に対する%（湖より上＝空の範囲）
  s: number; // 大きさ倍率
  delay: number; // 打ち上げのタイミング(s)
  dur: number; // 1サイクルの長さ(s)
  c: string; // 主色
  r: number; // 開く半径(px・実際の大きさは r×s)
  type: FWType;
  c2?: string; // 副色（菊・牡丹の内側リング）
};

// 緩急：開幕1発 → 間 → 左右2連 → しだれ → 小花火パラパラ → 大玉フィナーレ。
// dur を不揃いにしているので周回ごとにズレて“ずっと同じ”にはならない。
const FIREWORKS: FW[] = [
  { left: 30, top: 22, s: 1.5, delay: 0.0, dur: 3.4, c: "#ffd54a", c2: "#ffffff", r: 116, type: "chrys" },
  { left: 13, top: 30, s: 1.15, delay: 1.5, dur: 3.0, c: "#7ec8ff", r: 92, type: "ring" },
  { left: 78, top: 20, s: 1.3, delay: 1.85, dur: 3.9, c: "#ff7eb0", c2: "#ffffff", r: 118, type: "peony" },
  { left: 50, top: 15, s: 1.35, delay: 2.5, dur: 4.6, c: "#ffcf6b", r: 104, type: "willow" },
  { left: 88, top: 41, s: 0.7, delay: 2.9, dur: 2.3, c: "#ffffff", r: 50, type: "spark" },
  { left: 22, top: 43, s: 0.74, delay: 3.2, dur: 2.6, c: "#9fe0ff", r: 54, type: "spark" },
  { left: 40, top: 25, s: 1.55, delay: 3.9, dur: 3.7, c: "#c9a3ff", c2: "#ffffff", r: 122, type: "peony" },
  { left: 67, top: 30, s: 1.45, delay: 4.1, dur: 3.4, c: "#ffe08a", c2: "#ff8a3d", r: 118, type: "chrys" },
  { left: 84, top: 46, s: 1.0, delay: 4.3, dur: 4.2, c: "#ffd08a", r: 84, type: "willow" },
  { left: 16, top: 19, s: 1.2, delay: 4.45, dur: 3.0, c: "#8affc1", r: 92, type: "ring" },
  { left: 58, top: 45, s: 0.8, delay: 4.6, dur: 2.4, c: "#ff9ec8", r: 58, type: "spark" },
];

// 湖面に映る残光（大玉の下に控えめに）
const REFLECTS = [
  { left: 30, delay: 0.0, dur: 3.4, c: "#ffd54a", w: 96 },
  { left: 78, delay: 1.85, dur: 3.9, c: "#ff7eb0", w: 100 },
  { left: 40, delay: 3.9, dur: 3.7, c: "#c9a3ff", w: 100 },
  { left: 67, delay: 4.1, dur: 3.4, c: "#ffe08a", w: 92 },
];

// 種類ごとの粒数
function particleCount(type: FWType): number {
  if (type === "chrys") return 26;
  if (type === "peony") return 20;
  if (type === "spark") return 10;
  if (type === "willow") return 16;
  return 18; // ring
}

// 種類ごとのリング構成（[半径倍率, 色]）。牡丹・菊は二重にして大きな開花に
function ringsFor(f: FW): { rr: number; c: string }[] {
  if (f.type === "peony") return [{ rr: 1, c: f.c }, { rr: 0.58, c: f.c2 ?? "#ffffff" }];
  if (f.type === "chrys") return [{ rr: 1, c: f.c }, { rr: 0.62, c: f.c2 ?? f.c }];
  return [{ rr: 1, c: f.c }];
}

// 一斉に開かず“ふわっ”と開くための粒ごとの微小ディレイ幅(s)
function staggerWindow(type: FWType): number {
  if (type === "chrys") return 0.24;
  if (type === "peony") return 0.16;
  if (type === "willow") return 0.14;
  return 0.06; // ring / spark はキレよく
}

export default function FireworksBackground() {
  return (
    <div className="night-bg" aria-hidden="true">
      <div className="night-stars" />

      {FIREWORKS.map((f, i) => {
        const N = particleCount(f.type);
        const rings = ringsFor(f);
        const win = staggerWindow(f.type);
        const containerStyle: FWStyle = {
          left: `${f.left}%`,
          top: `${f.top}%`,
          "--s": f.s,
          "--c": f.c,
          "--dur": `${f.dur}s`,
          "--delay": `${f.delay}s`,
        };
        return (
          <div key={i} className={`fw${f.type === "willow" ? " fw--willow" : ""}`} style={containerStyle}>
            <span className="fw-rise" />
            <span className="fw-core" />
            {rings.map((ring, ri) =>
              Array.from({ length: N }).map((_, p) => {
                // 疑似ランダムな微小ディレイ（角度順の“掃引”にならないよう散らす）
                const micro = (((p * 37) % 13) / 13) * win;
                const pStyle: FWStyle = {
                  "--a": `${(360 / N) * p + (ri === 1 ? 360 / N / 2 : 0)}deg`,
                  "--r": `${f.r * ring.rr}px`,
                  "--c": ring.c,
                  animationDelay: `${(f.delay + micro).toFixed(3)}s`,
                };
                return <span key={`${ri}-${p}`} className="fw-p" style={pStyle} />;
              })
            )}
          </div>
        );
      })}

      {/* 湖面 */}
      <div className="night-lake" />
      <div className="night-horizon" />
      {REFLECTS.map((r, i) => {
        const rStyle: FWStyle = {
          left: `${r.left}%`,
          top: "79%",
          width: `${r.w}px`,
          marginLeft: `${-r.w / 2}px`,
          "--c": r.c,
          "--dur": `${r.dur}s`,
          "--delay": `${r.delay}s`,
        };
        return <div key={`r${i}`} className="fw-reflect" style={rStyle} />;
      })}
    </div>
  );
}
