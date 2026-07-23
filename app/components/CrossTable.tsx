"use client";

import { useState, useEffect } from "react";
import { timeSlots, defaultMembers, allSlotAbsent } from "@/lib/data";
import { getMembers } from "@/lib/memberStore";
import { getEventSetup } from "@/lib/eventStore";
import type { Member } from "@/lib/data";
import type { EventSetup } from "@/lib/eventStore";

// 同席回数の色（薄ピンク→濃ピンク。アプリのピンク基調に合わせる）
const fill: Record<number, string> = {
  1: "#FCE7F1", 2: "#F7B8D5", 3: "#F27CB2", 4: "#E8519A", 5: "#C81E77",
};
const ink: Record<number, string> = {
  1: "#8A1F53", 2: "#8A1F53", 3: "#ffffff", 4: "#ffffff", 5: "#ffffff",
};

function pairKey(a: string, b: string) {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

export default function CrossTable() {
  const [members, setMembers] = useState<Member[]>(defaultMembers);
  const [setup, setSetup] = useState<EventSetup>({
    attendanceIds: defaultMembers.map((m) => m.id),
    rotations: {},
  });
  const [mode, setMode] = useState<"koma" | "full">("koma");

  useEffect(() => {
    setMembers(getMembers());
    setSetup(getEventSetup());
  }, []);

  const attendSet = new Set(setup.attendanceIds);
  const people = members.filter((m) => attendSet.has(m.id));

  // 同席回数を集計
  const counts = new Map<string, number>();
  const add = (ids: string[]) => {
    for (let i = 0; i < ids.length; i++)
      for (let j = i + 1; j < ids.length; j++) {
        const k = pairKey(ids[i], ids[j]);
        counts.set(k, (counts.get(k) ?? 0) + 1);
      }
  };
  for (const slot of timeSlots) {
    if (slot.type === "rotation") {
      const asg = setup.rotations[slot.id] ?? {};
      const rooms: Record<string, string[]> = {};
      for (const m of people) {
        const r = asg[m.id];
        if (r === "A" || r === "B" || r === "C") (rooms[r] ??= []).push(m.id);
      }
      for (const g of Object.values(rooms)) add(g);
    } else if (slot.type === "all" && mode === "full") {
      const absent = new Set(allSlotAbsent[slot.id] ?? []);
      add(people.filter((m) => !absent.has(m.id)).map((m) => m.id));
    }
  }

  const get = (a: string, b: string) => (a === b ? -1 : counts.get(pairKey(a, b)) ?? 0);
  let maxV = 0;
  counts.forEach((v) => {
    if (v > maxV) maxV = v;
  });

  const CELL = 26;

  return (
    <section className="px-4 pb-4">
      <div className="flex items-center gap-3 mb-4 max-w-lg mx-auto">
        <div className="h-px flex-1" style={{ background: "#d8d0c8" }} />
        <p className="text-xs font-bold tracking-widest uppercase" style={{ color: "#aaa" }}>
          同席クロス表
        </p>
        <div className="h-px flex-1" style={{ background: "#d8d0c8" }} />
      </div>

      <div className="max-w-lg mx-auto card px-3 py-4">
        {/* 切替 */}
        <div className="flex justify-center mb-3">
          <div className="inline-flex rounded-full p-1" style={{ background: "#f3f0ec" }}>
            {([
              ["koma", "コマのみ"],
              ["full", "全セッション"],
            ] as const).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setMode(key)}
                className="px-4 py-1.5 rounded-full text-xs font-bold transition-colors"
                style={
                  mode === key
                    ? { background: "linear-gradient(135deg,#A8175F,#C81E77)", color: "#fff" }
                    : { background: "transparent", color: "#999" }
                }
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <p className="text-[11px] leading-relaxed text-center mb-3" style={{ color: "#999" }}>
          {mode === "koma"
            ? "小部屋（コマ①〜⑤）での同席回数。最多3回で調整（宿題・デュエットは除く）"
            : "宿題・デュエット（全員集合）を含む総同席回数。0＝未同席"}
        </p>

        {/* 表（横スクロール可） */}
        <div className="overflow-x-auto">
          <table style={{ borderCollapse: "separate", borderSpacing: 2, margin: "0 auto" }}>
            <thead>
              <tr>
                <th style={{ width: 44 }} />
                {people.map((m) => (
                  <th key={m.id} style={{ height: 58, verticalAlign: "bottom", padding: 0 }}>
                    <div
                      style={{
                        writingMode: "vertical-rl",
                        fontSize: 10,
                        fontWeight: 700,
                        margin: "0 auto",
                        whiteSpace: "nowrap",
                        color: m.role === "guest" ? "#C81E77" : "#888",
                      }}
                    >
                      {m.nickname}
                      {m.role === "guest" ? "・G" : ""}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {people.map((row) => (
                <tr key={row.id}>
                  <th
                    style={{
                      textAlign: "right",
                      padding: "0 6px 0 0",
                      fontSize: 10.5,
                      fontWeight: 700,
                      whiteSpace: "nowrap",
                      color: row.role === "guest" ? "#C81E77" : "#555",
                    }}
                  >
                    {row.nickname}
                    {row.role === "guest" ? "・G" : ""}
                  </th>
                  {people.map((col) => {
                    const v = get(row.id, col.id);
                    if (v === -1)
                      return (
                        <td
                          key={col.id}
                          style={{
                            width: CELL,
                            height: CELL,
                            borderRadius: 4,
                            background:
                              "linear-gradient(45deg, transparent calc(50% - 0.6px), #D8D0C8 calc(50% - 0.6px), #D8D0C8 calc(50% + 0.6px), transparent calc(50% + 0.6px))",
                          }}
                        />
                      );
                    if (v === 0)
                      return mode === "full" ? (
                        <td
                          key={col.id}
                          title="未同席"
                          style={{
                            width: CELL,
                            height: CELL,
                            textAlign: "center",
                            fontSize: 11,
                            fontWeight: 700,
                            borderRadius: 4,
                            background: "#FBE9E7",
                            color: "#C0392B",
                            border: "1px solid #F1C7C1",
                          }}
                        >
                          0
                        </td>
                      ) : (
                        <td
                          key={col.id}
                          style={{
                            width: CELL,
                            height: CELL,
                            textAlign: "center",
                            fontSize: 11,
                            borderRadius: 4,
                            background: "#f6f4f1",
                            color: "#cbc5bd",
                          }}
                        >
                          ·
                        </td>
                      );
                    const isMax = v === maxV;
                    return (
                      <td
                        key={col.id}
                        style={{
                          width: CELL,
                          height: CELL,
                          textAlign: "center",
                          fontSize: 12,
                          fontWeight: 700,
                          borderRadius: 4,
                          background: fill[v] ?? fill[5],
                          color: ink[v] ?? "#fff",
                          outline: isMax ? "2px solid #5C0E38" : "none",
                          outlineOffset: -2,
                        }}
                      >
                        {v}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* 凡例 */}
        <div
          className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5 mt-3 text-[10.5px]"
          style={{ color: "#999" }}
        >
          {[1, 2, 3, 4, 5].map((n) => (
            <span key={n} className="inline-flex items-center gap-1">
              <span
                style={{
                  width: 13,
                  height: 13,
                  borderRadius: 3,
                  background: fill[n],
                  display: "inline-block",
                }}
              />
              {n}回
            </span>
          ))}
          {mode === "full" && (
            <span className="inline-flex items-center gap-1">
              <span
                style={{
                  width: 13,
                  height: 13,
                  borderRadius: 3,
                  background: "#FBE9E7",
                  border: "1px solid #F1C7C1",
                  display: "inline-block",
                }}
              />
              未同席
            </span>
          )}
          <span className="inline-flex items-center gap-1">
            <span style={{ color: "#C81E77", fontWeight: 700 }}>G</span>ゲスト
          </span>
        </div>
      </div>
    </section>
  );
}
