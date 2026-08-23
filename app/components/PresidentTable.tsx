"use client";

/* ============================================================
   社長室：会員名簿の表（下書き）
   ------------------------------------------------------------
   線だけで組んだ表。面の色はほとんど使わず、グレーの罫線で区切る。
   列の見出しも、中身のマスも、そのまま手で打ち込んで直せる。

   ※ いまは打ち込んだ内容をどこにも保存していない（画面を離れると消える）。
     どこに保存するか（全員で共有する／この端末だけに残す）が決まったら足す。
   ============================================================ */

import { useState } from "react";

const LINE = "#DFE1E4"; // 罫線
const HEAD = "#F4F5F6"; // 見出しの行だけ、ごくうすい面

const COL_COUNT = 5; // はじめの列数
const ROW_COUNT = 8; // はじめの行数
const COL_MIN_W = 150;

export default function PresidentTable() {
  const [columns, setColumns] = useState<string[]>(() => Array(COL_COUNT).fill(""));
  const [rows, setRows] = useState<string[][]>(() =>
    Array.from({ length: ROW_COUNT }, () => Array(COL_COUNT).fill("")),
  );

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

      <div style={{ marginTop: 14, display: "flex", gap: 8 }}>
        <button type="button" className="pr-addbtn" onClick={addRow}>行を追加</button>
        <button type="button" className="pr-addbtn" onClick={addColumn}>列を追加</button>
      </div>

    </div>
  );
}
