"use client";

/* ============================================================
   社長室：入口のロック画面
   ------------------------------------------------------------
   sirius_tmp の採用ページ（AccessGate）と同じ考え方でつくっている。

   【見た目の方針】
   白を基調にした、無機質で高級感のある画面。
   置くのは「役目のあるもの」だけ＝施錠マーク／見出し／入力欄／解除ボタン
   （＋失敗時のメッセージ）。装飾のための表示は一切置かない。
   色は白・グレー・黒のみ。色を使うのは「失敗した」ことを伝える赤だけ。
   このアプリの他の画面（ピンク・クリーム色・丸い角）は持ち込まない。

   ※ クライアント側だけの簡易ロックです（本格的な認証ではありません）。
   ※ 解除状態は sessionStorage。タブを閉じるとまた聞く。
   ============================================================ */

import { useEffect, useRef, useState, type ReactNode } from "react";
import { PRESIDENT_PASSCODE, PRESIDENT_UNLOCK_KEY } from "@/lib/presidentGate";

/** 照合しているように見せるための短い待ち */
const AUTH_DELAY_MS = 620;

// 無機質・高級感のトーン（sirius_tmp のデザイントークンと同じ値）
const PANEL  = "#ffffff";
const CANVAS = "#f5f6f8";
const STRONG = "#e2e3e9"; // 少し強い罫線
const INK    = "#14151a";
const MUTED  = "#6b7180";
const FAINT  = "#9ca1ad";
const DANGER = "#e5564b";

const MONO = 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, "Courier New", monospace';

export default function PresidentGate({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const [value, setValue] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState(false);
  const [shake, setShake] = useState(0); // 揺れを再生し直すための番号
  const [checking, setChecking] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // 解除済みかどうかは描画後に見る（サーバー側の描画とずれないように）
  useEffect(() => {
    try {
      if (sessionStorage.getItem(PRESIDENT_UNLOCK_KEY) === "1") setUnlocked(true);
    } catch { /* 読めなくても続行（番号を聞くだけ） */ }
    setReady(true);
  }, []);

  useEffect(() => {
    if (ready && !unlocked) inputRef.current?.focus();
  }, [ready, unlocked]);

  // 照合中の見せ方 → 待ち終わったら解除する
  useEffect(() => {
    if (!checking) return;
    const id = setTimeout(() => setUnlocked(true), AUTH_DELAY_MS);
    return () => clearTimeout(id);
  }, [checking]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (checking) return;
    if (value.trim() === PRESIDENT_PASSCODE) {
      try { sessionStorage.setItem(PRESIDENT_UNLOCK_KEY, "1"); } catch { /* 保存できなくても解除は有効 */ }
      setError(false);
      setChecking(true);
      return;
    }
    setError(true);
    setValue("");
    setShake((n) => n + 1);
    inputRef.current?.focus();
  }

  // 判定が固まる前は何も描かない（中身が一瞬見えてしまうのを防ぐ）
  if (!ready) return null;
  if (unlocked) return <>{children}</>;

  return (
    <div
      style={{
        background: CANVAS,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "calc(100dvh - 190px)",
        padding: "40px 16px",
      }}
    >
      <div key={shake} className={error ? "pg-shake" : undefined} style={{ width: "100%", maxWidth: 300 }}>
        <div className="pg-rise pg-clip" style={{ background: PANEL, padding: "44px 28px 38px" }}>

          {/* 施錠マーク（状態をひと目で示すための唯一の図） */}
          <div style={{ display: "flex", justifyContent: "center", color: error ? DANGER : FAINT, transition: "color .15s ease" }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </div>

          <h2 style={{ marginTop: 20, textAlign: "center", fontSize: 15, fontWeight: 400, letterSpacing: "0.06em", color: INK }}>
            このエリアは保護されています
          </h2>

          <form onSubmit={submit} style={{ marginTop: 34 }}>
            {/* 入力欄。枠は持たず、下の1本の罫線だけで示す */}
            <div
              className="pg-field"
              style={{
                position: "relative",
                display: "flex",
                alignItems: "center",
                borderBottom: `1px solid ${error ? DANGER : STRONG}`,
                transition: "border-color .15s ease",
              }}
            >
              <input
                ref={inputRef}
                type={show ? "text" : "password"}
                inputMode="numeric"
                autoComplete="off"
                disabled={checking}
                value={value}
                onChange={(e) => { setValue(e.target.value); if (error) setError(false); }}
                placeholder="•••"
                aria-label="パスワード"
                style={{
                  width: "100%",
                  minWidth: 0,
                  padding: "10px 2px",
                  border: "none",
                  outline: "none",
                  background: "transparent",
                  fontFamily: MONO,
                  fontSize: 15,
                  letterSpacing: "0.4em",
                  color: INK,
                }}
              />
              <button
                type="button"
                className="pg-eye"
                onClick={() => setShow((s) => !s)}
                tabIndex={-1}
                aria-label={show ? "パスワードを隠す" : "パスワードを表示"}
                style={{ flexShrink: 0, padding: 4, border: "none", background: "transparent", color: FAINT, cursor: "pointer", lineHeight: 0 }}
              >
                {show ? (
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                       strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
                    <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
                    <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
                    <line x1="2" y1="2" x2="22" y2="22" />
                  </svg>
                ) : (
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                       strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
              {/* 入力中だけ、下線がグレーで引き直される（左から右へ） */}
              <span
                aria-hidden="true"
                className="pg-underline"
                style={{
                  position: "absolute", left: 0, right: 0, bottom: -1, height: 1,
                  background: FAINT, visibility: error ? "hidden" : "visible", pointerEvents: "none",
                }}
              />
            </div>

            {/* 失敗メッセージ。出ても他が動かないよう、場所は常に確保しておく */}
            <p
              aria-live="polite"
              style={{
                height: 26, paddingTop: 8, fontSize: 11, color: DANGER,
                opacity: error ? 1 : 0, transition: "opacity .2s ease",
              }}
            >
              {error ? "パスワードが違います" : ""}
            </p>

            {/* 解除ボタン。面は持たず、薄いグレーの枠だけの四角 */}
            <button
              type="submit"
              className="pg-submit"
              disabled={checking}
              style={{
                position: "relative", overflow: "hidden",
                marginTop: 12, width: "100%", padding: "12px 0",
                border: `1px solid ${STRONG}`, background: PANEL,
                fontSize: 12, fontWeight: 500, letterSpacing: "0.08em", color: INK,
                cursor: checking ? "default" : "pointer",
              }}
            >
              {checking ? "照合中" : "解除"}
              {checking && (
                <span aria-hidden="true" style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 1, overflow: "hidden" }}>
                  <span className="pg-progress" style={{ display: "block", height: "100%", width: "33%", background: "rgba(20,21,26,0.4)" }} />
                </span>
              )}
            </button>
          </form>

        </div>
      </div>
    </div>
  );
}
