"use client";

import Link from "next/link";
import Header from "./components/Header";
import RotationTable from "./components/RotationTable";
import CrossTable from "./components/CrossTable";
import EventAnnounce from "./components/EventAnnounce";
import { eventStatus } from "@/lib/data";

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
        <p className="text-xs" style={{ color: "#bbb" }}>
          アフリカハート 運営スタッフ一同
        </p>
      </footer>
    </main>
  );
}
