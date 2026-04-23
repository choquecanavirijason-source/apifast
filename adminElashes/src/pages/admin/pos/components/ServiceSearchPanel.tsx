import ServiceSelectorCard from "./ServiceSelectorCard";
import type { ServiceCategoryOption, ServiceOption } from "../../../core/services/agenda/agenda.service";

interface ServiceSearchPanelProps {
  labelClass: string;
  fieldClass: string;
  serviceSearch: string;
  onServiceSearchChange: (v: string) => void;
  onServiceInputFocus: () => void;
  onToggleServiceMenu: () => void;
  isServiceMenuOpen: boolean;
  serviceMenuPosition: { top: number; left: number; width: number } | null;
  filteredServices: ServiceOption[];
  onServiceSelect: (id: string) => void;
  selectedServiceCategoryId: string;
  onCategoryFilterChange: (id: string) => void;
  serviceCategories: ServiceCategoryOption[];
  onOpenCategoryModal: () => void;
  quickServices: ServiceOption[];
  onAddServiceToCart: (service: ServiceOption) => void;
  serviceComboboxRef: React.RefObject<HTMLDivElement>;
  serviceMenuRef: React.RefObject<HTMLDivElement>;
}

export default function ServiceSearchPanel(props: ServiceSearchPanelProps) {
  return (
    <div className="flex-1">
      <ServiceSelectorCard {...props} />
    </div>
  );
}
