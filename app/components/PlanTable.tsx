"use client";

/* ============================================================
   部屋割の表（時間｜部屋番号｜企画｜名前）
   ------------------------------------------------------------
   当日の画面（会員ページ ＞ 当日）と、設定 ＞ アーカイブの過去の回で
   同じ表を使う。形はひとつで、色だけを variant で差し替える。
     day     … 会員画面の白地に合わせた色（グレーだけで組む。全員の行は線で囲む）
     archive … 設定の画面の色（白を地に、グレーだけで組む。全員の行はうすい地）

   【表の読み方】
     1行が「その時間に、その部屋で、何をして、誰がいるか」（lib/timetable.ts）。
     同じ時間の行が続いていれば、時間のマスはつないで1つにする。
     その中で企画も同じなら、企画のマスもつなぐ
     （コマ①を2部屋でやるときは、時間と企画が1つで、部屋と名前が2段になる）。
     名前が空の行は「全員」として出す。当日の表ではグレーの枠でぐるりと囲み、
     地は塗らない。過去の回の表はうすい地の色のまま（tone の all.line の有無で決まる）。
     部屋番号は、出てきた順に地のうすさを当てる（1つめ・2つめ。3つめからは地なし）。
     行にメモ（note。集合の枠の退席時刻や宿題のお題など、枠に付いていた補足）があれば、
     その行の下に横いっぱいの1段で小さく出す。時間をつないだ枠の途中の行だと段を
     はさめない（つなぎが崩れる）ので、そのときは名前のマスの中に出す。

   罫線・文字の大きさ・中央ぞろえは、過去の回の部屋割り表
   （app/components/KaraokeRooms.tsx）にそろえてある。
   ============================================================ */

import { Fragment } from "react";
import type { PlanRow } from "@/lib/timetable";

type RoomTone = { bg: string; fg: string };
/** 全員で集まる行の見せ方。line を入れると、地を塗らずにその色で1周囲む。 */
type AllTone = RoomTone & { line?: string };
type Tone = {
  ink: string;
  sub: string;
  dim: string;
  line: string;
  head: string; // 見出しの行の地
  time: string; // 「時間」の見出しの色
  rooms: RoomTone[]; // 部屋番号ごとの色（出てきた順）
  all: AllTone; // 全員で集まる行
};

const TONES: Record<"day" | "archive", Tone> = {
  day: {
    ink: "#1B1C1E",
    sub: "#63666C",
    dim: "#8B8E94",
    line: "#E4E5E8",
    head: "#F6F7F8",
    time: "#1B1C1E",
    // 部屋は色で分けず、地のうすさで分ける（A がうすく、B がすこし濃い）。
    // 10/30 まではAを青・Bを赤にしていたが、表そのものを白黒にそろえた。
    rooms: [
      { bg: "#F4F5F6", fg: "#35373C" },
      { bg: "#E9EAED", fg: "#35373C" },
    ],
    // 全員の行は塗らず、線で1周囲む。線は細い罫（line）より濃いグレーにして、
    // 囲みだと分かるようにする（10/30 までは差し色のオレンジ #F37021 だった）。
    all: { bg: "transparent", fg: "#35373C", line: "#8B8E94" },
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

/**
 * 企画の名前を「・」「／」の後ろで折り返せるようにする。
 * 入れる先のマスを wordBreak: keep-all にしてあるので、折り返しはここで入れた
 * ところだけで起きる。「自己紹介・課題曲」が「自己紹介・」「課題曲」で折れる
 * （そうしないと「自己紹介・課題」「曲」のように言葉の途中で割れる）。
 * 区切りが無い言葉は、はみ出すときだけ overflowWrap: anywhere で折れる。
 */
function breakableTitle(title: string): React.ReactNode {
  const parts: string[] = [];
  let buf = "";
  for (const ch of title) {
    buf += ch;
    if (ch === "・" || ch === "／" || ch === "/") {
      parts.push(buf);
      buf = "";
    }
  }
  if (buf) parts.push(buf);
  if (parts.length < 2) return title;
  return parts.map((p, i) => (
    <Fragment key={i}>
      {p}
      {i < parts.length - 1 ? <wbr /> : null}
    </Fragment>
  ));
}

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

/* 名前のマスを押せるようにしたときの見た目。インラインstyleでは :hover が書けないので、
   この表の中（.pt-pick）だけに効く短いCSSを1つ置く。押せることは、下の点線と
   指のかたちのカーソルで示す（地を塗ると「全員」の行の囲みとぶつかる）。 */
const PICK_CSS = `
.pt-pick { display:block; width:100%; padding:0; border:none; background:transparent;
  font:inherit; color:inherit; text-align:inherit; cursor:pointer; border-radius:6px; }
.pt-pick:hover { background:rgba(0,0,0,0.035); }
.pt-pick:focus-visible { outline:2px solid #8B8E94; outline-offset:2px; }
`;

export default function PlanTable({
  rows,
  total,
  variant,
  minWidth = 248, // 幅375pxのスマホでも横に流さずに収まる大きさ。設定の画面ではもっと広く渡す
  onPickNames,
  peopleFor,
}: {
  rows: PlanRow[];
  /** 全員の人数。「全員（9名）」と出すのに使う。0なら人数は出さない。 */
  total: number;
  variant: "day" | "archive";
  minWidth?: number;
  /** 渡すと、名前のマスが押せるようになる（当日の部屋割りで、誰がいるかを選ぶため）。
      中身の無い行は押せない。渡さなければ、これまでどおり出すだけ。 */
  onPickNames?: (index: number) => void;
  /** 「全員」の行に、誰がいるのかを名前で出すために渡す。
      その行の時間にいる人を返す（出欠と来る帰る時間から決まる。lib/attendanceTime.ts）。
      空を返すか、渡さなければ、これまでどおり「全員（◯名）」とだけ出す。
      ※ 行そのものは名前を持たないまま（空＝全員）。ここは出し方だけの話。 */
  peopleFor?: (r: PlanRow, index: number) => string[];
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

  /* 全員の行の囲み。当日の表だけ、地を塗るかわりに枠で囲む（tone に line があるとき）。
     表は borderCollapse: collapse なので、線は行ではなくマスに付ける。
     行の左端・右端のマスにだけ外側の線を足し、間の縦線はもとの細い線のまま残す。 */
  const allLine = T.all.line ? `1px solid ${T.all.line}` : "";
  const allEdge = (
    on: boolean,
    side: "left" | "right" | "",
    bottom: boolean,
  ): React.CSSProperties =>
    !on || !allLine
      ? {}
      : {
          borderTop: allLine,
          ...(bottom ? { borderBottom: allLine } : {}),
          ...(side === "left" ? { borderLeft: allLine } : {}),
          ...(side === "right" ? { borderRight: allLine } : {}),
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

  /* 名前のマスの中身。
     名前の入っている行は、その人たち。
     「全員」の行（名前が空）は、peopleFor がその時間にいる人を返せばその人たち、
     返せなければ「全員（◯名）」の1行だけ。どちらの場合も、下に小さく人数を添える。 */
  const nameCell = (r: PlanRow, i: number, all: boolean, rt: RoomTone | undefined): React.ReactNode => {
    const shown = all ? peopleFor?.(r, i) ?? [] : r.names;
    if (shown.length === 0) {
      return (
        <p style={{ margin: 0, fontSize: 12, fontWeight: 700, textAlign: "center", color: T.ink }}>
          全員{total > 0 ? `（${total}名）` : ""}
        </p>
      );
    }
    return (
      <>
        {/* 名前は「・」で区切って続けて出す。1人ぶんを nowrap にしてあるので、
            長い呼び名が「あいう」「えお」のように途中で割れない。
            9/25 まではすきま（gap）だけで区切っていたが、2人が1行に並ぶと
            どこまでが1人の名前か読み取りにくかった。 */}
        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "1px 0" }}>
          {shown.map((n, k) => (
            <span
              key={`${n}-${k}`}
              style={{ fontSize: 12, fontWeight: 600, lineHeight: 1.45, color: T.ink, whiteSpace: "nowrap" }}
            >
              {n}
              {k < shown.length - 1 ? <span style={{ color: T.dim, fontWeight: 400 }}>・</span> : null}
            </span>
          ))}
        </div>
        <p
          style={{
            margin: "4px 0 0",
            fontSize: 10,
            fontWeight: 700,
            textAlign: "center",
            color: all ? T.all.fg : rt?.fg ?? T.dim,
          }}
        >
          {all ? `全員（${shown.length}名）` : `${shown.length}名`}
        </p>
      </>
    );
  };

  /* 名前のマスの中身。押せるときはボタンで包む。
     押したら、その行が何行目かを呼び出し元へ返す（名前を選ぶ画面を出すのは向こうの役目）。 */
  const pickWrap = (i: number, r: PlanRow, inner: React.ReactNode): React.ReactNode => {
    if (!onPickNames) return inner;
    const where = [r.time.trim(), r.room.trim() ? `${r.room.trim()}室` : ""].filter(Boolean).join(" ");
    return (
      <button
        type="button"
        className="pt-pick"
        aria-label={`${where || `${i + 1}行目`}にいる人を選ぶ`}
        onClick={() => onPickNames(i)}
      >
        {inner}
      </button>
    );
  };

  return (
    /* 狭い画面でも本文を横に押し出さないよう、この中だけで横に流す */
    <div style={{ overflowX: "auto" }}>
      {onPickNames && <style>{PICK_CSS}</style>}
      <div style={{ border: hair, borderRadius: 10, overflow: "hidden", minWidth }}>
        <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
          {/* 幅の配り方（9/25 に見直した）。部屋番号のマスは「A」や「26」しか入らないのに
              見出しの「部屋番号」4文字ぶんを取っていたので、見出しを「部屋」にして詰め、
              浮いたぶんを企画と名前に回した。企画は「イントロクイズ」が1行で収まる幅、
              名前は1行に2人ぶんが並ぶ幅がめやす。 */}
          <colgroup>
            <col style={{ width: "20%" }} />
            <col style={{ width: "12%" }} />
            <col style={{ width: "31%" }} />
            <col style={{ width: "37%" }} />
          </colgroup>
          <thead>
            <tr style={{ background: T.head }}>
              <th style={{ ...th, color: T.time }}>時間</th>
              <th style={th}>部屋</th>
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
                        ...allEdge(all, "left", !noteBelow),
                      }}
                    >
                      <p style={{ margin: 0, fontSize: 12, fontWeight: 700, lineHeight: 1.25, color: T.ink }}>{startT}</p>
                      {endT && <p style={{ margin: 0, fontSize: 11, lineHeight: 1.25, color: T.dim }}>〜{endT}</p>}
                    </td>
                  )}

                  {/* 部屋の呼び名（A・B）と、当日お店で聞いた実際の番号。
                      呼び名はLINEの告知や打ち合わせで使う言い方なので消さず、
                      番号はその下に添える（番号が入るまでは呼び名だけ）。 */}
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
                      ...allEdge(all, "", !noteBelow),
                    }}
                  >
                    {r.room}
                    {(r.roomNo ?? "").trim() !== "" && (
                      <span style={{ display: "block", fontSize: 10, fontWeight: 700, lineHeight: 1.4, opacity: 0.75 }}>
                        {r.roomNo}
                      </span>
                    )}
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
                        wordBreak: "keep-all",
                        overflowWrap: "anywhere",
                        ...allEdge(all, "", !noteBelow),
                      }}
                    >
                      {breakableTitle(r.title)}
                    </td>
                  )}

                  <td
                    style={{
                      ...td,
                      borderLeft: hair,
                      verticalAlign: all ? "middle" : "top",
                      ...allEdge(all, "right", !noteBelow),
                    }}
                  >
                    {empty ? null : pickWrap(i, r, nameCell(r, i, all, rt))}
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
                        // 囲みは、この段の下でいったん閉じる（枠が途中で切れないように）
                        ...(all && allLine
                          ? { borderBottom: allLine, borderLeft: allLine, borderRight: allLine }
                          : {}),
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
