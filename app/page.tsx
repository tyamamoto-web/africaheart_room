"use client";

import Header from "./components/Header";
import RotationTable from "./components/RotationTable";

export default function Home() {
  return (
    <main className="min-h-screen fun-bg">
      <Header />
      <div className="pt-4">
        <RotationTable />
      </div>
      <footer className="text-center pb-10 pt-4 px-4">
        <p className="text-xs" style={{ color: "#bbb" }}>
          アフリカハート 運営スタッフ一同 🎤
        </p>
      </footer>
    </main>
  );
}
