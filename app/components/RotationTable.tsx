"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { timeSlots, defaultMembers } from "@/lib/data";
import { getMembers } from "@/lib/memberStore";
import { getEventSetup } from "@/lib/eventStore";
import { getRoomNumbers, saveRoomNumbers, EMPTY_ROOM_NUMBERS, type RoomNumbers } from "@/lib/roomNumbers";
import DownloadTableButton from "./DownloadTableButton";
import type { Member } from "@/lib/data";
import type { EventSetup, RoomKey } from "@/lib/eventStore";

// コマ表：デュエットタイムの濃い赤紫（#A8175F〜#C81E77）を基調に統一
const roomCfg = {
  A: { gradient: "linear-gradient(135deg,#8E1252,#A8175F)", bg: "#F6E1EB", color: "#6E0F44" },
  B: { gradient: "linear-gradient(135deg,#A8175F,#C81E77)", bg: "#F9E6EF", color: "#6E0F44" },
  C: { gradient: "linear-gradient(135deg,#C0246F,#D6478E)", bg: "#FCEDF4", color: "#6E0F44" },
} as const;

const eventGrad: Record<string, string> = {
  yellow:  "linear-gradient(135deg,#f59e0b,#fbbf24)",
  orange:  "linear-gradient(135deg,#f97316,#fb923c)",
  blue:    "linear-gradient(135deg,#3b82f6,#60a5fa)",
  pink:    "linear-gradient(135deg,#ec4899,#f472b6)",
  green:   "linear-gradient(135deg,#10b981,#34d399)",
  // 全員集合：デュエットの濃い赤紫に統一（宿題=やや明るい赤紫／デュエット=最も濃い赤紫）
  rose:    "linear-gradient(135deg,#B81D6C,#D6398A)",
  magenta: "linear-gradient(135deg,#A8175F,#C81E77)",
};
const eventShad: Record<string, string> = {
  yellow:  "rgba(245,158,11,0.3)",
  orange:  "rgba(249,115,22,0.3)",
  blue:    "rgba(59,130,246,0.3)",
  pink:    "rgba(236,72,153,0.3)",
  green:   "rgba(16,185,129,0.3)",
  rose:    "rgba(184,29,108,0.32)",
  magenta: "rgba(168,23,95,0.34)",
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

  // 当日リーダーが登録する「実際の部屋番号」（A/B/C→番号）。全員で共有するため
  // Supabase から取得し、他端末の更新を反映できるよう約5秒ごとにポーリング。
  const [roomNos, setRoomNos] = useState<RoomNumbers>(EMPTY_ROOM_NUMBERS);
  // TOPページから直接入力するための編集状態
  const [editingNos, setEditingNos] = useState(false);
  const [draftNos, setDraftNos] = useState<{ A: string; B: string; C: string }>({ A: "", B: "", C: "" });
  const [savingNos, setSavingNos] = useState(false);
  const [nosMsg, setNosMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    setMembers(getMembers());
    setSetup(getEventSetup());
  }, []);

  useEffect(() => {
    let alive = true;
    const load = () => {
      getRoomNumbers()
        .then((r) => {
          if (alive) setRoomNos(r);
        })
        .catch(() => {
          /* 表示優先：取得失敗時は番号なしのまま */
        });
    };
    load();
    const timer = setInterval(load, 5000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, []);

  function openNosEditor() {
    setDraftNos({ A: roomNos.A, B: roomNos.B, C: roomNos.C }); // 現在の共有値を初期表示
    setNosMsg(null);
    setEditingNos(true);
  }

  async function handleSaveNos() {
    setSavingNos(true);
    setNosMsg(null);
    try {
      await saveRoomNumbers(draftNos, "TOP");
      setRoomNos((prev) => ({ ...prev, A: draftNos.A.trim(), B: draftNos.B.trim(), C: draftNos.C.trim() })); // 即時反映
      setNosMsg({ ok: true, text: "保存しました（全員のページに反映されます）" });
    } catch {
      setNosMsg({ ok: false, text: "保存に失敗しました。通信状況をご確認ください。" });
    } finally {
      setSavingNos(false);
    }
  }

  const anyRoomNo = !!(roomNos.A || roomNos.B || roomNos.C);

  return (
    <section className="px-4 pb-4">
      <div className="flex items-center gap-3 mb-4 max-w-lg mx-auto">
        <div className="h-px flex-1" style={{ background: "#d8d0c8" }} />
        <p className="text-xs font-bold tracking-widest uppercase" style={{ color: "#aaa" }}>本日のタイムテーブル</p>
        <div className="h-px flex-1" style={{ background: "#d8d0c8" }} />
      </div>

      <DownloadTableButton />

      {/* 当日の部屋番号：TOPから直接入力→全員に共有（初期値は空白） */}
      <div className="max-w-lg mx-auto mb-4">
        <div className="card px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-black" style={{ color: "#2c2c2c" }}>当日の部屋番号</p>
              <p className="text-xs mt-0.5 leading-relaxed" style={{ color: "#aaa" }}>
                {anyRoomNo
                  ? `A：${roomNos.A || "—"} ／ B：${roomNos.B || "—"} ／ C：${roomNos.C || "—"}`
                  : "未設定（当日ここで入力すると各コマの表と全員のページに反映されます）"}
              </p>
            </div>
            <button
              onClick={() => (editingNos ? setEditingNos(false) : openNosEditor())}
              className="flex-shrink-0 text-xs font-bold px-3 py-1.5 rounded-lg"
              style={{ background: "#F6E1EB", color: "#A8175F" }}
            >
              {editingNos ? "閉じる" : anyRoomNo ? "変更" : "設定"}
            </button>
          </div>

          {editingNos && (
            <div className="mt-3 pt-3 flex flex-col gap-2.5" style={{ borderTop: "1px solid #f0e6ee" }}>
              {(["A", "B", "C"] as const).map((r) => (
                <div key={r} className="flex items-center gap-2.5">
                  <span
                    className="flex-shrink-0 inline-flex items-center justify-center rounded-lg text-white text-sm font-black"
                    style={{ width: 36, height: 36, background: roomCfg[r].gradient }}
                  >
                    {r}
                  </span>
                  <input
                    value={draftNos[r]}
                    onChange={(e) => setDraftNos((p) => ({ ...p, [r]: e.target.value }))}
                    placeholder="例：305号室 / 大部屋 など"
                    maxLength={20}
                    inputMode="text"
                    className="flex-1 min-w-0 px-3 py-2.5 rounded-xl text-sm"
                    style={{ border: "1px solid #e5e7eb", background: "#fff", color: "#2c2c2c" }}
                  />
                </div>
              ))}
              <button
                onClick={handleSaveNos}
                disabled={savingNos}
                className="mt-1 py-2.5 rounded-xl text-sm font-bold text-white"
                style={{ background: "linear-gradient(135deg,#A8175F,#C81E77)", opacity: savingNos ? 0.6 : 1 }}
              >
                {savingNos ? "保存中…" : "保存して全員に共有"}
              </button>
              {nosMsg && (
                <p className="text-xs font-bold leading-relaxed" style={{ color: nosMsg.ok ? "#10b981" : "#ff6b6b" }}>
                  {nosMsg.text}
                </p>
              )}
            </div>
          )}
        </div>
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

          /* ── opening（集合・スタート）：赤紫の枠線のみ（塗りなし） ── */
          if (slot.type === "opening") {
            // detail を「集合/スタート行」と「退席リスト」に分解し、視認性を上げる
            const openLines = slot.detail ? slot.detail.split("\n") : [];
            const scheduleLine = openLines.find((l) => !l.includes("【退席】")) ?? "";
            const leaveLine = openLines.find((l) => l.includes("【退席】"));
            const leaves = leaveLine
              ? leaveLine.replace("【退席】", "").split("／").map((s) => s.trim()).filter(Boolean)
              : [];
            return (
              <div
                key={slot.id}
                className="rounded-2xl px-5 py-4 animate-fade-up"
                style={{ background: "#fff", border: "2px solid #A8175F" }}
              >
                <div className="flex items-start gap-3">
                  <div
                    className="flex-shrink-0 rounded-xl px-3 py-2 text-center"
                    style={{ background: "#F6E1EB", minWidth: "76px" }}
                  >
                    <p className="text-sm font-black" style={{ color: "#6E0F44" }}>{slot.startTime}</p>
                    <p className="text-xs" style={{ color: "#A05A82" }}>〜{slot.endTime}</p>
                  </div>
                  <div className="flex-1 pt-0.5">
                    <p className="font-black text-lg leading-tight" style={{ color: "#A8175F" }}>{slot.label}</p>

                    {scheduleLine && (
                      <p className="text-sm font-bold mt-1.5 leading-relaxed" style={{ color: "#2C2130" }}>
                        {scheduleLine}
                      </p>
                    )}

                    {leaves.length > 0 && (
                      <div className="mt-2.5">
                        <p className="text-xs font-black mb-1.5 tracking-wide" style={{ color: "#A8175F" }}>退席時間</p>
                        <div className="flex flex-wrap gap-1.5">
                          {leaves.map((item, i) => (
                            <span
                              key={i}
                              className="inline-flex items-center rounded-lg px-2 py-1 text-xs font-bold"
                              style={{ background: "#FBEAF2", color: "#4A1230", border: "1px solid #EFC9DD" }}
                            >
                              {item}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* フォーマット外の detail はそのまま表示（フォールバック） */}
                    {!scheduleLine && !leaves.length && slot.detail && (
                      <p className="text-sm mt-1 leading-relaxed" style={{ whiteSpace: "pre-line", color: "#2C2130" }}>
                        {slot.detail}
                      </p>
                    )}
                  </div>
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
            <div key={slot.id} className="card overflow-hidden animate-fade-up" style={{ border: "1px solid #EAEAEA" }}>
              {/* Header（時間帯のみ） */}
              <div className="px-4 py-3 border-b" style={{ borderColor: "#EAEAEA" }}>
                <p className="text-lg font-black" style={{ color: "#2c2c2c" }}>
                  {slot.startTime}<span className="mx-1 font-bold" style={{ color: "#C06A97" }}>〜</span>{slot.endTime}
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
                  className="grid divide-x divide-gray-200"
                  style={{ gridTemplateColumns: `repeat(${usedRooms.length}, minmax(0, 1fr))` }}
                >
                  {usedRooms.map((room) => {
                    const cfg = roomCfg[room];
                    const names = groups[room];
                    const roomNo = roomNos[room];
                    return (
                      <div key={room} style={{ background: "#fff" }}>
                        <div className="flex flex-col items-center justify-center py-2 gap-0.5" style={{ background: cfg.gradient, textShadow: "0 1px 2px rgba(122,8,58,0.35)" }}>
                          <div className="flex items-center gap-1.5">
                            <span className="text-base font-black text-white">{room}</span>
                            <span className="text-xs font-bold text-white/85">ルーム</span>
                          </div>
                          {roomNo && (
                            <span
                              className="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-black text-white"
                              style={{ background: "rgba(255,255,255,0.22)", textShadow: "none" }}
                            >
                              {roomNo}
                            </span>
                          )}
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
