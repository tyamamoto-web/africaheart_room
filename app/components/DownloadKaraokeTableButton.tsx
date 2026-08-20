"use client";

import { useState } from "react";
import { karaokeRooms, nextEvent, type KaraokeRoomKey, type KaraokeSlot } from "@/lib/data";

/* ============================================================
   カラオケの部屋割り表を画像（PNG）で保存する
   ------------------------------------------------------------
   先月の「部屋割り表をダウンロード」（DownloadTableButton.tsx）と同じ作り。
     ・背景は透明、白いふちどり付きの濃い文字＝どんな背景に貼っても読める
     ・高解像度（画面の3〜4倍）。iPhoneは共有シート、だめなら長押し保存
     ・絵文字は入れない（アプリ全体の方針）
   中身は画面の表と同じ並び（左が時間と枠の名前、右がA室・B室）。
   当日の部屋番号が入っていれば、見出しに一緒に描く。
   ============================================================ */

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

// 絵文字・記号を除去（モノトーン維持のため）。uフラグを使わずサロゲートペアで対応
function stripEmoji(s: string): string {
  return s
    .replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, "") // 補助面の絵文字
    .replace(/[☀-➿←-⇿⬀-⯿︀-️‍™ℹ]/g, "") // BMPの記号
    .trim();
}

/** 行のあたまに来ると読みづらい文字（句読点・閉じ括弧・小さい仮名・長音）。 */
const NO_LINE_START = "、。，．,.）)｝}」』】〕〉》＞>’”！？!?：；:;・ー―ぁぃぅぇぉっゃゅょゎゕゖァィゥェォッャュョヮヵヶ";
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
          cur = test; // 行あたまに置けない文字は、そのまま今の行に押し込む
          continue;
        }
        // 直前が開き括弧なら、その括弧ごと次の行へ送る
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

/** カラオケの部屋割り表を高解像度・透明背景のPNGとして描画してダウンロード */
function buildAndDownload(roomNos: { A: string; B: string }) {
  const k = karaokeRooms;
  const ROOMS: KaraokeRoomKey[] = ["A", "B"];

  // ── レイアウト寸法（論理px）──
  const W = 860;
  const padX = 28;
  const titleH = 104;
  const headH = 64;
  const lineH = 38;
  const cellPadV = 18;
  const timeW = 210; // 枠の名前（「オープニング・お誕生日会」など）も入る幅
  const contentW = W - padX * 2 - timeW;
  const roomW = contentW / ROOMS.length;
  const x0 = padX;
  const x1 = x0 + timeW;
  const tableTop = titleH;
  const tableW = W - padX * 2;

  // 高さ計測用の一時コンテキスト
  const meas = document.createElement("canvas").getContext("2d")!;
  const labelFont = `700 15px ${FONT}`;
  const detailFont = `500 16px ${FONT}`;

  // 各行の中身をあらかじめ組み立てて、高さを出す
  const rows = k.slots.map((s: KaraokeSlot) => {
    const [start, end] = s.time.split("〜");
    meas.font = labelFont;
    const labelLines = wrapText(meas, stripEmoji(s.label), timeW - 24);
    const detail = s.detail ? stripEmoji(s.detail) : "";
    meas.font = detailFont;
    const detailLines = detail ? wrapText(meas, detail, contentW - 44) : [];

    // 時間の列：開始 / 〜終了 / 枠の名前
    const timeH = 24 + 20 + labelLines.length * 20;
    // 中身の列：2部屋に分かれる枠は名前の数、集まる枠は1行＋補足
    const contentH = s.rooms
      ? s.rooms.reduce((mx, r) => Math.max(mx, r.members.length), 0) * lineH + 24
      : 28 + (detailLines.length ? 10 + detailLines.length * 22 : 0);

    return {
      start,
      end,
      labelLines,
      detailLines,
      rooms: s.rooms ?? null,
      height: Math.max(76, Math.max(timeH, contentH) + cellPadV * 2),
    };
  });

  const tableH = headH + rows.reduce((a, b) => a + b.height, 0);
  const H = titleH + tableH + padX;

  const isIOS =
    /iP(hone|ad|od)/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

  // ── 高解像度キャンバス（iOSは描画上限対策で3倍に抑制）──
  // 表が縦に長いので、端末の描画上限に当たらないよう面積で頭打ちにする
  let scale = isIOS ? 3 : Math.min(4, Math.max(3, Math.ceil((window.devicePixelRatio || 1) * 1.5)));
  while (scale > 1 && W * scale * H * scale > 16_000_000) scale -= 1;

  const canvas = document.createElement("canvas");
  canvas.width = Math.round(W * scale);
  canvas.height = Math.round(H * scale);
  const ctx = canvas.getContext("2d")!;
  ctx.scale(scale, scale);
  ctx.textBaseline = "middle";

  // モノトーン配色
  const INK = "#222222";
  const SUB = "#7a7a7a";
  const LINE = "#c9c7c2";
  const LINE_STRONG = "#5e5c58";
  const HALO = "rgba(255,255,255,0.95)";
  const ALL_FILL = "rgba(0,0,0,0.035)"; // 全員で集まる枠のうすい下地

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

  // ── タイトル ──
  haloText(k.title, W / 2, 34, `800 30px ${FONT}`, INK);
  haloText(`アフリカハート　${nextEvent.title}`, W / 2, 64, `600 17px ${FONT}`, SUB);
  haloText(`${nextEvent.date}　${k.time}　${k.place}`, W / 2, 88, `600 15px ${FONT}`, SUB);

  // ── 外枠 ──
  ctx.save();
  ctx.strokeStyle = LINE_STRONG;
  ctx.lineWidth = 2;
  roundRect(ctx, x0, tableTop, tableW, tableH, 18);
  ctx.stroke();
  ctx.restore();

  // ── ヘッダー行（部屋番号が入っていれば添える）──
  haloText("時間", x0 + timeW / 2, tableTop + headH / 2, `800 19px ${FONT}`, INK);
  ROOMS.forEach((r, i) => {
    const cx = x1 + roomW * i + roomW / 2;
    const no = roomNos[r].trim();
    if (no) {
      haloText(`${r}室`, cx, tableTop + headH / 2 - 11, `800 19px ${FONT}`, INK);
      haloText(no, cx, tableTop + headH / 2 + 12, `700 15px ${FONT}`, SUB);
    } else {
      haloText(`${r}室`, cx, tableTop + headH / 2, `800 19px ${FONT}`, INK);
    }
  });

  // ヘッダー下の区切り線
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
  rows.forEach((row, idx) => {
    const rh = row.height;
    const mid = y + rh / 2;

    // 全員で集まる枠は、うすい下地を敷いて2部屋の枠と見分けられるようにする
    if (!row.rooms) {
      ctx.save();
      ctx.fillStyle = ALL_FILL;
      ctx.fillRect(x0 + 1, y, tableW - 2, rh);
      ctx.restore();
    }

    // 行下の区切り線（最終行以外）
    if (idx < rows.length - 1) {
      ctx.save();
      ctx.strokeStyle = LINE;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x0, y + rh);
      ctx.lineTo(x0 + tableW, y + rh);
      ctx.stroke();
      ctx.restore();
    }

    // 時間の列：開始 / 〜終了 / 枠の名前
    {
      const cx = x0 + timeW / 2;
      const blockH = 24 + 20 + row.labelLines.length * 20;
      let ty = mid - blockH / 2 + 12;
      haloText(row.start, cx, ty, `800 20px ${FONT}`, INK);
      ty += 22;
      haloText("〜" + row.end, cx, ty, `600 15px ${FONT}`, SUB);
      ty += 20;
      for (const ln of row.labelLines) {
        haloText(ln, cx, ty, labelFont, INK);
        ty += 20;
      }
    }

    if (row.rooms) {
      // 2部屋に分かれる枠：部屋ごとに名前と人数
      row.rooms.forEach((r, i) => {
        const cx = x1 + roomW * i + roomW / 2;
        const blockH = r.members.length * lineH + 24;
        let ny = mid - blockH / 2 + lineH / 2;
        for (const m of r.members) {
          haloText(m, cx, ny, `600 21px ${FONT}`, INK);
          ny += lineH;
        }
        haloText(`${r.members.length}名`, cx, ny + 2, `700 14px ${FONT}`, SUB);
      });

      // 部屋のあいだの縦区切り線（この行のみ）
      ctx.save();
      ctx.strokeStyle = LINE;
      ctx.lineWidth = 1;
      for (let i = 1; i < ROOMS.length; i++) {
        const cx = x1 + roomW * i;
        ctx.beginPath();
        ctx.moveTo(cx, y + 8);
        ctx.lineTo(cx, y + rh - 8);
        ctx.stroke();
      }
      ctx.restore();
    } else {
      // 全員で集まる枠：部屋の列をつないで1つに
      const ccx = x1 + contentW / 2;
      const blockH = 28 + (row.detailLines.length ? 10 + row.detailLines.length * 22 : 0);
      let cy = mid - blockH / 2 + 14;
      haloText(`全員（${k.attendees.length}名）で${k.allRoom}室`, ccx, cy, `800 21px ${FONT}`, INK);
      cy += 24;
      for (const ln of row.detailLines) {
        cy += 22;
        haloText(ln, ccx, cy - 11, detailFont, SUB);
      }
    }

    y += rh;
  });

  // 時間列の縦区切り線（全高）
  ctx.save();
  ctx.strokeStyle = LINE_STRONG;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(x1, tableTop + 10);
  ctx.lineTo(x1, tableTop + tableH - 10);
  ctx.stroke();
  ctx.restore();

  // ── PNG 出力 & 保存 ──
  // toBlob は非同期でタップ操作の文脈が切れ iOS で共有/保存がブロックされるため、
  // 同期的な toDataURL を使ってユーザー操作の流れの中で保存処理を行う。
  const fileName = "africaheart_カラオケ部屋割り表.png";
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

  // iOS（モバイル）: 共有シート経由で「画像を保存」
  if (isIOS && file && nav.canShare && nav.canShare({ files: [file] }) && nav.share) {
    nav.share({ files: [file], title: k.title }).catch(() => {
      showImageOverlay(dataUrl); // キャンセル以外の失敗時は長押し保存にフォールバック
    });
    return;
  }

  // iOS で共有が使えない場合: 画像を全画面表示し長押しで保存
  if (isIOS) {
    showImageOverlay(dataUrl);
    return;
  }

  // PC・Android: 通常ダウンロード
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

// iOS フォールバック: 画像を全画面表示（長押しで「写真に追加」）
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

export default function DownloadKaraokeTableButton({
  roomNos,
}: {
  roomNos: { A: string; B: string };
}) {
  const [busy, setBusy] = useState(false);
  return (
    <div className="mt-2.5">
      <button
        type="button"
        onClick={() => {
          if (busy) return;
          setBusy(true);
          try {
            buildAndDownload(roomNos);
          } finally {
            setTimeout(() => setBusy(false), 600);
          }
        }}
        className="w-full rounded-lg py-2 text-[12px] font-black transition-all active:scale-[0.99]"
        style={{
          background: "linear-gradient(135deg,#F5C542,#E39A2E)",
          color: "#2a2000",
          opacity: busy ? 0.6 : 1,
        }}
      >
        {busy ? "作成中…" : "部屋割り表を画像で保存"}
      </button>
      <p className="mt-1 text-center text-[10px]" style={{ color: "#98a4c0" }}>
        背景透明・高解像度。iPhoneは共有シートから「画像を保存」
      </p>
    </div>
  );
}
