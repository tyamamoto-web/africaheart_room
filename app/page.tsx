"use client";

import Link from "next/link";
import Header from "./components/Header";
import RotationTable from "./components/RotationTable";
import CrossTable from "./components/CrossTable";

export default function Home() {
  return (
    <main className="min-h-screen bg-white">
      <Header />

      {/* ロゴバナー下：動作確認ページへの導線 */}
      <div className="px-4 pt-4 max-w-lg mx-auto">
        <Link
          href="/test"
          className="flex items-center gap-3 px-4 py-3 rounded-2xl text-white active:scale-[0.99] transition-transform"
          style={{ background: "linear-gradient(135deg,#A8175F,#C81E77)", boxShadow: "0 4px 14px rgba(168,23,95,0.34)" }}
        >
          <div className="flex-1 min-w-0">
            <p className="text-sm font-black leading-tight">会員メニュー</p>
            <p className="text-[11px] opacity-85 leading-tight">デュエット曲・宿題ルーレット・プロフィールはこちら</p>
          </div>
          <span className="text-lg opacity-90">›</span>
        </Link>
      </div>

      {/* 本日のタイムテーブル・部屋割り（7/26） */}
      <div className="pt-4">
        <RotationTable />
      </div>

      {/* 部屋割りの一番下：同席クロス表 */}
      <CrossTable />

      <footer className="text-center pb-10 pt-6 px-4">
        <p className="text-xs" style={{ color: "#bbb" }}>
          アフリカハート 運営スタッフ一同
        </p>
      </footer>
    </main>
  );
}
