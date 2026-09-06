"use client";

/* ============================================================
   部屋割の表（時間｜部屋番号｜企画｜名前）
   ------------------------------------------------------------
   当日の画面（会員ページ ＞ 当日）と、設定 ＞ アーカイブの過去の回で
   同じ表を使う。形はひとつで、色だけを variant で差し替える。
     day     … 会員画面の白地に合わせた色（時間の見出しがオレンジ、部屋は青と桃）
     archive … 設定の画面の色（白を地に、グレーだけで組む）

   【表の読み方】
     1行が「その時間に、その部屋で、何をして、誰がいるか」（lib/timetable.ts）。
     同じ時間の行が続いていれば、時間のマスはつないで1つにする。
     その中で企画も同じなら、企画のマスもつなぐ
     （コマ①を2部屋でやるときは、時間と企画が1つで、部屋と名前が2段になる）。
     名前が空の行は「全員」として出し、地の色を変える（過去の回の表と同じ扱い）。
     部屋番号は、出てきた順に色を当てる（1つめ・2つめ。3つめからは色なし）。
     行にメモ（note。集合の枠の退席時刻や宿題のお題など、枠に付いていた補足）があれば、
     その行の下に横いっぱいの1段で小さく出す。時間をつないだ枠の途中の行だと段を
     はさめない（つなぎが崩れる）ので、そのときは名前のマスの中に出す。

   罫線・文字の大きさ・中央ぞろえは、過去の回の部屋割り表
   （app/components/KaraokeRooms.tsx）にそろえてある。
   ============================================================ */

import { Fragment } from "react";
import type { PlanRow } from "@/lib/timetable";

type RoomTone = { bg: string; fg: string };
type Tone = {
  ink: string;
  sub: string;
  dim: string;
  line: string;
  head: string; // 見出しの行の地
  time: string; // 「時間」の見出しの色
  rooms: RoomTone[]; // 部屋番号ごとの色（出てきた順）
  all: RoomTone; // 全員で集まる行
};

const TONES: Record<"day" | "archive", Tone> = {
  day: {
    ink: "#1B1C1E",
    sub: "#63666C",
    dim: "#8B8E94",
    line: "#E4E5E8",
    head: "#F6F7F8",
    time: "#B24809",
    rooms: [
      { bg: "rgba(90,150,230,0.10)", fg: "#2F6DB5" },
      { bg: "rgba(255,120,180,0.10)", fg: "#B8336A" },
    ],
    all: { bg: "rgba(245,197,66,0.14)", fg: "#8A6100" },
  },
  archive: {
    ink: "#1B1C1E",
    sub: "#63666C",
    dim: "#8B8E94",
    line: "#DFE1E4",
    head: "#F4F5F6",
    time: "#1B1C1E",
    rooms: [
      { bg: "#F4F5F6", fg: "#35373C" },
      { bg: "#E9EAED", fg: "#35373C" },
    ],
    all: { bg: "#FAFAFB", fg: "#63666C" },
  },
};

/** 「13:20〜14:20」を開始と終了に分ける。区切りが無ければ全部を開始として出す。 */
function splitTime(time: string): [string, string] {
  const m = time.split(/〜|~|－|–|-/);
  return [(m[0] ?? "").trim(), (m[1] ?? "").trim()];
}

/* 何行ぶんをつないで描くか。0 は「上の行がまとめて描いているので、この行では描かない」。 */
type Span = { time: number; title: number };
function spansOf(rows: PlanRow[]): Span[] {
  const out: Span[] = rows.map(() => ({ time: 1, title: 1 }));
  let i = 0;
  while (i < rows.length) {
    const t = rows[i].time.trim();
    let j = i + 1;
    if (t) while (j < rows.length && rows[j].time.trim() === t) j++;
    out[i].time = j - i;
    for (let k = i + 1; k < j; k++) out[k].time = 0;

    // 同じ時間の中で、企画も同じなら企画のマスもつなぐ
    let a = i;
    while (a < j) {
      const tt = rows[a].title.trim();
      let b = a + 1;
      if (t && tt) while (b < j && rows[b].title.trim() === tt) b++;
      out[a].title = b - a;
      for (let k = a + 1; k < b; k++) out[k].title = 0;
      a = b;
    }
    i = j;
  }
  return out;
}

export default function PlanTable({
  rows,
  total,
  variant,
  minWidth = 280, // スマホの枠の中（幅298px）に収まる大きさ。設定の画面ではもっと広く渡す
}: {
  rows: PlanRow[];
  /** 全員の人数。「全員（9名）」と出すのに使う。0なら人数は出さない。 */
  total: number;
  variant: "day" | "archive";
  minWidth?: number;
}) {
  const T = TONES[variant];
  const hair = `1px solid ${T.line}`;
  const th: React.CSSProperties = {
    padding: "7px 2px",
    borderBottom: "1px solid #C9CBD0",
    fontSize: 11,
    fontWeight: 700,
    textAlign: "center",
    whiteSpace: "nowrap",
    letterSpacing: "0.02em",
    color: T.sub,
  };
  const td: React.CSSProperties = {
    padding: "8px 4px",
    borderTop: hair,
    verticalAlign: "top",
  };

  // 部屋番号に色を当てる（出てきた順）
  const roomOrder: string[] = [];
  for (const r of rows) {
    const room = r.room.trim();
    if (room && !roomOrder.includes(room)) roomOrder.push(room);
  }
  const toneOf = (room: string): RoomTone | undefined => {
    const idx = roomOrder.indexOf(room.trim());
    return idx >= 0 ? T.rooms[idx] : undefined;
  };

  const spans = spansOf(rows);

  return (
    /* 狭い画面でも本文を横に押し出さないよう、この中だけで横に流す */
    <div style={{ overflowX: "auto" }}>
      <div style={{ border: hair, borderRadius: 10, overflow: "hidden", minWidth }}>
        <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
          <colgroup>
            <col style={{ width: "27%" }} />
            <col style={{ width: "18%" }} />
            <col style={{ width: "23%" }} />
            <col style={{ width: "32%" }} />
          </colgroup>
          <thead>
            <tr style={{ background: T.head }}>
              <th style={{ ...th, color: T.time }}>時間</th>
              <th style={th}>部屋番号</th>
              <th style={th}>企画</th>
              <th style={th}>名前</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const sp = spans[i];
              const [startT, endT] = splitTime(r.time);
              const empty = !r.time.trim() && !r.room.trim() && !r.title.trim() && r.names.length === 0;
              const all = !empty && r.names.length === 0; // 名前が空 ＝ 全員で集まる行
              const rt = toneOf(r.room);
              // 枠の補足。この行で時間のつなぎが終わるなら下に1段、途中なら名前のマスの中
              const note = empty ? "" : (r.note ?? "").trim();
              const groupEnds = i + 1 >= rows.length || spans[i + 1].time > 0;
              const noteBelow = note !== "" && groupEnds;
              const noteInCell = note !== "" && !groupEnds;
              return (
                <Fragment key={i}>
                <tr style={all ? { background: T.all.bg } : undefined}>
                  {sp.time > 0 && (
                    <td
                      rowSpan={sp.time}
                      style={{
                        ...td,
                        textAlign: "center",
                        verticalAlign: sp.time > 1 ? "middle" : "top",
                        height: empty ? 46 : undefined,
                        background: sp.time > 1 ? "#FFFFFF" : undefined,
                      }}
                    >
                      <p style={{ margin: 0, fontSize: 12, fontWeight: 700, lineHeight: 1.25, color: T.ink }}>{startT}</p>
                      {endT && <p style={{ margin: 0, fontSize: 11, lineHeight: 1.25, color: T.dim }}>〜{endT}</p>}
                    </td>
                  )}

                  <td
                    style={{
                      ...td,
                      borderLeft: hair,
                      textAlign: "center",
                      verticalAlign: "middle",
                      background: rt?.bg,
                      fontSize: 13,
                      fontWeight: 700,
                      lineHeight: 1.3,
                      color: rt?.fg ?? T.ink,
                      wordBreak: "break-word",
                    }}
                  >
                    {r.room}
                  </td>

                  {sp.title > 0 && (
                    <td
                      rowSpan={sp.title}
                      style={{
                        ...td,
                        borderLeft: hair,
                        textAlign: "center",
                        verticalAlign: sp.title > 1 ? "middle" : "top",
                        background: sp.title > 1 ? "#FFFFFF" : undefined,
                        fontSize: 11,
                        fontWeight: 700,
                        lineHeight: 1.35,
                        color: all ? T.all.fg : T.sub,
                        wordBreak: "break-word",
                      }}
                    >
                      {r.title}
                    </td>
                  )}

                  <td style={{ ...td, borderLeft: hair, verticalAlign: all ? "middle" : "top" }}>
                    {empty ? null : all ? (
                      <p style={{ margin: 0, fontSize: 12, fontWeight: 700, textAlign: "center", color: T.ink }}>
                        全員{total > 0 ? `（${total}名）` : ""}
                      </p>
                    ) : (
                      <>
                        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "2px 8px" }}>
                          {r.names.map((n, k) => (
                            <span key={`${n}-${k}`} style={{ fontSize: 12, fontWeight: 600, lineHeight: 1.4, color: T.ink }}>
                              {n}
                            </span>
                          ))}
                        </div>
                        <p style={{ margin: "4px 0 0", fontSize: 10, fontWeight: 700, textAlign: "center", color: rt?.fg ?? T.dim }}>
                          {r.names.length}名
                        </p>
                      </>
                    )}
                    {noteInCell && (
                      <p style={{ margin: "4px 0 0", fontSize: 11, lineHeight: 1.5, textAlign: "center", color: T.sub, whiteSpace: "pre-line", wordBreak: "break-word" }}>
                        {note}
                      </p>
                    )}
                  </td>
                </tr>
                {noteBelow && (
                  <tr style={all ? { background: T.all.bg } : undefined}>
                    <td
                      colSpan={4}
                      style={{
                        padding: "0 12px 9px",
                        fontSize: 11.5,
                        lineHeight: 1.65,
                        color: T.sub,
                        whiteSpace: "pre-line",
                        wordBreak: "break-word",
                      }}
                    >
                      {note}
                    </td>
                  </tr>
                )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
