"use client";

import Link from "next/link";
import { useState } from "react";
import { archivedEvents, type ArchivedEvent } from "@/lib/archive";
import type { Member } from "@/lib/data";

const roomCfg = {
  A: { gradient: "linear-gradient(135deg,#6b6b6b,#8a8a8a)", bg: "#f6f5f3" },
  B: { gradient: "linear-gradient(135deg,#7e7e7e,#9e9e9e)", bg: "#f3f2f0" },
  C: { gradient: "linear-gradient(135deg,#909090,#b0b0b0)", bg: "#f1f0ee" },
} as const;

const eventGrad: Record<string, string> = {
  yellow:  "linear-gradient(135deg,#f59e0b,#fbbf24)",
  orange:  "linear-gradient(135deg,#f97316,#fb923c)",
  blue:    "linear-gradient(135deg,#3b82f6,#60a5fa)",
  pink:    "linear-gradient(135deg,#ec4899,#f472b6)",
  green:   "linear-gradient(135deg,#10b981,#34d399)",
  rose:    "linear-gradient(135deg,#B81D6C,#D6398A)",
  magenta: "linear-gradient(135deg,#A8175F,#C81E77)",
};

function EventDetail({ ev }: { ev: ArchivedEvent }) {
  const byId = new Map(ev.members.map((m) => [m.id, m] as const));

  return (
    <div className="flex flex-col gap-4">
      {ev.timeSlots.map((slot) => {
        if (slot.type === "rotation") {
          const assign = ev.rotations[slot.id] ?? {};
          const groups: Record<"A" | "B" | "C", Member[]> = { A: [], B: [], C: [] };
          for (const [mid, room] of Object.entries(assign)) {
            const m = byId.get(mid);
            if (m && (room === "A" || room === "B" || room === "C")) groups[room].push(m);
          }
          const usedRooms = (["A", "B", "C"] as const).filter((r) => groups[r].length > 0);
          return (
            <div key={slot.id} className="card overflow-hidden">
              <div className="px-4 py-3 border-b" style={{ borderColor: "#f0ece5" }}>
                <p className="text-lg font-black" style={{ color: "#2c2c2c" }}>
                  {slot.startTime}<span className="mx-1 font-bold" style={{ color: "#bbb" }}>〜</span>{slot.endTime}
                </p>
              </div>
              <div className="grid divide-x divide-gray-100" style={{ gridTemplateColumns: `repeat(${usedRooms.length || 1}, minmax(0,1fr))` }}>
                {usedRooms.map((room) => (
                  <div key={room} style={{ background: roomCfg[room].bg }}>
                    <div className="flex items-center justify-center py-2.5 gap-1.5" style={{ background: roomCfg[room].gradient }}>
                      <span className="text-base font-black text-white">{room}</span>
                      <span className="text-xs font-bold text-white/80">ルーム</span>
                    </div>
                    <div className="px-2 py-3 flex flex-col gap-2 min-h-[52px]">
                      {groups[room].map((m) => (
                        <p key={m.id} className="text-base font-semibold text-center leading-snug" style={{ color: "#2c2c2c" }}>{m.nickname}</p>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        }
        if (slot.type === "end") {
          return (
            <div key={slot.id} className="card flex items-center gap-3 px-4 py-4">
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
        const grad = slot.color ? eventGrad[slot.color] : "linear-gradient(135deg,#aaa,#ccc)";
        return (
          <div key={slot.id} className="rounded-2xl px-5 py-4 text-white" style={{ background: grad }}>
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 rounded-xl px-3 py-2 text-center" style={{ background: "rgba(255,255,255,0.25)", minWidth: "76px" }}>
                <p className="text-sm font-black">{slot.startTime}</p>
                <p className="text-xs opacity-80">〜{slot.endTime}</p>
              </div>
              <div className="flex-1 pt-0.5">
                <p className="font-black text-lg leading-tight">{slot.label}</p>
                {slot.detail && (
                  <p className="text-sm opacity-80 mt-1 leading-relaxed" style={{ whiteSpace: "pre-line" }}>{slot.detail}</p>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function ArchivePage() {
  const [openId, setOpenId] = useState<string | null>(archivedEvents[0]?.id ?? null);

  return (
    <main className="min-h-screen fun-bg pb-16">
      <div className="sticky top-0 z-50 px-4 py-3 flex items-center gap-3" style={{ background: "#f0ece5" }}>
        <Link href="/admin" className="flex items-center gap-1.5 text-sm font-semibold px-3 py-2 rounded-xl card" style={{ color: "#555" }}>
          ← 管理画面
        </Link>
        <h1 className="text-base font-black" style={{ color: "#2c2c2c" }}>部屋割りアーカイブ</h1>
      </div>

      <div className="px-4 pt-3 max-w-lg mx-auto flex flex-col gap-3">
        <div className="card px-4 py-4">
          <p className="text-sm leading-relaxed" style={{ color: "#666" }}>
            過去のオフ会の時間割・部屋割りを保存しています。タイトルをタップで開閉できます。
          </p>
        </div>

        {archivedEvents.length === 0 ? (
          <div className="card px-4 py-10 text-center">
            <p className="text-sm" style={{ color: "#aaa" }}>まだアーカイブがありません</p>
          </div>
        ) : (
          archivedEvents.map((ev) => {
            const open = openId === ev.id;
            return (
              <div key={ev.id} className="flex flex-col gap-3">
                <button
                  onClick={() => setOpenId(open ? null : ev.id)}
                  className="card px-4 py-3.5 text-left flex items-center gap-3"
                >
                  <div className="flex-shrink-0 w-1.5 h-10 rounded-full" style={{ background: "linear-gradient(135deg,#FF6B9D,#FF4FA3)" }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-black" style={{ color: "#2c2c2c" }}>{ev.date}</p>
                    <p className="text-xs truncate" style={{ color: "#999" }}>{ev.venue}{ev.note ? `　/　${ev.note}` : ""}</p>
                  </div>
                  <span className="text-sm flex-shrink-0" style={{ color: "#bbb" }}>{open ? "▲" : "▼"}</span>
                </button>
                {open && <EventDetail ev={ev} />}
              </div>
            );
          })
        )}
      </div>
    </main>
  );
}
