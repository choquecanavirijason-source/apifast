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
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
      <div className="px-5 pt-5 pb-4">
        <label className={labelClass}>Agregar Servicio</label>
        <div className="flex gap-2">
          <div className="relative flex-1" ref={serviceComboboxRef}>
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
            <input
              value={serviceSearch}
              onChange={(event) => onServiceSearchChange(event.target.value)}
              onFocus={onServiceInputFocus}
              placeholder="Buscar producto o servicio..."
              className={`${fieldClass} pl-10 pr-10`}
            />
            <button
              type="button"
              onClick={onToggleServiceMenu}
              className="absolute right-2 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
              aria-label="Mostrar servicios"
            >
              <ChevronDown className="h-4 w-4" />
            </button>

            {isServiceMenuOpen && serviceMenuPosition && typeof document !== "undefined"
              ? createPortal(
                  <div
                    ref={serviceMenuRef}
                    className="fixed z-[3000] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl"
                    style={{
                      top: serviceMenuPosition.top,
                      left: serviceMenuPosition.left,
                      width: serviceMenuPosition.width,
                    }}
                  >
                    <div className="max-h-56 overflow-y-auto py-1">
                      {filteredServices.length === 0 ? (
                        <p className="px-3 py-2 text-xs text-slate-500">No se encontraron servicios.</p>
                      ) : (
                        filteredServices.map((service) => (
                          <button
                            key={service.id}
                            type="button"
                            onClick={() => onServiceSelect(String(service.id))}
                            className="flex w-full items-center justify-between px-3 py-2 text-left transition hover:bg-slate-50"
                          >
                            <span className="truncate text-sm text-slate-700">{service.name}</span>
                            <span className="ml-3 shrink-0 text-xs font-semibold text-slate-500">
                              Bs {service.price.toFixed(2)}
                            </span>
                          </button>
                        ))
                      )}
                    </div>
                  </div>,
                  document.body
                )
              : null}
          </div>

          <div className="w-44">
            <select
              value={selectedServiceCategoryId}
              onChange={(event) => onCategoryFilterChange(event.target.value)}
              className={`${fieldClass} appearance-none cursor-pointer`}
            >
              <option value="all">Todas las categorias</option>
              {serviceCategories.map((category) => (
                <option key={category.id} value={String(category.id)}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            onClick={onOpenCategoryModal}
            className="h-11 flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-semibold text-slate-600 transition hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-600"
          >
            Ver categorias
          </button>
        </div>
      </div>
      {quickServices.length > 0 && (
        <div className="px-5 pb-5">
          <p className={labelClass}>Accesos Rapidos</p>
          <div className="-mx-1 overflow-x-auto pb-1 [scrollbar-width:thin]">
            <div className="flex min-w-max gap-2 px-1">
              {quickServices.map((service) => (
                <button
                  key={service.id}
                  onClick={() => onAddServiceToCart(service)}
                  className="group inline-flex min-w-[190px] items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:bg-slate-100 hover:text-slate-900 active:scale-95"
                >
                  {service.image_url ? (
                    <img
                      src={service.image_url}
                      alt={service.name}
                      className="h-6 w-6 rounded-md object-cover border border-slate-200"
                    />
                  ) : null}
                  <span className="truncate">{service.name}</span>
                  <span className="ml-auto shrink-0 text-slate-400 font-normal">Bs {service.price.toFixed(2)}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
