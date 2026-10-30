"use client";

/* ============================================================
   当日の部屋割り表を画像（PNG）で保存する
   ------------------------------------------------------------
   8/20 まで使っていた「部屋割り表をダウンロード」
   （app/components/DownloadKaraokeTableButton.tsx）と同じ作り。
     ・背景は透明、白いふちどり付きの濃い文字＝どんな背景に貼っても読める
     ・高解像度（画面の3〜4倍）。iPhoneは共有シート、だめなら長押し保存
     ・絵文字は入れない（アプリ全体の方針）
   前の画面は lib/data.ts に直書きした表を描いていたので、
   当日の部屋割りが役員の手入力（lib/timetable.ts）に変わったときに出なくなった。
   こちらは画面に出ている表（PlanRow）をそのまま描くので、入れ替えても付いてくる。

   表の組み方は画面の表（app/components/PlanTable.tsx）にそろえてある。
     列は 時間｜部屋｜企画｜名前。
     同じ時間の行が続いていれば、時間のマスはつないで1つにする。
     その中で企画も同じなら、企画のマスもつなぐ。
     名前が空の行は「全員（◯名）」として、名前の列いっぱいに出す。
   ============================================================ */

import { useState } from "react";
import type { PlanRow } from "@/lib/timetable";

const FONT = '"Hiragino Sans","Hiragino Kaku Gothic ProN","Noto Sans JP","Yu Gothic",sans-serif';

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// 絵文字・記号を除去（モノトーンを保つため）。uフラグを使わずサロゲートペアで対応
function stripEmoji(s: string): string {
  return s
    .replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, "")
    .replace(/[☀-➿←-⇿⬀-⯿︀-️‍™ℹ]/g, "")
    .trim();
}

/** 行のあたまに来ると読みづらい文字（句読点・閉じ括弧・小さい仮名・長音）。 */
const NO_LINE_START =
  "、。，．,.）)｝}」』】〕〉》＞>’”！？!?：；:;・ー―ぁぃぅぇぉっゃゅょゎゕゖァィゥェォッャュョヮヵヶ";
/** 行のおしりに来ると読みづらい文字（開き括弧）。 */
const NO_LINE_END = "（(｛{「『【〔〈《＜<‘“";

// 日本語向け：改行(\n)を尊重しつつ幅に合わせて文字単位で折り返す。
// 「、」や「）」が行あたまに落ちないよう、その1文字ぶんだけはみ出させる（簡易の禁則処理）。
function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  for (const segment of text.split("\n")) {
    let cur = "";
    for (const ch of segment) {
      const test = cur + ch;
      if (ctx.measureText(test).width > maxWidth && cur) {
        if (NO_LINE_START.includes(ch)) {
          cur = test;
          continue;
        }
        const last = cur[cur.length - 1];
        if (NO_LINE_END.includes(last) && cur.length > 1) {
          lines.push(cur.slice(0, -1));
          cur = last + ch;
          continue;
        }
        lines.push(cur);
        cur = ch;
      } else {
        cur = test;
      }
    }
    lines.push(cur);
  }
  return lines.length ? lines : [""];
}

/**
 * 名前の列は、名前の切れ目（「・」）でだけ折る。
 * 1文字ずつ折ると「あいう」「えお」のように呼び名が途中で割れて読みにくい。
 * 1つで幅に入りきらない長い名前だけは、やむをえず文字で折る。
 */
function wrapJoined(ctx: CanvasRenderingContext2D, parts: string[], maxWidth: number): string[] {
  const lines: string[] = [];
  let cur = "";
  for (const raw of parts) {
    const part = raw.trim();
    if (!part) continue;
    const test = cur ? `${cur}・${part}` : part;
    if (ctx.measureText(test).width <= maxWidth || !cur) {
      cur = test;
      continue;
    }
    lines.push(`${cur}・`); // 続きがあることが分かるよう、中黒は行の終わりに残す
    cur = part;
  }
  if (cur) lines.push(cur);
  // 1つで入りきらない名前は、ここで文字ごとに折る
  const out: string[] = [];
  for (const ln of lines) {
    if (ctx.measureText(ln).width <= maxWidth) out.push(ln);
    else out.push(...wrapText(ctx, ln, maxWidth));
  }
  return out.length ? out : [""];
}

/** 「13:20〜14:20」を開始と終了に分ける。区切りが無ければ全部を開始として出す。 */
function splitTime(time: string): [string, string] {
  const m = time.split(/〜|~|－|–|-/);
  return [(m[0] ?? "").trim(), (m[1] ?? "").trim()];
}

/* 何行ぶんをつないで描くか。0 は「上の行がまとめて描いているので、この行では描かない」。
   app/components/PlanTable.tsx の spansOf と同じ決め方（画面と印刷でずれないように）。 */
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

export type PlanHeading = {
  /** 大きく出す見出し。例「カラオケオフ会 部屋割り」 */
  title: string;
  /** その下の1行。例「2026年10月31日（土）　12:00 〜 20:00」 */
  when: string;
  /** さらにその下の1行。例「カラオケ館 松本中央店」。無ければ出さない */
  place: string;
};

function buildAndDownload(
  rows: PlanRow[],
  total: number,
  heading: PlanHeading,
  peopleFor?: (r: PlanRow, index: number) => string[]
): void {
  // ── レイアウト寸法（論理px）──
  const W = 900;
  const padX = 28;
  const titleH = heading.place ? 112 : 88;
  const headH = 46;
  const cellPadV = 14;
  const tableW = W - padX * 2;
  const colW = [168, 104, 198, tableW - 168 - 104 - 198]; // 時間・部屋・企画・名前
  const x0 = padX;
  const colX = [x0, x0 + colW[0], x0 + colW[0] + colW[1], x0 + colW[0] + colW[1] + colW[2]];
  const tableTop = titleH;

  const meas = document.createElement("canvas").getContext("2d");
  if (!meas) return;
  const titleFont = `700 17px ${FONT}`;
  const nameFont = `600 19px ${FONT}`;
  const noteFont = `500 14px ${FONT}`;

  const spans = spansOf(rows);

  // 各行の中身をあらかじめ組み立てて、高さを出す
  const built = rows.map((r, i) => {
    const [start, end] = splitTime(r.time);
    meas.font = titleFont;
    const titleLines = wrapText(meas, stripEmoji(r.title), colW[2] - 20);
    const all = r.names.length === 0;
    // 全員の行は、その時間にいる人が分かればその名前を描く（分からなければ「全員（◯名）」）
    const shown = all ? peopleFor?.(r, i) ?? [] : r.names;
    meas.font = nameFont;
    const nameLines = shown.length
      ? wrapJoined(meas, shown.map(stripEmoji), colW[3] - 20)
      : [total > 0 ? `全員（${total}名）` : "全員"];
    meas.font = noteFont;
    const noteLines = r.note ? wrapText(meas, stripEmoji(r.note), tableW - 40) : [];

    const nameBlock = nameLines.length * 25 + (shown.length ? 20 : 0); // 人数の1行ぶん
    const titleBlock = spans[i].title > 0 ? titleLines.length * 23 : 0;
    const noteBlock = noteLines.length ? 8 + noteLines.length * 19 : 0;
    return {
      row: r,
      start,
      end,
      all,
      shown,
      titleLines,
      nameLines,
      noteLines,
      height: Math.max(62, Math.max(nameBlock, titleBlock, 48) + cellPadV * 2 + noteBlock),
    };
  });

  const tableH = headH + built.reduce((a, b) => a + b.height, 0);
  const H = titleH + tableH + padX;

  const isIOS =
    /iP(hone|ad|od)/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

  // ── 高解像度キャンバス（iOSは描画上限対策で3倍に抑制）──
  let scale = isIOS ? 3 : Math.min(4, Math.max(3, Math.ceil((window.devicePixelRatio || 1) * 1.5)));
  while (scale > 1 && W * scale * H * scale > 16_000_000) scale -= 1;

  const canvas = document.createElement("canvas");
  canvas.width = Math.round(W * scale);
  canvas.height = Math.round(H * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.scale(scale, scale);
  ctx.textBaseline = "middle";

  // モノトーン配色（どんな背景に貼っても読めるように、白いふちどりを足す）
  const INK = "#222222";
  const SUB = "#7a7a7a";
  const LINE = "#c9c7c2";
  const LINE_STRONG = "#5e5c58";
  const HALO = "rgba(255,255,255,0.95)";
  const ALL_FILL = "rgba(0,0,0,0.035)";

  const haloText = (
    text: string,
    x: number,
    y: number,
    font: string,
    color: string,
    align: CanvasTextAlign = "center"
  ) => {
    ctx.save();
    ctx.shadowColor = HALO;
    ctx.shadowBlur = 5;
    ctx.textAlign = align;
    ctx.fillStyle = color;
    ctx.font = font;
    ctx.fillText(text, x, y);
    ctx.restore();
  };

  // ── 見出し ──
  haloText(stripEmoji(heading.title), W / 2, 32, `800 28px ${FONT}`, INK);
  haloText(stripEmoji(heading.when), W / 2, 64, `600 17px ${FONT}`, SUB);
  if (heading.place) haloText(stripEmoji(heading.place), W / 2, 90, `600 15px ${FONT}`, SUB);

  // ── 外枠 ──
  ctx.save();
  ctx.strokeStyle = LINE_STRONG;
  ctx.lineWidth = 2;
  roundRect(ctx, x0, tableTop, tableW, tableH, 16);
  ctx.stroke();
  ctx.restore();

  // ── 見出しの行 ──
  ["時間", "部屋", "企画", "名前"].forEach((label, i) => {
    haloText(label, colX[i] + colW[i] / 2, tableTop + headH / 2, `800 15px ${FONT}`, SUB);
  });
  ctx.save();
  ctx.strokeStyle = LINE_STRONG;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x0, tableTop + headH);
  ctx.lineTo(x0 + tableW, tableTop + headH);
  ctx.stroke();
  ctx.restore();

  // ── 各行 ──
  let y = tableTop + headH;
  built.forEach((b, idx) => {
    const rh = b.height;
    const noteH = b.noteLines.length ? 8 + b.noteLines.length * 19 : 0;
    const bodyH = rh - noteH;
    const mid = y + bodyH / 2;

    // 全員で集まる行は、うすい下地を敷いて2部屋の行と見分けられるようにする
    if (b.all) {
      ctx.save();
      ctx.fillStyle = ALL_FILL;
      ctx.fillRect(x0 + 1, y, tableW - 2, rh);
      ctx.restore();
    }

    // 行のあいだの横線（いちばん下は外枠にまかせる）
    if (idx < built.length - 1) {
      ctx.save();
      ctx.strokeStyle = LINE;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x0, y + rh);
      ctx.lineTo(x0 + tableW, y + rh);
      ctx.stroke();
      ctx.restore();
    }

    // 時間（つないだ行のいちばん上だけ描く。高さはつないだぶん全部）
    if (spans[idx].time > 0) {
      let spanH = 0;
      for (let k = idx; k < idx + spans[idx].time; k++) spanH += built[k].height;
      const cy = y + spanH / 2;
      const cx = colX[0] + colW[0] / 2;
      if (b.end) {
        haloText(b.start, cx, cy - 11, `800 19px ${FONT}`, INK);
        haloText(`〜${b.end}`, cx, cy + 12, `600 14px ${FONT}`, SUB);
      } else if (b.start) {
        haloText(b.start, cx, cy, `800 19px ${FONT}`, INK);
      }
    }

    // 部屋（呼び名と、当日の番号）
    {
      const cx = colX[1] + colW[1] / 2;
      const no = (b.row.roomNo ?? "").trim();
      if (no) {
        haloText(b.row.room, cx, mid - 10, `800 18px ${FONT}`, INK);
        haloText(no, cx, mid + 12, `700 14px ${FONT}`, SUB);
      } else if (b.row.room) {
        haloText(b.row.room, cx, mid, `800 18px ${FONT}`, INK);
      }
    }

    // 企画（つないだ行のいちばん上だけ描く）
    if (spans[idx].title > 0 && b.row.title.trim()) {
      let spanH = 0;
      for (let k = idx; k < idx + spans[idx].title; k++) spanH += built[k].height;
      const cx = colX[2] + colW[2] / 2;
      let ty = y + spanH / 2 - ((b.titleLines.length - 1) * 23) / 2;
      for (const ln of b.titleLines) {
        haloText(ln, cx, ty, titleFont, INK);
        ty += 23;
      }
    }

    // 名前（全員の行は「全員（◯名）」、分かれる行は名前と人数）
    {
      const cx = colX[3] + colW[3] / 2;
      const block = b.nameLines.length * 25 + (b.shown.length ? 20 : 0);
      let ny = mid - block / 2 + 12;
      for (const ln of b.nameLines) {
        // 名前を1つも出せない「全員」の行だけ、大きめの字で1行だけ描く
        haloText(ln, cx, ny, b.shown.length === 0 ? `800 20px ${FONT}` : nameFont, INK);
        ny += 25;
      }
      if (b.shown.length) {
        haloText(
          b.all ? `全員（${b.shown.length}名）` : `${b.shown.length}名`,
          cx,
          ny + 2,
          `700 13px ${FONT}`,
          SUB
        );
      }
    }

    // 行に付いた補足は、その行の下に横いっぱいで小さく
    if (b.noteLines.length) {
      let ny = y + bodyH + 8;
      for (const ln of b.noteLines) {
        haloText(ln, x0 + 20, ny, noteFont, SUB, "left");
        ny += 19;
      }
    }

    y += rh;
  });

  // 列のあいだの縦線（表の高さいっぱい）
  ctx.save();
  ctx.strokeStyle = LINE;
  ctx.lineWidth = 1;
  for (let i = 1; i < colX.length; i++) {
    ctx.beginPath();
    ctx.moveTo(colX[i], tableTop + 8);
    ctx.lineTo(colX[i], tableTop + tableH - 8);
    ctx.stroke();
  }
  ctx.restore();

  // ── PNG 出力 & 保存 ──
  // toBlob は非同期でタップ操作の文脈が切れ iOS で共有や保存が止められるため、
  // 同期の toDataURL を使って、押した流れの中で保存まで済ませる。
  const fileName = "africaheart_部屋割り表.png";
  const dataUrl = canvas.toDataURL("image/png");
  const blob = dataUrlToBlob(dataUrl);

  const nav = navigator as Navigator & {
    canShare?: (d: { files: File[] }) => boolean;
    share?: (d: { files: File[]; title?: string }) => Promise<void>;
  };

  let file: File | null = null;
  try {
    file = new File([blob], fileName, { type: "image/png" });
  } catch {
    file = null;
  }

  // iPhone・iPad: 共有シートから「画像を保存」
  if (isIOS && file && nav.canShare && nav.canShare({ files: [file] }) && nav.share) {
    nav.share({ files: [file], title: heading.title }).catch(() => {
      showImageOverlay(dataUrl); // 取り消し以外で失敗したら、長押し保存に回す
    });
    return;
  }
  if (isIOS) {
    showImageOverlay(dataUrl);
    return;
  }

  // パソコン・Android: ふつうのダウンロード
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

// dataURL → Blob（同期）
function dataUrlToBlob(dataUrl: string): Blob {
  const [head, b64] = dataUrl.split(",");
  const mime = (head.match(/:(.*?);/) || [])[1] || "image/png";
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

// iPhone で共有が使えないときの逃げ道: 画像を全画面に出す（長押しで「写真に追加」）
function showImageOverlay(dataUrl: string): void {
  const ov = document.createElement("div");
  ov.style.cssText =
    "position:fixed;inset:0;z-index:2147483647;background:rgba(0,0,0,0.92);display:flex;flex-direction:column;align-items:center;justify-content:center;padding:20px;gap:14px;overflow:auto;";
  const tip = document.createElement("p");
  tip.textContent = "画像を長押しして「写真に追加」で保存できます";
  tip.style.cssText = "color:#fff;font-size:14px;font-weight:700;text-align:center;margin:0;";
  const img = document.createElement("img");
  img.src = dataUrl;
  img.style.cssText = "max-width:100%;height:auto;border-radius:8px;background:#fff;";
  const close = document.createElement("button");
  close.textContent = "閉じる";
  close.style.cssText =
    "margin-top:6px;padding:10px 28px;border:none;border-radius:9999px;background:#fff;color:#222;font-size:14px;font-weight:700;";
  close.onclick = () => ov.remove();
  ov.appendChild(tip);
  ov.appendChild(img);
  ov.appendChild(close);
  ov.addEventListener("click", (e) => {
    if (e.target === ov) ov.remove();
  });
  document.body.appendChild(ov);
}

export default function DownloadPlanButton({
  rows,
  total,
  heading,
  peopleFor,
}: {
  rows: PlanRow[];
  /** 全員の人数。「全員（13名）」と出すのに使う。0なら人数は出さない */
  total: number;
  heading: PlanHeading;
  /** 「全員」の行に名前を描くために渡す。画面の表（PlanTable）と同じものを渡すこと。 */
  peopleFor?: (r: PlanRow, index: number) => string[];
}) {
  const [busy, setBusy] = useState(false);
  // 中身の無い表を画像にしても意味がないので、1行でも入っていなければ出さない
  const has = rows.some((r) => r.time.trim() || r.room.trim() || r.title.trim() || r.names.length > 0);
  if (!has) return null;

  return (
    <div style={{ marginTop: 14 }}>
      <button
        type="button"
        className="md-edit"
        onClick={() => {
          if (busy) return;
          setBusy(true);
          try {
            buildAndDownload(rows, total, heading, peopleFor);
          } finally {
            setTimeout(() => setBusy(false), 600);
          }
        }}
        style={{ opacity: busy ? 0.6 : 1 }}
      >
        {busy ? "作成中" : "画像で保存"}
      </button>
    </div>
  );
}
