import type { ReactNode } from "react";

import { SegmentedTabs } from "@/components/common/ui";

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
    <SegmentedTabs
      options={tabs}
      value={activeTab}
      onChange={onChange}
      right={right}
    />
  );
}
