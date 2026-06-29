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
        <p className="text-xs font-semibold tracking-widest mb-4" style={{ color: "rgba(255,255,255,0.8)" }}>
          {eventInfo.subtitle}
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          {[`${eventInfo.startTime}〜`, eventInfo.venue].map((text) => (
            <span
              key={text}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold"
              style={{ background: "rgba(255,255,255,0.25)", color: "#fff" }}
            >
              {text}
            </span>
          ))}
        </div>
      </div>

      {/* Wave divider */}
      <div style={{ background: "#f0ece5", marginTop: -1 }}>
        <svg viewBox="0 0 375 20" preserveAspectRatio="none" style={{ display: "block", height: 20 }}>
          <path d="M0,0 C60,20 120,0 187.5,10 C255,20 315,0 375,10 L375,0 Z" fill="url(#wGrad)" />
          <defs>
            <linearGradient id="wGrad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%"   stopColor="#FF6B9D" />
              <stop offset="35%"  stopColor="#FF5FA3" />
              <stop offset="70%"  stopColor="#FF8C3F" />
              <stop offset="100%" stopColor="#FFD166" />
            </linearGradient>
          </defs>
        </svg>
      </div>
    </header>
  );
}
