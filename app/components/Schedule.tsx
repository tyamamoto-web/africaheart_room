"use client";

import { useState, useEffect } from "react";
import { timeSlots, defaultMembers, defaultRotations } from "@/lib/data";
import { getMembers } from "@/lib/memberStore";
import { getEventSetup, getRotationGroups } from "@/lib/eventStore";
import type { Member } from "@/lib/data";
import type { EventSetup } from "@/lib/eventStore";

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
const roomAccent = { A: "#ff6b6b", B: "#845ef7", C: "#339af0" };

export default function Schedule() {
  const [members, setMembers] = useState<Member[]>(defaultMembers);
  const [setup,   setSetup]   = useState<EventSetup>({
    attendanceIds: defaultMembers.map((m) => m.id),
    rotations: defaultRotations,
  });

  useEffect(() => {
    setMembers(getMembers());
    setSetup(getEventSetup());
  }, []);

  return (
    <section className="px-4 pb-8">
      <div className="flex items-center gap-3 mb-4 max-w-lg mx-auto">
        <div className="h-px flex-1" style={{ background: "#d8d0c8" }} />
        <p className="text-[11px] font-bold tracking-widest uppercase" style={{ color: "#aaa" }}>本日のスケジュール</p>
        <div className="h-px flex-1" style={{ background: "#d8d0c8" }} />
      </div>

      <div className="max-w-lg mx-auto flex flex-col gap-3">
        {timeSlots.map((slot) => {
          /* ── Rotation ── */
          if (slot.type === "rotation") {
            const groups = getRotationGroups(slot.id, members);
            return (
              <div key={slot.id} className="card px-4 py-3.5 animate-fade-up">
                <div className="flex items-center gap-3 mb-3">
                  <div
                    className="px-2.5 py-1 rounded-lg text-[11px] font-black text-white flex-shrink-0"
                    style={{ background: "linear-gradient(135deg,#555,#777)" }}
                  >
                    {slot.startTime}〜{slot.endTime}
                  </div>
                  <p className="text-sm font-bold" style={{ color: "#2c2c2c" }}>{slot.label}</p>
                </div>
                <div className="flex gap-2">
                  {(["A","B","C"] as const).map((room) => (
                    <div key={room} className="flex-1 rounded-xl px-2 py-2" style={{ background: "#f4f0ea" }}>
                      <div
                        className="text-center text-xs font-black mb-1.5 rounded-lg py-0.5 text-white"
                        style={{ background: roomAccent[room] }}
                      >
                        {room}
                      </div>
                      {groups[room].length === 0 ? (
                        <p className="text-[10px] text-center" style={{ color: "#ccc" }}>—</p>
                      ) : (
                        groups[room].map((m) => (
                          <p key={m.id} className="text-[10px] text-center leading-relaxed" style={{ color: "#555" }}>
                            {m.nickname}
                          </p>
                        ))
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          }

          /* ── End ── */
          if (slot.type === "end") {
            return (
              <div key={slot.id} className="card flex items-center gap-3 px-4 py-3.5 animate-fade-up">
                <div className="text-center flex-shrink-0 w-[68px]">
                  <p className="text-xs font-bold" style={{ color: "#888" }}>{slot.startTime}</p>
                  <p className="text-[10px]" style={{ color: "#bbb" }}>〜{slot.endTime}</p>
                </div>
                <div>
                  <p className="text-sm font-semibold" style={{ color: "#555" }}>{slot.label}</p>
                  {slot.detail && <p className="text-xs mt-0.5" style={{ color: "#aaa" }}>{slot.detail}</p>}
                </div>
              </div>
            );
          }

          /* ── Special events ── */
          const grad   = slot.color ? eventGrad[slot.color]  : "linear-gradient(135deg,#888,#aaa)";
          const shadow = slot.color ? eventShad[slot.color] : "rgba(0,0,0,0.1)";
          return (
            <div
              key={slot.id}
              className="rounded-2xl px-4 py-4 text-white animate-fade-up"
              style={{ background: grad, boxShadow: `0 4px 18px ${shadow}` }}
            >
              <div className="flex items-start gap-3">
                <div
                  className="flex-shrink-0 rounded-xl px-2.5 py-2 text-center"
                  style={{ background: "rgba(255,255,255,0.25)", minWidth: "68px" }}
                >
                  <p className="text-xs font-black">{slot.startTime}</p>
                  <p className="text-[10px] opacity-80">〜{slot.endTime}</p>
                </div>
                <div className="flex-1 pt-0.5">
                  <p className="font-black text-base leading-tight">{slot.label}</p>
                  {slot.detail && <p className="text-[12px] opacity-85 mt-1 leading-relaxed">{slot.detail}</p>}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
