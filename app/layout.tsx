import type { Metadata, Viewport } from "next";
import { Inter, Michroma } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

/* 会員画面の「D-23」のような日数の読み上げにだけ使う、横に広い近未来的な書体。
   本文には使わない（本文は Inter のまま）。ビルド時に取り込むので通信は増えない。 */
const michroma = Michroma({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-readout",
  display: "swap",
});

export const metadata: Metadata = {
  title: "アフリカハート",
  description: "社会人カラオケサークル「アフリカハート」の会員アプリ（部屋割り・デュエット曲・宿題ルーレット・プロフィール）",
  applicationName: "アフリカハート",
  icons: {
    icon: "data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><path d=%22M50 84 C16 60 8 40 22 28 C32 19 46 22 50 34 C54 22 68 19 78 28 C92 40 84 60 50 84 Z%22 fill=%22%23C81E77%22/></svg>",
    apple: "/apple-touch-icon.png",
  },
  // ホーム画面追加(iOS)時にフルスクリーン起動＋アプリ名を「アフリカハート」に
  appleWebApp: {
    capable: true,
    title: "アフリカハート",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#C81E77",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body className={`${inter.variable} ${michroma.variable} font-sans antialiased`}>
        {children}
      </body>
    </html>
  );
}
