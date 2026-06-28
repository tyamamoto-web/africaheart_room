"use client";

import Link from "next/link";
import Header from "./components/Header";

export default function Home() {
  return (
    <main className="min-h-screen fun-bg">
      <Header />

      {/* ロゴバナー下：動作確認ページへの導線 */}
      <div className="px-4 pt-4 max-w-lg mx-auto">
        <Link
          href="/test"
          className="flex items-center gap-3 px-4 py-3 rounded-2xl text-white active:scale-[0.99] transition-transform"
          style={{ background: "linear-gradient(135deg,#FF6B9D,#FF4FA3)", boxShadow: "0 4px 14px rgba(255,107,157,0.35)" }}
        >
          <div className="flex-1 min-w-0">
            <p className="text-sm font-black leading-tight">動作確認ページ</p>
            <p className="text-[11px] opacity-85 leading-tight">デュエット曲リストなど新機能はこちら</p>
          </div>
          <span className="text-lg opacity-90">›</span>
        </Link>
      </div>

      {/* 次回案内（6/27の部屋割りはアーカイブへ移動済み） */}
      <div className="px-4 pt-4 max-w-lg mx-auto">
        <div className="card px-5 py-9 text-center">
          <p className="text-base font-black" style={{ color: "#2c2c2c" }}>次回のオフ会をお楽しみに！</p>
          <p className="text-sm mt-1.5 leading-relaxed" style={{ color: "#999" }}>
            部屋割りは決まり次第、こちらに表示されます。
          </p>
        </div>
      </div>

      <footer className="text-center pb-10 pt-6 px-4">
        <p className="text-xs" style={{ color: "#bbb" }}>
          アフリカハート 運営スタッフ一同
        </p>
      </footer>
    </main>
  );
}
