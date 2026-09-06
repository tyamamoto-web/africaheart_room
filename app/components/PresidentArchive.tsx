"use client";

/* ============================================================
   社長室：アーカイブ（設定 ＞ アーカイブ）
   ------------------------------------------------------------
   これまでのオフ会を、回ごとに「タイムテーブル」と「参加者」で残しておく場所。
   新しいほうを上にして並べ、いちばん新しい回だけ開いた状態で始まる。
   見出しの行を押すと、その回の中身が開いたり閉じたりする。

   【いまは見本】
     見た目を確かめてもらう段階なので、中身は見本のデータ（下の SAMPLE）。
     会員の名前は使っていない（「会員1」のような仮の名前）。
     承認をもらってから、過去の回のデータ（lib/archive.ts の2回と、
     lib/data.ts の前回のぶん）をこの形に直して入れる。そのときは
     ArchiveEvent と読み込みを lib/ に移し、この画面は表示だけにする。

   【色】
     白を地にして、グレーだけで組む（設定の他の画面と同じ）。
     数字はやや濃いグレー、面はごくうすいグレー。差し色は使わない。

   【表】
     タイムテーブルは当日の部屋割と同じ表（app/components/PlanTable.tsx）。
     列は 時間｜部屋番号｜企画｜名前。色だけこの画面のグレーにしてある。
   ============================================================ */

import { useState } from "react";
import PlanTable from "@/app/components/PlanTable";
import type { TimetableRow } from "@/lib/timetable";

const INK = "#1B1C1E"; // 主要テキスト
const SUB = "#63666C"; // 補助テキスト
const DIM = "#8B8E94"; // さらに控えめな字
const LINE = "#DFE1E4"; // 罫線
const HEAD = "#F4F5F6"; // ごくうすい面
const MARK = "#35373C"; // 数字や印に使う、やや濃いグレー
const CHIP = "#E1E2E5"; // 印の地（メニューの選んでいる行と同じピューター）

/** 1回ぶんの記録。key は開催日（"2026-05-24"）で、並び順と見出しに使う。 */
export type ArchiveEvent = {
  key: string;
  place: string;
  rows: TimetableRow[];
  participants: string[];
};

/* 見本。承認後に実データへ差し替える（この配列ごと消す）。 */
const NAMES = Array.from({ length: 12 }, (_, i) => `会員${i + 1}`);
const pick = (...idx: number[]) => idx.map((i) => NAMES[i - 1]);

const SAMPLE: ArchiveEvent[] = [
  {
    key: "2026-05-24",
    place: "会場名（見本）",
    participants: NAMES.slice(0, 9),
    rows: [
      { time: "12:00〜12:20", room: "101", title: "オープニング", names: [] },
      { time: "12:20〜13:20", room: "101", title: "コマ①", names: pick(1, 2, 3, 4, 5) },
      { time: "12:20〜13:20", room: "102", title: "コマ①", names: pick(6, 7, 8, 9) },
      { time: "13:20〜14:20", room: "101", title: "コマ②", names: pick(1, 6, 7, 3) },
      { time: "13:20〜14:20", room: "102", title: "コマ②", names: pick(2, 4, 5, 8, 9) },
      { time: "14:20〜14:50", room: "101", title: "合唱", names: [] },
      { time: "14:50〜15:00", room: "101", title: "片付け", names: [] },
    ],
  },
  {
    key: "2026-03-15",
    place: "会場名（見本）",
    participants: NAMES.slice(0, 8),
    rows: [
      { time: "12:30〜12:50", room: "A", title: "自己紹介", names: [] },
      { time: "12:50〜13:50", room: "A", title: "コマ①", names: pick(1, 2, 3, 4) },
      { time: "12:50〜13:50", room: "B", title: "コマ①", names: pick(5, 6, 7, 8) },
      { time: "14:00〜15:00", room: "A", title: "宿題タイム", names: [] },
      { time: "15:10〜16:10", room: "A", title: "コマ②", names: pick(1, 5, 6, 3) },
      { time: "15:10〜16:10", room: "B", title: "コマ②", names: pick(2, 4, 7, 8) },
      { time: "16:10〜16:20", room: "A", title: "ラストソング", names: [] },
    ],
  },
  {
    key: "2026-01-11",
    place: "会場名（見本）",
    participants: NAMES,
    rows: [
      { time: "12:20〜12:30", room: "215", title: "集合", names: [] },
      { time: "12:30〜14:00", room: "215", title: "コマ①", names: pick(1, 2, 3, 4) },
      { time: "12:30〜14:00", room: "220", title: "コマ①", names: pick(5, 6, 7, 8) },
      { time: "12:30〜14:00", room: "224", title: "コマ①", names: pick(9, 10, 11, 12) },
      { time: "14:00〜15:00", room: "215", title: "宿題タイム", names: [] },
      { time: "15:00〜16:00", room: "215", title: "コマ②", names: pick(1, 5, 9, 2, 6, 10) },
      { time: "15:00〜16:00", room: "220", title: "コマ②", names: pick(3, 7, 11, 4, 8, 12) },
    ],
  },
];

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
  const events = [...SAMPLE].sort((a, b) => (a.key < b.key ? 1 : -1)); // 新しいほうを上に
  const [open, setOpen] = useState<string[]>(events.length ? [events[0].key] : []);
  const toggle = (key: string) =>
    setOpen((o) => (o.includes(key) ? o.filter((k) => k !== key) : [...o, key]));

  const totalSeats = events.reduce((s, e) => s + e.participants.length, 0);
  const people = new Set(events.flatMap((e) => e.participants)).size;

  return (
    <div style={{ padding: "28px 28px 40px", maxWidth: 920 }}>
      {/* 上に、数だけ。これまで何回あって、のべ何人が来たか。 */}
      <div style={{ display: "flex", gap: 32, flexWrap: "wrap", alignItems: "flex-end" }}>
        <Stat n={events.length} unit="回" label="これまでのオフ会" />
        <Stat n={totalSeats} unit="名" label="のべ参加" />
        <Stat n={people} unit="名" label="参加した人" />
      </div>

      {/* 見本であることの断り。実データに差し替えたら消す。 */}
      <p
        style={{
          margin: "18px 0 0",
          padding: "10px 14px",
          borderRadius: 8,
          background: HEAD,
          fontSize: 12.5,
          lineHeight: 1.8,
          color: SUB,
        }}
      >
        いまは見た目を確かめるための見本のデータです。見た目の承認後に、過去の回のタイムテーブルと参加者を入れます。
      </p>

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
                    <span
                      style={{
                        padding: "1px 7px",
                        borderRadius: 5,
                        background: CHIP,
                        fontSize: 10,
                        fontWeight: 700,
                        letterSpacing: "0.06em",
                        color: MARK,
                      }}
                    >
                      見本
                    </span>
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
