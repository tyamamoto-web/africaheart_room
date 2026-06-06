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

      {/* Decorative floating notes */}
      <span className="absolute top-4 left-5 text-2xl opacity-40 -rotate-12 select-none pointer-events-none">🎵</span>
      <span className="absolute top-8 left-16 text-lg opacity-30 rotate-6 select-none pointer-events-none">⭐</span>
      <span className="absolute top-5 right-8 text-2xl opacity-40 rotate-12 select-none pointer-events-none">🎶</span>
      <span className="absolute top-10 right-20 text-lg opacity-30 -rotate-6 select-none pointer-events-none">✨</span>
      <span className="absolute bottom-16 left-8 text-xl opacity-25 select-none pointer-events-none">🎸</span>
      <span className="absolute bottom-14 right-10 text-xl opacity-25 select-none pointer-events-none">🎉</span>

      <div className="px-4 pt-10 pb-6 text-center">
        {/* Africa Heart illustration */}
        <div className="flex justify-center mb-3">
          <svg viewBox="0 0 240 178" width="190" height="141" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <path id="hArc" d="M62,138 Q120,168 178,138" />
            </defs>

            {/* Heart */}
            <path
              d="M120 58 C120 44 107 31 90 31 C66 31 52 51 52 73 C52 106 120 152 120 152 C120 152 188 106 188 73 C188 51 174 31 150 31 C133 31 120 44 120 58Z"
              fill="#FFB7C5" stroke="#2a2a2a" strokeWidth="3" strokeLinejoin="round"
            />
            {/* AFRICA ♥ HEART arc text */}
            <text fontSize="7.5" fontWeight="bold" fill="#CC1155" letterSpacing="2">
              <textPath href="#hArc">AFRICA ♥ HEART</textPath>
            </text>

          </svg>
        </div>

        <h1 className="text-3xl font-black tracking-tight mb-1 text-white" style={{ textShadow: "0 2px 12px rgba(0,0,0,0.15)" }}>
          {eventInfo.title}
        </h1>
        <p className="text-xs font-semibold tracking-widest mb-4" style={{ color: "rgba(255,255,255,0.8)" }}>
          {eventInfo.subtitle}
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          {[
            { icon: "📅", text: eventInfo.date },
            { icon: "⏰", text: `${eventInfo.startTime}〜` },
            { icon: "📍", text: eventInfo.venue },
          ].map(({ icon, text }) => (
            <span
              key={text}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold"
              style={{ background: "rgba(255,255,255,0.25)", color: "#fff" }}
            >
              {icon} {text}
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
