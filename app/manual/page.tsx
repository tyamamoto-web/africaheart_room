"use client";

import Link from "next/link";
import { nextEvent } from "@/lib/data";
import { raciDefs } from "@/lib/raciDefs";

/* ============================================================
   イベント運営マニュアル
   ------------------------------------------------------------
   イベント名と日時、役割の決め方を載せる。

   ※ やること一覧の表は、このページから役員専用2タブ（/admin）へ移した。
     やること320件と、2日前にLINEへ送る文面の下書き（lineMessageOutline）は
     lib/eventTasks.ts に残してあるが、今はどの画面にも出していない。
   ※ 絵文字は使わない（アプリ全体の方針）。
   ============================================================ */

export default function ManualPage() {
  return (
    <main className="min-h-screen bg-white pb-16">
      {/* 上部バー（トップへ戻る） */}
      <div
        className="sticky top-0 z-50 px-4 py-3 flex items-center gap-3"
        style={{ background: "#fff", borderBottom: "1px solid #f0ece5" }}
      >
        <Link
          href="/"
          className="flex items-center gap-1.5 text-sm font-semibold px-3 py-2 rounded-xl card"
          style={{ color: "#555" }}
        >
          ← 戻る
        </Link>
        <h1 className="text-base font-black" style={{ color: "#2c2c2c" }}>
          イベント運営マニュアル
        </h1>
      </div>

      <div className="px-4 pt-3 pb-8 max-w-lg mx-auto">
        {/* イベント名と日時 */}
        <div className="card px-4 py-4">
          <p className="text-sm font-black" style={{ color: "#A8175F" }}>
            {nextEvent.title}
          </p>
          <p className="text-xs mt-1" style={{ color: "#888" }}>
            {nextEvent.date}　{nextEvent.timeRange}　{nextEvent.place}
          </p>
        </div>

        {/* 役割の説明（役員専用ページと同じ言葉づかい） */}
        <div className="card px-4 py-4 mt-3">
          <p className="text-sm font-black" style={{ color: "#2c2c2c" }}>
            役割の決め方
          </p>
          <p className="text-xs mt-1.5 leading-relaxed" style={{ color: "#999" }}>
            やることごとに、だれがどう関わるかを4つから選びます。責任者は1つのやることにつき1人だけです。
          </p>
          <div className="mt-3 flex flex-col gap-2">
            {raciDefs.map((d) => (
              <div
                key={d.key}
                className="px-3 py-2.5 rounded-lg"
                style={{ background: d.tint, border: `1px solid ${d.accent}22` }}
              >
                <span className="text-xs font-black" style={{ color: d.accent }}>
                  {d.label}
                </span>
                <p className="text-[11px] leading-relaxed mt-1" style={{ color: "#666" }}>
                  {d.hint}
                </p>
                <p className="text-[11px] leading-relaxed mt-1" style={{ color: "#a09585" }}>
                  例：{d.example}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
