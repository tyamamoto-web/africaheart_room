"use client";

import { karaokeRooms, type KaraokeRoomKey, type KaraokeSlot } from "@/lib/data";

/* ============================================================
   カラオケの部屋割り（告知の回）：TOPに掲載するタイムテーブル
   ------------------------------------------------------------
   花火大会テーマ（夜背景）に合わせた配色。中身は lib/data.ts の karaokeRooms を
   差し替えるだけで更新できる（時刻も顔ぶれもあちらに置いてある）。

   ※ 当日の実際の部屋番号（管理画面の「部屋番号（当日）」）は、ここには出していない。
     共有テーブルに入っているのは先月（7/26・ジャパレン松本店）の番号なので、
     そのまま出すと諏訪の部屋番号として読まれてしまう。番号は当日ご案内する。
   ※ 絵文字は使わない（アプリ全体の方針）。
   ============================================================ */

// 部屋ごとの色味（A=青／B=桃。3本柱のカードと同じ系統でそろえる）
const ROOM: Record<KaraokeRoomKey, { bg: string; br: string; fg: string; chip: string }> = {
  A: { bg: "rgba(90,150,230,0.13)", br: "rgba(120,170,240,0.30)", fg: "#a9cdff", chip: "rgba(90,150,230,0.28)" },
  B: { bg: "rgba(255,120,180,0.12)", br: "rgba(255,140,190,0.30)", fg: "#ffb3d6", chip: "rgba(255,120,180,0.26)" },
};

// 全員で1部屋に集まる枠の色味（琥珀）
const ALL = { bg: "rgba(245,197,66,0.11)", br: "rgba(245,205,110,0.30)", fg: "#ffd884", chip: "rgba(245,197,66,0.26)" };

/** 部屋の名札（A室／B室）。 */
function RoomBadge({ room, tone }: { room: KaraokeRoomKey; tone: { fg: string; chip: string } }) {
  return (
    <span
      className="flex-shrink-0 inline-block px-2 py-0.5 rounded-md text-[11px] font-black whitespace-nowrap"
      style={{ background: tone.chip, color: tone.fg }}
    >
      {room}室
    </span>
  );
}

export default function KaraokeRooms() {
  const k = karaokeRooms;

  return (
    <div className="night-card px-4 py-4">
      <div className="flex items-center gap-2 mb-1">
        <span className="w-1.5 h-4 rounded-full" style={{ background: "#F5C542" }} />
        <h3 className="text-sm font-black" style={{ color: "#ffd884" }}>
          {k.title}
        </h3>
      </div>
      <p className="text-[11px]" style={{ color: "#b7c2da" }}>
        <span className="whitespace-nowrap">{k.time}</span>
        {" ／ "}
        <span className="whitespace-nowrap">{k.place}</span>
        {" ／ "}
        <span className="whitespace-nowrap">参加{k.attendees.length}名</span>
      </p>
      <p className="mt-1.5 text-[12px] leading-relaxed" style={{ color: "#b7c2da" }}>
        {k.lead}
      </p>

      <div className="mt-3 flex flex-col gap-2">
        {k.slots.map((s: KaraokeSlot) => {
          const split = !!s.rooms;
          return (
            <div
              key={s.id}
              className="rounded-xl px-3 py-2.5"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.09)" }}
            >
              <div className="flex items-center justify-between gap-2">
                <span
                  className="text-[11px] font-black px-2 py-0.5 rounded-md whitespace-nowrap"
                  style={{ background: "rgba(245,197,66,0.16)", color: "#ffd884" }}
                >
                  {s.time}
                </span>
                <span
                  className="text-[10px] font-bold px-2 py-0.5 rounded-md whitespace-nowrap"
                  style={{
                    background: "rgba(255,255,255,0.06)",
                    color: split ? "#c8d2e6" : "#ffd884",
                    border: `1px solid ${split ? "rgba(255,255,255,0.14)" : "rgba(245,205,110,0.34)"}`,
                  }}
                >
                  {split ? "2部屋に分かれる" : "全員で1部屋"}
                </span>
              </div>

              <p className="mt-1 text-[13px] font-black" style={{ color: "#eef2fb" }}>
                {s.label}
              </p>
              {s.detail ? (
                <p className="mt-0.5 text-[12px] leading-snug" style={{ color: "#b7c2da" }}>
                  {s.detail}
                </p>
              ) : null}

              {/* 2部屋に分かれる枠は部屋ごとの顔ぶれ、分かれない枠は集まる部屋だけを出す */}
              <div className="mt-2 flex flex-col gap-1.5">
                {split ? (
                  s.rooms!.map((r) => (
                    <div
                      key={r.key}
                      className="flex items-start gap-2 px-2.5 py-2 rounded-lg"
                      style={{ background: ROOM[r.key].bg, border: `1px solid ${ROOM[r.key].br}` }}
                    >
                      <RoomBadge room={r.key} tone={ROOM[r.key]} />
                      <p className="flex-1 text-[12px] font-semibold leading-relaxed" style={{ color: "#e4ebf8" }}>
                        {r.members.flatMap((m, i) => [
                          i > 0 ? <span key={`sep${i}`}>・</span> : null,
                          <span key={m} className="whitespace-nowrap">
                            {m}
                          </span>,
                        ])}
                      </p>
                      <span className="flex-shrink-0 text-[11px] font-bold" style={{ color: ROOM[r.key].fg }}>
                        {r.members.length}名
                      </span>
                    </div>
                  ))
                ) : (
                  <div
                    className="flex items-center gap-2 px-2.5 py-2 rounded-lg"
                    style={{ background: ALL.bg, border: `1px solid ${ALL.br}` }}
                  >
                    <RoomBadge room={k.allRoom} tone={ALL} />
                    <p className="flex-1 text-[12px] font-semibold leading-relaxed" style={{ color: "#e4ebf8" }}>
                      全員（{k.attendees.length}名）
                    </p>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-3 flex flex-col gap-1">
        {k.notes.map((n, i) => (
          <p key={i} className="text-[11px] leading-relaxed" style={{ color: "#98a4c0" }}>
            ※ {n}
          </p>
        ))}
      </div>
    </div>
  );
}
