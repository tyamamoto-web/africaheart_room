"use client";

import { nextEvent } from "@/lib/data";

/* ============================================================
   次回イベント告知（部屋割りの無い回）：TOPに掲載する案内カード
   ------------------------------------------------------------
   花火大会テーマ（夜背景）に合わせた配色。チラシ「夏の歌宴 完全燃焼 in 諏訪」の
   内容を、リテラシーの高くない人でもひと目で分かるように整理して表示する。
   内容は lib/data.ts の nextEvent を差し替えるだけ。
   ※絵文字は使わない（アプリ全体の方針）。
   ============================================================ */

// ハイライト3本柱の色味（夜に映える半透明グラス）
const TONE: Record<string, { bg: string; br: string; fg: string }> = {
  blue: { bg: "rgba(90,150,230,0.16)", br: "rgba(120,170,240,0.32)", fg: "#a9cdff" },
  pink: { bg: "rgba(255,120,180,0.16)", br: "rgba(255,140,190,0.32)", fg: "#ffb3d6" },
  gold: { bg: "rgba(245,197,66,0.16)", br: "rgba(245,205,110,0.36)", fg: "#ffd884" },
};

// タップで地図アプリを開くURL（住所を検索クエリに。個人情報は載せない）
function mapUrl(query: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

function PinIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 22s7-6.2 7-12A7 7 0 0 0 5 10c0 5.8 7 12 7 12Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="10" r="2.4" fill="currentColor" />
    </svg>
  );
}

export default function EventAnnounce() {
  const e = nextEvent;

  return (
    <div className="px-4 pt-5 max-w-lg mx-auto flex flex-col gap-4 animate-fade-up">
      {/* ── ヒーロー（夜空に馴染む半透明グラス：背後の花火が透ける）── */}
      <div
        className="relative overflow-hidden rounded-2xl px-5 py-6 text-center"
        style={{
          background:
            "linear-gradient(160deg, rgba(9,20,44,0.66) 0%, rgba(18,36,78,0.52) 48%, rgba(28,18,64,0.60) 100%)",
          backdropFilter: "blur(3px)",
          WebkitBackdropFilter: "blur(3px)",
          border: "1px solid rgba(245,197,66,0.28)",
          boxShadow: "0 8px 26px rgba(3,8,22,0.42)",
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
        <div
          className="mt-4 inline-flex flex-col items-center gap-1 px-4 py-2.5 rounded-xl"
          style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.14)" }}
        >
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
              style={{ background: t.bg, border: `1px solid ${t.br}` }}
            >
              <p className="text-[13px] font-black leading-tight" style={{ color: t.fg }}>
                {h.label}
              </p>
              <p className="mt-1 text-[11px] leading-snug" style={{ color: "#c3cee2" }}>
                {h.note}
              </p>
            </div>
          );
        })}
      </div>

      {/* ── 当日のスケジュール（予定）── */}
      <div className="night-card px-4 py-4">
        <div className="flex items-center gap-2 mb-1">
          <span className="w-1.5 h-4 rounded-full" style={{ background: "#F5C542" }} />
          <h3 className="text-sm font-black" style={{ color: "#ffd884" }}>
            当日のスケジュール（予定）
          </h3>
        </div>
        <p className="text-[11px] mb-3" style={{ color: "#b7c2da" }}>{e.feeNote}</p>

        <div className="flex flex-col gap-2">
          {e.schedule.map((s, i) => (
            <div
              key={i}
              className="rounded-xl px-3 py-2.5"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.09)" }}
            >
              <div className="flex items-center justify-between gap-2">
                <span
                  className="text-[11px] font-black px-2 py-0.5 rounded-md whitespace-nowrap"
                  style={{ background: "rgba(245,197,66,0.16)", color: "#ffd884" }}
                >
                  {s.time}
                </span>
                {s.cost ? (
                  <span
                    className="text-[11px] font-bold px-2 py-0.5 rounded-md whitespace-nowrap"
                    style={{ background: "rgba(255,255,255,0.06)", color: "#ffd884", border: "1px solid rgba(245,205,110,0.3)" }}
                  >
                    目安 {s.cost}
                  </span>
                ) : null}
              </div>
              <p className="mt-1 text-[13px] font-black" style={{ color: "#eef2fb" }}>
                {s.title}
              </p>
              {s.place ? (
                <p className="text-[12px] leading-snug mt-0.5" style={{ color: "#b7c2da" }}>
                  {s.place}
                </p>
              ) : null}
              {s.map ? (
                <a
                  href={mapUrl(s.map)}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 mt-2 text-[11px] font-bold px-2.5 py-1 rounded-md active:scale-[0.98] transition-transform"
                  style={{ background: "rgba(120,180,255,0.15)", color: "#bcd6ff", border: "1px solid rgba(140,180,240,0.34)" }}
                >
                  <PinIcon />
                  地図を開く
                </a>
              ) : null}

              {/* 内訳（選べるコース／料金に含まれるもの等）。detailHeading でボックスの意味を明示 */}
              {s.detail && s.detail.length > 0 ? (
                <div
                  className="mt-2.5 flex flex-col gap-1 px-2.5 py-2 rounded-lg"
                  style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
                >
                  {s.detailHeading ? (
                    <p className="text-[11px] font-bold mb-0.5" style={{ color: "#ffd884" }}>
                      {s.detailHeading}
                    </p>
                  ) : null}
                  {s.detail.map((d, di) => (
                    <div key={di} className="flex items-baseline justify-between gap-3">
                      <span className="text-[12px] leading-snug" style={{ color: "#c8d2e6" }}>
                        {d.label}
                      </span>
                      {d.price ? (
                        <span className="text-[12px] font-bold whitespace-nowrap" style={{ color: "#ffd884" }}>
                          {d.price}
                        </span>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : null}
              {s.note ? (
                <p className="mt-1.5 text-[11px] leading-relaxed" style={{ color: "#98a4c0" }}>
                  {s.note}
                </p>
              ) : null}
              {/* 別料金・注意（お金がかかる情報を独立した琥珀の注意ボックスで強調）*/}
              {s.warn ? (
                <p
                  className="mt-2 text-[12px] font-semibold leading-relaxed px-2.5 py-2 rounded-lg"
                  style={{ background: "rgba(245,170,80,0.13)", color: "#ffd6a0", border: "1px solid rgba(245,180,90,0.40)" }}
                >
                  ※ {s.warn}
                </p>
              ) : null}
            </div>
          ))}
        </div>
      </div>

      {/* ── 費用のめやす（お酒を飲む/飲まないで2種）── */}
      <div className="night-card px-4 py-4">
        <span className="text-sm font-black" style={{ color: "#ffd884" }}>
          概算合計（1人あたり）
        </span>
        <div className="mt-2.5 grid grid-cols-2 gap-2">
          <div
            className="rounded-xl px-3 py-3 text-center"
            style={{ background: "rgba(245,197,66,0.10)", border: "1px solid rgba(245,205,110,0.30)" }}
          >
            <p className="text-[11px] font-bold" style={{ color: "#c8d2e6" }}>お酒を飲む人</p>
            <p className="mt-1 text-2xl font-black" style={{ color: "#ffd873" }}>{e.estimateDrink}</p>
            <p className="mt-0.5 text-[11px]" style={{ color: "#c8d2e6" }}>焼肉＝飲み放題コース</p>
          </div>
          <div
            className="rounded-xl px-3 py-3 text-center"
            style={{ background: "rgba(120,180,255,0.10)", border: "1px solid rgba(140,180,240,0.30)" }}
          >
            <p className="text-[11px] font-bold" style={{ color: "#c8d2e6" }}>飲まない人</p>
            <p className="mt-1 text-2xl font-black" style={{ color: "#bcd6ff" }}>{e.estimateSoft}</p>
            <p className="mt-0.5 text-[11px]" style={{ color: "#c8d2e6" }}>焼肉＝ソフトドリンク</p>
          </div>
        </div>

        {/* 当日の支払い（最重要アクション：見出し付き・費用の直下で強調）*/}
        <div
          className="mt-3 px-3 py-2.5 rounded-lg"
          style={{ background: "rgba(245,197,66,0.12)", border: "1px solid rgba(245,205,110,0.42)" }}
        >
          <div className="flex items-center gap-1.5 mb-1">
            <span className="w-1.5 h-3.5 rounded-full" style={{ background: "#F5C542" }} />
            <span className="text-[12px] font-black" style={{ color: "#ffd884" }}>{e.paymentTitle}</span>
          </div>
          <p className="text-[12px] font-semibold leading-relaxed" style={{ color: "#f0e4c8" }}>
            {e.paymentNote}
          </p>
        </div>

        <p className="mt-2.5 text-[12px] font-semibold" style={{ color: "#cdd6ea" }}>
          {e.estimateBridge}
        </p>
        <p className="mt-2 text-[12px] leading-relaxed" style={{ color: "#b7c2da" }}>
          {e.estimateNote}
        </p>
        <p
          className="mt-2.5 text-[12px] font-semibold px-3 py-2 rounded-lg"
          style={{ background: "rgba(255,255,255,0.06)", color: "#d6e0f2", border: "1px solid rgba(255,255,255,0.09)" }}
        >
          {e.driverThanks}
        </p>
        <p className="mt-2 text-[11px] leading-relaxed" style={{ color: "#98a4c0" }}>
          ※ {e.changeNote}
        </p>
      </div>

      {/* ── 雨天・持ち物 ── */}
      <div className="night-card px-4 py-4">
        <div className="flex items-center gap-2 mb-2">
          <span className="w-1.5 h-4 rounded-full" style={{ background: "#7ec8ff" }} />
          <h3 className="text-sm font-black" style={{ color: "#bcd6ff" }}>
            {e.rainTitle}
          </h3>
        </div>
        <p className="text-[12px] leading-relaxed" style={{ color: "#cdd6ea" }}>
          {e.rainNote}
        </p>
      </div>

      {/* ── 参加受付の案内（受付中）── */}
      <div className="night-card px-4 py-4 text-center" style={{ borderColor: "rgba(245,205,110,0.45)" }}>
        <span
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-black"
          style={{ background: "rgba(245,197,66,0.18)", color: "#ffd884", border: "1px solid rgba(245,205,110,0.45)" }}
        >
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: "#ffd884" }} />
          {e.recruitStatus}
        </span>
        <p className="mt-2.5 text-sm font-black leading-relaxed" style={{ color: "#ffe0a3" }}>
          {e.recruit}
        </p>
      </div>
    </div>
  );
}
