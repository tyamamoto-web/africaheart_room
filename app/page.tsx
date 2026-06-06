"use client";

import { useState } from "react";
import Header from "./components/Header";
import TabNav from "./components/TabNav";
import RotationTable from "./components/RotationTable";
import Schedule from "./components/Schedule";

type Tab = "rooms" | "schedule";

export default function Home() {
  const [activeTab, setActiveTab] = useState<Tab>("rooms");

  return (
    <main className="min-h-screen fun-bg">
      <Header />
      <TabNav active={activeTab} onChange={setActiveTab} />
      <div className="pt-2">
        {activeTab === "rooms"    && <RotationTable />}
        {activeTab === "schedule" && <Schedule />}
      </div>
      <footer className="text-center pb-10 pt-4 px-4">
        <p className="text-xs" style={{ color: "#bbb" }}>
          アフリカハート 運営スタッフ一同 🎤
        </p>
      </footer>
    </main>
  );
}
