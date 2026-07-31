"use client";

import Link from "next/link";
import Header from "./components/Header";
import RotationTable from "./components/RotationTable";
import CrossTable from "./components/CrossTable";
import EventAnnounce from "./components/EventAnnounce";
import FireworksBackground from "./components/FireworksBackground";
import { eventStatus } from "@/lib/data";

export default function Home() {
  // 花火大会テーマ（今回の告知回だけ）。eventStatus を戻せば通常の白＋赤紫UIに復帰。
  const night = eventStatus === "announced";

  return (
    <main
      className={`min-h-screen relative ${night ? "" : "bg-white"}`}
      style={night ? { background: "#050b1f" } : undefined}
    >
      {/* 花火の夜空（固定背景・本文の下）。announcedの回だけ描画 */}
      {night && <FireworksBackground />}

      {/* 本文（背景の花火より前面に重ねる） */}
      <div className={night ? "relative z-10" : undefined}>
      <Header />

      {/* ロゴバナー下：動作確認ページへの導線 */}
      <div className="px-4 pt-4 max-w-lg mx-auto">
        <Link
          href="/test"
          className="flex items-center gap-3 px-4 py-3 rounded-2xl text-white active:scale-[0.99] transition-transform"
          style={
            night
              ? {
                  // 夜背景に合わせたグラス調＋金の縁取り
                  background: "rgba(255,255,255,0.07)",
                  border: "1px solid rgba(245,205,110,0.34)",
                  boxShadow: "0 6px 18px rgba(3,8,22,0.42)",
                  backdropFilter: "blur(6px)",
                  WebkitBackdropFilter: "blur(6px)",
                }
              : { background: "linear-gradient(135deg,#A8175F,#C81E77)", boxShadow: "0 4px 14px rgba(168,23,95,0.34)" }
          }
        >
          <div className="flex-1 min-w-0">
            <p className="text-sm font-black leading-tight">会員メニュー</p>
            <p className="text-[11px] opacity-85 leading-tight">デュエット曲・宿題ルーレット・プロフィールはこちら</p>
          </div>
          <span className="text-lg" style={night ? { color: "#ffd884" } : { opacity: 0.9 }}>
            ›
          </span>
        </Link>
      </div>

      {eventStatus === "scheduled" ? (
        <>
          {/* 本日のタイムテーブル・部屋割り */}
          <div className="pt-4">
            <RotationTable />
          </div>

          {/* 部屋割りの一番下：同席クロス表 */}
          <CrossTable />
        </>
      ) : eventStatus === "announced" ? (
        /* 次回イベント告知（部屋割りの無い回） */
        <EventAnnounce />
      ) : (
        /* 次回日程調整中プレースホルダ */
        <div className="px-4 pt-6 max-w-lg mx-auto">
          <div className="card px-6 py-10 text-center">
            <p className="text-lg font-black" style={{ color: "#A8175F" }}>次回のオフ会は日程調整中です</p>
            <p className="text-sm mt-2.5 leading-relaxed" style={{ color: "#888" }}>
              日程が決まり次第、部屋割りをこちらでお知らせします。
              <br />
              デュエット曲・宿題ルーレット・プロフィールは会員メニューから引き続きご利用いただけます。
            </p>
          </div>
        </div>
      )}

      <footer className="text-center pb-10 pt-6 px-4">
        <p className="text-xs" style={{ color: night ? "rgba(255,255,255,0.6)" : "#bbb" }}>
          アフリカハート 運営スタッフ一同
        </p>
      </footer>
      </div>
    </main>
  );
}
