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

/** 部屋割り表（4コマ）を高解像度・透明背景のPNGとして描画してダウンロード */
function buildAndDownload() {
  const members = getMembers();
  const setup = getEventSetup();
  const attending = new Set(setup.attendanceIds);

  const rotationSlots = timeSlots.filter((s) => s.type === "rotation");

  // 各コマの A/B/C グループを算出
  type SlotData = { start: string; end: string; rooms: Record<RoomKey, Member[]> };
  const data: SlotData[] = rotationSlots.map((slot) => {
    const assign = setup.rotations[slot.id] ?? {};
    const rooms: Record<RoomKey, Member[]> = { A: [], B: [], C: [] };
    for (const m of members) {
      if (!attending.has(m.id)) continue;
      const r = assign[m.id];
      if (r === "A" || r === "B" || r === "C") rooms[r].push(m);
    }
    return { start: slot.startTime, end: slot.endTime, rooms };
  });

  // 使用されている部屋（列）を決定
  const usedRooms = (["A", "B", "C"] as const).filter((r) =>
    data.some((d) => d.rooms[r].length > 0)
  );

  // ── レイアウト寸法（論理px）──
  const W = 820;
  const padX = 28;
  const titleH = 88;
  const headH = 56;
  const lineH = 40;
  const cellPadV = 20;
  const timeW = 188;
  const roomW = (W - padX * 2 - timeW) / usedRooms.length;

  const rowHeights = data.map((d) => {
    const maxN = Math.max(1, ...usedRooms.map((r) => d.rooms[r].length));
    return maxN * lineH + cellPadV * 2;
  });
  const tableH = headH + rowHeights.reduce((a, b) => a + b, 0);
  const H = titleH + tableH + padX;

  // ── 高解像度キャンバス ──
  const scale = Math.min(4, Math.max(3, Math.ceil((window.devicePixelRatio || 1) * 1.5)));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(W * scale);
  canvas.height = Math.round(H * scale);
  const ctx = canvas.getContext("2d")!;
  ctx.scale(scale, scale);
  ctx.textBaseline = "middle";

  const x0 = padX;
  const x1 = x0 + timeW;
  const tableTop = titleH;
  const tableW = W - padX * 2;

  // モノトーン配色
  const INK = "#222222";
  const SUB = "#7a7a7a";
  const LINE = "#c9c7c2";
  const LINE_STRONG = "#5e5c58";

  // ── タイトル ──
  ctx.save();
  ctx.shadowColor = "rgba(255,255,255,0.95)";
  ctx.shadowBlur = 5;
  ctx.textAlign = "center";
  ctx.fillStyle = INK;
  ctx.font = `800 30px ${FONT}`;
  ctx.fillText("部屋割り表", W / 2, 34);
  ctx.fillStyle = SUB;
  ctx.font = `600 17px ${FONT}`;
  ctx.fillText(`${eventInfo.title}　${eventInfo.date}`, W / 2, 64);
  ctx.restore();

  // ── 外枠 ──
  ctx.save();
  ctx.strokeStyle = LINE_STRONG;
  ctx.lineWidth = 2;
  roundRect(ctx, x0, tableTop, tableW, tableH, 18);
  ctx.stroke();
  ctx.restore();

  // ── ヘッダー行 ──
  ctx.save();
  ctx.shadowColor = "rgba(255,255,255,0.9)";
  ctx.shadowBlur = 4;
  ctx.fillStyle = INK;
  ctx.textAlign = "center";
  ctx.font = `800 19px ${FONT}`;
  ctx.fillText("時間", x0 + timeW / 2, tableTop + headH / 2);
  usedRooms.forEach((r, i) => {
    const cx = x1 + roomW * i + roomW / 2;
    ctx.font = `800 19px ${FONT}`;
    ctx.fillStyle = INK;
    ctx.fillText(`${r}ルーム`, cx, tableTop + headH / 2);
  });
  ctx.restore();

  // ヘッダー下の区切り線
  ctx.save();
  ctx.strokeStyle = LINE_STRONG;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x0, tableTop + headH);
  ctx.lineTo(x0 + tableW, tableTop + headH);
  ctx.stroke();
  ctx.restore();

  // ── 各コマ行 ──
  let y = tableTop + headH;
  data.forEach((d, idx) => {
    const rh = rowHeights[idx];
    const rowMid = y + rh / 2;

    // 行区切り線（最後の行以外）
    if (idx < data.length - 1) {
      ctx.save();
      ctx.strokeStyle = LINE;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x0, y + rh);
      ctx.lineTo(x0 + tableW, y + rh);
      ctx.stroke();
      ctx.restore();
    }

    // 時間（縦中央）
    ctx.save();
    ctx.shadowColor = "rgba(255,255,255,0.95)";
    ctx.shadowBlur = 4;
    ctx.textAlign = "center";
    ctx.fillStyle = INK;
    ctx.font = `800 20px ${FONT}`;
    ctx.fillText(d.start, x0 + timeW / 2, rowMid - 13);
    ctx.fillStyle = SUB;
    ctx.font = `600 16px ${FONT}`;
    ctx.fillText("〜", x0 + timeW / 2, rowMid + 6);
    ctx.fillStyle = INK;
    ctx.font = `800 20px ${FONT}`;
    ctx.fillText(d.end, x0 + timeW / 2, rowMid + 25);
    ctx.restore();

    // 各部屋のメンバー名（縦並び・中央寄せ）
    usedRooms.forEach((r, i) => {
      const cx = x1 + roomW * i + roomW / 2;
      const names = d.rooms[r];
      const blockH = names.length * lineH;
      let ny = rowMid - blockH / 2 + lineH / 2;
      ctx.save();
      ctx.shadowColor = "rgba(255,255,255,0.95)";
      ctx.shadowBlur = 5;
      ctx.textAlign = "center";
      ctx.fillStyle = INK;
      ctx.font = `600 21px ${FONT}`;
      for (const m of names) {
        ctx.fillText(m.nickname, cx, ny);
        ny += lineH;
      }
      if (names.length === 0) {
        ctx.fillStyle = "#bdbbb6";
        ctx.fillText("—", cx, rowMid);
      }
      ctx.restore();
    });

    y += rh;
  });

  // 縦の列区切り線
  ctx.save();
  ctx.strokeStyle = LINE;
  ctx.lineWidth = 1;
  const colXs = [x1, ...usedRooms.slice(0, -1).map((_, i) => x1 + roomW * (i + 1))];
  for (const cx of colXs) {
    ctx.beginPath();
    ctx.moveTo(cx, tableTop + 12);
    ctx.lineTo(cx, tableTop + tableH - 12);
    ctx.stroke();
  }
  ctx.restore();

  // ── PNG 出力 & ダウンロード ──
  const fileName = "africaheart_部屋割り表.png";
  const isIOS =
    /iP(hone|ad|od)/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    if (isIOS) {
      // iOS: 新規タブで開き、長押しで写真に保存
      window.open(url, "_blank");
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } else {
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
  }, "image/png");
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
        <span className="text-base">📥</span>
        {busy ? "作成中…" : "部屋割り表をダウンロード（透明PNG）"}
      </button>
      <p className="text-[11px] text-center mt-1.5" style={{ color: "#aaa" }}>
        チラシ用・背景透明／高解像度。iPhoneは開いた画像を長押しで保存
      </p>
    </div>
  );
}
