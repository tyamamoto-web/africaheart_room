import type { MetadataRoute } from "next";

// ホーム画面に追加(PWA)したときのアプリ名・アイコン・表示方法。
// Next.js が /manifest.webmanifest として自動配信し、<link rel="manifest"> も自動挿入する。
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "アフリカハート",
    short_name: "アフリカハート",
    description: "社会人カラオケサークル「アフリカハート」の会員アプリ（部屋割り・デュエット曲・宿題ルーレット・プロフィール）",
    lang: "ja",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f0ece5",
    theme_color: "#C81E77",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
