"use client";

import { Fragment, useEffect, useState } from "react";
import { karaokeRooms, type KaraokeRoomKey, type KaraokeSlot } from "@/lib/data";
import {
  EMPTY_ROOM_NUMBERS,
  getRoomNumbers,
  saveRoomNumbers,
  type RoomNumbers,
} from "@/lib/roomNumbers";
import DownloadKaraokeTableButton from "./DownloadKaraokeTableButton";

/* ============================================================
   カラオケの部屋割り（告知の回）：TOPに掲載する表
   ------------------------------------------------------------
   置き場所は「当日のスケジュール」のカラオケの行のすぐ下（EventAnnounce が差し込む）。
   どの部屋で歌うかはカラオケの予定と一続きなので、外枠もその列の1枠と同じ形にして、
   琥珀の縁取りだけで「これは部屋割り」と分かるようにしてある。

   並びは、このアプリが前から使っている「部屋割り表」と同じ形にそろえてある。
     左が時間、右が部屋（A室・B室）。全員で集まる枠は部屋の列をつないで1つにする。
   中身は lib/data.ts の karaokeRooms を差し替えるだけで更新できる
   （時刻も顔ぶれもあちらに置いてある）。

   当日の実際の部屋番号は、表のすぐ下から手入力して全員に共有できる（lib/roomNumbers.ts）。
   入れた番号は A室・B室 の見出しの下に出て、ほかの人の画面にも5秒ほどで反映される。
   まだ入っていないあいだは見出しは「A室」「B室」だけになる（先月の番号は出さない。
   保存時に「どの回の番号か」も一緒に記録していて、回が違えば表示しないようにしてある）。
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
  padding: "6px 4px",
  borderBottom: "1px solid rgba(255,255,255,0.22)",
  fontSize: 11,
  fontWeight: 900,
  textAlign: "center",
  whiteSpace: "nowrap",
};

const td: React.CSSProperties = {
  padding: "8px 4px",
  borderTop: HAIR,
  verticalAlign: "top",
};

/** 部屋番号を入れる欄。狭い枠に収まるよう小さめにしてある。 */
const inputStyle: React.CSSProperties = {
  background: "rgba(255,255,255,0.06)",
  border: "1px solid rgba(255,255,255,0.16)",
  color: "#eef2fb",
};

export default function KaraokeRooms() {
  const k = karaokeRooms;

  // 当日の部屋番号（全員で共有）。ほかの人が入れた番号も拾えるよう5秒ごとに読み直す。
  const [nos, setNos] = useState<RoomNumbers>(EMPTY_ROOM_NUMBERS);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ A: "", B: "" });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    let alive = true;
    const load = () => {
      getRoomNumbers()
        .then((r) => {
          if (alive) setNos(r);
        })
        .catch(() => {
          /* 表示優先：取得できなくても番号なしのまま表を出す */
        });
    };
    load();
    const t = setInterval(load, 5000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  const hasNo = !!(nos.A || nos.B);

  const openEditor = () => {
    setDraft({ A: nos.A, B: nos.B });
    setMsg(null);
    setEditing(true);
  };

  const handleSave = async () => {
    setSaving(true);
    setMsg(null);
    try {
      // この回は2部屋なので C は触らずにそのまま戻す
      await saveRoomNumbers({ A: draft.A, B: draft.B, C: nos.C }, "TOP");
      setNos((prev) => ({ ...prev, A: draft.A.trim(), B: draft.B.trim() }));
      setMsg({ ok: true, text: "保存しました。全員の画面に出ます。" });
      setEditing(false);
    } catch {
      setMsg({ ok: false, text: "保存できませんでした。通信状況をご確認ください。" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="rounded-xl px-3 py-2.5"
      style={{ background: "rgba(245,197,66,0.07)", border: "1px solid rgba(245,205,110,0.30)" }}
    >
      <div className="flex items-center gap-1.5">
        <span className="w-1.5 h-3.5 rounded-full" style={{ background: "#F5C542" }} />
        <h4 className="text-[13px] font-black" style={{ color: "#ffd884" }}>
          {k.title}
        </h4>
      </div>
      {/* 時間と店名はすぐ上のカラオケの枠に出ているので、ここでは部屋数と人数だけ添える */}
      <p className="mt-0.5 text-[11px]" style={{ color: "#b7c2da" }}>
        <span className="whitespace-nowrap">A室・B室の2部屋</span>
        {" ／ "}
        <span className="whitespace-nowrap">参加{k.attendees.length}名</span>
      </p>
      <p className="mt-1 text-[12px] leading-relaxed" style={{ color: "#b7c2da" }}>
        {k.lead}
      </p>

      {/* 表そのもの。狭い画面でも本文を横に押し出さないよう、この中だけで横に流す。 */}
      <div className="mt-2.5 overflow-x-auto">
        <table
          style={{
            width: "100%",
            minWidth: 280,
            borderCollapse: "collapse",
            tableLayout: "fixed",
            background: "rgba(255,255,255,0.03)",
            borderRadius: 10,
            overflow: "hidden",
          }}
        >
          <colgroup>
            {/* 時間の列は「片付け・移動の準備」が1行で収まる幅にしてある */}
            <col style={{ width: "36%" }} />
            <col style={{ width: "32%" }} />
            <col style={{ width: "32%" }} />
          </colgroup>
          <thead>
            <tr style={{ background: "rgba(255,255,255,0.06)" }}>
              <th style={{ ...th, color: "#ffd884" }}>時間</th>
              {(["A", "B"] as KaraokeRoomKey[]).map((key) => (
                <th key={key} style={{ ...th, color: ROOM[key].fg }}>
                  <span style={{ display: "block" }}>{key}室</span>
                  {/* 当日入れた実際の部屋番号。まだ無いあいだは何も出さない。 */}
                  {nos[key] ? (
                    <span
                      style={{
                        display: "block",
                        margin: "3px auto 0",
                        maxWidth: "100%",
                        padding: "1px 5px",
                        borderRadius: 6,
                        background: "rgba(255,255,255,0.16)",
                        color: "#ffffff",
                        fontSize: 10,
                        fontWeight: 900,
                        whiteSpace: "normal",
                        wordBreak: "break-word",
                      }}
                    >
                      {nos[key]}
                    </span>
                  ) : null}
                </th>
              ))}
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

      {/* 当日の部屋番号。お店で部屋が決まったらここに入れると、全員の表の見出しに出る。 */}
      <div
        className="mt-2.5 rounded-lg px-2.5 py-2"
        style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.10)" }}
      >
        <div className="flex items-center justify-between gap-2">
          <p className="min-w-0 text-[11px] leading-snug" style={{ color: "#b7c2da" }}>
            <span className="font-bold">当日の部屋番号</span>
            <span className="ml-1.5" style={{ color: hasNo ? "#e4ebf8" : "#98a4c0" }}>
              {hasNo ? `A：${nos.A || "—"} ／ B：${nos.B || "—"}` : "お店で決まったら入力してください"}
            </span>
          </p>
          <button
            type="button"
            onClick={() => (editing ? setEditing(false) : openEditor())}
            className="shrink-0 rounded-md px-2.5 py-1 text-[11px] font-black"
            style={{ background: "rgba(245,197,66,0.16)", border: "1px solid rgba(245,205,110,0.40)", color: "#ffd884" }}
          >
            {editing ? "閉じる" : hasNo ? "変更" : "入力"}
          </button>
        </div>

        {editing ? (
          <div className="mt-2 flex flex-col gap-1.5">
            {(["A", "B"] as KaraokeRoomKey[]).map((key) => (
              <label key={key} className="flex items-center gap-2">
                <span
                  className="w-7 shrink-0 rounded-md text-center text-[11px] font-black leading-6"
                  style={{ background: ROOM[key].bg, color: ROOM[key].fg }}
                >
                  {key}
                </span>
                <input
                  value={draft[key]}
                  onChange={(e) => setDraft((d) => ({ ...d, [key]: e.target.value }))}
                  maxLength={20}
                  placeholder="例：305号室 / 大部屋 など"
                  className="min-w-0 flex-1 rounded-md px-2 py-1 text-[12px]"
                  style={inputStyle}
                />
              </label>
            ))}
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="mt-0.5 rounded-md px-3 py-1.5 text-[11px] font-black"
              style={{ background: "#F5C542", color: "#2a2000", opacity: saving ? 0.6 : 1 }}
            >
              {saving ? "保存中…" : "保存して全員に共有"}
            </button>
          </div>
        ) : null}

        {msg ? (
          <p className="mt-1.5 text-[11px]" style={{ color: msg.ok ? "#7ee0a8" : "#ff8f8f" }}>
            {msg.text}
          </p>
        ) : null}
      </div>

      {/* 画像で保存（先月と同じ作り）。部屋番号が入っていれば画像の見出しにも入る。 */}
      <DownloadKaraokeTableButton roomNos={{ A: nos.A, B: nos.B }} />
    </div>
  );
}
