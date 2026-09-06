"use client";

/* ============================================================
   設定の下に並べた、会員メニューの機能（TOP。管理画面 ＞ 社長室 にも同じものが出る）
   （デュエット／宿題ルーレット／歌唱順ルーレット／プロフィール／ギャラリー）
   ------------------------------------------------------------
   会員メニュー（/test）に出しているものと同じ部品（app/components/memberFeatures.tsx）を、
   ここでは設定の中の1ページとして出す。見た目は会員メニューのカードのまま
   （9/6 に場所を移しただけで、中身も保存先も変えていない）。
   幅は会員メニューと同じく、スマホ1画面ぶん（512px）に収める。

   プロフィールの「新着」印は、会員メニューと同じ端末の記録（africaheart_profile_seen_v1）を
   使う。開いた時点の記録を基準に新着を決め、見ている間に分かった最新の更新時刻を
   記録に書き戻す（次に開いたときには新着でなくなる）。決め方は会員メニュー（TestPage）と同じ。
   ============================================================ */

import { useCallback, useEffect, useState } from "react";
import { features } from "@/app/components/memberFeatures";
import { loadProfileSeen, saveProfileSeen, isNewer, PROFILE_NEW_BASELINE } from "@/app/components/ProfileFeature";

/** 端末の記録と基準時刻のうち、新しいほう（これより後の更新だけを新着にする） */
function seenFloor(): string {
  const stored = loadProfileSeen();
  return isNewer(PROFILE_NEW_BASELINE, stored) ? PROFILE_NEW_BASELINE : stored;
}

export default function PresidentFeature({ id }: { id: string }) {
  const f = features.find((x) => x.id === id);

  // 新着判定の基準は、開いた時点で固定（見ている間に消えないように）
  const [sinceSeen, setSinceSeen] = useState("");
  useEffect(() => {
    setSinceSeen(seenFloor());
  }, [id]);
  // 見ている間に分かった最新の更新時刻を「確認済み」として書き戻す
  const onLatest = useCallback((iso: string) => {
    if (isNewer(iso, seenFloor())) saveProfileSeen(iso);
  }, []);

  if (!f) return null;
  return (
    <div style={{ padding: "28px 28px 40px", maxWidth: 512 + 28 * 2 }}>
      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b" style={{ borderColor: "#f4f0ea" }}>
          <p className="text-sm font-black" style={{ color: "#2c2c2c" }}>{f.title}</p>
          {f.description && (
            <p className="text-xs mt-1" style={{ color: "#aaa" }}>{f.description}</p>
          )}
        </div>
        <div className="px-4 py-6 flex justify-center">{f.render({ sinceSeen, onLatest })}</div>
      </div>
    </div>
  );
}
