"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { nextEvent } from "@/lib/data";
import { OFFICER_UNLOCK_KEY, isOfficerUnlocked, unlockOfficer, lockOfficer } from "@/lib/officerGate";

/* ============================================================
   参加者アンケート
   ------------------------------------------------------------
   参加する方に、事前の確認と運営からのお願いへ答えてもらうページ。
   答えは全員ぶんが集まり、運営だけが一覧で見られる。

   画面は2つ。
     回答する　　：参加する方が自分の答えを書く（だれでも入れる）
     みんなの回答：運営が全員の答えを見る（合言葉が要る）
   「みんなの回答」に合言葉を掛けているのは、体調や連絡先など、
   人に見られたくない答えが混じりうるため。合言葉は役員専用タブと共通（lib/officerGate.ts）。

   ※ 設問はまだ1つも入れていない。中身は別途決めてから足す。
     ここで勝手に設問を作らないこと。
   ※ 以前このURL（/manual）にあったイベント運営マニュアルは役目を終えた。
     やること一覧の表は役員専用2タブへ移し、やること320件と2日前のLINE文面の下書きは
     lib/eventTasks.ts に残してある（今はどの画面にも出していない）。
   ※ 絵文字は使わない（アプリ全体の方針）。
   ============================================================ */

// 白を地に、濃さの違う灰だけで組む（役員専用2の表と同じ配色）。
const S = {
  paper: "#ffffff",
  soft: "#faf9f6", // ひとつ沈んだ白
  band: "#f2f0eb", // 帯・選んでいないタブ
  hair: "#e6e3dc", // 細い罫
  rule: "#cbc7be", // 外枠・区切り
  ink: "#33302a", // 本文・見出し
  sub: "#57544d",
  cap: "#6b6860", // 添え書き
  faint: "#8a867d",
};

type View = "answer" | "results";

export default function SurveyPage() {
  const [view, setView] = useState<View>("answer");
  const [unlocked, setUnlocked] = useState(false);
  const [pass, setPass] = useState("");
  const [passError, setPassError] = useState(false);

  useEffect(() => {
    setUnlocked(isOfficerUnlocked());
  }, []);

  function submitPasscode(e: React.FormEvent) {
    e.preventDefault();
    if (!unlockOfficer(pass)) {
      setPassError(true);
      setPass("");
      return;
    }
    setUnlocked(true);
    setPassError(false);
    setPass("");
  }

  const tabs: { key: View; label: string }[] = [
    { key: "answer", label: "回答する" },
    { key: "results", label: "みんなの回答" },
  ];

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

      <div className="px-4 pt-4 max-w-xl mx-auto">
        {/* どのイベントについての回答か */}
        <div style={{ borderLeft: `2px solid ${S.rule}`, paddingLeft: 12 }}>
          <p className="text-[13px] font-black" style={{ color: S.ink, letterSpacing: "0.02em" }}>
            {nextEvent.title}
          </p>
          <p className="text-[11px] mt-1" style={{ color: S.cap, letterSpacing: "0.02em" }}>
            {nextEvent.date}　{nextEvent.timeRange}　{nextEvent.place}
          </p>
        </div>

        {/* 画面の切り替え */}
        <div
          className="flex mt-5"
          style={{ border: `1px solid ${S.hair}`, borderRadius: 4, overflow: "hidden" }}
        >
          {tabs.map((t) => {
            const on = view === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setView(t.key)}
                className="flex-1 text-[11px] font-bold"
                style={{
                  padding: "9px 8px",
                  letterSpacing: "0.04em",
                  background: on ? S.ink : S.paper,
                  color: on ? S.paper : S.cap,
                  border: "none",
                  cursor: "pointer",
                }}
              >
                {t.label}
              </button>
            );
          })}
        </div>

        {/* 回答する（設問が入るところ） */}
        {view === "answer" && (
          <EmptyBox
            title="設問はまだ入っていません"
            body="この下に、事前の確認と運営からのお願いが並びます。内容が決まりしだい足します。"
          />
        )}

        {/* みんなの回答（運営だけ） */}
        {view === "results" &&
          (unlocked ? (
            <>
              <EmptyBox
                title="まだ回答はありません"
                body="設問を足すと、ここに全員ぶんの答えが一覧で並びます。"
              />
              <button
                onClick={() => {
                  lockOfficer();
                  setUnlocked(false);
                }}
                className="mt-3 text-[11px] underline"
                style={{ color: S.faint, background: "none", border: "none", cursor: "pointer", padding: 0 }}
              >
                合言葉の入力に戻す
              </button>
            </>
          ) : (
            <div
              className="mt-4"
              style={{ border: `1px solid ${S.hair}`, borderRadius: 4, padding: "20px 18px", background: S.soft }}
            >
              <p className="text-[10px] font-bold" style={{ color: S.faint, letterSpacing: "0.16em" }}>
                OFFICER
              </p>
              <p className="text-[13px] font-black mt-2" style={{ color: S.ink }}>
                合言葉を入れてください
              </p>
              <p className="text-[11px] mt-1.5 leading-relaxed" style={{ color: S.cap }}>
                ここから先は運営だけが見る画面です。体調や連絡先など、人に見られたくない答えが混じることがあるため、
                合言葉を掛けています。
              </p>
              <form onSubmit={submitPasscode} className="flex gap-2 mt-3">
                <input
                  type="password"
                  inputMode="numeric"
                  value={pass}
                  onChange={(e) => setPass(e.target.value)}
                  aria-label="合言葉"
                  className="flex-1"
                  style={{
                    border: `1px solid ${S.rule}`,
                    borderRadius: 3,
                    background: S.paper,
                    color: S.ink,
                    fontSize: 13,
                    padding: "9px 10px",
                    outline: "none",
                    letterSpacing: "0.3em",
                    fontFamily: "inherit",
                  }}
                />
                <button
                  type="submit"
                  className="text-[11px] font-bold"
                  style={{
                    background: S.ink,
                    color: S.paper,
                    border: "none",
                    borderRadius: 3,
                    padding: "9px 20px",
                    letterSpacing: "0.04em",
                    cursor: "pointer",
                  }}
                >
                  開く
                </button>
              </form>
              {passError && (
                <p className="text-[11px] mt-2" style={{ color: "#7a5a2e" }}>
                  合言葉が違います。もう一度入れてください。
                </p>
              )}
              <p className="text-[10px] mt-3 leading-relaxed" style={{ color: S.faint }}>
                一度入れると、このタブを閉じるまで聞き直しません（{OFFICER_UNLOCK_KEY} に保存）。
              </p>
            </div>
          ))}
      </div>
    </main>
  );
}

/** 中身がまだ無いことを伝える枠。設問が入ったら差し替える。 */
function EmptyBox({ title, body }: { title: string; body: string }) {
  return (
    <div
      className="mt-4 text-center"
      style={{
        border: `1px dashed ${S.rule}`,
        borderRadius: 4,
        padding: "34px 20px",
        background: S.soft,
      }}
    >
      <p className="text-[12px] font-bold" style={{ color: S.sub, letterSpacing: "0.02em" }}>
        {title}
      </p>
      <p className="text-[11px] mt-2 leading-relaxed" style={{ color: S.faint }}>
        {body}
      </p>
    </div>
  );
}
