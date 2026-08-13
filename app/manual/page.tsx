"use client";

import Link from "next/link";
import { eventTaskPlan, eventTaskCount } from "@/lib/eventTasks";
import { nextEvent } from "@/lib/data";

/* ============================================================
   イベント運営マニュアル
   ------------------------------------------------------------
   TOPの告知（lib/data.ts の nextEvent）に書かれている内容だけを根拠に、
   運営として対応が必要なやることを時系列（開催前→当日→開催後）で並べる。
   内容の追加・修正は lib/eventTasks.ts を直す（このページは表示だけ）。
   ※絵文字は使わない（アプリ全体の方針）。
   ============================================================ */

const ACCENT = "#A8175F";

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

      <div className="px-4 pt-3 max-w-lg mx-auto flex flex-col gap-4">
        {/* このマニュアルの前提 */}
        <div className="card px-4 py-4">
          <p className="text-sm font-black" style={{ color: ACCENT }}>
            {nextEvent.title}
          </p>
          <p className="text-xs mt-1" style={{ color: "#888" }}>
            {nextEvent.date}　{nextEvent.timeRange}　{nextEvent.place}
          </p>
          <p className="text-sm mt-3 leading-relaxed" style={{ color: "#666" }}>
            当日までの準備と当日の運営について、やることを時系列で {eventTaskCount} 件に分けています。
          </p>
          <p className="text-xs mt-2.5 leading-relaxed" style={{ color: "#999" }}>
            内容はTOPに掲載しているイベント告知に書かれていることだけを根拠にしています。
            告知に無いことは載せていないため、決まっていない事柄は運営で決めて追記してください。
            金額・時刻は告知時点のもので、変わることがあります。
          </p>
        </div>

        {eventTaskPlan.map((phase, pi) => (
          <div key={phase.id} className="flex flex-col gap-2.5">
            {/* 大分類（時期） */}
            <div className="flex items-center gap-2.5 pt-1">
              <span
                className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black text-white"
                style={{ background: ACCENT }}
              >
                {pi + 1}
              </span>
              <div className="min-w-0">
                <p className="text-base font-black leading-tight" style={{ color: "#2c2c2c" }}>
                  {phase.title}
                </p>
                <p className="text-[11px] leading-snug mt-0.5" style={{ color: "#999" }}>
                  {phase.summary}
                </p>
              </div>
            </div>

            {/* 中分類（時系列の区切り） */}
            {phase.sections.map((sec) => (
              <div key={sec.id} className="card px-4 py-3.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-black" style={{ color: "#2c2c2c" }}>
                    {sec.title}
                  </span>
                  {sec.when ? (
                    <span
                      className="text-[11px] font-bold px-2 py-0.5 rounded-md whitespace-nowrap"
                      style={{ background: "#F9E6EF", color: ACCENT }}
                    >
                      {sec.when}
                    </span>
                  ) : null}
                </div>

                <div className="mt-2.5 flex flex-col">
                  {sec.tasks.map((t, ti) => (
                    <div
                      key={t.id}
                      className="flex gap-2.5 py-2"
                      style={{ borderTop: ti === 0 ? undefined : "1px solid #f4f1eb" }}
                    >
                      <span
                        className="flex-shrink-0 text-[11px] font-bold pt-0.5"
                        style={{ color: "#c7bdae", fontFamily: "Georgia,serif" }}
                      >
                        {t.id.replace("e", "")}
                      </span>
                      <div className="min-w-0">
                        <p className="text-[13px] leading-snug" style={{ color: "#2c2c2c" }}>
                          {t.label}
                        </p>
                        {t.note ? (
                          <p className="text-[11px] leading-snug mt-1" style={{ color: "#a09585" }}>
                            {t.note}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </main>
  );
}
