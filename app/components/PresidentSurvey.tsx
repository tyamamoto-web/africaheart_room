"use client";

/* ============================================================
   設定 ＞ アンケート（TOPと、管理画面 ＞ 社長室 の両方に出る）
   ------------------------------------------------------------
   /survey に出しているものと同じ部品（app/components/SurveyFeature.tsx）を、
   ここでは設定の中の1ページとして出す。9/6 に場所を足しただけで、
   設問も保存先（共有テーブルの id=9）も変えていない。
   答えは端末ごとに紐づくので、/survey とここのどちらから書いても同じ1件になる。
   「みんなの回答」に役員の合言葉が要るのも /survey と同じ。
   ============================================================ */

import SurveyBody from "@/app/components/SurveyFeature";

export default function PresidentSurvey() {
  // 幅は中の max-w-xl が持っているので、ここは上下と左右の余白だけ。
  return (
    <div style={{ padding: "16px 12px 40px" }}>
      <SurveyBody />
    </div>
  );
}
