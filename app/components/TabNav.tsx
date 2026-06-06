"use client";

type Tab = "rooms" | "schedule";

type Props = {
  active: Tab;
  onChange: (tab: Tab) => void;
};

const tabs: { id: Tab; label: string; icon: string }[] = [
  { id: "rooms",    label: "部屋割り",     icon: "🏠" },
  { id: "schedule", label: "スケジュール", icon: "📋" },
];

export default function TabNav({ active, onChange }: Props) {
  return (
    <nav className="sticky top-0 z-50 px-4 py-3" style={{ background: "#f0ece5" }}>
      <div
        className="flex gap-1 max-w-lg mx-auto p-1.5 rounded-2xl"
        style={{ background: "rgba(0,0,0,0.08)" }}
      >
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className={`flex-1 flex items-center justify-center gap-1 py-2.5 px-1 rounded-xl text-[11px] font-bold transition-all duration-200 ${
              active === tab.id ? "tab-active" : "hover:bg-white/40"
            }`}
            style={{ color: active === tab.id ? "#2c2c2c" : "#999" }}
          >
            <span className="text-sm leading-none">{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}
