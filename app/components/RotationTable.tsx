"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { timeSlots, defaultMembers } from "@/lib/data";
import { getMembers } from "@/lib/memberStore";
import { getEventSetup } from "@/lib/eventStore";
import DownloadTableButton from "./DownloadTableButton";
import type { Member } from "@/lib/data";
import type { EventSetup, RoomKey } from "@/lib/eventStore";

// コマ表はモノトーン（イベントカードのカラーを引き立てるため）
const roomCfg = {
  A: { gradient: "linear-gradient(135deg,#6b6b6b,#8a8a8a)", bg: "#f6f5f3", color: "#555" },
  B: { gradient: "linear-gradient(135deg,#7e7e7e,#9e9e9e)", bg: "#f3f2f0", color: "#555" },
  C: { gradient: "linear-gradient(135deg,#909090,#b0b0b0)", bg: "#f1f0ee", color: "#555" },
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

// 会員メニュー(/test)の該当タブへのリンク（宿題タイム→宿題ルーレット等）
const featureLink: Record<string, { href: string; hint: string }> = {
  homework: { href: "/test?tab=homework", hint: "タップで宿題ルーレットへ" },
  duet:     { href: "/test?tab=duet",     hint: "タップでデュエット曲リストへ" },
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
        <p className="text-xs font-bold tracking-widest uppercase" style={{ color: "#aaa" }}>本日のタイムテーブル</p>
        <div className="h-px flex-1" style={{ background: "#d8d0c8" }} />
      </div>

      <DownloadTableButton />

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
            const link   = featureLink[slot.id];
            const body = (
              <>
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 rounded-xl px-3 py-2 text-center" style={{ background: "rgba(255,255,255,0.25)", minWidth: "76px" }}>
                    <p className="text-sm font-black">{slot.startTime}</p>
                    <p className="text-xs opacity-80">〜{slot.endTime}</p>
                  </div>
                  <div className="flex-1 pt-0.5">
                    <p className="font-black text-lg leading-tight">{slot.label}</p>
                    {slot.detail && (
                      <p className="text-sm opacity-80 mt-1 leading-relaxed" style={{ whiteSpace: "pre-line" }}>
                        {slot.detail}
                      </p>
                    )}
                  </div>
                  {link && <span className="flex-shrink-0 self-center text-2xl font-black opacity-90">›</span>}
                </div>
                {link && (
                  <div className="mt-2.5 flex justify-center">
                    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold" style={{ background: "rgba(255,255,255,0.25)" }}>
                      {link.hint} ›
                    </span>
                  </div>
                )}
              </>
            );
            if (link) {
              return (
                <Link
                  key={slot.id}
                  href={link.href}
                  className="block rounded-2xl px-5 py-4 text-white animate-fade-up transition-transform active:scale-[0.99]"
                  style={{ background: grad, boxShadow: `0 4px 16px ${shadow}` }}
                >
                  {body}
                </Link>
              );
            }
            return (
              <div
                key={slot.id}
                className="rounded-2xl px-5 py-4 text-white animate-fade-up"
                style={{ background: grad, boxShadow: `0 4px 16px ${shadow}` }}
              >
                {body}
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
          const usedRooms = (["A", "B", "C"] as const).filter((r) => groups[r].length > 0);
          const hasAny = usedRooms.length > 0;

          return (
            <div key={slot.id} className="card overflow-hidden animate-fade-up">
              {/* Header（時間帯のみ） */}
              <div className="px-4 py-3 border-b" style={{ borderColor: "#f0ece5" }}>
                <p className="text-lg font-black" style={{ color: "#2c2c2c" }}>
                  {slot.startTime}<span className="mx-1 font-bold" style={{ color: "#bbb" }}>〜</span>{slot.endTime}
                </p>
              </div>

              {/* Room groups */}
              {!hasAny ? (
                <div className="px-4 py-8 text-center">
                  <p className="text-base font-semibold" style={{ color: "#ccc" }}>部屋割りは設定中です</p>
                  <p className="text-sm mt-1" style={{ color: "#ddd" }}>しばらくお待ちください</p>
                </div>
              ) : (
                <div
                  className="grid divide-x divide-gray-100"
                  style={{ gridTemplateColumns: `repeat(${usedRooms.length}, minmax(0, 1fr))` }}
                >
                  {usedRooms.map((room) => {
                    const cfg = roomCfg[room];
                    const names = groups[room];
                    return (
                      <div key={room} style={{ background: cfg.bg }}>
                        <div className="flex items-center justify-center py-2.5 gap-1.5" style={{ background: cfg.gradient }}>
                          <span className="text-base font-black text-white">{room}</span>
                          <span className="text-xs font-bold text-white/80">ルーム</span>
                        </div>
                        <div className="px-2 py-3 flex flex-col gap-2 min-h-[52px]">
                          {names.map((m) => (
                            <p key={m.id} className="text-base font-semibold text-center leading-snug" style={{ color: "#2c2c2c" }}>
                              {m.nickname}
                            </p>
                          ))}
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
