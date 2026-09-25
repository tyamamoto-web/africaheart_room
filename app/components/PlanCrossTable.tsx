"use client";

/* ============================================================
   同席クロス表：誰と誰が、同じ部屋に何回いるか
   ------------------------------------------------------------
   当日の部屋割（app/components/PlanTable.tsx）のすぐ下に出す。
   もとになるのは部屋割の表そのもので、別に持っている数は無い
   （役員が部屋割を書き換えれば、この表もその場で変わる）。

   数え方：名前の入っている行1つが「その時間・その部屋にいる顔ぶれ」なので、
   その中の2人ずつの組を1回と数える。名前が空の行（全員で集まる時間）は
   誰と誰でも必ず一緒になるので数えない。数えても全部の組に同じ数が足されるだけで、
   「誰と誰が会っていないか」が見えなくなる。

   見た目：
     ・縦も横も同じ並び（名簿の順）。交わるところが同席回数。
     ・回数が多いほど濃いオレンジ。0 だけは白のまま残して、
       「まだ一度も同じ部屋になっていない組」が穴のように見えるようにした。
     ・斜めの線（自分×自分）は灰色にして数字を出さない。
     ・横の見出しは縦書き（writing-mode）。13人ぶん並べても幅が要らない。
       これは前のTOPページにあった同席クロス表（app/components/CrossTable.tsx）と同じ手。

   狭い画面（幅375pxのスマホ）でも横に流さずに収まる大きさにしてある。
   ============================================================ */

import type { PlanRow } from "@/lib/timetable";

/* 回数ごとの色。0 は白のまま（見つけてほしいのは、ここだから）。 */
const HEAT: { bg: string; fg: string }[] = [
  { bg: "#FFFFFF", fg: "#C2410C" }, // 0
  { bg: "#FDECE0", fg: "#8A5A34" }, // 1
  { bg: "#F9CFAF", fg: "#7A3E12" }, // 2
  { bg: "#F3A268", fg: "#4A2206" }, // 3
  { bg: "#F37021", fg: "#FFFFFF" }, // 4以上
];
const heatOf = (n: number) => HEAT[Math.min(n, HEAT.length - 1)];

const LINE = "#E4E5E8";
const SUB = "#63666C";
const DIM = "#8B8E94";

const pairKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);

/** 部屋割から、出てくる人と組ごとの同席回数を数える。 */
function tally(rows: PlanRow[], order: string[]) {
  const counts = new Map<string, number>();
  const seen: string[] = [];
  for (const r of rows) {
    const ns = r.names.filter(Boolean);
    if (ns.length < 2) continue; // 名前が空の行（全員）は数えない
    for (const n of ns) if (!seen.includes(n)) seen.push(n);
    for (let i = 0; i < ns.length; i++) {
      for (let j = i + 1; j < ns.length; j++) {
        const k = pairKey(ns[i], ns[j]);
        counts.set(k, (counts.get(k) ?? 0) + 1);
      }
    }
  }
  // 並びは名簿の順。名簿に無い名前は、表に出てきた順で後ろに付ける。
  const people = [...order.filter((n) => seen.includes(n)), ...seen.filter((n) => !order.includes(n))];
  return { people, counts };
}

export default function PlanCrossTable({
  rows,
  order = [],
}: {
  rows: PlanRow[];
  /** 縦横の並び（名簿の順）。渡さなければ、部屋割に出てきた順になる。 */
  order?: string[];
}) {
  const { people, counts } = tally(rows, order);
  if (people.length < 2) return null;

  const get = (a: string, b: string) => counts.get(pairKey(a, b)) ?? 0;
  const never: [string, string][] = [];
  for (let i = 0; i < people.length; i++) {
    for (let j = i + 1; j < people.length; j++) {
      if (get(people[i], people[j]) === 0) never.push([people[i], people[j]]);
    }
  }

  const hair = `1px solid ${LINE}`;
  const cell: React.CSSProperties = {
    border: hair,
    padding: 0,
    height: 20,
    textAlign: "center",
    fontSize: 10,
    fontWeight: 700,
    lineHeight: 1,
  };

  return (
    <div style={{ marginTop: 22 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: "50%", background: "#F37021" }} />
        <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: DIM, letterSpacing: "0.06em" }}>同席の回数</p>
      </div>

      <p style={{ margin: "8px 0 0", fontSize: 11, lineHeight: 1.7, color: SUB }}>
        部屋が分かれている時間に、同じ部屋になる回数です。全員で集まる時間は数えていません。
      </p>

      {/* 狭い画面でも本文を横に押し出さないよう、この中だけで横に流す */}
      <div style={{ overflowX: "auto", marginTop: 10 }}>
        <div style={{ minWidth: 268 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
            <colgroup>
              <col style={{ width: 60 }} />
              {people.map((n) => (
                <col key={n} />
              ))}
            </colgroup>
            <thead>
              <tr>
                <th />
                {people.map((n) => (
                  <th key={n} style={{ padding: "0 0 4px", verticalAlign: "bottom" }}>
                    {/* 縦書き。13人ぶん並べても1列ぶんの幅で足りる */}
                    <div
                      style={{
                        writingMode: "vertical-rl",
                        margin: "0 auto",
                        fontSize: 9,
                        fontWeight: 700,
                        whiteSpace: "nowrap",
                        letterSpacing: "0.02em",
                        color: SUB,
                      }}
                    >
                      {n}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {people.map((a) => (
                <tr key={a}>
                  <th
                    scope="row"
                    style={{
                      padding: "0 5px 0 0",
                      textAlign: "right",
                      fontSize: 10,
                      fontWeight: 700,
                      whiteSpace: "nowrap",
                      color: SUB,
                    }}
                  >
                    {a}
                  </th>
                  {people.map((b) => {
                    if (a === b) return <td key={b} style={{ ...cell, background: "#EDEEF0" }} />;
                    const v = get(a, b);
                    const h = heatOf(v);
                    return (
                      <td
                        key={b}
                        title={`${a} と ${b}：${v}回`}
                        style={{
                          ...cell,
                          background: h.bg,
                          color: h.fg,
                          // 0 のマスだけ細い枠を重ねて、白いまま埋もれないようにする
                          boxShadow: v === 0 ? "inset 0 0 0 1.5px #F6C3A5" : undefined,
                        }}
                      >
                        {v}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 色のめやす */}
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "4px 6px", marginTop: 10 }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: DIM }}>回数</span>
        {HEAT.map((h, i) => (
          <span
            key={i}
            style={{
              minWidth: 20,
              padding: "2px 4px",
              border: hair,
              borderRadius: 4,
              background: h.bg,
              color: h.fg,
              fontSize: 10,
              fontWeight: 700,
              textAlign: "center",
            }}
          >
            {i === HEAT.length - 1 ? `${i}以上` : i}
          </span>
        ))}
      </div>

      <p style={{ margin: "10px 0 0", fontSize: 11, lineHeight: 1.7, color: SUB }}>
        {never.length === 0
          ? "全員が、誰とも一度は同じ部屋になります。"
          : `一度も同じ部屋にならないのは ${never.length}組（白いマス）。`}
        {never.length > 0 && never.length <= 6 && (
          <>
            <br />
            <span style={{ color: DIM }}>{never.map(([a, b]) => `${a}と${b}`).join("／")}</span>
          </>
        )}
      </p>
    </div>
  );
}
