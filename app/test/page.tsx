"use client";

import Link from "next/link";
import { useState, useEffect, useCallback } from "react";
import { getLatestUpdatedAt } from "@/lib/profiles";
import { features } from "@/app/components/memberFeatures";
import {
  loadProfileSeen,
  saveProfileSeen,
  isNewer,
  withinNewWindow,
  PROFILE_NEW_BASELINE,
} from "@/app/components/ProfileFeature";

/* ============================================================
   会員メニュー（タブ切り替え式）
   ------------------------------------------------------------
   機能の中身は app/components/ の各ファイル
   （DuetFeature / HomeworkRoulette / SingingOrderRoulette / ProfileFeature / GalleryFeature）で、
   一覧は app/components/memberFeatures.tsx。9/6 までここに直接書いてあったものを
   切り出しただけで、動きは変えていない。同じ5つを 管理画面 ＞ 社長室 ＞ 設定 からも出す。
   機能を足すときは memberFeatures.tsx の features に1件足す（両方に出る）。
   ============================================================ */

export default function TestPage() {
  const [activeId, setActiveId] = useState<string>(features[0]?.id ?? "");
  const active = features.find((f) => f.id === activeId);

  // TOPの宿題/デュエットカードなどから ?tab=<id> で該当タブを開く（初回のみ）
  useEffect(() => {
    try {
      const t = new URLSearchParams(window.location.search).get("tab");
      if (t && features.some((f) => f.id === t)) setActiveId(t);
    } catch {
      /* 取得できなくても既定タブで続行 */
    }
  }, []);

  // プロフィールの新着（未読）検知：この端末が最後に見た時刻と、DB上の最終更新時刻を比較
  const [seenAt, setSeenAt] = useState(""); // この端末が確認済みの最終更新時刻
  const [latestAt, setLatestAt] = useState(""); // DB上の最終更新時刻（ポーリング）
  const [sinceSeen, setSinceSeen] = useState(""); // カードの「新着」判定基準（タブを開いた時点でスナップショット）

  // 端末の保存値を読み込み（初回）。基準時刻（PROFILE_NEW_BASELINE）を下限にして、
  // 既存プロフィールが新着扱いにならないようにする（保存値が無い初回端末でも既存分は非新着）。
  useEffect(() => {
    const stored = loadProfileSeen();
    const base = isNewer(PROFILE_NEW_BASELINE, stored) ? PROFILE_NEW_BASELINE : stored;
    setSeenAt(base);
    setSinceSeen(base);
  }, []);

  // DBの最終更新時刻を定期取得（他メンバーの追加/編集を検知）
  useEffect(() => {
    let alive = true;
    const check = async () => {
      try {
        const latest = await getLatestUpdatedAt();
        if (alive) setLatestAt(latest);
      } catch {
        /* 未設定/一時的な失敗は無視（ドットを出さない） */
      }
    };
    check();
    const id = setInterval(check, 15000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  // プロフィールタブを見ている間は「確認済み」を最新へ追従（離れても未読ドットが残らない）
  useEffect(() => {
    if (activeId === "profile" && isNewer(latestAt, seenAt)) {
      setSeenAt(latestAt);
      saveProfileSeen(latestAt);
    }
  }, [activeId, latestAt, seenAt]);

  // プロフィール表示中(5秒ポーリング)に判明した最終更新時刻を即時反映（15秒待ちの隙で未読が誤点灯するのを防ぐ）
  const reportLatest = useCallback((iso: string) => {
    setLatestAt((prev) => (isNewer(iso, prev) ? iso : prev));
  }, []);

  // 未読の更新があるか（タブのドット用。プロフィール表示中は出さない）。
  // カードの新着マークと同様に、更新から2週間を過ぎた更新ではドットも出さない。
  const profileUnseen = isNewer(latestAt, seenAt) && withinNewWindow(latestAt, Date.now());

  function selectTab(id: string) {
    // プロフィールを開く瞬間に「新着」判定の基準を確定（開いた後の追従で消えないように）
    if (id === "profile") setSinceSeen(seenAt);
    setActiveId(id);
  }

  return (
    <main className="min-h-screen bg-white pb-16">
      {/* Top bar */}
      <div className="sticky top-0 z-50 px-4 py-3 flex items-center gap-3" style={{ background: "#fff", borderBottom: "1px solid #f0ece5" }}>
        <Link href="/" className="flex items-center gap-1.5 text-sm font-semibold px-3 py-2 rounded-xl card" style={{ color: "#555" }}>
          ← 戻る
        </Link>
        <h1 className="text-base font-black" style={{ color: "#2c2c2c" }}>会員メニュー</h1>
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
            アフリカハートの会員メニューです。{features.length > 1 ? "下のメニューから各機能を切り替えられます。" : ""}
          </p>
        </div>

        {features.length === 0 ? (
          <div className="card px-4 py-10 text-center">
            <p className="text-sm" style={{ color: "#aaa" }}>まだ機能がありません</p>
          </div>
        ) : (
          <>
            {/* 機能メニュー（2つ以上のときだけ表示）。横スクロールで隠れないよう2列グリッドで全部見せる */}
            {features.length > 1 && (
            <div className="grid grid-cols-2 gap-2">
              {features.map((f) => {
                const sel = f.id === activeId;
                const showDot = f.id === "profile" && profileUnseen && activeId !== "profile";
                return (
                  <button
                    key={f.id}
                    onClick={() => selectTab(f.id)}
                    className="relative w-full px-3 py-3 rounded-2xl text-sm font-black transition-all text-center"
                    style={{
                      background: sel ? "linear-gradient(135deg,#A8175F,#C81E77)" : "#f0ece5",
                      color: sel ? "#fff" : "#aaa",
                      boxShadow: sel ? "0 3px 10px rgba(168,23,95,0.3)" : "none",
                    }}
                  >
                    {f.tab}
                    {showDot && (
                      <span
                        className="absolute top-1.5 right-2 w-2.5 h-2.5 rounded-full"
                        style={{ background: "#ff3b6b", border: "1.5px solid #f0ece5" }}
                        aria-label="新着あり"
                      />
                    )}
                  </button>
                );
              })}
            </div>
            )}

            {/* 選択中の機能 */}
            {active && (
              <div className="card overflow-hidden animate-fade-up">
                <div className="px-4 py-3 border-b" style={{ borderColor: "#f4f0ea" }}>
                  <p className="text-sm font-black" style={{ color: "#2c2c2c" }}>{active.title}</p>
                  {active.description && (
                    <p className="text-xs mt-1" style={{ color: "#aaa" }}>{active.description}</p>
                  )}
                </div>
                <div className="px-4 py-6 flex justify-center">{active.render({ sinceSeen, onLatest: reportLatest })}</div>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
