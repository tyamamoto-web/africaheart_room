"use client";

import Link from "next/link";
import { useState, useEffect, type ReactNode } from "react";

/* ============================================================
   動作確認ページ
   ------------------------------------------------------------
   新しい機能を試すためのページです。
   機能を追加するには：
     1) 下に機能用のコンポーネントを作る
     2) 末尾の features 配列に { id, title, description, render } を追加する
   これだけでカードとして自動的に一覧に並びます。
   ============================================================ */

type Feature = {
  id: string;
  title: string;
  description: string;
  render: () => ReactNode;
};

/* ── サンプル機能①：カウンター ───────────────────────── */
function SampleCounter() {
  const [n, setN] = useState(0);
  return (
    <div className="flex items-center gap-3">
      <button
        onClick={() => setN((v) => v - 1)}
        className="w-11 h-11 rounded-xl text-xl font-black"
        style={{ background: "#f0ece5", color: "#555" }}
      >
        −
      </button>
      <span className="text-2xl font-black w-16 text-center" style={{ color: "#2c2c2c" }}>
        {n}
      </span>
      <button
        onClick={() => setN((v) => v + 1)}
        className="w-11 h-11 rounded-xl text-xl font-black text-white"
        style={{ background: "linear-gradient(135deg,#FF6B9D,#FF4FA3)" }}
      >
        ＋
      </button>
    </div>
  );
}

/* ── サンプル機能②：現在時刻 ─────────────────────────── */
function SampleClock() {
  const [now, setNow] = useState<string>("—");
  useEffect(() => {
    const tick = () =>
      setNow(
        new Date().toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
      );
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <p className="text-3xl font-black tabular-nums" style={{ color: "#2c2c2c" }}>
      {now}
    </p>
  );
}

/* ── 機能一覧（ここに追加していく）──────────────────── */
const features: Feature[] = [
  {
    id: "sample-counter",
    title: "サンプル：カウンター",
    description: "動作確認用のサンプルです。ボタンで数字が増減します。",
    render: () => <SampleCounter />,
  },
  {
    id: "sample-clock",
    title: "サンプル：現在時刻",
    description: "1秒ごとに現在時刻を更新して表示します。",
    render: () => <SampleClock />,
  },
];

export default function TestPage() {
  return (
    <main className="min-h-screen fun-bg pb-16">
      {/* Top bar */}
      <div className="sticky top-0 z-50 px-4 py-3 flex items-center gap-3" style={{ background: "#f0ece5" }}>
        <Link href="/" className="flex items-center gap-1.5 text-sm font-semibold px-3 py-2 rounded-xl card" style={{ color: "#555" }}>
          ← 戻る
        </Link>
        <h1 className="text-base font-black" style={{ color: "#2c2c2c" }}>🧪 動作確認</h1>
        <Link
          href="/admin"
          className="ml-auto text-sm font-semibold px-3 py-2 rounded-xl card"
          style={{ color: "#555" }}
        >
          管理画面
        </Link>
      </div>

      <div className="px-4 pt-3 max-w-lg mx-auto flex flex-col gap-4">
        {/* 説明 */}
        <div className="card px-4 py-4">
          <p className="text-sm leading-relaxed" style={{ color: "#666" }}>
            新しい機能を試すためのページです。下のカードに機能が追加されます。
            気になる機能があればここで動作を確認してから本番に組み込みます。
          </p>
        </div>

        {/* 機能カード一覧 */}
        {features.map((f, i) => (
          <div key={f.id} className="card overflow-hidden">
            <div className="px-4 py-3 border-b" style={{ borderColor: "#f4f0ea" }}>
              <div className="flex items-center gap-2">
                <span
                  className="flex-shrink-0 w-6 h-6 rounded-lg flex items-center justify-center text-xs font-black text-white"
                  style={{ background: "linear-gradient(135deg,#FF6B9D,#FF4FA3)" }}
                >
                  {i + 1}
                </span>
                <p className="text-sm font-black" style={{ color: "#2c2c2c" }}>{f.title}</p>
              </div>
              <p className="text-xs mt-1" style={{ color: "#aaa" }}>{f.description}</p>
            </div>
            <div className="px-4 py-5 flex justify-center">{f.render()}</div>
          </div>
        ))}

        {features.length === 0 && (
          <div className="card px-4 py-10 text-center">
            <p className="text-3xl mb-2">🧩</p>
            <p className="text-sm" style={{ color: "#aaa" }}>まだ機能がありません</p>
          </div>
        )}
      </div>
    </main>
  );
}
