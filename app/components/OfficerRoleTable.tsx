"use client";

/* ============================================================
   役員専用2：オフ会運営のRACIチャート
   ------------------------------------------------------------
   9/6 に app/admin/page.tsx から、中身も見た目も変えずに切り出した。
   同じものを 管理画面 ＞ 役員専用2 と TOP ＞ 設定 ＞ 役員専用2 の両方から出す。
   どちらから開いても、書いたものは同じ置き場所（Supabase）に入る。
   前に置く合言葉は app/components/OfficerGate.tsx。
   ============================================================ */

import { useState, useEffect, useRef } from "react";
import { RACI_PEOPLE, type RaciRole } from "@/lib/officerRaci";
import { raciDefs, raciPersonSubLabel } from "@/lib/raciDefs";
import {
  getOfficerTable, saveOfficerTableRow, saveOfficerTableColumns, deleteOfficerTableRow,
  insertOfficerTableRowBefore,
  seedOfficerTable, emptyRow, emptyColumns, newRowId, SEED_ROW_IDS,
  type OfficerTableRow, type OfficerTableData,
} from "@/lib/officerTable";

/* ── 役員専用2：オフ会運営のRACIチャート（役員全員で共同編集）───────
   表の形はRACIの基本どおり。左が「やることの特定」、右が「人ごとの役割」。
     左：見出しも中身も自分たちで書ける空の5列（＋通し番号のNo）
     右：よしのすけ／くる／しゃちょー／メンバー（担当者・責任者・相談役・お知らせ）

   左を空の5列にしてある理由：
     この表が扱うのは1回のイベントの進行ではなく、毎月まわしていく運営そのもの。
     何を軸に並べるか（分野・まとまり・いつ など）は、書きながら決めたほうが早い。
     見出しも全員で共有されるので、1人が直せば他の人の画面にも同じ見出しが出る。
     右のRACIの4人は、表の型を保つため固定。

   見た目の考え方：白い紙に活字を組んだ誌面として扱う。
     色は足さず、わずかに暖かい白の階調と、強さの決まった2本の罫だけで作る。
       強い罫：見出しの下の2px（表の背骨）
       弱い罫：1行ごとの細い罫（どの行も同じ濃さでそろえる）
     行を数える手がかりは、左端に貼り付くNo列の柱と、桁のそろった等幅の数字が受け持つ。
     書く5列のあいだに縦罫は引かず、余白と記入欄の下線で分ける。
     赤紫（アプリの色）はこの表では使わない。60個ある記入欄のどこにでも出るため、
     いちばん目立つ色が「たまたま今さわっている欄」に付いてしまうので。

   保存は lib/officerTable.ts（homework_result の id=6 を間借り）。
   文字は打ち終わってから少し待って自動保存。役割のプルダウンは押した時点で保存。
   ほかの人の変更は約6秒ごとに入ってくる。
   ------------------------------------------------------------------ */

// 表の色。紙（地）・罫（線）・インク（文字）の3組に分けてある。
// 灰色はどれも赤よりも青をわずかに落とした、ごく弱い暖色寄り（無彩色だと表計算ソフトの顔になる）。
const T = {
  // 紙。上から順に、白 → だんだん沈む
  paper: "#ffffff", // 表の地。記入欄の地
  rowHov: "#faf9f6", // マウスを乗せた行
  rowOn: "#f8f6f1", // いま自分が書いている行
  cellHov: "#f4f2ed", // 記入欄・ボタン・×にマウスを乗せたとき
  no: "#f2f0eb", // No列の地。左端をつらぬく柱
  noHov: "#edeae4", // No列（行にマウスを乗せたとき）
  noOn: "#e7e4dc", // No列（いま書いている行）
  // 罫。弱い順に3段。いちばん強いのは見出しの下の2px（ink）
  hair: "#e6e3dc", // 1行ごとの細い罫・人と人の間・No列の右
  rule: "#cbc7be", // 表の外枠・ボタンの枠
  block: "#b8b3a8", // 書く5列と役割の4列を分ける仕切り
  guide: "#dedbd3", // 記入欄の下に常時引く線（ここに書けるという合図）
  // インク
  ink: "#33302a", // 本文・人名・見出しの下の2px罫・責任者の地
  sub: "#57544d", // Noの数字
  cap: "#6b6860", // 肩書き・状態表示・×・書いている欄の枠
  faint: "#8a867d", // 押せないときの文字
  warn: "#7a5a2e", // 責任者が1人に決まっていない印
};

/* マウスを乗せたとき・書いているときの見た目はCSSで書く。
   このファイルはインラインstyleが主体で :hover が書けないため、
   この表の中（.rtbl）だけに効く短いCSSを1つ置く。色は T から差し込む。
   ※ 行の地色はここが受け持つので、tdのインラインstyleに background を書かないこと
     （インラインが必ず勝ってしまう）。No列だけ className="no" を付ける。 */
const TABLE_CSS = `
.rtbl tbody td { background:${T.paper}; border-bottom:1px solid ${T.hair}; }
.rtbl tbody td.no { background:${T.no}; }
.rtbl tbody tr:hover td { background:${T.rowHov}; }
.rtbl tbody tr:hover td.no { background:${T.noHov}; }
.rtbl tbody tr.on td { background:${T.rowOn}; }
.rtbl tbody tr.on td.no { background:${T.noOn}; box-shadow: inset 3px 0 0 ${T.ink}; }
.rtbl tbody tr:last-child td { border-bottom-color:transparent; }
.rtbl textarea, .rtbl thead input {
  border:1px solid transparent; border-radius:3px; background:transparent;
  transition: background .12s, border-color .12s, box-shadow .12s;
}
.rtbl textarea { border-bottom-color:${T.guide}; }
.rtbl textarea:hover { background:${T.cellHov}; border-bottom-color:${T.block}; }
.rtbl thead input:hover { background:${T.cellHov}; }
.rtbl textarea:focus, .rtbl thead input:focus {
  background:${T.paper}; border-color:${T.cap}; box-shadow:0 0 0 3px rgba(51,48,42,0.10);
}
.rtbl select:hover { border-color:${T.cap} !important; }
.rtbl select:focus { border-color:${T.cap} !important; box-shadow:0 0 0 3px rgba(51,48,42,0.10); }
.rtbl .addbtn:hover:not(:disabled) { background:${T.cellHov}; border-color:${T.block}; }
.rtbl .delbtn:hover { background:${T.cellHov}; color:${T.ink}; }
`;

/* 役割4種の見た目。言葉と意味は lib/raciDefs.ts のまま使い、色だけこの表で上書きする
   （raciDefs は役員専用タブと共用なので触らない）。
   見分けは4つの性質を重ねてある：面の有無 / 面の明るさ / 灰色の温度 / 文字の太さ。
   白黒に落としても 濃い面 → 中間の面 → 白抜き＋濃い枠 → 薄い面 の順に軽くなり、
   「決める → 手を動かす → 意見を言う → 知らせるだけ」の重さの順と一致する。 */
const ROLE_UI: Record<RaciRole, { bg: string; fg: string; bd: string; weight: number }> = {
  a: { bg: "#33302a", fg: "#ffffff", bd: "#33302a", weight: 700 }, // 責任者：濃く塗る。1行に1人だけなので目印になる
  r: { bg: "#dbd6ca", fg: "#322e26", bd: "#8f8670", weight: 700 }, // 担当者：暖かい薄灰で塗る
  c: { bg: "#ffffff", fg: "#3b3833", bd: "#6f6b63", weight: 600 }, // 相談役：白く抜いて、枠をいちばん濃くする
  i: { bg: "#e8ebef", fg: "#363c43", bd: "#80868d", weight: 500 }, // お知らせ：冷たい薄灰で塗る
};
const ROLE_NONE = { bg: "transparent", fg: "#66635c", bd: "#8f8a81", weight: 500 };

// プルダウンの三角を自分で描く（環境ごとの見た目の差をなくす）。
function chevron(color: string): string {
  const c = encodeURIComponent(color);
  return `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='7' height='5' viewBox='0 0 7 5'><path d='M0.7 0.9 L3.5 3.8 L6.3 0.9' fill='none' stroke='${c}' stroke-width='1.2' stroke-linecap='round' stroke-linejoin='round'/></svg>")`;
}

const tblTh: React.CSSProperties = {
  background: T.paper,
  color: T.cap,
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: "0.04em",
  textAlign: "left",
  padding: "10px 10px 8px",
  verticalAlign: "bottom", // 見出しの文字を、下の太い罫のすぐ上にそろえる
  whiteSpace: "nowrap",
};
const tblTd: React.CSSProperties = { padding: "3px 5px", verticalAlign: "top" };

/** 行の右端に並べる小さなボタン（＋で足す・×で消す）の共通の見た目。 */
const rowIconBtn: React.CSSProperties = {
  width: 22,
  height: 22,
  borderRadius: 3,
  border: "none",
  background: "transparent",
  color: T.cap,
  lineHeight: 1,
  padding: 0,
  cursor: "pointer",
};

/** 自由に書く欄。書いた分だけ縦に伸びるので、行の中でスクロールバーが出ない。 */
function CellText({
  value,
  onChange,
  onFocus,
  onBlur,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  onFocus: () => void;
  onBlur: () => void;
  label: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.max(32, el.scrollHeight)}px`;
  }, [value]);

  return (
    <textarea
      ref={ref}
      rows={1}
      value={value}
      aria-label={label}
      onChange={(e) => onChange(e.target.value)}
      onFocus={onFocus}
      onBlur={onBlur}
      style={{
        width: "100%",
        display: "block",
        resize: "none",
        overflow: "hidden",
        fontSize: 12,
        lineHeight: 1.6,
        color: T.ink,
        padding: "6px 8px",
        outline: "none",
        fontFamily: "inherit",
      }}
    />
  );
}

/** 列の見出し。見出しそのものを書き替えられる（全員に共有される）。 */
function HeadInput({
  value,
  onChange,
  onFocus,
  onBlur,
  index,
}: {
  value: string;
  onChange: (v: string) => void;
  onFocus: () => void;
  onBlur: () => void;
  index: number;
}) {
  return (
    <input
      type="text"
      value={value}
      aria-label={`${index + 1}つめの列の名前`}
      onChange={(e) => onChange(e.target.value)}
      onFocus={onFocus}
      onBlur={onBlur}
      style={{
        width: "100%",
        color: T.ink,
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: "0.04em",
        padding: "4px 6px",
        outline: "none",
        fontFamily: "inherit",
      }}
    />
  );
}

export default function OfficerRoleTable() {
  const [columns, setColumns] = useState<string[]>(emptyColumns());
  const [rows, setRows] = useState<OfficerTableRow[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [focusRow, setFocusRow] = useState<string | null>(null); // いま自分が書いている行
  const [more, setMore] = useState(false); // 右にまだ表が続くか

  const dataRef = useRef<OfficerTableData>({ columns: emptyColumns(), rows: [] }); // 保存はいつもこの手元の値を使う
  const pending = useRef(0); // 保存中の件数。0より大きいあいだは取り込みを止める
  const editing = useRef<string | null>(null); // 入力中の行（見出しは "cols"）は上書きしない
  const dirty = useRef<Set<string>>(new Set()); // まだ保存していない行
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const scrollRef = useRef<HTMLDivElement>(null);

  const COLS_KEY = "cols"; // 見出しをタイマー・入力中の目印で扱うときのキー

  // 画面の表示と手元の値を同時に更新する
  function commit(next: OfficerTableData) {
    dataRef.current = next;
    setColumns(next.columns);
    setRows(next.rows);
  }

  async function run(key: string, work: () => Promise<unknown>) {
    pending.current += 1;
    setSaving(true);
    try {
      await work();
      dirty.current.delete(key);
      setErr(null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "保存に失敗しました");
    } finally {
      pending.current -= 1;
      if (pending.current === 0) setSaving(false);
    }
  }

  // 1行ぶんの変更。immediate は「押した時点で保存する」もの（役割のプルダウン）。
  function patchRow(id: string, change: Partial<OfficerTableRow>, immediate: boolean) {
    const next: OfficerTableData = {
      columns: dataRef.current.columns,
      rows: dataRef.current.rows.map((r) => (r.id === id ? { ...r, ...change } : r)),
    };
    commit(next);
    const row = next.rows.find((r) => r.id === id);
    if (!row) return;
    if (immediate) {
      void run(id, () => saveOfficerTableRow(row));
      return;
    }
    dirty.current.add(id);
    clearTimeout(timers.current[id]);
    timers.current[id] = setTimeout(() => void run(id, () => saveOfficerTableRow(row)), 800);
  }

  // 列の見出しの変更（全員に共有される）
  function patchColumn(index: number, value: string) {
    const nextCols = dataRef.current.columns.map((c, i) => (i === index ? value : c));
    commit({ columns: nextCols, rows: dataRef.current.rows });
    dirty.current.add(COLS_KEY);
    clearTimeout(timers.current[COLS_KEY]);
    timers.current[COLS_KEY] = setTimeout(
      () => void run(COLS_KEY, () => saveOfficerTableColumns(nextCols)),
      800
    );
  }

  function startEdit(key: string) {
    editing.current = key;
    setFocusRow(key === COLS_KEY ? null : key);
  }

  // 欄から離れたら、待たずに保存する
  function flush(key: string) {
    editing.current = null;
    setFocusRow(null);
    if (!dirty.current.has(key)) return;
    clearTimeout(timers.current[key]);
    if (key === COLS_KEY) {
      const cols = dataRef.current.columns;
      void run(COLS_KEY, () => saveOfficerTableColumns(cols));
      return;
    }
    const row = dataRef.current.rows.find((r) => r.id === key);
    if (row) void run(key, () => saveOfficerTableRow(row));
  }

  function addRow() {
    const row = emptyRow(newRowId());
    commit({ columns: dataRef.current.columns, rows: [...dataRef.current.rows, row] });
    void run(row.id, () => saveOfficerTableRow(row));
  }

  // 行と行のあいだに足す。どの行の「上」に入れるかで位置を決める。
  // どの行の＋を押しても上に入るので、いちばん上の行の前にも足せる（末尾は「行を追加」）。
  function insertRowBefore(beforeId: string) {
    const row = emptyRow(newRowId());
    const rows = dataRef.current.rows.slice();
    const at = rows.findIndex((r) => r.id === beforeId);
    rows.splice(at >= 0 ? at : rows.length, 0, row);
    commit({ columns: dataRef.current.columns, rows });
    void run(row.id, () => insertOfficerTableRowBefore(row, beforeId));
  }

  function removeRow(row: OfficerTableRow) {
    const hasText = row.cells.some((s) => s.trim());
    if (hasText && !window.confirm("この行を消します。ほかの人の画面からも消えます。よろしいですか。")) return;
    clearTimeout(timers.current[row.id]);
    dirty.current.delete(row.id);
    commit({
      columns: dataRef.current.columns,
      rows: dataRef.current.rows.filter((r) => r.id !== row.id),
    });
    void run(row.id, () => deleteOfficerTableRow(row.id));
  }

  // 最初の読み込み。まだ1行も無ければ空の12行を作る（idは固定なので二重にならない）。
  useEffect(() => {
    let alive = true;
    (async () => {
      let data = await getOfficerTable();
      if (data.rows.length === 0) {
        try {
          data = await seedOfficerTable();
        } catch {
          data = { columns: emptyColumns(), rows: SEED_ROW_IDS.map(emptyRow) };
        }
      }
      if (!alive) return;
      commit(data);
      setLoaded(true);
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ほかの人の変更を取り込む（約6秒ごと）。
  useEffect(() => {
    const t = setInterval(async () => {
      if (pending.current > 0) return; // 保存中は取り込まない
      const remote = await getOfficerTable();
      if (remote.rows.length === 0) return; // 読めなかったときは今の表を残す
      const key = editing.current;
      if (!key) {
        commit(remote);
        return;
      }
      // 入力中の見出し・行だけは自分の手元を残し、ほかは共有側に合わせる
      const cols = key === COLS_KEY ? dataRef.current.columns : remote.columns;
      const mine = key === COLS_KEY ? undefined : dataRef.current.rows.find((r) => r.id === key);
      commit({
        columns: cols,
        rows: mine ? remote.rows.map((r) => (r.id === mine.id ? mine : r)) : remote.rows,
      });
    }, 6000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 画面を離れるときに、待機中の保存を片づける
  useEffect(() => {
    const t = timers.current;
    return () => {
      Object.values(t).forEach(clearTimeout);
    };
  }, []);

  // 右にまだ表が続いているかを見張る（続いているときだけ右端をぼかす）
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const check = () => setMore(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
    check();
    el.addEventListener("scroll", check, { passive: true });
    window.addEventListener("resize", check);
    return () => {
      el.removeEventListener("scroll", check);
      window.removeEventListener("resize", check);
    };
  }, [loaded, rows.length]);

  return (
    // 左5列＋RACI4人＋Noで横に長いので、広い画面では収まるところまで枠を広げる。
    <div className="rtbl px-4 pt-3 pb-8 mx-auto" style={{ maxWidth: 1240 }}>
      <style>{TABLE_CSS}</style>

      <div className="flex items-center justify-between gap-3" style={{ marginBottom: 10 }}>
        <button
          onClick={addRow}
          disabled={!loaded}
          className="addbtn"
          style={{
            background: T.paper,
            border: `1px solid ${loaded ? T.rule : T.hair}`,
            borderRadius: 3,
            padding: "7px 16px",
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.04em",
            color: loaded ? T.ink : T.faint,
            cursor: loaded ? "pointer" : "default",
          }}
        >
          行を追加
        </button>
        {/* ふだんは何も出さない。保存に失敗したときだけ、その場で知らせる。 */}
        {err && <span style={{ fontSize: 11, letterSpacing: "0.02em", color: T.warn }}>{err}</span>}
      </div>

      <div style={{ position: "relative" }}>
        <div
          ref={scrollRef}
          style={{
            border: `1px solid ${T.rule}`,
            borderRadius: 4,
            overflowX: "auto",
            overflowY: "hidden",
            background: T.paper,
          }}
        >
          <table
            style={{
              minWidth: 1221, // No36＋自由5列795＋役割4人336＋右の操作54
              width: "100%",
              borderCollapse: "separate", // No列を左に貼り付けても罫線が消えないように
              borderSpacing: 0,
              tableLayout: "fixed",
            }}
          >
            <colgroup>
              <col style={{ width: 36 }} />
              {columns.map((_, i) => (
                <col key={i} style={{ width: 159 }} />
              ))}
              {RACI_PEOPLE.map((p) => (
                <col key={p.id} style={{ width: 84 }} />
              ))}
              {/* 右端の操作（＋で足す・×で消す） */}
              <col style={{ width: 54 }} />
            </colgroup>
            <thead>
              <tr>
                <th
                  rowSpan={2}
                  style={{
                    ...tblTh,
                    textAlign: "center",
                    padding: "10px 0 8px",
                    background: T.no,
                    borderRight: `1px solid ${T.hair}`,
                    borderBottom: `2px solid ${T.ink}`,
                    position: "sticky",
                    left: 0,
                    zIndex: 3,
                  }}
                >
                  No
                </th>
                {columns.map((label, i) => (
                  <th
                    key={i}
                    rowSpan={2}
                    style={{
                      ...tblTh,
                      padding: "10px 6px 7px",
                      paddingRight: i === columns.length - 1 ? 14 : 6,
                      borderBottom: `2px solid ${T.ink}`,
                      borderRight: i === columns.length - 1 ? `1px solid ${T.block}` : undefined,
                    }}
                  >
                    <HeadInput
                      value={label}
                      index={i}
                      onChange={(v) => patchColumn(i, v)}
                      onFocus={() => startEdit(COLS_KEY)}
                      onBlur={() => flush(COLS_KEY)}
                    />
                  </th>
                ))}
                <th
                  colSpan={RACI_PEOPLE.length}
                  style={{
                    ...tblTh,
                    textAlign: "center",
                    padding: "10px 8px 7px",
                    fontSize: 10,
                    borderBottom: `1px solid ${T.hair}`,
                  }}
                >
                  役割（だれが・どう関わる）
                </th>
                <th
                  rowSpan={2}
                  style={{
                    ...tblTh,
                    padding: "10px 2px 8px",
                    borderLeft: `1px solid ${T.hair}`,
                    borderBottom: `2px solid ${T.ink}`,
                  }}
                />
              </tr>
              <tr>
                {RACI_PEOPLE.map((p, pi) => (
                  <th
                    key={p.id}
                    style={{
                      ...tblTh,
                      textAlign: "center",
                      padding: "6px 4px 9px",
                      borderBottom: `2px solid ${T.ink}`,
                      borderRight: pi === RACI_PEOPLE.length - 1 ? undefined : `1px solid ${T.hair}`,
                    }}
                  >
                    <div style={{ color: T.ink, fontSize: 12, fontWeight: 600, letterSpacing: "0.02em" }}>
                      {p.name}
                    </div>
                    <div style={{ marginTop: 3, fontSize: 10, fontWeight: 500, letterSpacing: "0.02em", color: T.cap }}>
                      {raciPersonSubLabel(p.role)}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => {
                const written = row.cells.some((c) => c.trim());
                const aCount = Object.values(row.roles).filter((v) => v === "a").length;
                const needsOwner = written && aCount !== 1;
                const on = focusRow === row.id;
                return (
                  <tr key={row.id} className={on ? "on" : undefined}>
                    <td
                      className="no"
                      style={{
                        ...tblTd,
                        padding: "12px 0 0",
                        textAlign: "center",
                        position: "sticky",
                        left: 0,
                        zIndex: 1,
                        borderRight: `1px solid ${T.hair}`,
                      }}
                    >
                      <div
                        style={{
                          fontSize: 11,
                          letterSpacing: "0.02em",
                          fontVariantNumeric: "tabular-nums",
                          color: on ? T.ink : T.sub,
                          fontWeight: on ? 700 : 400,
                        }}
                      >
                        {i + 1}
                      </div>
                      {needsOwner && (
                        <div
                          title="責任者が1人に決まっていません"
                          style={{ width: 5, height: 5, borderRadius: "50%", background: T.warn, margin: "6px auto 0" }}
                        />
                      )}
                    </td>

                    {/* 自分たちで見出しをつけた5列 */}
                    {row.cells.map((cell, ci) => (
                      <td
                        key={ci}
                        style={{
                          ...tblTd,
                          paddingRight: ci === row.cells.length - 1 ? 14 : 5,
                          borderRight: ci === row.cells.length - 1 ? `1px solid ${T.block}` : undefined,
                        }}
                      >
                        <CellText
                          value={cell}
                          onChange={(v) =>
                            patchRow(row.id, { cells: row.cells.map((c, k) => (k === ci ? v : c)) }, false)
                          }
                          onFocus={() => startEdit(row.id)}
                          onBlur={() => flush(row.id)}
                          label={`${i + 1}行目の${columns[ci] || `${ci + 1}つめの列`}`}
                        />
                      </td>
                    ))}

                    {/* 役割（だれが・どう関わる） */}
                    {RACI_PEOPLE.map((p, pi) => {
                      const role = row.roles[p.id];
                      const ui = role ? ROLE_UI[role] : ROLE_NONE;
                      return (
                        <td
                          key={p.id}
                          style={{
                            ...tblTd,
                            padding: "6px 5px",
                            textAlign: "center",
                            verticalAlign: "middle",
                            borderRight: pi === RACI_PEOPLE.length - 1 ? undefined : `1px solid ${T.hair}`,
                          }}
                        >
                          <select
                            value={role ?? ""}
                            onChange={(e) => {
                              const next = { ...row.roles };
                              if (e.target.value) next[p.id] = e.target.value as RaciRole;
                              else delete next[p.id];
                              patchRow(row.id, { roles: next }, true);
                            }}
                            aria-label={`${i + 1}行目の${p.name}さんの役割`}
                            style={{
                              width: "100%",
                              // 既定の見た目を切らないと、Safariが背景と枠をまとめて無視する
                              appearance: "none",
                              WebkitAppearance: "none",
                              MozAppearance: "none",
                              fontSize: 11,
                              fontWeight: ui.weight,
                              letterSpacing: "0.02em",
                              color: ui.fg,
                              backgroundColor: ui.bg,
                              backgroundImage: chevron(ui.fg),
                              backgroundRepeat: "no-repeat",
                              backgroundPosition: "right 6px center",
                              backgroundSize: "7px 5px",
                              border: `1px solid ${ui.bd}`,
                              borderRadius: 3,
                              padding: "6px 16px 6px 8px",
                              cursor: "pointer",
                              outline: "none",
                              fontFamily: "inherit",
                              transition: "border-color .12s, box-shadow .12s",
                            }}
                          >
                            <option value="">—</option>
                            {raciDefs.map((d) => (
                              <option key={d.key} value={d.key}>
                                {d.short}
                              </option>
                            ))}
                          </select>
                        </td>
                      );
                    })}

                    <td
                      style={{
                        ...tblTd,
                        padding: "7px 3px",
                        textAlign: "center",
                        verticalAlign: "middle",
                        borderLeft: `1px solid ${T.hair}`,
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 2 }}>
                        {/* 行と行のあいだに足す。押した行の上に入る（末尾に足すのは上の「行を追加」）。 */}
                        <button
                          onClick={() => insertRowBefore(row.id)}
                          disabled={!loaded}
                          className="delbtn"
                          aria-label={`${i + 1}行目の上に行を足す`}
                          title="この行の上に行を足す"
                          style={{ ...rowIconBtn, fontSize: 12, cursor: loaded ? "pointer" : "default" }}
                        >
                          ＋
                        </button>
                        <button
                          onClick={() => removeRow(row)}
                          className="delbtn"
                          aria-label={`${i + 1}行目を消す`}
                          title="この行を消す"
                          style={{ ...rowIconBtn, fontSize: 13 }}
                        >
                          ×
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* 右にまだ表が続くときだけ、右端をぼかして先があることを示す */}
        {more && (
          <div
            aria-hidden
            style={{
              position: "absolute",
              top: 1,
              right: 1,
              bottom: 1,
              width: 28,
              pointerEvents: "none",
              borderRadius: "0 4px 4px 0",
              background: "linear-gradient(90deg, rgba(255,255,255,0), #ffffff)",
            }}
          />
        )}
      </div>
    </div>
  );
}
