"use client";

/* ============================================================
   アーカイブ（設定 ＞ アーカイブ。TOPと、管理画面 ＞ 社長室 の両方に出る）
   ------------------------------------------------------------
   これまでのオフ会を、回ごとに「タイムテーブル」と「参加者」で残しておく場所。
   新しいほうを上にして並べ、いちばん新しい回だけ開いた状態で始まる。
   見出しの行を押すと、その回の中身が開いたり閉じたりする。

   【中身】
     lib/eventArchive.ts の archiveEvents。過去の凍結コピー（lib/archive.ts）と
     前回の部屋割り表（lib/data.ts）から組み立てているので、名前はここには無い。
     回を足すときも lib/eventArchive.ts に書く。この画面は表示だけ。

   【色】
     白を地にして、グレーだけで組む（設定の他の画面と同じ）。
     数字はやや濃いグレー、面はごくうすいグレー。差し色は使わない。

   【表】
     タイムテーブルは当日の部屋割と同じ表（app/components/PlanTable.tsx）。
     列は 時間｜部屋番号｜企画｜名前。色だけこの画面のグレーにしてある。
     部屋番号は「A 215」のように、記号と（分かっていれば）当日の番号。
     集合や宿題などの枠に付いていた補足（退席の時刻・宿題のお題など。以前の /archive の
     画面に出ていたもの）は、その行の下に小さく出る（lib/eventArchive.ts の note）。

   【上の数字】
     「これまでのオフ会」と「のべ参加」だけ。人数の実数（何人が来たことがあるか）は
     回によって呼び名の書き方が違う人がいて、名前だけでは数えられないので出さない。
   ============================================================ */

import { useState } from "react";
import PlanTable from "@/app/components/PlanTable";
import { archiveEvents } from "@/lib/eventArchive";

const INK = "#1B1C1E"; // 主要テキスト
const SUB = "#63666C"; // 補助テキスト
const DIM = "#8B8E94"; // さらに控えめな字
const LINE = "#DFE1E4"; // 罫線
const MARK = "#35373C"; // 数字や印に使う、やや濃いグレー

/** "2026-05-24" → "2026.05.24" と曜日。読めなければそのまま出す。 */
function dateParts(key: string): { text: string; wday: string } {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  if (!m) return { text: key, wday: "" };
  const [, y, mo, d] = m;
  const day = new Date(Number(y), Number(mo) - 1, Number(d)).getDay();
  return { text: `${y}.${mo}.${d}`, wday: "日月火水木金土"[day] ?? "" };
}

function Stat({ n, unit, label }: { n: number; unit: string; label: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: DIM }}>{label}</span>
      <span style={{ display: "flex", alignItems: "baseline", gap: 3 }}>
        <span style={{ fontSize: 24, fontWeight: 700, lineHeight: 1.1, color: MARK, fontVariantNumeric: "tabular-nums" }}>
          {n}
        </span>
        <span style={{ fontSize: 13, fontWeight: 600, color: SUB }}>{unit}</span>
      </span>
    </div>
  );
}

export default function PresidentArchive() {
  const events = archiveEvents; // 新しいほうが先に並んでいる
  const [open, setOpen] = useState<string[]>(events.length ? [events[0].key] : []);
  const toggle = (key: string) =>
    setOpen((o) => (o.includes(key) ? o.filter((k) => k !== key) : [...o, key]));

  const totalSeats = events.reduce((s, e) => s + e.participants.length, 0);

  return (
    <div style={{ padding: "28px 28px 40px", maxWidth: 920 }}>
      {/* 上に、数だけ。これまで何回あって、のべ何人が来たか。 */}
      <div style={{ display: "flex", gap: 32, flexWrap: "wrap", alignItems: "flex-end" }}>
        <Stat n={events.length} unit="回" label="これまでのオフ会" />
        <Stat n={totalSeats} unit="名" label="のべ参加" />
      </div>

      <ol style={{ listStyle: "none", margin: "20px 0 0", padding: 0, display: "grid", gap: 12 }}>
        {events.map((ev) => {
          const on = open.includes(ev.key);
          const { text, wday } = dateParts(ev.key);
          const bodyId = `ar-body-${ev.key}`;
          return (
            <li key={ev.key} style={{ border: `1px solid ${LINE}`, borderRadius: 10, overflow: "hidden", background: "#FFFFFF" }}>
              <button type="button" className="ar-head" aria-expanded={on} aria-controls={bodyId} onClick={() => toggle(ev.key)}>
                <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 3 }}>
                  <span style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 16, fontWeight: 700, lineHeight: 1.2, color: INK, fontVariantNumeric: "tabular-nums", letterSpacing: "0.02em" }}>
                      {text}
                    </span>
                    {wday && <span style={{ fontSize: 13, color: SUB }}>（{wday}）</span>}
                  </span>
                  <span style={{ fontSize: 13, color: SUB }}>{ev.place}</span>
                </span>
                <span style={{ display: "flex", alignItems: "center", gap: 14, flexShrink: 0 }}>
                  <span style={{ fontSize: 13, color: SUB }}>
                    参加{" "}
                    <span style={{ fontSize: 15, fontWeight: 700, color: MARK, fontVariantNumeric: "tabular-nums" }}>
                      {ev.participants.length}
                    </span>
                    名
                  </span>
                  <svg
                    className="pr-chev"
                    width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                    strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
                    style={{ color: SUB, transform: on ? "rotate(90deg)" : "none" }}
                  >
                    <polyline points="9 6 15 12 9 18" />
                  </svg>
                </span>
              </button>

              {on && (
                <div id={bodyId} className="ar-body">
                  {ev.note && (
                    <p className="ar-note" style={{ margin: 0, fontSize: 12.5, lineHeight: 1.8, color: SUB }}>
                      {ev.note}
                    </p>
                  )}
                  <div>
                    <p style={{ margin: "0 0 8px", fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: DIM }}>
                      タイムテーブル
                    </p>
                    <PlanTable rows={ev.rows} total={ev.participants.length} variant="archive" />
                  </div>
                  <div>
                    <p style={{ margin: "0 0 8px", fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: DIM }}>
                      参加者 {ev.participants.length}名
                    </p>
                    <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {ev.participants.map((n) => (
                        <li key={n} className="ar-name">{n}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
