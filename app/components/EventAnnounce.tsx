"use client";

import { nextEvent } from "@/lib/data";

/* ============================================================
   次回イベント告知（部屋割りの無い回）：TOPに掲載する案内カード
   ------------------------------------------------------------
   チラシ「夏の歌宴 完全燃焼 in 諏訪」の内容を、リテラシーの高くない人でも
   ひと目で分かるように整理して表示する。内容は lib/data.ts の nextEvent を差し替え。
   ※絵文字は使わない（アプリ全体の方針）。
   ============================================================ */

// ハイライト3本柱の色味（チラシの3色の丸を踏襲）
const TONE: Record<string, { bg: string; fg: string }> = {
  blue: { bg: "#e8f1fb", fg: "#1f6fb2" },
  pink: { bg: "#fce8f1", fg: "#c81e77" },
  indigo: { bg: "#ece9fb", fg: "#5b45b0" },
};

export default function EventAnnounce() {
  const e = nextEvent;

  return (
    <div className="px-4 pt-5 max-w-lg mx-auto flex flex-col gap-4 animate-fade-up">
      {/* ── ヒーロー（夜空×花火）── */}
      <div
        className="relative overflow-hidden rounded-2xl px-5 py-6 text-center"
        style={{
          background:
            "radial-gradient(circle at 18% 22%, rgba(245,197,66,0.20) 0 2px, transparent 3px)," +
            "radial-gradient(circle at 82% 30%, rgba(255,120,180,0.20) 0 2px, transparent 3px)," +
            "radial-gradient(circle at 66% 14%, rgba(120,190,255,0.20) 0 2px, transparent 3px)," +
            "radial-gradient(circle at 30% 70%, rgba(255,255,255,0.16) 0 1.5px, transparent 3px)," +
            "linear-gradient(160deg,#0b1e3f 0%,#122a5c 48%,#221248 100%)",
          boxShadow: "0 8px 22px rgba(11,30,63,0.30)",
        }}
      >
        <span
          className="inline-block px-3 py-1 rounded-full text-[11px] font-black tracking-wide"
          style={{ background: "rgba(245,197,66,0.16)", color: "#F5D26B", border: "1px solid rgba(245,197,66,0.4)" }}
        >
          {e.badge}
        </span>

        <p className="mt-3 text-xs font-bold tracking-wide" style={{ color: "rgba(255,255,255,0.8)" }}>
          {e.catch}
        </p>
        <h2
          className="mt-1 text-[26px] leading-tight font-black"
          style={{
            backgroundImage: "linear-gradient(180deg,#FFE9A8,#F5C542)",
            WebkitBackgroundClip: "text",
            backgroundClip: "text",
            color: "transparent",
            textShadow: "0 2px 10px rgba(0,0,0,0.18)",
          }}
        >
          {e.title}
        </h2>
        <p className="mt-2 text-[13px] font-semibold" style={{ color: "rgba(255,255,255,0.9)" }}>
          {e.lead}
        </p>

        {/* 日時・場所 */}
        <div className="mt-4 inline-flex flex-col items-center gap-1 px-4 py-2.5 rounded-xl"
          style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.14)" }}>
          <span className="text-base font-black text-white">{e.date}</span>
          <span className="text-xs font-semibold" style={{ color: "rgba(255,255,255,0.85)" }}>
            {e.timeRange} ／ {e.place}
          </span>
        </div>
      </div>

      {/* ── 3本柱（カラオケ・焼肉・花火）── */}
      <div className="grid grid-cols-3 gap-2">
        {e.highlights.map((h) => {
          const t = TONE[h.tone] ?? TONE.pink;
          return (
            <div
              key={h.label}
              className="rounded-2xl px-2.5 py-3 text-center"
              style={{ background: t.bg }}
            >
              <p className="text-[13px] font-black leading-tight" style={{ color: t.fg }}>
                {h.label}
              </p>
              <p className="mt-1 text-[11px] leading-snug" style={{ color: "#555" }}>
                {h.note}
              </p>
            </div>
          );
        })}
      </div>

      {/* ── 当日のスケジュール（予定）── */}
      <div className="card px-4 py-4">
        <div className="flex items-center gap-2 mb-1">
          <span className="w-1.5 h-4 rounded-full" style={{ background: "#C81E77" }} />
          <h3 className="text-sm font-black" style={{ color: "#A8175F" }}>
            当日のスケジュール（予定）
          </h3>
        </div>
        <p className="text-[11px] mb-3" style={{ color: "#666" }}>{e.feeNote}</p>

        <div className="flex flex-col gap-2">
          {e.schedule.map((s, i) => (
            <div key={i} className="rounded-xl px-3 py-2.5" style={{ background: "#faf6f2" }}>
              <div className="flex items-center justify-between gap-2">
                <span
                  className="text-[11px] font-black px-2 py-0.5 rounded-md whitespace-nowrap"
                  style={{ background: "#fbe4f0", color: "#A8175F" }}
                >
                  {s.time}
                </span>
                {s.cost ? (
                  <span
                    className="text-[11px] font-bold px-2 py-0.5 rounded-md whitespace-nowrap"
                    style={{ background: "#fff", color: "#c07", border: "1px solid #f3cfe1" }}
                  >
                    目安 {s.cost}
                  </span>
                ) : null}
              </div>
              <p className="mt-1 text-[13px] font-black" style={{ color: "#333" }}>
                {s.title}
              </p>
              {s.place ? (
                <p className="text-[12px] leading-snug mt-0.5" style={{ color: "#555" }}>
                  {s.place}
                </p>
              ) : null}
            </div>
          ))}
        </div>
      </div>

      {/* ── 費用のめやす ── */}
      <div className="card px-4 py-4">
        <div className="flex items-baseline justify-between">
          <span className="text-sm font-black" style={{ color: "#A8175F" }}>
            概算合計（1人あたり）
          </span>
          <span className="text-2xl font-black" style={{ color: "#C81E77" }}>
            {e.estimateTotal}
          </span>
        </div>
        <p className="mt-1 text-[12px] font-semibold" style={{ color: "#666" }}>
          {e.estimateBridge}
        </p>
        <p className="mt-2 text-[12px] leading-relaxed" style={{ color: "#666" }}>
          {e.estimateNote}
        </p>
        <p className="mt-2.5 text-[12px] font-semibold px-3 py-2 rounded-lg" style={{ background: "#f4f7fb", color: "#3f5570" }}>
          {e.driverThanks}
        </p>
      </div>

      {/* ── 参加受付の案内 ── */}
      <div
        className="rounded-2xl px-4 py-4 text-center text-white"
        style={{ background: "linear-gradient(135deg,#A8175F,#C81E77)", boxShadow: "0 4px 14px rgba(168,23,95,0.30)" }}
      >
        <p className="text-sm font-black leading-relaxed">{e.recruit}</p>
      </div>
    </div>
  );
}
