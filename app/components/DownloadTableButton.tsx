"use client";

import { useState } from "react";
import { timeSlots, eventInfo } from "@/lib/data";
import { getMembers } from "@/lib/memberStore";
import { getEventSetup } from "@/lib/eventStore";
import type { Member } from "@/lib/data";
import type { RoomKey } from "@/lib/eventStore";

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

// 日本語向け：改行(\n)を尊重しつつ幅に合わせて文字単位で折り返し
function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  for (const segment of text.split("\n")) {
    let cur = "";
    for (const ch of segment) {
      const test = cur + ch;
      if (ctx.measureText(test).width > maxWidth && cur) {
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

type Row =
  | { kind: "rotation"; start: string; end: string; rooms: Record<RoomKey, Member[]> }
  | { kind: "event"; start: string; end: string; label: string; detail: string };

/** 全タイムテーブル（コマ＋イベント）を高解像度・透明背景のPNGとして描画してダウンロード */
function buildAndDownload() {
  const members = getMembers();
  const setup = getEventSetup();
  const attending = new Set(setup.attendanceIds);

  // 全スロットを行データへ変換
  const rows: Row[] = timeSlots.map((slot) => {
    if (slot.type === "rotation") {
      const assign = setup.rotations[slot.id] ?? {};
      const r: Record<RoomKey, Member[]> = { A: [], B: [], C: [] };
      for (const m of members) {
        if (!attending.has(m.id)) continue;
        const k = assign[m.id];
        if (k === "A" || k === "B" || k === "C") r[k].push(m);
      }
      return { kind: "rotation", start: slot.startTime, end: slot.endTime, rooms: r };
    }
    return {
      kind: "event",
      start: slot.startTime,
      end: slot.endTime,
      label: stripEmoji(slot.label),
      detail: slot.detail ? stripEmoji(slot.detail) : "",
    };
  });

  const usedRooms = (["A", "B", "C"] as const).filter((r) =>
    rows.some((row) => row.kind === "rotation" && row.rooms[r].length > 0)
  );

  // ── レイアウト寸法（論理px）──
  const W = 860;
  const padX = 28;
  const titleH = 88;
  const headH = 56;
  const lineH = 40;
  const cellPadV = 20;
  const timeW = 178;
  const contentW = W - padX * 2 - timeW; // 右側（部屋 or イベント）全体幅
  const roomW = contentW / usedRooms.length;
  const x0 = padX;
  const x1 = x0 + timeW;
  const tableTop = titleH;
  const tableW = W - padX * 2;

  // 高さ計測用の一時コンテキスト
  const meas = document.createElement("canvas").getContext("2d")!;
  const eventDetailFont = `500 16px ${FONT}`;

  // 各行の高さを算出
  const rowHeights = rows.map((row) => {
    if (row.kind === "rotation") {
      const maxN = Math.max(1, ...usedRooms.map((r) => row.rooms[r].length));
      return maxN * lineH + cellPadV * 2;
    }
    // event
    let h = cellPadV * 2 + 28; // ラベル
    if (row.detail) {
      meas.font = eventDetailFont;
      const lines = wrapText(meas, row.detail, contentW - 36);
      h += 6 + lines.length * 22;
    }
    return Math.max(72, h);
  });

  const tableH = headH + rowHeights.reduce((a, b) => a + b, 0);
  const H = titleH + tableH + padX;

  const isIOS =
    /iP(hone|ad|od)/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

  // ── 高解像度キャンバス（iOSは描画上限対策で3倍に抑制）──
  const scale = isIOS ? 3 : Math.min(4, Math.max(3, Math.ceil((window.devicePixelRatio || 1) * 1.5)));
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

  // 時間（2行：start / 〜end）を縦中央に描画
  const drawTime = (cx: number, mid: number, start: string, end: string) => {
    haloText(start, cx, mid - 11, `800 20px ${FONT}`, INK);
    haloText("〜" + end, cx, mid + 12, `600 15px ${FONT}`, SUB);
  };

  // ── タイトル ──
  haloText("部屋割り表", W / 2, 34, `800 30px ${FONT}`, INK);
  haloText(`${eventInfo.title}　${eventInfo.date}`, W / 2, 64, `600 17px ${FONT}`, SUB);

  // ── 外枠 ──
  ctx.save();
  ctx.strokeStyle = LINE_STRONG;
  ctx.lineWidth = 2;
  roundRect(ctx, x0, tableTop, tableW, tableH, 18);
  ctx.stroke();
  ctx.restore();

  // ── ヘッダー行 ──
  haloText("時間", x0 + timeW / 2, tableTop + headH / 2, `800 19px ${FONT}`, INK);
  usedRooms.forEach((r, i) => {
    const cx = x1 + roomW * i + roomW / 2;
    haloText(`${r}ルーム`, cx, tableTop + headH / 2, `800 19px ${FONT}`, INK);
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
    const rh = rowHeights[idx];
    const mid = y + rh / 2;

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

    // 時間
    drawTime(x0 + timeW / 2, mid, row.start, row.end);

    if (row.kind === "rotation") {
      // 部屋ごとのメンバー名
      usedRooms.forEach((r, i) => {
        const cx = x1 + roomW * i + roomW / 2;
        const names = row.rooms[r];
        const blockH = names.length * lineH;
        let ny = mid - blockH / 2 + lineH / 2;
        if (names.length === 0) {
          haloText("—", cx, mid, `600 21px ${FONT}`, "#bdbbb6");
        }
        for (const m of names) {
          haloText(m.nickname, cx, ny, `600 21px ${FONT}`, INK);
          ny += lineH;
        }
      });

      // 部屋間の縦区切り線（この行のみ）
      ctx.save();
      ctx.strokeStyle = LINE;
      ctx.lineWidth = 1;
      for (let i = 1; i < usedRooms.length; i++) {
        const cx = x1 + roomW * i;
        ctx.beginPath();
        ctx.moveTo(cx, y + 8);
        ctx.lineTo(cx, y + rh - 8);
        ctx.stroke();
      }
      ctx.restore();
    } else {
      // イベント：内容を横いっぱいに表示
      const ccx = x1 + contentW / 2;
      if (row.detail) {
        meas.font = eventDetailFont;
        const lines = wrapText(meas, row.detail, contentW - 36);
        const labelY = mid - (6 + lines.length * 22) / 2;
        haloText(row.label, ccx, labelY, `800 21px ${FONT}`, INK);
        let dy = labelY + 18 + 11;
        for (const ln of lines) {
          haloText(ln, ccx, dy, eventDetailFont, SUB);
          dy += 22;
        }
      } else {
        haloText(row.label, ccx, mid, `800 21px ${FONT}`, INK);
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

  // iOS（モバイル）: 共有シート経由で「画像を保存」
  if (isIOS && file && nav.canShare && nav.canShare({ files: [file] }) && nav.share) {
    nav.share({ files: [file], title: "部屋割り表" }).catch(() => {
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

export default function DownloadTableButton() {
  const [busy, setBusy] = useState(false);
  return (
    <div className="max-w-lg mx-auto mb-4">
      <button
        onClick={() => {
          if (busy) return;
          setBusy(true);
          try {
            buildAndDownload();
          } finally {
            setTimeout(() => setBusy(false), 600);
          }
        }}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-bold transition-all active:scale-[0.98]"
        style={{
          background: "linear-gradient(135deg,#3a3a3a,#5e5c58)",
          color: "#fff",
          boxShadow: "0 3px 12px rgba(0,0,0,0.18)",
          opacity: busy ? 0.6 : 1,
        }}
      >
        {busy ? "作成中…" : "部屋割り表をダウンロード"}
      </button>
      <p className="text-[11px] text-center mt-1.5" style={{ color: "#aaa" }}>
        チラシ用・背景透明／高解像度。iPhoneは開いた画像を長押しで保存
      </p>
    </div>
  );
}
