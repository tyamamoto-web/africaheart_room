"use client";

/* ============================================================
   社長室：会員名簿の表（設定 ＞ 会員名簿）
   ------------------------------------------------------------
   線だけで組んだ表。面の色はほとんど使わず、グレーの罫線で区切る。
   列の見出しも、中身のマスも、そのまま手で打ち込んで直せる。

   【1列目は名前】
     1列目に入れた名前を、参加状況のチェックに使う（lib/attendance.ts）。
     2列目から先は自由に増やしてよい（ふりがな・誕生月など）。

   【保存】
     「保存して全員に共有」を押したときだけ残る。置き場所は lib/roster.ts
     （新しいテーブルは作らず、共有テーブルの1行を間借りしている）。
     打つたびに送ると通信が多くなりすぎるので、押したときだけにしてある。
   ============================================================ */

import { useEffect, useState } from "react";
import { defaultMembers } from "@/lib/data";
import { EMPTY_ROSTER, readRoster, saveRoster, type Roster } from "@/lib/roster";

const LINE = "#DFE1E4"; // 罫線
const HEAD = "#F4F5F6"; // 見出しの行だけ、ごくうすい面

const COL_MIN_W = 150;

type Msg = { kind: "ok" | "ng"; text: string } | null;

export default function PresidentTable() {
  const [columns, setColumns] = useState<string[]>(EMPTY_ROSTER.columns);
  const [rows, setRows] = useState<string[][]>(EMPTY_ROSTER.rows);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<Msg>(null);

  /* 保存してあるものを読む。まだ何も無ければ空の表のまま。 */
  useEffect(() => {
    let alive = true;
    readRoster()
      .then((r) => {
        if (!alive) return;
        if (r) {
          setColumns(r.columns);
          setRows(r.rows);
        }
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  function setColumn(i: number, v: string) {
    setColumns((cs) => cs.map((c, n) => (n === i ? v : c)));
  }

  function setCell(r: number, c: number, v: string) {
    setRows((rs) => rs.map((row, ri) => (ri === r ? row.map((cell, ci) => (ci === c ? v : cell)) : row)));
  }

  function addRow() {
    setRows((rs) => [...rs, Array(columns.length).fill("")]);
  }

  function addColumn() {
    setColumns((cs) => [...cs, ""]);
    setRows((rs) => rs.map((r) => [...r, ""]));
  }

  /* すでにアプリが持っているメンバーの名前を、1列目に流し込む。
     いま入っているものは消さず、まだ載っていない名前だけを下に足す。 */
  function fillFromMembers() {
    setRows((rs) => {
      const have = new Set(rs.map((r) => (r[0] ?? "").trim()).filter(Boolean));
      const add = defaultMembers.map((m) => m.nickname).filter((n) => !have.has(n));
      if (add.length === 0) return rs;

      const next = rs.slice();
      // まず空いている行を上から埋め、足りなければ行を足す
      for (const name of add) {
        const blank = next.findIndex((r) => (r[0] ?? "").trim() === "");
        if (blank >= 0) {
          next[blank] = next[blank].map((c, i) => (i === 0 ? name : c));
        } else {
          next.push([name, ...Array(Math.max(columns.length - 1, 0)).fill("")]);
        }
      }
      return next;
    });
    setMsg({ kind: "ok", text: "名前を入れました。保存を押すと全員に共有されます" });
  }

  async function save() {
    setSaving(true);
    setMsg(null);
    const next: Roster = { columns, rows };
    try {
      await saveRoster(next);
      setMsg({ kind: "ok", text: "保存しました" });
    } catch (e) {
      setMsg({ kind: "ng", text: e instanceof Error ? e.message : "保存に失敗しました" });
    } finally {
      setSaving(false);
    }
  }

  const nameCount = rows.filter((r) => (r[0] ?? "").trim() !== "").length;
  const cellStyle = { border: `1px solid ${LINE}`, padding: 0 } as const;

  return (
    <div style={{ padding: "28px 28px 40px" }}>

      {/* 横に長くなったときは、この枠の中だけが横に動く */}
      <div style={{ overflowX: "auto" }}>
        <table style={{ borderCollapse: "collapse", width: "100%", minWidth: columns.length * COL_MIN_W }}>
          <thead>
            <tr>
              {columns.map((c, i) => (
                <th key={i} scope="col" style={{ ...cellStyle, background: HEAD, minWidth: COL_MIN_W }}>
                  <input
                    className="pr-cell pr-cell--head"
                    value={c}
                    onChange={(e) => setColumn(i, e.target.value)}
                    placeholder="列名"
                    aria-label={`${i + 1}列目の見出し`}
                  />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, ri) => (
              <tr key={ri}>
                {row.map((cell, ci) => (
                  <td key={ci} style={cellStyle}>
                    <input
                      className="pr-cell"
                      value={cell}
                      onChange={(e) => setCell(ri, ci, e.target.value)}
                      aria-label={`${ri + 1}行${ci + 1}列`}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: 14, display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button type="button" className="pr-addbtn" onClick={addRow}>行を追加</button>
        <button type="button" className="pr-addbtn" onClick={addColumn}>列を追加</button>
        <button type="button" className="pr-addbtn" onClick={fillFromMembers}>いまのメンバーを入れる</button>
        <button type="button" className="pr-addbtn" onClick={save} disabled={saving || loading}>
          {saving ? "保存しています" : "保存して全員に共有"}
        </button>
      </div>

      <p style={{ margin: "14px 0 0", fontSize: 13, lineHeight: 1.9, color: "#8B8E94" }}>
        1列目に入れた名前を、参加状況のチェックに使います（いま{nameCount}名）。
      </p>
      {msg && (
        <p style={{ margin: "6px 0 0", fontSize: 13, lineHeight: 1.9, color: msg.kind === "ok" ? "#63666C" : "#B24809" }}>
          {msg.text}
        </p>
      )}

    </div>
  );
}
