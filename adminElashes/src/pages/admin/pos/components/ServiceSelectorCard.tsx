import { createPortal } from "react-dom";
import { ChevronDown } from "lucide-react";

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
    <div className="flex h-full min-h-0 flex-col rounded-sm border border-[#edebe9] bg-white shadow-sm">
      <div className="shrink-0 p-4 sm:p-5">
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
                  {filteredServices.length === 0 ? (
                    <p className="px-4 py-3 text-xs text-[#605e5c]">Sin resultados para la búsqueda.</p>
                  ) : (
                    filteredServices.map((service) => (
                      <button
                        key={service.id}
                        onClick={() => onServiceSelect(String(service.id))}
                        className="group flex w-full items-center gap-3 px-3 py-2 text-left transition hover:bg-[#f3f2f1]"
                      >
                        <div className="h-12 w-12 shrink-0 overflow-hidden rounded-md border border-[#edebe9] bg-[#f3f2f1]">
                          {service.image_url ? (
                            <img src={service.image_url} alt="" className="h-full w-full object-cover" />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-xs font-bold text-[#a19f9d]">
                              {service.name.slice(0, 2).toUpperCase()}
                            </div>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-[#323130]">{service.name}</p>
                          <p className="truncate text-[11px] text-[#605e5c]">{service.description || "Sin descripción"}</p>
                        </div>
                        <span className="shrink-0 text-xs font-semibold text-[#0078d4] opacity-0 transition-opacity group-hover:opacity-100">
                          Bs {service.price.toFixed(2)}
                        </span>
                      </button>
                    ))
                  )}
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

    
      {quickServices.length > 0 && (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden border-t border-[#f3f2f1]">
          <div className="min-h-0 flex-1 overflow-hidden px-4 pb-5 pt-4 sm:px-5">
            <p className="mb-3 text-[11px] font-bold uppercase tracking-wider text-[#605e5c]">Sugerencias rápidas</p>
            <div className="h-full min-h-0 overflow-x-auto overflow-y-hidden">
              <div className="flex h-full min-h-0 snap-x snap-mandatory items-stretch gap-3 pb-2">
                {quickServices.map((service) => (
                  <button
                    key={service.id}
                    type="button"
                    onClick={() => onAddServiceToCart(service)}
                    className="group flex h-[338px] w-[268px] shrink-0 snap-start flex-col overflow-hidden rounded-xl border border-[#edebe9] bg-white text-left shadow-sm transition hover:border-[#0078d4] hover:shadow-md"
                  >
                    <div className="relative h-[252px] w-full shrink-0 bg-[#f3f2f1]">
                      {service.image_url ? (
                        <img src={service.image_url} alt="" className="h-full w-full object-cover transition group-hover:scale-[1.03]" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-lg font-black text-[#a19f9d]">
                          {service.name.slice(0, 2).toUpperCase()}
                        </div>
                      )}
                      <span className="absolute bottom-2 right-2 rounded-md bg-white/95 px-2 py-0.5 text-[10px] font-bold text-[#323130] opacity-0 shadow transition-opacity group-hover:opacity-100">
                        Bs {service.price.toFixed(2)}
                      </span>
                    </div>
                    <div className="p-2.5">
                      <div>
                        <p className="line-clamp-1 text-xs font-semibold leading-tight text-[#323130]">{service.name}</p>
                        <p className="mt-0.5 line-clamp-1 text-[10px] text-[#605e5c]">{service.description || "Servicio disponible"}</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}