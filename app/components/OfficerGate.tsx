"use client";

/* ============================================================
   役員専用ページの入口（合言葉）
   ------------------------------------------------------------
   役員専用（OfficerPlan）と役員専用2（OfficerRoleTable）の前に置く。
   合言葉が合うまで中身は一切描かない。
   9/6 に app/admin/page.tsx から切り出した（中身と見た目は当時のまま）。
   同じものを 管理画面 と TOP ＞ 設定 の両方から使う。TOPには鍵が無いので、
   ここから先を役員だけのものにしているのは、この合言葉ひとつだけ。

   合言葉は lib/officerGate.ts に集約（参加者アンケートの「みんなの回答」とも共通）。
   一度入れると sessionStorage に印を付けるので、タブを閉じるまで聞き直さない。
   役員専用と役員専用2で同じ印を使う（片方を開ければもう片方も開く）。
   ============================================================ */

import { useEffect, useState, type ReactNode } from "react";
import { OFFICER_PASSCODE, OFFICER_UNLOCK_KEY } from "@/lib/officerGate";

export default function OfficerGate({ children }: { children: ReactNode }) {
  // 解錠状態と、合言葉の入力欄。解錠はタブを閉じるまで保持する。
  const [unlocked, setUnlocked] = useState(false);
  const [passInput, setPassInput] = useState("");
  const [passError, setPassError] = useState(false);

  // 前に合言葉を入れていれば、そのタブを開いているあいだは聞き直さない。
  useEffect(() => {
    try {
      if (sessionStorage.getItem(OFFICER_UNLOCK_KEY) === "1") setUnlocked(true);
    } catch { /* 読めなくても続行（合言葉を聞くだけ） */ }
  }, []);

  // 合言葉の判定。合っていれば解錠し、違っていれば入力欄を空にしてやり直してもらう。
  function submitPasscode() {
    if (passInput.trim() !== OFFICER_PASSCODE) {
      setPassError(true);
      setPassInput("");
      return;
    }
    setUnlocked(true);
    setPassError(false);
    setPassInput("");
    try { sessionStorage.setItem(OFFICER_UNLOCK_KEY, "1"); } catch { /* 保存できなくても解錠は有効 */ }
  }

  if (unlocked) return <>{children}</>;

  return (
    <div className="px-4 pt-5 pb-8 max-w-lg mx-auto">
      <div
        style={{
          background: "linear-gradient(180deg,#ffffff,#fdfcfa)",
          border: "1px solid #eee7db",
          borderRadius: 22,
          padding: "30px 26px 26px",
          boxShadow: "0 18px 50px -30px rgba(70,58,34,0.35)",
        }}
      >
        <p style={{ fontSize: 10.5, letterSpacing: "0.30em", color: "#bcb09c", fontWeight: 600, textTransform: "uppercase" }}>
          Officer
        </p>
        <h2 style={{ fontSize: 20, fontWeight: 800, color: "#1c1a17", marginTop: 8, letterSpacing: "0.01em" }}>
          合言葉を入れてください
        </h2>
        <p style={{ marginTop: 10, fontSize: 12.5, lineHeight: 1.9, color: "#8b8274" }}>
          ここから先は役員だけが使うページです。合言葉は役員のあいだで共有しています。
        </p>

        <form
          onSubmit={(e) => { e.preventDefault(); submitPasscode(); }}
          style={{ marginTop: 18, display: "flex", gap: 8 }}
        >
          <input
            type="password"
            inputMode="numeric"
            autoComplete="off"
            value={passInput}
            onChange={(e) => { setPassInput(e.target.value); setPassError(false); }}
            placeholder="合言葉"
            aria-label="合言葉"
            style={{
              flex: 1,
              padding: "11px 14px",
              borderRadius: 11,
              border: `1px solid ${passError ? "#c96a6a" : "#e3dccf"}`,
              background: "#fff",
              color: "#1c1a17",
              fontSize: 15,
              letterSpacing: "0.18em",
              outline: "none",
            }}
          />
          <button
            type="submit"
            style={{
              padding: "11px 22px",
              borderRadius: 11,
              border: "none",
              background: "#1c1a17",
              color: "#fff",
              fontSize: 13.5,
              fontWeight: 700,
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            開く
          </button>
        </form>

        {passError && (
          <p style={{ marginTop: 10, fontSize: 12, color: "#b25a5a" }}>
            合言葉が違います。もう一度入れてください。
          </p>
        )}

        <p style={{ marginTop: 16, fontSize: 11, lineHeight: 1.9, color: "#b3a794" }}>
          ※ 一度入れると、このタブを閉じるまで聞き直しません。ブラウザを閉じるとまた合言葉を聞きます。
        </p>
      </div>
    </div>
  );
}
