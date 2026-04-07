import type { ReactNode } from "react";

import FilterActionBar from "@/components/common/FilterActionBar";

import type { SectionTab } from "../types";

interface TabButton {
  id: SectionTab;
  label: string;
  icon: ReactNode;
}

interface UsersTabsProps {
  tabs: TabButton[];
  activeTab: SectionTab;
  onChange: (tab: SectionTab) => void;
  right?: ReactNode;
}

export default function UsersTabs({ tabs, activeTab, onChange, right }: UsersTabsProps) {
  return (
    <FilterActionBar
      left={
        <div className="flex flex-wrap items-center gap-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => onChange(tab.id)}
              className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-all ${
                activeTab === tab.id
                  ? "bg-[#094732] text-white shadow-sm"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-800"
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
      }
      right={right}
    />
  );
}
