"use client";

import { Fragment } from "react";
import { karaokeRooms, type KaraokeRoomKey, type KaraokeSlot } from "@/lib/data";

/* ============================================================
   カラオケの部屋割り（告知の回）：TOPに掲載する表
   ------------------------------------------------------------
   並びは、このアプリが前から使っている「部屋割り表」と同じ形にそろえてある。
     左が時間、右が部屋（A室・B室）。全員で集まる枠は部屋の列をつないで1つにする。
   花火大会テーマ（夜背景）に合わせた配色。中身は lib/data.ts の karaokeRooms を
   差し替えるだけで更新できる（時刻も顔ぶれもあちらに置いてある）。

   ※ 当日の実際の部屋番号（管理画面の「部屋番号（当日）」）は、ここには出していない。
     共有テーブルに入っているのは先月（7/26・ジャパレン松本店）の番号なので、
     そのまま出すと諏訪の部屋番号として読まれてしまう。番号は当日ご案内する。
   ※ 絵文字は使わない（アプリ全体の方針）。
   ============================================================ */

// 部屋ごとの色味（A=青／B=桃。3本柱のカードと同じ系統でそろえる）
const ROOM: Record<KaraokeRoomKey, { bg: string; fg: string }> = {
  A: { bg: "rgba(90,150,230,0.10)", fg: "#a9cdff" },
  B: { bg: "rgba(255,120,180,0.09)", fg: "#ffb3d6" },
};

// 全員で1部屋に集まる枠の色味（琥珀）
const ALL = { bg: "rgba(245,197,66,0.10)", fg: "#ffd884" };

const HAIR = "1px solid rgba(255,255,255,0.13)";

const th: React.CSSProperties = {
  padding: "6px 6px",
  borderBottom: "1px solid rgba(255,255,255,0.22)",
  fontSize: 11,
  fontWeight: 900,
  textAlign: "center",
  whiteSpace: "nowrap",
};

const td: React.CSSProperties = {
  padding: "8px 6px",
  borderTop: HAIR,
  verticalAlign: "top",
};

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

      {/* 表そのもの。狭い画面でも本文を横に押し出さないよう、この中だけで横に流す。 */}
      <div className="mt-3 overflow-x-auto">
        <table
          style={{
            width: "100%",
            minWidth: 300,
            borderCollapse: "collapse",
            tableLayout: "fixed",
            background: "rgba(255,255,255,0.03)",
            borderRadius: 10,
            overflow: "hidden",
          }}
        >
          <colgroup>
            {/* 時間の列は「片付け・移動の準備」が1行で収まる幅にしてある */}
            <col style={{ width: "34%" }} />
            <col style={{ width: "33%" }} />
            <col style={{ width: "33%" }} />
          </colgroup>
          <thead>
            <tr style={{ background: "rgba(255,255,255,0.06)" }}>
              <th style={{ ...th, color: "#ffd884" }}>時間</th>
              <th style={{ ...th, color: ROOM.A.fg }}>A室</th>
              <th style={{ ...th, color: ROOM.B.fg }}>B室</th>
            </tr>
          </thead>
          <tbody>
            {k.slots.map((s: KaraokeSlot) => {
              const [start, end] = s.time.split("〜");
              const split = !!s.rooms;
              // 補足がある枠は、その1行下に横いっぱいで添える（表の列を狭くしないため）
              const hasNote = !!s.detail;
              return (
                <Fragment key={s.id}>
                  <tr style={split ? undefined : { background: ALL.bg }}>
                    <td style={{ ...td, borderBottom: hasNote ? "none" : undefined, textAlign: "center" }}>
                      <p className="text-[12px] font-black leading-tight" style={{ color: "#eef2fb" }}>
                        {start}
                      </p>
                      <p className="text-[11px] leading-tight" style={{ color: "#98a4c0" }}>
                        〜{end}
                      </p>
                      <p className="mt-1 text-[10px] font-bold leading-snug" style={{ color: split ? "#c8d2e6" : ALL.fg }}>
                        {s.label}
                      </p>
                    </td>

                    {split ? (
                      s.rooms!.map((r) => (
                        <td key={r.key} style={{ ...td, borderLeft: HAIR, background: ROOM[r.key].bg }}>
                          {r.members.map((m) => (
                            <p
                              key={m}
                              className="text-[12px] font-semibold leading-snug text-center"
                              style={{ color: "#e4ebf8" }}
                            >
                              {m}
                            </p>
                          ))}
                          <p className="mt-1 text-[10px] font-bold text-center" style={{ color: ROOM[r.key].fg }}>
                            {r.members.length}名
                          </p>
                        </td>
                      ))
                    ) : (
                      /* 全員で1部屋に集まる枠は、部屋の列をつないで1つにする */
                      <td
                        colSpan={2}
                        style={{ ...td, borderLeft: HAIR, textAlign: "center", verticalAlign: "middle" }}
                      >
                        <p className="text-[12px] font-black" style={{ color: "#e4ebf8" }}>
                          全員（{k.attendees.length}名）で{k.allRoom}室
                        </p>
                      </td>
                    )}
                  </tr>

                  {hasNote ? (
                    <tr style={split ? undefined : { background: ALL.bg }}>
                      <td colSpan={3} style={{ padding: "0 8px 8px", borderTop: "none" }}>
                        <p className="text-[11px] leading-relaxed" style={{ color: "#98a4c0" }}>
                          {s.detail}
                        </p>
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              );
            })}
          </tbody>
        </table>
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
