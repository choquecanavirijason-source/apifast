import { createPortal } from "react-dom";
import { ChevronDown, Search } from "lucide-react";

import type { ServiceCategoryOption, ServiceOption } from "../../../../core/services/agenda/agenda.service";

type ServiceSelectorCardProps = {
  labelClass: string;
  fieldClass: string;
  serviceSearch: string;
  onServiceSearchChange: (value: string) => void;
  onServiceInputFocus: () => void;
  onToggleServiceMenu: () => void;
  isServiceMenuOpen: boolean;
  serviceMenuPosition: { top: number; left: number; width: number } | null;
  filteredServices: ServiceOption[];
  onServiceSelect: (serviceId: string) => void;
  selectedServiceCategoryId: string;
  onCategoryFilterChange: (value: string) => void;
  serviceCategories: ServiceCategoryOption[];
  onOpenCategoryModal: () => void;
  quickServices: ServiceOption[];
  onAddServiceToCart: (service: ServiceOption) => void;
  serviceComboboxRef: React.RefObject<HTMLDivElement | null>;
  serviceMenuRef: React.RefObject<HTMLDivElement | null>;
};

export default function ServiceSelectorCard({
  labelClass,
  fieldClass,
  serviceSearch,
  onServiceSearchChange,
  onServiceInputFocus,
  onToggleServiceMenu,
  isServiceMenuOpen,
  serviceMenuPosition,
  filteredServices,
  onServiceSelect,
  selectedServiceCategoryId,
  onCategoryFilterChange,
  serviceCategories,
  onOpenCategoryModal,
  quickServices,
  onAddServiceToCart,
  serviceComboboxRef,
  serviceMenuRef,
}: ServiceSelectorCardProps) {
  return (
    <div className="bg-white border border-[#edebe9] shadow-sm rounded-sm">
      <div className="p-5">
        <div className="flex flex-col md:flex-row gap-4 items-end">
          {/* Input de Búsqueda */}
          <div className="flex-1 w-full" ref={serviceComboboxRef}>
            <label className={labelClass}>Buscar Producto o Servicio</label>
            <div className="relative">
              <input
                value={serviceSearch}
                onChange={(e) => onServiceSearchChange(e.target.value)}
                onFocus={onServiceInputFocus}
                placeholder="Escriba para buscar..."
                className={`${fieldClass} pl-3 pr-10`}
              />
              <button
                type="button"
                onClick={onToggleServiceMenu}
                className="absolute right-0 top-0 h-9 w-9 flex items-center justify-center text-[#605e5c] hover:bg-[#f3f2f1]"
              >
                <ChevronDown className="h-4 w-4" />
              </button>
            </div>

            {/* Portal Menu Estilo Microsoft */}
            {isServiceMenuOpen && serviceMenuPosition && createPortal(
              <div
                ref={serviceMenuRef}
                className="fixed z-[3000] bg-white border border-[#edebe9] shadow-xl rounded-sm"
                style={{ ...serviceMenuPosition, top: serviceMenuPosition.top + 4 }}
              >
                <div className="max-h-64 overflow-y-auto py-1">
                  {filteredServices.map((service) => (
                    <button
                      key={service.id}
                      onClick={() => onServiceSelect(String(service.id))}
                      className="flex w-full items-center justify-between px-4 py-2 text-left hover:bg-[#f3f2f1] text-sm"
                    >
                      <span className="text-[#323130]">{service.name}</span>
                      <span className="font-semibold text-[#0078d4]">Bs {service.price.toFixed(2)}</span>
                    </button>
                  ))}
                </div>
              </div>,
              document.body
            )}
          </div>

          {/* Categoría */}
          <div className="w-full md:w-64">
            <label className={labelClass}>Categoría</label>
            <select
              value={selectedServiceCategoryId}
              onChange={(e) => onCategoryFilterChange(e.target.value)}
              className={fieldClass}
            >
              <option value="all">Todas las categorías</option>
              {serviceCategories.map((cat) => (
                <option key={cat.id} value={String(cat.id)}>{cat.name}</option>
              ))}
            </select>
          </div>

          <button
            onClick={onOpenCategoryModal}
            className="h-9 px-4 border border-[#8a8886] text-sm font-semibold hover:bg-[#f3f2f1] transition-colors rounded-sm whitespace-nowrap"
          >
            Explorar Todo
          </button>
        </div>
      </div>

      {/* Quick Actions / Accesos Rápidos */}
      {quickServices.length > 0 && (
        <div className="px-5 pb-5 border-t border-[#f3f2f1] pt-4">
          <p className="text-[11px] font-bold text-[#605e5c] uppercase tracking-wider mb-3">Sugerencias Rápidas</p>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
            {quickServices.map((service) => (
              <button
                key={service.id}
                onClick={() => onAddServiceToCart(service)}
                className="flex items-center gap-3 p-2 border border-[#edebe9] hover:border-[#0078d4] hover:bg-[#f0f6ff] transition-all text-left rounded-sm group"
              >
                <div className="h-8 w-8 bg-[#f3f2f1] rounded-sm flex-shrink-0 flex items-center justify-center text-[10px] font-bold text-[#605e5c] group-hover:bg-[#0078d4] group-hover:text-white">
                  {service.name.slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold truncate text-[#323130]">{service.name}</p>
                  <p className="text-[10px] text-[#605e5c]">Bs {service.price.toFixed(2)}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}