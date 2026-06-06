"use client";

import { useState, useMemo, useEffect } from "react";
import { timeSlots, defaultMembers, defaultRotations } from "@/lib/data";
import { getMembers } from "@/lib/memberStore";
import { getEventSetup } from "@/lib/eventStore";
import type { Member, TimeSlot } from "@/lib/data";
import type { EventSetup } from "@/lib/eventStore";

const roomBadge = {
  A: { bg: "#ff6b6b", shadow: "rgba(255,107,107,0.35)" },
  B: { bg: "#845ef7", shadow: "rgba(132,94,247,0.35)" },
  C: { bg: "#339af0", shadow: "rgba(51,154,240,0.35)" },
} as const;

const eventAccent: Record<string, string> = {
  yellow: "#f59e0b",
  orange: "#f97316",
  blue:   "#3b82f6",
  pink:   "#ec4899",
  green:  "#10b981",
};

type ScheduleItem = {
  slot: TimeSlot;
  room: "A" | "B" | "C" | null;
};

export default function RoomSearch() {
  const [query, setQuery]   = useState("");
  const [members, setMembers]       = useState<Member[]>(defaultMembers);
  const [setup,   setSetup]         = useState<EventSetup>({
    attendanceIds: defaultMembers.map((m) => m.id),
    rotations: defaultRotations,
  });

  useEffect(() => {
    setMembers(getMembers());
    setSetup(getEventSetup());
  }, []);

  const result = useMemo(() => {
    const q = query.trim().replace(/\s+/g, "");
    if (!q) return null;

    const member = members.find((m) =>
      m.nickname.replace(/\s+/g, "").includes(q)
    );
    if (!member) return { found: false, items: [] as ScheduleItem[] };

    const items: ScheduleItem[] = [];
    for (const slot of timeSlots) {
      if (slot.type === "rotation") {
        const room = setup.rotations[slot.id]?.[member.id] ?? null;
        if (room) items.push({ slot, room });
      } else {
        items.push({ slot, room: null });
      }
    }
    return { found: true, items };
  }, [query, members, setup]);

  const hasQuery = query.trim().length > 0;
  const notFound = hasQuery && result !== null && !result.found;

  return (
    <section className="px-4 mb-4 animate-fade-up">
      {/* Search card */}
      <div className="card p-5 max-w-lg mx-auto mb-4">
        <p
          className="text-xs font-bold tracking-widest mb-3 text-center uppercase"
          style={{ color: "#aaa" }}
        >
          ニックネームで検索
        </p>
        <div className="relative">
          <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
            <svg className="w-4 h-4" style={{ color: "#ccc" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="例：よしの助"
            className="w-full rounded-xl pl-10 pr-10 py-3.5 text-sm font-medium focus:outline-none transition-all"
            style={{ background: "#f4f0ea", color: "#2c2c2c", border: "2px solid transparent" }}
            onFocus={(e)  => (e.target.style.border = "2px solid #FF6348AA")}
            onBlur={(e)   => (e.target.style.border = "2px solid transparent")}
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="absolute inset-y-0 right-4 flex items-center"
              style={{ color: "#ccc" }}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
        {!hasQuery && (
          <p className="text-center text-xs mt-2.5" style={{ color: "#bbb" }}>
            自分の名前を入れると今日のスケジュールがわかります 👆
          </p>
        )}
      </div>

      {/* Schedule result */}
      {result?.found && (
        <div className="max-w-lg mx-auto pop-in">
          <p className="text-xs font-bold text-center mb-3" style={{ color: "#888" }}>
            「{query}」のスケジュール
          </p>
          <div className="flex flex-col gap-2">
            {result.items.map(({ slot, room }, i) => {
              if (slot.type === "end") return null;

              if (slot.type === "rotation" && room) {
                const badge = roomBadge[room];
                return (
                  <div key={i} className="card flex items-center gap-3 px-4 py-3.5">
                    <div className="flex-shrink-0 text-center w-[68px]">
                      <p className="text-xs font-bold" style={{ color: "#888" }}>{slot.startTime}</p>
                      <p className="text-[10px]" style={{ color: "#bbb" }}>〜{slot.endTime}</p>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] mb-1.5" style={{ color: "#aaa" }}>{slot.label}</p>
                      <div
                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-white font-black text-sm"
                        style={{ background: badge.bg, boxShadow: `0 3px 10px ${badge.shadow}` }}
                      >
                        ROOM {room}
                      </div>
                    </div>
                  </div>
                );
              }

              const accent = slot.color ? eventAccent[slot.color] : "#aaa";
              return (
                <div
                  key={i}
                  className="card flex items-center gap-3 px-4 py-3.5"
                  style={{ borderLeft: `4px solid ${accent}` }}
                >
                  <div className="flex-shrink-0 text-center w-[68px]">
                    <p className="text-xs font-bold" style={{ color: "#888" }}>{slot.startTime}</p>
                    <p className="text-[10px]" style={{ color: "#bbb" }}>〜{slot.endTime}</p>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold" style={{ color: "#2c2c2c" }}>{slot.label}</p>
                    {slot.detail && (
                      <p className="text-xs mt-0.5 leading-relaxed" style={{ color: "#888" }}>{slot.detail}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {notFound && (
        <div className="max-w-lg mx-auto card p-6 text-center pop-in">
          <p className="text-3xl mb-2">🤔</p>
          <p className="text-sm font-semibold" style={{ color: "#555" }}>
            「{query}」は見つかりませんでした
          </p>
          <p className="text-xs mt-1" style={{ color: "#aaa" }}>スタッフにご確認ください</p>
        </div>
      )}
    </section>
  );
}
