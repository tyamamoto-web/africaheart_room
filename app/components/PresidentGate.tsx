"use client";

/* ============================================================
   社長室：暗証番号の入力画面
   ------------------------------------------------------------
   このアプリの他の画面（ピンク・クリーム色・丸い角）とは意図的に別の見た目。
   白一色の地に細い線とテンキーだけを置き、余計な装飾と文言を持たせない。

   ・数字を3つ入れると自動で判定する（決定ボタンを置かない）
   ・違っていれば丸が横に揺れて空に戻る
   ・画面のキーパッドでも、パソコンのキーボード（数字・BackSpace）でも入る
   ============================================================ */

import { useCallback, useEffect, useRef, useState } from "react";
import { PRESIDENT_CODE_LENGTH, unlockPresident } from "@/lib/presidentGate";

const MONO = 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, "Courier New", monospace';
const INK   = "#0c0d12"; // 文字と点灯した丸
const DIM   = "#a3a4b0"; // 小さな添え字
const LINE  = "#e8e8ee"; // 罫線（わずかに青みのある灰）
const ALERT = "#d94436"; // 番号違いのときだけ使う

// 空欄・0・削除を含めた並び。null は押せない空きマス。
const KEYS: (string | null)[] = ["1", "2", "3", "4", "5", "6", "7", "8", "9", null, "0", "del"];

export default function PresidentGate({ onUnlock }: { onUnlock: () => void }) {
  const [code, setCode] = useState("");
  const [error, setError] = useState(false);
  const [shake, setShake] = useState(0); // 揺れを再生し直すための番号
  const busy = useRef(false);            // 判定中は入力を受け付けない

  const push = useCallback((d: string) => {
    if (busy.current) return;
    setError(false);
    setCode((c) => (c.length >= PRESIDENT_CODE_LENGTH ? c : c + d));
  }, []);

  const back = useCallback(() => {
    if (busy.current) return;
    setError(false);
    setCode((c) => c.slice(0, -1));
  }, []);

  // 3つ揃ったら判定する。最後の丸が点いたのが見えるよう、少しだけ待つ。
  useEffect(() => {
    if (code.length < PRESIDENT_CODE_LENGTH) return;
    busy.current = true;
    const t = setTimeout(() => {
      if (unlockPresident(code)) {
        onUnlock();
        return; // 解錠したらこの画面ごと消える
      }
      setError(true);
      setShake((n) => n + 1);
      setCode("");
      busy.current = false;
    }, 260);
    return () => clearTimeout(t);
  }, [code, onUnlock]);

  // パソコンのキーボードからも入れるようにする
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key >= "0" && e.key <= "9") { e.preventDefault(); push(e.key); }
      else if (e.key === "Backspace")   { e.preventDefault(); back(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [push, back]);

  return (
    <div style={{ background: "#fff", borderTop: `1px solid ${LINE}`, padding: "54px 24px 72px" }}>
      <div style={{ maxWidth: 264, margin: "0 auto" }}>

        <p style={{ margin: 0, textAlign: "center", fontFamily: MONO, fontSize: 9, letterSpacing: "0.52em", textIndent: "0.52em", color: DIM }}>
          ACCESS
        </p>
        <h2 style={{ margin: "14px 0 0", textAlign: "center", fontSize: 14, fontWeight: 700, letterSpacing: "0.34em", textIndent: "0.34em", color: INK }}>
          社長室
        </h2>

        {/* 入れた桁数を示す3つの丸 */}
        <div
          key={shake}
          className={error ? "pg-shake" : undefined}
          style={{ display: "flex", justifyContent: "center", gap: 14, marginTop: 30 }}
          aria-hidden="true"
        >
          {Array.from({ length: PRESIDENT_CODE_LENGTH }).map((_, i) => {
            const on = i < code.length;
            return (
              <span
                key={i}
                style={{
                  width: 9,
                  height: 9,
                  borderRadius: "50%",
                  background: on ? INK : "transparent",
                  border: `1px solid ${on ? INK : error ? ALERT : "#d6d7de"}`,
                  transition: "background-color .14s ease, border-color .14s ease",
                }}
              />
            );
          })}
        </div>

        {/* 高さを固定して、出ても下がずれないようにする */}
        <p style={{ height: 16, margin: "14px 0 0", textAlign: "center", fontSize: 11, letterSpacing: "0.08em", color: error ? ALERT : "transparent" }} role="status">
          {error ? "番号が違います" : ""}
        </p>

        {/* テンキー。1pxの隙間から下地の線が見えて、格子の罫線になる */}
        <div
          style={{
            marginTop: 14,
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 1,
            background: LINE,
            border: `1px solid ${LINE}`,
          }}
        >
          {KEYS.map((k, i) => {
            if (k === null) return <div key={i} style={{ background: "#fff", height: 58 }} />;
            const isDel = k === "del";
            return (
              <button
                key={i}
                type="button"
                className="pg-key"
                onClick={() => (isDel ? back() : push(k))}
                aria-label={isDel ? "1つ消す" : k}
                style={{
                  height: 58,
                  border: "none",
                  background: "#fff",
                  color: isDel ? DIM : INK,
                  fontFamily: MONO,
                  fontSize: isDel ? 10 : 19,
                  fontWeight: isDel ? 600 : 400,
                  letterSpacing: isDel ? "0.16em" : "0.04em",
                  fontVariantNumeric: "tabular-nums",
                  cursor: "pointer",
                  WebkitTapHighlightColor: "transparent",
                }}
              >
                {isDel ? "DEL" : k}
              </button>
            );
          })}
        </div>

      </div>
    </div>
  );
}
