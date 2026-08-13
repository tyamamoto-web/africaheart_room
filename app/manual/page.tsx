"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { eventTaskPlan, eventTaskCount, type EventTask } from "@/lib/eventTasks";
import { nextEvent } from "@/lib/data";
import { RACI_PEOPLE, raciKey, type RaciRole } from "@/lib/officerRaci";
import { raciDefs, raciPersonSubLabel } from "@/lib/raciDefs";
import { getEventRaci, setEventRaci, type EventRaci } from "@/lib/eventRaci";
import { getEventCheck, setEventCheck, type EventCheck } from "@/lib/eventCheck";

/* ============================================================
   イベント運営マニュアル
   ------------------------------------------------------------
   TOPの告知（lib/data.ts の nextEvent）に書かれている内容だけを根拠に、
   運営として対応が必要なやることを時系列（開催前→当日→開催後）で並べる。
   やることの追加・修正は lib/eventTasks.ts を直す（このページは表示と入力だけ）。

   表は薄いグレー。左から 時期・区切り・No・やること・補足・チェック・役割（4人）。
   ・チェック … 済みにしたものをボタンで記録。全員で共有（id8）。
   ・役割     … 役員専用ページと同じ言葉づかい（担当者/責任者/相談役/お知らせ）。
                 保存先は別の行（id7）なので、役員専用の表の入力とは混ざらない。
   どちらも約6秒ごとに取り直して、他の人の入力が自分の画面にも出るようにしている。
   行数が多いので、上のボタンで時期を絞り込めるようにしている。
   ※絵文字は使わない（アプリ全体の方針）。
   ============================================================ */

// 薄いグレーの配色（1か所にまとめて、表全体で同じトーンを使う）
const G = {
  line: "#e4e4e4",
  head: "#efefef",
  phase: "#f6f6f6",
  section: "#fafafa",
  body: "#ffffff",
  text: "#333333",
  sub: "#767676",
  faint: "#a6a6a6",
  done: "#f4f7f4", // 済みの行の背景（ごく薄い緑寄りのグレー）
};
const CHECK_ON = "#4a7a58"; // 済みボタンの色（落ち着いた緑）

const POLL_MS = 6000;

type Row = {
  task: EventTask;
  no: string;
  phaseTitle: string;
  phase?: { title: string; summary: string; span: number };
  section?: { title: string; when?: string; span: number };
};

function buildRows(phaseFilter: string): Row[] {
  const rows: Row[] = [];
  for (const phase of eventTaskPlan) {
    if (phaseFilter !== "all" && phase.id !== phaseFilter) continue;
    const phaseSpan = phase.sections.reduce((n, s) => n + s.tasks.length, 0);
    let phaseShown = false;
    for (const sec of phase.sections) {
      sec.tasks.forEach((task, ti) => {
        rows.push({
          task,
          no: task.id.replace(/^e/, ""),
          phaseTitle: phase.title,
          phase: phaseShown
            ? undefined
            : { title: phase.title, summary: phase.summary, span: phaseSpan },
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
  const [phaseFilter, setPhaseFilter] = useState<string>("all");
  const [raci, setRaci] = useState<EventRaci>({});
  const [checks, setChecks] = useState<EventCheck>(new Set());
  const [error, setError] = useState<string | null>(null);

  // 書き込み中は取り直しを止める（自分の入力が古い値で上書きされるのを防ぐ）
  const pendingWrites = useRef(0);

  const pull = useCallback(async () => {
    if (pendingWrites.current > 0) return;
    const [r, c] = await Promise.all([getEventRaci(), getEventCheck()]);
    if (pendingWrites.current > 0) return;
    setRaci(r);
    setChecks(c);
  }, []);

  useEffect(() => {
    void pull();
    const t = setInterval(() => void pull(), POLL_MS);
    return () => clearInterval(t);
  }, [pull]);

  // チェックの付け外し（先に画面へ反映し、保存に失敗したら元へ戻す）
  const toggleCheck = useCallback(
    async (taskId: string, next: boolean) => {
      setError(null);
      setChecks((prev) => {
        const s = new Set(prev);
        if (next) s.add(taskId);
        else s.delete(taskId);
        return s;
      });
      pendingWrites.current += 1;
      try {
        const saved = await setEventCheck(taskId, next);
        setChecks(saved);
      } catch (e) {
        setChecks((prev) => {
          const s = new Set(prev);
          if (next) s.delete(taskId);
          else s.add(taskId);
          return s;
        });
        setError(e instanceof Error ? e.message : "チェックの保存に失敗しました");
      } finally {
        pendingWrites.current -= 1;
      }
    },
    []
  );

  // 役割の設定・解除（先に画面へ反映し、保存に失敗したら元へ戻す）
  const changeRole = useCallback(
    async (taskId: string, personId: string, role: RaciRole | null) => {
      setError(null);
      const key = raciKey(taskId, personId);
      const before = raci[key];
      setRaci((prev) => {
        const m = { ...prev };
        if (role === null) delete m[key];
        else m[key] = role;
        return m;
      });
      pendingWrites.current += 1;
      try {
        const saved = await setEventRaci(taskId, personId, role);
        setRaci(saved);
      } catch (e) {
        setRaci((prev) => {
          const m = { ...prev };
          if (before) m[key] = before;
          else delete m[key];
          return m;
        });
        setError(e instanceof Error ? e.message : "役割の保存に失敗しました");
      } finally {
        pendingWrites.current -= 1;
      }
    },
    [raci]
  );

  const rows = buildRows(phaseFilter);
  const doneCount = eventTaskPlan.reduce(
    (n, p) => n + p.sections.reduce((m, s) => m + s.tasks.filter((t) => checks.has(t.id)).length, 0),
    0
  );

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

      {/* やること一覧（薄いグレーの表）。列が多いので、上の説明カードより広い枠に置く。 */}
      <div className="px-4 pt-3 max-w-6xl mx-auto">
        {/* 進み具合と絞り込み */}
        <div className="flex items-center gap-2 flex-wrap mb-2.5">
          <span className="text-xs font-bold" style={{ color: G.sub }}>
            済み {doneCount} / {eventTaskCount}
          </span>
          <span style={{ flex: 1 }} />
          <button
            type="button"
            onClick={() => setPhaseFilter("all")}
            style={{
              fontSize: 11,
              fontWeight: 700,
              padding: "4px 10px",
              borderRadius: 999,
              cursor: "pointer",
              border: `1px solid ${phaseFilter === "all" ? G.text : G.line}`,
              background: phaseFilter === "all" ? G.text : "#fff",
              color: phaseFilter === "all" ? "#fff" : G.sub,
            }}
          >
            すべて
          </button>
          {eventTaskPlan.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setPhaseFilter(p.id)}
              style={{
                fontSize: 11,
                fontWeight: 700,
                padding: "4px 10px",
                borderRadius: 999,
                cursor: "pointer",
                border: `1px solid ${phaseFilter === p.id ? G.text : G.line}`,
                background: phaseFilter === p.id ? G.text : "#fff",
                color: phaseFilter === p.id ? "#fff" : G.sub,
              }}
            >
              {p.title}
            </button>
          ))}
        </div>

        {error ? (
          <p
            className="text-[11px] mb-2 px-3 py-2 rounded-lg"
            style={{ background: "#fdf2ee", color: "#a9603f", border: "1px solid #ecd8cc" }}
          >
            {error}
          </p>
        ) : null}

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
              minWidth: 980,
              width: "100%",
              borderCollapse: "collapse",
              tableLayout: "fixed",
            }}
          >
            <colgroup>
              <col style={{ width: 88 }} />
              <col style={{ width: 118 }} />
              <col style={{ width: 30 }} />
              <col style={{ width: 224 }} />
              <col style={{ width: 180 }} />
              <col style={{ width: 54 }} />
              {RACI_PEOPLE.map((p) => (
                <col key={p.id} style={{ width: 71 }} />
              ))}
            </colgroup>
            <thead>
              <tr>
                <th style={th} rowSpan={2}>時期</th>
                <th style={th} rowSpan={2}>区切り</th>
                <th style={{ ...th, textAlign: "center", padding: "8px 4px" }} rowSpan={2}>No</th>
                <th style={th} rowSpan={2}>やること</th>
                <th style={th} rowSpan={2}>補足（告知の記載）</th>
                <th style={{ ...th, textAlign: "center", padding: "8px 4px" }} rowSpan={2}>済み</th>
                <th
                  style={{ ...th, textAlign: "center", borderRight: "none", borderLeft: `2px solid #d8d8d8` }}
                  colSpan={RACI_PEOPLE.length}
                >
                  役割（だれが・どう関わる）
                </th>
              </tr>
              <tr>
                {RACI_PEOPLE.map((p, pi) => (
                  <th
                    key={p.id}
                    style={{
                      ...th,
                      textAlign: "center",
                      padding: "6px 4px",
                      borderRight: pi === RACI_PEOPLE.length - 1 ? "none" : `1px solid ${G.line}`,
                      borderLeft: pi === 0 ? `2px solid #d8d8d8` : undefined,
                    }}
                  >
                    <div style={{ color: G.text, fontSize: 11 }}>{p.name}</div>
                    <div style={{ marginTop: 1, fontSize: 9.5, color: G.faint, fontWeight: 600 }}>
                      {raciPersonSubLabel(p.role)}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const done = checks.has(r.task.id);
                return (
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
                        background: done ? G.done : undefined,
                      }}
                    >
                      {r.no}
                    </td>

                    <td
                      style={{
                        ...td,
                        fontSize: 12.5,
                        color: done ? G.sub : G.text,
                        lineHeight: 1.6,
                        background: done ? G.done : undefined,
                      }}
                    >
                      {r.task.label}
                    </td>

                    <td
                      style={{
                        ...td,
                        fontSize: 11,
                        color: G.sub,
                        lineHeight: 1.6,
                        background: done ? G.done : undefined,
                      }}
                    >
                      {r.task.note ?? ""}
                    </td>

                    {/* 済み（押すと全員に共有） */}
                    <td
                      style={{
                        ...td,
                        padding: "8px 4px",
                        textAlign: "center",
                        verticalAlign: "middle",
                        background: done ? G.done : undefined,
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => void toggleCheck(r.task.id, !done)}
                        aria-pressed={done}
                        aria-label={`「${r.task.label}」を${done ? "未済に戻す" : "済みにする"}`}
                        style={{
                          width: 24,
                          height: 24,
                          borderRadius: 6,
                          padding: 0,
                          cursor: "pointer",
                          border: done ? `1.5px solid ${CHECK_ON}` : `1.5px solid #d2d2d2`,
                          background: done ? CHECK_ON : "#fff",
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          transition: "background .12s, border-color .12s",
                        }}
                      >
                        {done ? (
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                            <path
                              d="M5 12.5 10 17.5 19 7"
                              stroke="#fff"
                              strokeWidth="3"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        ) : null}
                      </button>
                    </td>

                    {/* 役割（だれが・どう関わる）：名前ごとに選ぶ・全員で共有 */}
                    {RACI_PEOPLE.map((p, pi) => {
                      const role = raci[raciKey(r.task.id, p.id)];
                      const def = raciDefs.find((d) => d.key === role);
                      return (
                        <td
                          key={p.id}
                          style={{
                            ...td,
                            padding: "8px 5px",
                            textAlign: "center",
                            verticalAlign: "middle",
                            borderRight: pi === RACI_PEOPLE.length - 1 ? "none" : `1px solid ${G.line}`,
                            borderLeft: pi === 0 ? `2px solid #d8d8d8` : undefined,
                            background: done ? G.done : undefined,
                          }}
                        >
                          <select
                            value={role ?? ""}
                            onChange={(e) =>
                              void changeRole(
                                r.task.id,
                                p.id,
                                e.target.value ? (e.target.value as RaciRole) : null
                              )
                            }
                            aria-label={`「${r.task.label}」の${p.name}さんの役割`}
                            style={{
                              width: "100%",
                              fontSize: 11,
                              padding: "4px 2px",
                              borderRadius: 6,
                              cursor: "pointer",
                              border: def ? `1.5px solid ${def.accent}` : `1px solid #d2d2d2`,
                              background: def ? def.tint : "#fff",
                              color: def ? def.accent : G.faint,
                              fontWeight: def ? 700 : 500,
                            }}
                          >
                            <option value="">—</option>
                            {raciDefs.map((d) => (
                              <option key={d.key} value={d.key}>
                                {d.short}
                              </option>
                            ))}
                          </select>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <p className="text-[11px] leading-relaxed mt-2" style={{ color: "#a6a6a6" }}>
          済んだものはチェックを押してください。押した内容と役割は約6秒ごとに取り直すため、
          他の人が入れた内容もこの画面に出ます。画面が狭いときは、表を横にスクロールできます。
        </p>
        <p className="text-[11px] leading-relaxed mt-1.5" style={{ color: "#a6a6a6" }}>
          やることの内容は、TOPに掲載しているイベント告知に書かれていることだけを根拠にしています。
          告知に無いことは載せていないため、決まっていない事柄は運営で決めて追記してください。
          金額・時刻は告知時点のもので、変わることがあります。役割の考え方はRACIにならっています。
        </p>
      </div>
    </main>
  );
}
