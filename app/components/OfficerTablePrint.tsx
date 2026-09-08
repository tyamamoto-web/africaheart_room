"use client";

/* ============================================================
   役員専用2：この表を、打ち合わせで配れる紙（PDF）にする
   ------------------------------------------------------------
   なぜ画面をそのまま刷らず、別に組み直しているか：
     画面の表は「書きこむための道具」でできている。
     文字を打つ欄・役割のプルダウン・横スクロール・付いたり消えたりする罫。
     そのまま刷ると、欄からはみ出した文が切れ、プルダウンの三角だけが並び、
     右のほうの列が紙の外に出てしまう。
     紙に要るのは「いま入っている文字」だけなので、同じ中身から静かな表を組み直す。

   字を小さくしない（ここがいちばんの約束）：
     A4よこ・本文10.5pt を決め打ちにして、幅に収まらないぶんは縮めずに折り返す。
     列の幅は、その列にいま入っている文字の量で分ける。
     空の列に幅を取られないので、長い説明の列にそのぶんを回せる。
     ※ 空の列も細く残す。打ち合わせの場でその場で手書きできるようにするため。

   色は使わない：
     役割は「担当者・責任者・相談役・お知らせ」という言葉そのものを刷る。
     色や塗りに頼らないので、白黒のコピー機でも、
     ブラウザの「背景を印刷しない」設定でも、読めるものは同じ。
     区別は 枠・太さ だけでつける（枠と文字はどの設定でも必ず出る）。

   出す範囲：
     画面に出ている行を、画面と同じ番号のまま刷る。
     絞り込んでいるときは、何で絞ったかを紙の頭に書く（黙って抜けたと思われないように）。
   ============================================================ */

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { RACI_PEOPLE, type RaciRole } from "@/lib/officerRaci";
import { raciDefs, raciPersonSubLabel } from "@/lib/raciDefs";
import type { OfficerTableRow } from "@/lib/officerTable";

/* 紙の見た目。長さは mm と pt で書く（画面の拡大率や端末に左右されないように）。
   いちばん小さい字でも8.5pt までにとどめる。 */
const SHEET_CSS = `
#rtbl-print { display: none; }

@media print {
  @page { size: A4 landscape; margin: 11mm 10mm 12mm; }

  /* ほかを全部伏せて、この1枚だけを紙に出す */
  html, body {
    background: #ffffff !important;
    max-width: none !important;
    overflow: visible !important;
  }
  body > * { display: none !important; }
  body > #rtbl-print { display: block !important; }

  #rtbl-print {
    font-family: "Hiragino Sans", "Hiragino Kaku Gothic ProN", "Yu Gothic", "Noto Sans JP", sans-serif;
    color: #000000;
    line-height: 1.5;
  }

  /* 紙の頭 */
  #rtbl-print .head {
    display: flex; align-items: flex-end; justify-content: space-between; gap: 10mm;
    border-bottom: 1.2pt solid #000000;
    padding-bottom: 2.4mm; margin-bottom: 3.6mm;
  }
  #rtbl-print h1 { margin: 0; font-size: 15pt; font-weight: 700; letter-spacing: 0.05em; }
  #rtbl-print .lead { margin: 1.4mm 0 0; font-size: 9pt; letter-spacing: 0.02em; color: #333333; }
  #rtbl-print .meta { text-align: right; white-space: nowrap; font-size: 9pt; letter-spacing: 0.02em; color: #333333; }
  #rtbl-print .meta span { display: block; }
  #rtbl-print .meta .scope { margin-top: 0.8mm; font-weight: 700; color: #000000; }

  /* 表。画面では縦罫を引いていないが、紙では記入欄の下線が消えて列の切れ目が無くなるので、
     いちばん細い罫で列を分ける。見出しの下だけは太くして、表の背骨を残す。 */
  #rtbl-print table { width: 100%; border-collapse: collapse; table-layout: fixed; }
  #rtbl-print thead { display: table-header-group; }
  #rtbl-print tr { break-inside: avoid; page-break-inside: avoid; }
  #rtbl-print th, #rtbl-print td {
    border: 0.4pt solid #8c8880;
    padding: 1.7mm 2mm;
    vertical-align: top;
    text-align: left;
  }
  #rtbl-print thead th {
    font-size: 10pt; font-weight: 700; letter-spacing: 0.03em;
    vertical-align: bottom;
    border-bottom: 1pt solid #000000;
  }
  #rtbl-print th.group {
    text-align: center; font-size: 9pt;
    border-bottom: 0.4pt solid #8c8880;
  }
  #rtbl-print th.who { text-align: center; }
  #rtbl-print th.who .sb {
    display: block; margin-top: 0.7mm;
    font-size: 8pt; font-weight: 500; letter-spacing: 0.02em; color: #444444;
  }

  #rtbl-print th.noh, #rtbl-print td.no {
    text-align: center; padding-left: 0; padding-right: 0;
    font-size: 9.5pt; font-variant-numeric: tabular-nums;
  }
  /* 責任者がまだ1人に決まっていない行の印。画面の小さな点と同じもの。
     文字ではなく枠で描くのは、印刷設定で「背景を印刷しない」にしていても
     枠だけは必ず出るため（塗りだと消えてしまう）。 */
  #rtbl-print .mark {
    display: block; width: 1.4mm; height: 1.4mm; margin: 0.9mm auto 0;
    border: 0.5pt solid #000000; border-radius: 50%;
  }
  #rtbl-print .foot .mark { display: inline-block; margin: 0 1.2mm 0 0; vertical-align: middle; }

  /* 自分たちで見出しをつけた列。改行はそのまま、長い語も紙の中で折り返す */
  #rtbl-print td.cell {
    font-size: 10.5pt;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }

  /* 役割。塗らずに、枠と太さだけで重さの順をつける
     （責任者＝枠つき / 担当者＝太字 / 相談役＝ふつう / お知らせ＝うすい字） */
  #rtbl-print td.role { text-align: center; vertical-align: middle; font-size: 9.5pt; }
  #rtbl-print td.role .a {
    display: inline-block; padding: 0.4mm 1.4mm;
    border: 0.8pt solid #000000; border-radius: 0.6mm;
    font-weight: 700;
  }
  #rtbl-print td.role .r { font-weight: 700; }
  #rtbl-print td.role .i { color: #4a4a4a; }

  /* 紙の足。役割の言葉の意味と、この紙が「いつの写しか」 */
  #rtbl-print .legend { margin-top: 4.5mm; break-inside: avoid; page-break-inside: avoid; }
  #rtbl-print .legend h2 {
    margin: 0 0 1.8mm; font-size: 9pt; font-weight: 700; letter-spacing: 0.05em; color: #333333;
  }
  #rtbl-print .legend dl {
    display: grid; grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 1.4mm 8mm; margin: 0; font-size: 9pt;
  }
  #rtbl-print .legend .item { display: flex; gap: 2.5mm; }
  #rtbl-print .legend dt { flex: 0 0 15mm; font-weight: 700; }
  #rtbl-print .legend dd { margin: 0; color: #333333; }
  #rtbl-print .foot { margin-top: 3.2mm; font-size: 8.5pt; letter-spacing: 0.02em; color: #444444; }
}
`;

/* ── 列の幅 ────────────────────────────────────
   横一列を100として、No と 役割4人ぶんを先に取り、残りを自分たちの列で分ける。
   役割の列は「よしのすけ」の5文字が1行に収まる幅にしてある。 */
const NO_W = 3.4;
const WHO_W = 8.2;
const FREE_W = 100 - NO_W - WHO_W * RACI_PEOPLE.length;
/* 1列あたりの左右の余白（2mm+2mm）を、表の幅277mmに対する割合で表したもの。
   ここには文字が入らないので、幅を分ける前に全部の列へ先に配っておく。
   そうしないと、細い列ほど余白に食われて、字の入るところが極端に狭くなる。 */
const CELL_PAD = 1.45;

/** 全角を1、半角を0.55として、その文字列が横にどれだけ場所を取るかを数える。 */
function span(s: string): number {
  let n = 0;
  for (const ch of s) n += ch.charCodeAt(0) < 0x100 ? 0.55 : 1;
  return n;
}

/* 列の重み。その列でいちばん長い1行を目安にする。
   MIN  … 空の列にも残す幅（打ち合わせの場でその場で手書きするため）
   MAX  … 1つの長い行に、ほかの列の幅まで持っていかれないための頭打ち
   HEAD … 見出しのぶんの余裕。見出しは太字で刷るので、中身と同じ勘定だと折り返す。
          表の頭だけが2行になると、どこからが中身か分かりにくい。 */
const MIN_SPAN = 6;
const MAX_SPAN = 22;
const HEAD_EXTRA = 3.5;
function columnWeights(columns: string[], rows: OfficerTableRow[]): number[] {
  return columns.map((head, i) => {
    let longest = span(head) + HEAD_EXTRA;
    for (const r of rows) {
      for (const line of (r.cells[i] ?? "").split("\n")) longest = Math.max(longest, span(line));
    }
    return Math.min(MAX_SPAN, Math.max(MIN_SPAN, longest));
  });
}

/** 役割の説明は lib/raciDefs.ts のものを使う。紙の足には1文目だけを載せる。 */
function firstSentence(s: string): string {
  const i = s.indexOf("。");
  return i < 0 ? s : s.slice(0, i + 1);
}

const SHORT: Record<RaciRole, string> = {
  r: raciDefs.find((d) => d.key === "r")!.short,
  a: raciDefs.find((d) => d.key === "a")!.short,
  c: raciDefs.find((d) => d.key === "c")!.short,
  i: raciDefs.find((d) => d.key === "i")!.short,
};

/** 絞り込みの中身を「よしのすけ＝担当者・責任者／くる＝相談役」の形に書き出す。 */
function filterText(filters: Record<string, RaciRole[]>): string {
  return RACI_PEOPLE.filter((p) => (filters[p.id] ?? []).length > 0)
    .map((p) => `${p.name}＝${(filters[p.id] ?? []).map((r) => SHORT[r]).join("・")}`)
    .join("／");
}

type Job = { n: number; date: string; file: string };

export default function OfficerTablePrint({
  columns,
  view,
  total,
  filters,
  disabled,
  className,
  style,
}: {
  columns: string[];
  /** 画面に出ている行と、その番号（絞り込む前の通し番号） */
  view: { row: OfficerTableRow; no: number }[];
  /** 絞り込む前の全行数 */
  total: number;
  filters: Record<string, RaciRole[]>;
  disabled: boolean;
  className?: string;
  style?: React.CSSProperties;
}) {
  const [job, setJob] = useState<Job | null>(null);
  const done = useRef(0); // 刷り終えた回数。開発中に効果が2回走っても2枚出さないための目印
  const count = useRef(0);

  /* 押されたら、まず日付を決めて紙を組む（この時点ではまだ画面に出ない）。
     組み上がってから下の効果が印刷を呼ぶ。 */
  function start() {
    const d = new Date();
    const p2 = (n: number) => String(n).padStart(2, "0");
    count.current += 1;
    setJob({
      n: count.current,
      date: `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`,
      file: `アフリカハート_役割分担_${d.getFullYear()}${p2(d.getMonth() + 1)}${p2(d.getDate())}`,
    });
  }

  /* 紙が組み上がったあとに印刷を呼ぶ。
     題名を一時的に差し替えるのは、「PDFとして保存」を選んだときの
     ファイル名がこの題名になるため（そのままだと「アフリカハート」になる）。 */
  useEffect(() => {
    if (!job || done.current === job.n) return;
    done.current = job.n;

    const prevTitle = document.title;
    document.title = job.file;
    let closed = false;
    const finish = () => {
      if (closed) return;
      closed = true;
      document.title = prevTitle;
      setJob(null); // 紙を片づける
    };
    window.addEventListener("afterprint", finish);
    window.print();
    // afterprint を出さない環境のための保険
    const t = setTimeout(finish, 2000);
    return () => {
      clearTimeout(t);
      window.removeEventListener("afterprint", finish);
      document.title = prevTitle;
    };
  }, [job]);

  /* 紙の中身は、押したときだけ組む。
     この表は1文字打つたびに描き直されるので、ふだんから紙を持っていると、
     そのたびに全部の行の幅を数えなおすことになる。 */
  function sheet(j: Job) {
    const weights = columnWeights(columns, view.map((v) => v.row));
    const wSum = weights.reduce((a, b) => a + b, 0) || 1;
    const freeInner = FREE_W - CELL_PAD * columns.length; // 文字が入るぶんの合計
    const ft = filterText(filters);
    const anyMark = view.some(({ row }) => {
      const written = row.cells.some((c) => c.trim());
      return written && Object.values(row.roles).filter((v) => v === "a").length !== 1;
    });

    return (
      <div id="rtbl-print" aria-hidden>
        <style>{SHEET_CSS}</style>

        <div className="head">
          <div>
            <h1>オフ会運営の役割分担</h1>
            <p className="lead">やること1つずつに、だれがどう関わるかを決めた表です。</p>
          </div>
          <div className="meta">
            <span>アフリカハート　役員用</span>
            <span>{j.date} 現在</span>
            <span className="scope">
              {ft ? `絞り込み：${ft}（全${total}行のうち${view.length}行）` : `全${total}行`}
            </span>
          </div>
      </div>

      <table>
        <colgroup>
          <col style={{ width: `${NO_W}%` }} />
          {weights.map((w, i) => (
            <col
              key={i}
              style={{ width: `${(CELL_PAD + (w / wSum) * freeInner).toFixed(2)}%` }}
            />
          ))}
          {RACI_PEOPLE.map((p) => (
            <col key={p.id} style={{ width: `${WHO_W}%` }} />
          ))}
        </colgroup>
        <thead>
          <tr>
            <th className="noh" rowSpan={2}>
              No
            </th>
            {columns.map((label, i) => (
              <th key={i} rowSpan={2}>
                {label}
              </th>
            ))}
            <th className="group" colSpan={RACI_PEOPLE.length}>
              役割（だれが・どう関わる）
            </th>
          </tr>
          <tr>
            {RACI_PEOPLE.map((p) => (
              <th key={p.id} className="who">
                {p.name}
                <span className="sb">{raciPersonSubLabel(p.role)}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {view.map(({ row, no }) => {
            const written = row.cells.some((c) => c.trim());
            const aCount = Object.values(row.roles).filter((v) => v === "a").length;
            const needsOwner = written && aCount !== 1;
            return (
              <tr key={row.id}>
                <td className="no">
                  {no}
                  {needsOwner && <span className="mark" />}
                </td>
                {columns.map((_, ci) => (
                  <td key={ci} className="cell">
                    {row.cells[ci] ?? ""}
                  </td>
                ))}
                {RACI_PEOPLE.map((p) => {
                  const role = row.roles[p.id];
                  return (
                    <td key={p.id} className="role">
                      {role && <span className={role}>{SHORT[role]}</span>}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>

      <div className="legend">
        <h2>役割の意味</h2>
        <dl>
          {raciDefs.map((d) => (
            <div className="item" key={d.key}>
              <dt>{d.short}</dt>
              <dd>{firstSentence(d.hint)}</dd>
            </div>
          ))}
        </dl>
        {anyMark && (
          <p className="foot">
            <span className="mark" />
            責任者がまだ1人に決まっていない行です。
          </p>
        )}
        <p className="foot">
          この紙は、アプリの「役員専用2」を{j.date}時点で写したものです。
          決めたことをアプリに書き入れておくと、次に刷る紙にも残ります。
        </p>
      </div>
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={start}
        disabled={disabled}
        className={className}
        style={style}
        title="この表を打ち合わせ用に刷ります（印刷の画面で「PDFとして保存」も選べます）"
      >
        印刷・PDF
      </button>
      {job && createPortal(sheet(job), document.body)}
    </>
  );
}
