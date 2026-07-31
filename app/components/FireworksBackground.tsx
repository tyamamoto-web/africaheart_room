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

// 速い/遅い・大きい/小さいを入り乱れさせた“たくさんの花火”。
//  - dur を 1.6s(速い小花火)〜5.0s(ゆっくり大玉) と大きく振る＝打ち上げの緩急。
//  - s(大きさ) も 0.5〜1.7 と幅広く。delay をクラスター状に散らし、各花火は固有周期で
//    無限ループ＝周回ごとに自然にズレ、絶えず違うリズムで打ち上がる（“ずっと同じ”にならない）。
const FIREWORKS: FW[] = [
  // 大玉（ゆっくり・大きく開く）
  { left: 26, top: 20, s: 1.6, delay: 0.0, dur: 4.4, c: "#ffd54a", c2: "#ffffff", r: 120, type: "chrys" },
  { left: 70, top: 16, s: 1.7, delay: 1.9, dur: 4.9, c: "#ff7eb0", c2: "#ffffff", r: 128, type: "peony" },
  { left: 44, top: 24, s: 1.5, delay: 3.6, dur: 4.2, c: "#c9a3ff", c2: "#ffffff", r: 118, type: "peony" },
  { left: 82, top: 26, s: 1.45, delay: 5.2, dur: 4.0, c: "#ffe08a", c2: "#ff8a3d", r: 116, type: "chrys" },
  // しだれ柳（ゆっくり垂れる）
  { left: 14, top: 16, s: 1.35, delay: 2.6, dur: 5.0, c: "#ffcf6b", r: 104, type: "willow" },
  { left: 58, top: 18, s: 1.15, delay: 4.4, dur: 4.6, c: "#ffd08a", r: 92, type: "willow" },
  { left: 90, top: 40, s: 1.0, delay: 6.1, dur: 4.4, c: "#ffe0b0", r: 80, type: "willow" },
  // 輪（中くらい）
  { left: 36, top: 30, s: 1.2, delay: 1.2, dur: 3.2, c: "#7ec8ff", r: 96, type: "ring" },
  { left: 64, top: 34, s: 1.05, delay: 3.0, dur: 3.0, c: "#8affc1", r: 86, type: "ring" },
  { left: 20, top: 38, s: 1.1, delay: 4.9, dur: 3.4, c: "#a9b8ff", r: 90, type: "ring" },
  { left: 76, top: 44, s: 0.95, delay: 6.5, dur: 3.0, c: "#9fe0ff", r: 78, type: "ring" },
  // 小花火（速い・小さい・たくさん・パラパラ）
  { left: 10, top: 34, s: 0.55, delay: 0.5, dur: 1.7, c: "#ffffff", r: 44, type: "spark" },
  { left: 50, top: 12, s: 0.7, delay: 0.9, dur: 2.0, c: "#ffd54a", r: 52, type: "spark" },
  { left: 88, top: 22, s: 0.5, delay: 1.5, dur: 1.6, c: "#9fe0ff", r: 40, type: "spark" },
  { left: 32, top: 45, s: 0.62, delay: 2.1, dur: 1.9, c: "#ff9ec8", r: 48, type: "spark" },
  { left: 72, top: 28, s: 0.5, delay: 2.7, dur: 1.7, c: "#ffffff", r: 42, type: "spark" },
  { left: 46, top: 41, s: 0.68, delay: 3.3, dur: 2.1, c: "#c9a3ff", r: 50, type: "spark" },
  { left: 18, top: 26, s: 0.52, delay: 3.9, dur: 1.6, c: "#8affc1", r: 42, type: "spark" },
  { left: 60, top: 47, s: 0.66, delay: 4.6, dur: 2.0, c: "#ffd54a", r: 48, type: "spark" },
  { left: 84, top: 34, s: 0.5, delay: 5.4, dur: 1.7, c: "#ffffff", r: 40, type: "spark" },
  { left: 28, top: 14, s: 0.6, delay: 5.9, dur: 1.9, c: "#7ec8ff", r: 46, type: "spark" },
  { left: 54, top: 32, s: 0.72, delay: 6.7, dur: 2.2, c: "#ffb0d4", r: 52, type: "spark" },
];

// 湖面に映る残光（大玉・しだれの下に控えめに）
const REFLECTS = [
  { left: 26, delay: 0.0, dur: 4.4, c: "#ffd54a", w: 100 },
  { left: 70, delay: 1.9, dur: 4.9, c: "#ff7eb0", w: 108 },
  { left: 14, delay: 2.6, dur: 5.0, c: "#ffcf6b", w: 92 },
  { left: 44, delay: 3.6, dur: 4.2, c: "#c9a3ff", w: 100 },
  { left: 82, delay: 5.2, dur: 4.0, c: "#ffe08a", w: 96 },
];

// 種類ごとの粒数（数が多いので少し軽めに）
function particleCount(type: FWType): number {
  if (type === "chrys") return 24;
  if (type === "peony") return 18;
  if (type === "spark") return 9;
  if (type === "willow") return 14;
  return 16; // ring
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
