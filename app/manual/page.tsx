"use client";

import Link from "next/link";
import { eventTaskPlan, eventTaskCount, type EventTask } from "@/lib/eventTasks";
import { nextEvent } from "@/lib/data";

/* ============================================================
   イベント運営マニュアル
   ------------------------------------------------------------
   TOPの告知（lib/data.ts の nextEvent）に書かれている内容だけを根拠に、
   運営として対応が必要なやることを時系列（開催前→当日→開催後）で並べる。
   内容の追加・修正は lib/eventTasks.ts を直す（このページは表示だけ）。

   表示は薄いグレーの表。大分類（時期）・中分類（区切り）は縦に結合して、
   どのまとまりのやることかがひと目で分かるようにしている。
   画面が狭いときは表だけ横スクロールする（本文は横に伸びない）。
   ※絵文字は使わない（アプリ全体の方針）。
   ============================================================ */

// 薄いグレーの配色（1か所にまとめて、表全体で同じトーンを使う）
const G = {
  line: "#e4e4e4",     // 罫線
  head: "#efefef",     // 見出し行の背景
  phase: "#f6f6f6",    // 大分類セルの背景
  section: "#fafafa",  // 中分類セルの背景
  body: "#ffffff",     // やることセルの背景
  text: "#333333",     // 本文
  sub: "#767676",      // 補足・見出し文字
  faint: "#a6a6a6",    // 番号など控えめな文字
};

// 表の1行ぶん。phase / section は「そのまとまりの最初の行」だけに入れて縦結合する。
type Row = {
  task: EventTask;
  no: string;
  phase?: { title: string; summary: string; span: number };
  section?: { title: string; when?: string; span: number };
};

function buildRows(): Row[] {
  const rows: Row[] = [];
  for (const phase of eventTaskPlan) {
    const phaseSpan = phase.sections.reduce((n, s) => n + s.tasks.length, 0);
    let phaseShown = false;
    for (const sec of phase.sections) {
      sec.tasks.forEach((task, ti) => {
        rows.push({
          task,
          no: task.id.replace(/^e/, ""),
          phase: phaseShown ? undefined : { title: phase.title, summary: phase.summary, span: phaseSpan },
          section: ti === 0 ? { title: sec.title, when: sec.when, span: sec.tasks.length } : undefined,
        });
        phaseShown = true;
      });
    }
  }
  return rows;
}

const th: React.CSSProperties = {
  background: G.head,
  color: G.sub,
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: "0.04em",
  textAlign: "left",
  padding: "8px 10px",
  borderBottom: `1px solid ${G.line}`,
  borderRight: `1px solid ${G.line}`,
  whiteSpace: "nowrap",
};
const td: React.CSSProperties = {
  padding: "9px 10px",
  borderBottom: `1px solid ${G.line}`,
  borderRight: `1px solid ${G.line}`,
  verticalAlign: "top",
};

export default function ManualPage() {
  const rows = buildRows();

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

      <div className="px-4 pt-3 max-w-lg mx-auto">
        {/* このマニュアルの前提 */}
        <div className="card px-4 py-4">
          <p className="text-sm font-black" style={{ color: "#A8175F" }}>
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
      </div>

      {/* やること一覧（薄いグレーの表）。列が多いので、上の説明カードより広い枠に置く。 */}
      <div className="px-4 pt-3 max-w-3xl mx-auto">
        <div
          style={{
            border: `1px solid ${G.line}`,
            borderRadius: 12,
            overflowX: "auto",
            overflowY: "hidden",
            background: G.body,
          }}
        >
          <table
            style={{
              minWidth: 700,
              width: "100%",
              borderCollapse: "collapse",
              tableLayout: "fixed",
            }}
          >
            <colgroup>
              <col style={{ width: 92 }} />
              <col style={{ width: 128 }} />
              <col style={{ width: 34 }} />
              <col style={{ width: 236 }} />
              <col style={{ width: 210 }} />
            </colgroup>
            <thead>
              <tr>
                <th style={th}>時期</th>
                <th style={th}>区切り</th>
                <th style={{ ...th, textAlign: "center", padding: "8px 4px" }}>No</th>
                <th style={th}>やること</th>
                <th style={{ ...th, borderRight: "none" }}>補足（告知の記載）</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.task.id}>
                  {r.phase ? (
                    <td rowSpan={r.phase.span} style={{ ...td, background: G.phase }}>
                      <p style={{ fontSize: 12.5, fontWeight: 700, color: G.text, lineHeight: 1.5 }}>
                        {r.phase.title}
                      </p>
                      <p style={{ marginTop: 4, fontSize: 10.5, color: G.faint, lineHeight: 1.6 }}>
                        {r.phase.summary}
                      </p>
                    </td>
                  ) : null}

                  {r.section ? (
                    <td rowSpan={r.section.span} style={{ ...td, background: G.section }}>
                      <p style={{ fontSize: 12, fontWeight: 700, color: G.text, lineHeight: 1.5 }}>
                        {r.section.title}
                      </p>
                      {r.section.when ? (
                        <p style={{ marginTop: 3, fontSize: 10.5, color: G.sub, whiteSpace: "nowrap" }}>
                          {r.section.when}
                        </p>
                      ) : null}
                    </td>
                  ) : null}

                  <td
                    style={{
                      ...td,
                      padding: "9px 4px",
                      textAlign: "center",
                      fontSize: 10.5,
                      fontFamily: "Georgia,serif",
                      color: G.faint,
                    }}
                  >
                    {r.no}
                  </td>

                  <td style={{ ...td, fontSize: 12.5, color: G.text, lineHeight: 1.6 }}>
                    {r.task.label}
                  </td>

                  <td
                    style={{
                      ...td,
                      borderRight: "none",
                      fontSize: 11,
                      color: G.sub,
                      lineHeight: 1.6,
                    }}
                  >
                    {r.task.note ?? ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="text-[11px] leading-relaxed mt-2" style={{ color: "#a6a6a6" }}>
          画面が狭いときは、表を横にスクロールできます。
        </p>
      </div>
    </main>
  );
}
