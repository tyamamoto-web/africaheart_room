"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { timeSlots, defaultMembers, type Member, type MemberRole } from "@/lib/data";
import { getMembers, addMember, updateMember, deleteMember, resetToDefault } from "@/lib/memberStore";
import { getEventSetup, setAttendance, setMemberRoom } from "@/lib/eventStore";
import type { RoomKey } from "@/lib/eventStore";
import { getRoomNumbers, saveRoomNumbers, RoomNumbersSetupError } from "@/lib/roomNumbers";

const roomCfg = {
  A: { gradient: "linear-gradient(135deg,#8E1252,#A8175F)", color: "#A8175F", bg: "#F6E1EB" },
  B: { gradient: "linear-gradient(135deg,#A8175F,#C81E77)", color: "#C81E77", bg: "#F9E6EF" },
  C: { gradient: "linear-gradient(135deg,#C0246F,#D6478E)", color: "#C0246F", bg: "#FCEDF4" },
} as const;

const roleConfig: Record<MemberRole, { label: string; bg: string; text: string }> = {
  leader:    { label: "リーダー", bg: "#fff0f0", text: "#ff6b6b" },
  subleader: { label: "サブ",     bg: "#f5f0ff", text: "#845ef7" },
  regular:   { label: "メンバー", bg: "#f4f0ea", text: "#888" },
  guest:     { label: "ゲスト",   bg: "#fffbe6", text: "#f59e0b" },
};
const roleOrder: MemberRole[] = ["leader", "subleader", "regular", "guest"];

const rotationSlots = timeSlots.filter((s) => s.type === "rotation");

type FormState = { nickname: string; role: MemberRole };

export default function AdminPage() {
  const [members,      setMembers]      = useState<Member[]>([]);
  const [attendance,   setAttState]     = useState<Set<string>>(new Set());
  const [rotations,    setRotations]    = useState<Record<string, Record<string, RoomKey>>>({});
  const [activeSlot,   setActiveSlot]   = useState<string>(rotationSlots[0]?.id ?? "");
  const [modal,        setModal]        = useState<{ open: boolean; editId: string | null }>({ open: false, editId: null });
  const [form,         setForm]         = useState<FormState>({ nickname: "", role: "regular" });
  const [confirmReset, setConfirmReset] = useState(false);
  // 当日の実部屋番号（A/B/C→番号）。Supabaseで全員共有。
  const [roomNos,      setRoomNos]      = useState<{ A: string; B: string; C: string }>({ A: "", B: "", C: "" });
  const [roomSaving,   setRoomSaving]   = useState(false);
  const [roomMsg,      setRoomMsg]      = useState<{ kind: "ok" | "err" | "setup"; text: string } | null>(null);

  useEffect(() => {
    const m = getMembers();
    setMembers(m);
    const setup = getEventSetup();
    setAttState(new Set(setup.attendanceIds));
    setRotations(setup.rotations);
    getRoomNumbers()
      .then((r) => setRoomNos({ A: r.A, B: r.B, C: r.C }))
      .catch(() => {});
  }, []);

  async function handleSaveRoomNumbers() {
    setRoomSaving(true);
    setRoomMsg(null);
    try {
      await saveRoomNumbers(roomNos, "管理");
      setRoomMsg({ kind: "ok", text: "保存しました（TOPの部屋割り表に反映・全員に共有）" });
    } catch (e) {
      if (e instanceof RoomNumbersSetupError) {
        setRoomMsg({ kind: "setup", text: "room_numbers テーブルが未作成です。Supabaseのセットアップが必要です。" });
      } else {
        setRoomMsg({ kind: "err", text: "保存に失敗しました。通信状況をご確認ください。" });
      }
    } finally {
      setRoomSaving(false);
    }
  }

  function refreshMembers() { setMembers(getMembers()); }

  function openAdd() {
    setForm({ nickname: "", role: "regular" });
    setModal({ open: true, editId: null });
  }
  function openEdit(m: Member) {
    setForm({ nickname: m.nickname, role: m.role });
    setModal({ open: true, editId: m.id });
  }
  function closeModal() { setModal({ open: false, editId: null }); }

  function handleSubmit() {
    const nickname = form.nickname.trim();
    if (!nickname) return;
    if (modal.editId) updateMember(modal.editId, { nickname, role: form.role });
    else addMember({ nickname, role: form.role });
    refreshMembers();
    closeModal();
  }
  function handleDelete(id: string) {
    if (!confirm("削除しますか？")) return;
    deleteMember(id);
    refreshMembers();
  }
  function handleReset() {
    resetToDefault();
    refreshMembers();
    setConfirmReset(false);
  }

  function toggleAttendance(id: string) {
    const next = new Set(attendance);
    if (next.has(id)) next.delete(id); else next.add(id);
    setAttState(next);
    setAttendance(Array.from(next));
  }
  function setAll(val: boolean) {
    const ids = val ? members.map((m) => m.id) : [];
    setAttState(new Set(ids));
    setAttendance(ids);
  }

  function handleRoomChange(slotId: string, memberId: string, val: string) {
    const room = val ? (val as RoomKey) : null;
    setMemberRoom(slotId, memberId, room);
    setRotations((prev) => {
      const slot = { ...(prev[slotId] ?? {}) };
      if (!room) delete slot[memberId];
      else slot[memberId] = room;
      return { ...prev, [slotId]: slot };
    });
  }

  const sorted        = [...members].sort((a, b) => roleOrder.indexOf(a.role) - roleOrder.indexOf(b.role));
  const attendingCount = members.filter((m) => attendance.has(m.id)).length;
  const attendingList  = sorted.filter((m) => attendance.has(m.id));
  const activeAssign   = rotations[activeSlot] ?? {};
  const assignedCount  = attendingList.filter((m) => activeAssign[m.id]).length;

  return (
    <main className="min-h-screen pb-16" style={{ background: "#ffffff" }}>
      {/* Top bar */}
      <div className="sticky top-0 z-50 px-4 py-3 flex items-center gap-3" style={{ background: "#ffffff", borderBottom: "1px solid #eee" }}>
        <Link href="/" className="flex items-center gap-1.5 text-sm font-semibold px-3 py-2 rounded-xl card" style={{ color: "#555" }}>
          ← 戻る
        </Link>
        <h1 className="text-base font-black" style={{ color: "#2c2c2c" }}>管理画面</h1>
        <button
          onClick={openAdd}
          className="ml-auto flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold text-white"
          style={{ background: "linear-gradient(135deg,#A8175F,#C81E77)", boxShadow: "0 3px 10px rgba(168,23,95,0.3)" }}
        >
          ＋ 追加
        </button>
      </div>

      <div className="px-4 pt-3 max-w-lg mx-auto flex flex-col gap-4">

        {/* ── 部屋番号（当日の実部屋番号を全員に共有）── */}
        <div className="card overflow-hidden">
          <div className="px-4 py-4 border-b" style={{ borderColor: "#f4f0ea" }}>
            <p className="text-base font-black" style={{ color: "#2c2c2c" }}>部屋番号（当日）</p>
            <p className="text-sm mt-0.5 leading-relaxed" style={{ color: "#aaa" }}>
              A / B / C の実際の部屋番号を入力して保存すると、TOPの部屋割り表に表示され、全員がこのアプリから確認できます。
            </p>
          </div>
          <div className="px-4 py-4 flex flex-col gap-3">
            {(["A", "B", "C"] as const).map((r) => (
              <div key={r} className="flex items-center gap-3">
                <span
                  className="flex-shrink-0 inline-flex items-center justify-center rounded-lg text-white text-sm font-black"
                  style={{ width: 40, height: 40, background: roomCfg[r].gradient }}
                >
                  {r}
                </span>
                <input
                  value={roomNos[r]}
                  onChange={(e) => setRoomNos((p) => ({ ...p, [r]: e.target.value }))}
                  placeholder="例：305号室 / 大部屋 など"
                  maxLength={20}
                  className="flex-1 min-w-0 px-3 py-2.5 rounded-xl text-sm"
                  style={{ border: "1px solid #e5e7eb", background: "#fff", color: "#2c2c2c" }}
                />
              </div>
            ))}
            <button
              onClick={handleSaveRoomNumbers}
              disabled={roomSaving}
              className="mt-1 py-2.5 rounded-xl text-sm font-bold text-white"
              style={{ background: "linear-gradient(135deg,#A8175F,#C81E77)", opacity: roomSaving ? 0.6 : 1 }}
            >
              {roomSaving ? "保存中…" : "保存して全員に共有"}
            </button>
            {roomMsg && (
              <p
                className="text-xs font-bold leading-relaxed"
                style={{ color: roomMsg.kind === "ok" ? "#10b981" : roomMsg.kind === "setup" ? "#A8175F" : "#ff6b6b" }}
              >
                {roomMsg.text}
              </p>
            )}
          </div>
        </div>

        {/* ── 出欠確認 ── */}
        <div className="card overflow-hidden">
          <div className="px-4 py-4 flex items-center justify-between border-b" style={{ borderColor: "#f4f0ea" }}>
            <div>
              <p className="text-base font-black" style={{ color: "#2c2c2c" }}>出欠確認</p>
              <p className="text-sm mt-0.5" style={{ color: "#aaa" }}>参加：{attendingCount}名 / 全{members.length}名</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setAll(true)}  className="text-sm px-3 py-2.5 rounded-xl font-bold" style={{ background: "#f3f4f6", color: "#6b7280" }}>全員参加</button>
              <button onClick={() => setAll(false)} className="text-sm px-3 py-2.5 rounded-xl font-bold" style={{ background: "#fff0f0", color: "#ff6b6b" }}>全員不参加</button>
            </div>
          </div>
          <div className="px-3 py-3 grid grid-cols-2 gap-2">
            {sorted.map((m) => {
              const isAtt = attendance.has(m.id);
              return (
                <button
                  key={m.id}
                  onClick={() => toggleAttendance(m.id)}
                  className="flex items-center gap-2.5 px-3 py-3.5 rounded-2xl text-left transition-all duration-150"
                  style={{
                    background: isAtt ? "#ffffff" : "#f4f4f4",
                    border: `2px solid ${isAtt ? "#6b7280" : "transparent"}`,
                  }}
                >
                  <span
                    className="flex-shrink-0 inline-block rounded-md"
                    style={{
                      width: 18,
                      height: 18,
                      background: isAtt ? "#6b7280" : "transparent",
                      border: `2px solid ${isAtt ? "#6b7280" : "#cfcfcf"}`,
                    }}
                  />
                  <span className="text-sm font-semibold truncate" style={{ color: isAtt ? "#374151" : "#888" }}>
                    {m.nickname}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── 部屋割り設定 ── */}
        <div className="card overflow-hidden">
          <div className="px-4 py-4 border-b" style={{ borderColor: "#f4f0ea" }}>
            <p className="text-base font-black" style={{ color: "#2c2c2c" }}>部屋割り設定</p>
            <p className="text-sm mt-0.5" style={{ color: "#aaa" }}>ローテーションごとに部屋を選んでください</p>
          </div>

          {/* Slot selector tabs */}
          {rotationSlots.length > 0 && (
            <div className="px-3 pt-3 pb-2 flex gap-2 overflow-x-auto">
              {rotationSlots.map((slot) => {
                const isSel = activeSlot === slot.id;
                return (
                  <button
                    key={slot.id}
                    onClick={() => setActiveSlot(slot.id)}
                    className="flex-shrink-0 px-4 py-2.5 rounded-2xl text-sm font-black transition-all"
                    style={{
                      background: isSel ? "linear-gradient(135deg,#A8175F,#C81E77)" : "#f0ece5",
                      color: isSel ? "white" : "#aaa",
                      boxShadow: isSel ? "0 3px 10px rgba(168,23,95,0.3)" : "none",
                    }}
                  >
                    {slot.label}
                  </button>
                );
              })}
            </div>
          )}

          {/* Active slot info bar */}
          {rotationSlots.length > 0 && (
            <div className="px-4 py-2.5 flex items-center justify-between" style={{ background: "#fafaf8" }}>
              <p className="text-sm font-semibold" style={{ color: "#888" }}>
                {rotationSlots.find((s) => s.id === activeSlot)?.startTime}〜
                {rotationSlots.find((s) => s.id === activeSlot)?.endTime}
              </p>
              <p className="text-sm font-bold" style={{ color: assignedCount === attendingList.length && attendingList.length > 0 ? "#10b981" : "#aaa" }}>
                {assignedCount}/{attendingList.length}名 設定済み
              </p>
            </div>
          )}

          {/* Member assignment list */}
          {attendingList.length === 0 ? (
            <div className="px-4 py-10 text-center">
              <p className="text-base" style={{ color: "#ccc" }}>出欠確認で参加者を選択してください</p>
            </div>
          ) : (
            <div className="divide-y" style={{ borderColor: "#f4f0ea" }}>
              {attendingList.map((m) => {
                const current = activeAssign[m.id] ?? "";
                return (
                  <div key={m.id} className="flex items-center gap-3 px-4 py-3.5">
                    <p className="text-base font-bold flex-1" style={{ color: "#2c2c2c" }}>{m.nickname}</p>
                    <div className="flex gap-2">
                      {(["", "A", "B", "C"] as const).map((val) => {
                        const isCur = current === val;
                        const label = val || "未";
                        const cfgKey = val as RoomKey;
                        const btnBg = isCur
                          ? (val ? roomCfg[cfgKey].gradient : "linear-gradient(135deg,#888,#aaa)")
                          : "#f0ece5";
                        return (
                          <button
                            key={val}
                            onClick={() => handleRoomChange(activeSlot, m.id, val)}
                            className="rounded-2xl font-black text-sm transition-all"
                            style={{
                              background: btnBg,
                              color: isCur ? "white" : "#bbb",
                              width: "48px",
                              height: "44px",
                              flexShrink: 0,
                            }}
                          >
                            {label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── メンバー一覧 ── */}
        <div className="card overflow-hidden">
          <div className="px-4 py-4 border-b" style={{ borderColor: "#f4f0ea" }}>
            <p className="text-base font-black" style={{ color: "#2c2c2c" }}>メンバー一覧</p>
          </div>
          {sorted.length === 0 ? (
            <div className="py-12 text-center" style={{ color: "#bbb" }}>
              <p className="text-base">メンバーがいません</p>
            </div>
          ) : (
            <div className="divide-y" style={{ borderColor: "#f4f0ea" }}>
              {sorted.map((m) => {
                const cfg = roleConfig[m.role];
                return (
                  <div key={m.id} className="flex items-center gap-3 px-4 py-3.5">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 text-base font-black" style={{ background: cfg.bg, color: cfg.text }}>
                      {m.nickname.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-base font-bold truncate" style={{ color: "#2c2c2c" }}>{m.nickname}</p>
                      <span className="text-xs font-semibold px-1.5 py-0.5 rounded-md" style={{ background: cfg.bg, color: cfg.text }}>
                        {cfg.label}
                      </span>
                    </div>
                    <button onClick={() => openEdit(m)} className="px-3 py-2 rounded-xl text-xs font-bold" style={{ background: "#f4f0ea", color: "#888" }}>編集</button>
                    <button onClick={() => handleDelete(m.id)} className="px-3 py-2 rounded-xl text-xs font-bold" style={{ background: "#fff0f0", color: "#ff6b6b" }}>削除</button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* アーカイブ・動作確認ページへ */}
        <div className="flex gap-2">
          <Link
            href="/archive"
            className="flex-1 py-3.5 rounded-xl text-sm font-semibold text-center"
            style={{ background: "#f4f0ea", color: "#888" }}
          >
            部屋割りアーカイブ
          </Link>
          <Link
            href="/test"
            className="flex-1 py-3.5 rounded-xl text-sm font-semibold text-center"
            style={{ background: "#f4f0ea", color: "#888" }}
          >
            会員メニュー
          </Link>
        </div>

        {/* Reset */}
        {!confirmReset ? (
          <button onClick={() => setConfirmReset(true)} className="w-full py-3.5 rounded-xl text-sm font-semibold" style={{ background: "#f4f0ea", color: "#aaa" }}>
            デフォルトメンバーに戻す
          </button>
        ) : (
          <div className="card p-4 text-center">
            <p className="text-base font-semibold mb-3" style={{ color: "#555" }}>本当にリセットしますか？</p>
            <div className="flex gap-2">
              <button onClick={() => setConfirmReset(false)} className="flex-1 py-3 rounded-xl text-base font-semibold" style={{ background: "#f4f0ea", color: "#888" }}>キャンセル</button>
              <button onClick={handleReset} className="flex-1 py-3 rounded-xl text-base font-bold text-white" style={{ background: "#ff6b6b" }}>リセット</button>
            </div>
          </div>
        )}
      </div>

      {/* ── Add/Edit Modal ── */}
      {modal.open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center"
          style={{ background: "rgba(0,0,0,0.4)" }}
          onClick={(e) => e.target === e.currentTarget && closeModal()}
        >
          <div className="w-full max-w-lg rounded-t-3xl p-6 pop-in" style={{ background: "#fff" }}>
            <div className="w-10 h-1 rounded-full mx-auto mb-5" style={{ background: "#e0e0e0" }} />
            <h2 className="text-lg font-black mb-5" style={{ color: "#2c2c2c" }}>
              {modal.editId ? "メンバーを編集" : "メンバーを追加"}
            </h2>
            <div className="mb-4">
              <label className="text-sm font-bold mb-2 block" style={{ color: "#888" }}>ニックネーム</label>
              <input
                type="text"
                value={form.nickname}
                onChange={(e) => setForm((f) => ({ ...f, nickname: e.target.value }))}
                placeholder="例：よしの助"
                className="w-full rounded-xl px-4 py-3.5 text-base font-medium focus:outline-none"
                style={{ background: "#f4f0ea", color: "#2c2c2c", border: "2px solid transparent" }}
                onFocus={(e) => (e.target.style.border = "2px solid #C81E7760")}
                onBlur={(e)  => (e.target.style.border = "2px solid transparent")}
                autoFocus
              />
            </div>
            <div className="mb-6">
              <label className="text-sm font-bold mb-2 block" style={{ color: "#888" }}>ロール</label>
              <div className="grid grid-cols-4 gap-2">
                {roleOrder.map((role) => {
                  const cfg = roleConfig[role];
                  const selected = form.role === role;
                  return (
                    <button
                      key={role}
                      onClick={() => setForm((f) => ({ ...f, role }))}
                      className="py-3 rounded-xl text-sm font-bold transition-all"
                      style={{
                        background: selected ? cfg.bg : "#f4f0ea",
                        color:      selected ? cfg.text : "#aaa",
                        border:     selected ? `2px solid ${cfg.text}40` : "2px solid transparent",
                      }}
                    >
                      {cfg.label}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={closeModal} className="flex-1 py-3.5 rounded-xl text-base font-semibold" style={{ background: "#f4f0ea", color: "#888" }}>
                キャンセル
              </button>
              <button
                onClick={handleSubmit}
                disabled={!form.nickname.trim()}
                className="flex-1 py-3.5 rounded-xl text-base font-bold text-white transition-opacity"
                style={{
                  background: "linear-gradient(135deg,#A8175F,#C81E77)",
                  boxShadow: "0 3px 10px rgba(168,23,95,0.3)",
                  opacity: form.nickname.trim() ? 1 : 0.4,
                }}
              >
                {modal.editId ? "保存" : "追加"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
