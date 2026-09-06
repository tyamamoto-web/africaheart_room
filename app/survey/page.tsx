"use client";

/* ============================================================
   参加者アンケートのページ（/survey）
   ------------------------------------------------------------
   中身は app/components/SurveyFeature.tsx。9/6 に、設定 ＞ アンケート からも
   同じものを出せるようにするため、ここから切り出した（中身は変えていない）。
   このページに残っているのは、上のバー（TOPへ戻る・見出し）だけ。
   ============================================================ */

import Link from "next/link";
import SurveyBody, { S } from "@/app/components/SurveyFeature";

export default function SurveyPage() {
  return (
    <main className="min-h-screen pb-16" style={{ background: S.paper }}>

      {/* 上部バー */}
      <div
        className="sticky top-0 z-50 px-4 py-3 flex items-center gap-3"
        style={{ background: S.paper, borderBottom: `1px solid ${S.hair}` }}
      >
        <Link
          href="/"
          className="text-xs font-bold px-3 py-2 rounded"
          style={{ color: S.cap, border: `1px solid ${S.hair}`, letterSpacing: "0.04em" }}
        >
          ← 戻る
        </Link>
        <h1 className="text-sm font-black" style={{ color: S.ink, letterSpacing: "0.02em" }}>
          参加者アンケート
        </h1>
      </div>

      <SurveyBody />
    </main>
  );
}
