"use client";

import Link from "next/link";
import { eventInfo } from "@/lib/data";

export default function Header() {
  return (
    <header
      className="relative overflow-hidden"
      style={{ background: "linear-gradient(160deg, #FF6B9D 0%, #FF5FA3 35%, #FF8C3F 70%, #FFD166 100%)" }}
    >
      <div className="absolute top-4 right-4 z-10">
        <Link
          href="/admin"
          className="text-xs px-2.5 py-1 rounded-lg font-medium"
          style={{ background: "rgba(255,255,255,0.2)", color: "rgba(255,255,255,0.9)" }}
        >
          管理
        </Link>
      </div>

      <div className="px-4 pt-10 pb-6 text-center">
        {/* Africa Heart ロゴ */}
        <div className="flex justify-center mb-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/africaheart-logo.png"
            alt="アフリカハート ロゴ"
            width={224}
            className="h-auto select-none pointer-events-none"
            style={{ filter: "drop-shadow(0 3px 8px rgba(0,0,0,0.18))" }}
          />
        </div>

        <h1 className="text-3xl font-black tracking-tight mb-1 text-white" style={{ textShadow: "0 2px 12px rgba(0,0,0,0.15)" }}>
          {eventInfo.title}
        </h1>
        <p className="text-xs font-semibold tracking-widest" style={{ color: "rgba(255,255,255,0.8)" }}>
          {eventInfo.subtitle}
        </p>

        {/* 開催日時 */}
        <div className="mt-3.5 flex flex-col items-center gap-1">
          <span
            className="px-4 py-1 rounded-full text-sm font-black text-white"
            style={{ background: "rgba(255,255,255,0.22)" }}
          >
            {eventInfo.date}
          </span>
          <span className="text-xs font-semibold" style={{ color: "rgba(255,255,255,0.85)" }}>
            集合 {eventInfo.startTime} ／ {eventInfo.openTime}〜{eventInfo.endTime}
          </span>
        </div>
      </div>
    </header>
  );
}
