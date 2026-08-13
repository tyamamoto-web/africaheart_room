"use client";

import Link from "next/link";

/* ============================================================
   今回のみ参加メンバー向けページ（現在は空白）
   ------------------------------------------------------------
   トップの「会員メニュー」の下から入るページ。
   中身はこれから追加するため、いまは枠（戻る導線とタイトル）だけを置いている。
   内容を足すときは下の「ここに内容を追加する」の中に書き足す。
   ============================================================ */

export default function GuestPage() {
  return (
    <main className="min-h-screen bg-white pb-16">
      {/* 上部バー（トップへ戻る） */}
      <div
        className="sticky top-0 z-50 px-4 py-3 flex items-center gap-3"
        style={{ background: "#fff", borderBottom: "1px solid #f0ece5" }}
      >
        <Link
          href="/"
          className="flex items-center gap-1.5 text-sm font-semibold px-3 py-2 rounded-xl card"
          style={{ color: "#555" }}
        >
          ← 戻る
        </Link>
        <h1 className="text-base font-black" style={{ color: "#2c2c2c" }}>
          今回のみ参加のメンバー
        </h1>
      </div>

      {/* ここに内容を追加する */}
      <div className="px-4 pt-3 max-w-lg mx-auto flex flex-col gap-4" />
    </main>
  );
}
