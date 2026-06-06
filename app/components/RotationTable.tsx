"use client";

import { useState, useEffect } from "react";
import { timeSlots, defaultMembers } from "@/lib/data";
import { getMembers } from "@/lib/memberStore";
import { getEventSetup } from "@/lib/eventStore";
import type { Member } from "@/lib/data";
import type { EventSetup, RoomKey } from "@/lib/eventStore";

const roomCfg = {
  A: { gradient: "linear-gradient(135deg,#ff6b6b,#ff9a5c)", bg: "#fff4f4", color: "#ff6b6b" },
  B: { gradient: "linear-gradient(135deg,#845ef7,#cc5de8)", bg: "#f7f3ff", color: "#845ef7" },
  C: { gradient: "linear-gradient(135deg,#339af0,#22d3ee)", bg: "#f0f8ff", color: "#339af0" },
} as const;

const eventGrad: Record<string, string> = {
  yellow: "linear-gradient(135deg,#f59e0b,#fbbf24)",
  orange: "linear-gradient(135deg,#f97316,#fb923c)",
  blue:   "linear-gradient(135deg,#3b82f6,#60a5fa)",
  pink:   "linear-gradient(135deg,#ec4899,#f472b6)",
  green:  "linear-gradient(135deg,#10b981,#34d399)",
};
const eventShad: Record<string, string> = {
  yellow: "rgba(245,158,11,0.3)",
  orange: "rgba(249,115,22,0.3)",
  blue:   "rgba(59,130,246,0.3)",
  pink:   "rgba(236,72,153,0.3)",
  green:  "rgba(16,185,129,0.3)",
};

export default function RotationTable() {
  const [members, setMembers] = useState<Member[]>(defaultMembers);
  const [setup,   setSetup]   = useState<EventSetup>({
    attendanceIds: defaultMembers.map((m) => m.id),
    rotations: {},
  });

  useEffect(() => {
    setMembers(getMembers());
    setSetup(getEventSetup());
  }, []);

  return (
    <section className="px-4 pb-4">
      <div className="flex items-center gap-3 mb-4 max-w-lg mx-auto">
        <div className="h-px flex-1" style={{ background: "#d8d0c8" }} />
        <p className="text-xs font-bold tracking-widest uppercase" style={{ color: "#aaa" }}>部屋割り一覧</p>
        <div className="h-px flex-1" style={{ background: "#d8d0c8" }} />
      </div>

      <div className="max-w-lg mx-auto flex flex-col gap-4">
        {timeSlots.map((slot) => {

          /* ── end ── */
          if (slot.type === "end") {
            return (
              <div key={slot.id} className="card flex items-center gap-3 px-4 py-4 animate-fade-up">
                <div className="flex-shrink-0 text-center w-[76px]">
                  <p className="text-sm font-bold" style={{ color: "#888" }}>{slot.startTime}</p>
                  <p className="text-xs" style={{ color: "#bbb" }}>〜{slot.endTime}</p>
                </div>
                <div>
                  <p className="text-base font-semibold" style={{ color: "#555" }}>{slot.label}</p>
                  {slot.detail && <p className="text-sm mt-0.5" style={{ color: "#aaa" }}>{slot.detail}</p>}
                </div>
              </div>
            );
          }

          /* ── special event ── */
          if (slot.type !== "rotation") {
            const grad   = slot.color ? eventGrad[slot.color]  : "linear-gradient(135deg,#aaa,#ccc)";
            const shadow = slot.color ? eventShad[slot.color] : "rgba(0,0,0,0.1)";
            return (
              <div
                key={slot.id}
                className="rounded-2xl px-5 py-4 text-white animate-fade-up"
                style={{ background: grad, boxShadow: `0 4px 16px ${shadow}` }}
              >
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 rounded-xl px-3 py-2 text-center" style={{ background: "rgba(255,255,255,0.25)", minWidth: "76px" }}>
                    <p className="text-sm font-black">{slot.startTime}</p>
                    <p className="text-xs opacity-80">〜{slot.endTime}</p>
                  </div>
                  <div className="flex-1 pt-0.5">
                    <p className="font-black text-lg leading-tight">{slot.label}</p>
                    {slot.detail && <p className="text-sm opacity-80 mt-1 leading-relaxed">{slot.detail}</p>}
                  </div>
                </div>
              </div>
            );
          }

          /* ── Rotation slot (read-only) ── */
          const assignments = setup.rotations[slot.id] ?? {};
          const attending = new Set(setup.attendanceIds);
          const groups = { A: [] as Member[], B: [] as Member[], C: [] as Member[], unassigned: [] as Member[] };
          for (const m of members) {
            if (!attending.has(m.id)) continue;
            const room = assignments[m.id];
            if (room === "A" || room === "B" || room === "C") groups[room].push(m);
            else groups.unassigned.push(m);
          }
          const hasAny = groups.A.length + groups.B.length + groups.C.length > 0;

          return (
            <div key={slot.id} className="card overflow-hidden animate-fade-up">
              {/* Header */}
              <div className="flex items-center gap-3 px-4 py-3 border-b" style={{ borderColor: "#f0ece5" }}>
                <div
                  className="px-3 py-1.5 rounded-xl text-sm font-black text-white flex-shrink-0"
                  style={{ background: "linear-gradient(135deg,#555,#777)" }}
                >
                  {slot.startTime}〜{slot.endTime}
                </div>
                <p className="text-base font-bold flex-1" style={{ color: "#2c2c2c" }}>{slot.label}</p>
              </div>

              {/* Room groups */}
              {!hasAny ? (
                <div className="px-4 py-8 text-center">
                  <p className="text-base font-semibold" style={{ color: "#ccc" }}>部屋割りは設定中です</p>
                  <p className="text-sm mt-1" style={{ color: "#ddd" }}>しばらくお待ちください</p>
                </div>
              ) : (
                <div className="grid grid-cols-3 divide-x divide-gray-100">
                  {(["A", "B", "C"] as const).map((room) => {
                    const cfg = roomCfg[room];
                    const names = groups[room];
                    return (
                      <div key={room} style={{ background: cfg.bg }}>
                        <div className="flex items-center justify-center py-2.5 gap-1.5" style={{ background: cfg.gradient }}>
                          <span className="text-base font-black text-white">{room}</span>
                          <span className="text-xs font-bold text-white/80">ルーム</span>
                        </div>
                        <div className="px-2 py-3 flex flex-col gap-2 min-h-[52px]">
                          {names.length === 0 ? (
                            <p className="text-sm text-center" style={{ color: "#ccc" }}>—</p>
                          ) : (
                            names.map((m) => (
                              <p key={m.id} className="text-sm font-semibold text-center leading-snug" style={{ color: "#2c2c2c" }}>
                                {m.nickname}
                              </p>
                            ))
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
