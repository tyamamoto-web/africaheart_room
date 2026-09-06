"use client";

/* ============================================================
   TOPページ
   ------------------------------------------------------------
   9/6 に、管理画面 ＞ 社長室 で作っていた画面（app/components/PresidentRoom.tsx）を
   そのままここへ移した。それまでのTOP（ヘッダー＋会員メニュー・参加者アンケートへの導線＋
   本日の部屋割り表＋同席クロス表、告知回の花火の夜空）は出さなくなった。
   部品（Header／RotationTable／CrossTable／EventAnnounce／FireworksBackground）は
   消さずに残してあるが、ここからは使っていない。

   【いまTOPから行けなくなった場所】
   会員メニュー（/test）・参加者アンケート（/survey）・管理画面（/admin）へのリンクは
   このページから無くなった。会員メニューの5機能は 設定 の下から出せるが、
   アンケートと管理画面はURLを直に打つしかない。導線を戻すかはこれから決める。

   画面はブラウザでだけ描く（ssr: false）。
   「準備／当日／ふりかえり」の判定と D-〇 の日数は今日の日付から決めるので、
   ビルドしたときの日付で先に描いてしまうと、開いた日の中身とずれる。
   社長室にあったときも（暗証番号の画面のあと）ブラウザでだけ描いていたので、出方は同じ。
   ============================================================ */

import dynamic from "next/dynamic";

const PresidentRoom = dynamic(() => import("./components/PresidentRoom"), { ssr: false });

export default function Home() {
  // 描く前の一瞬も白のまま（PresidentRoom の面と同じ色）。高さは画面いっぱいに取る。
  // 縦のフレックスにしてあるのは、中身が短いときも .pr-shell を下まで伸ばすため
  // （左のメニューの罫線が途中で切れないように）。
  return (
    <main style={{ minHeight: "100dvh", background: "#FFFFFF", display: "flex", flexDirection: "column" }}>
      <PresidentRoom />
    </main>
  );
}
