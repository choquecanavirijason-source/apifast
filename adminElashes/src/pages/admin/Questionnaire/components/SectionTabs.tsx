import React from "react";
import { Users, User, Baby } from "lucide-react";
import { SECTIONS} from "../types";
import type {TargetAudience } from "../types";

interface Props {
  activeTab: TargetAudience;
  onChange: (tab: TargetAudience) => void;
}

export const SectionTabs: React.FC<Props> = ({ activeTab, onChange }) => {
  const getIcon = (id: string) => {
    if (id === "NIÑOS") return <Baby className="w-4 h-4" />;
    if (id === "JOVENES") return <User className="w-4 h-4" />;
    return <Users className="w-4 h-4" />;
  };

  return (
    <div className="flex flex-wrap gap-2 mb-8">
      {SECTIONS.map((section) => {
        const isActive = activeTab === section.id;
        return (
          <button
            key={section.id}
            onClick={() => onChange(section.id as TargetAudience)}
            className={`
              flex items-center gap-2 px-5 py-2 rounded-full text-sm font-medium transition-all duration-200 border
              ${isActive 
                ? "bg-gray-900 text-white border-gray-900 shadow-md" 
                : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50 hover:border-gray-300"}
            `}
          >
            {getIcon(section.id)}
            {section.label}
          </button>
        );
      })}
    </div>
  );
};