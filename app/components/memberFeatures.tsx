"use client";

/* ============================================================
   会員メニューの機能一覧
   ------------------------------------------------------------
   「デュエット」「宿題ルーレット」「歌唱順ルーレット」「プロフィール」「ギャラリー」の
   5つ。会員メニュー（app/test/page.tsx）のタブと、TOP ＞ 設定 の項目
   （app/components/PresidentFeature.tsx。管理画面 ＞ 社長室 にも同じものが出る）は、
   どちらもこの並びをそのまま使う。
   id は URL の ?tab=<id> と、設定のメニューの項目の id（"m10-<id>"）に使っているので、
   名前を変えても id は変えないこと。
   ============================================================ */

import type { ReactNode } from "react";
import DuetFeature from "@/app/components/DuetFeature";
import HomeworkRoulette from "@/app/components/HomeworkRoulette";
import SingingOrderRoulette from "@/app/components/SingingOrderRoulette";
import ProfileFeature from "@/app/components/ProfileFeature";
import GalleryFeature from "@/app/components/GalleryFeature";

export type RenderCtx = {
  sinceSeen: string; // この時刻より後に更新されたプロフィールを「新着」扱いにする基準
  onLatest: (iso: string) => void; // 表示中に判明したDBの最終更新時刻を親へ通知（未読判定を即時化）
};
export type Feature = {
  id: string;
  tab: string;          // タブに表示する短い名前
  title: string;        // 機能の正式名称
  description: string;  // 機能の説明
  render: (ctx: RenderCtx) => ReactNode;
};

/* ── 機能一覧（ここに追加していく）──────────────────── */
export const features: Feature[] = [
  {
    id: "duet",
    tab: "デュエット",
    title: "デュエット曲リスト",
    description: "歌いたいデュエット曲を登録し、歌える曲にいいね。全員で共有されます。",
    render: () => <DuetFeature />,
  },
  {
    id: "homework",
    tab: "宿題ルーレット",
    title: "宿題ルーレット",
    description: "ここで決まった3つが今回の宿題テーマです。各テーマに合う持ち歌を1曲ずつ、今回のオフ会までに準備してきてください。",
    render: () => <HomeworkRoulette />,
  },
  {
    id: "singorder",
    tab: "歌唱順ルーレット",
    title: "歌唱順ルーレット",
    description: "参加者からスロット形式で最初に歌う人を抽選し、右回り／左回りの進行方向を決めます。",
    render: () => <SingingOrderRoulette />,
  },
  {
    id: "profile",
    tab: "プロフィール",
    title: "メンバープロフィール",
    description: "",
    render: (ctx) => <ProfileFeature sinceSeen={ctx.sinceSeen} onLatest={ctx.onLatest} />,
  },
  {
    id: "gallery",
    tab: "ギャラリー",
    title: "ギャラリー",
    description: "当日の写真と動画です。開いて拡大したり、自分の端末に保存できます。",
    render: () => <GalleryFeature />,
  },
];
