import { useRef, useState } from "react";
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
  onRemoveServiceFromCart: (service: ServiceOption) => void;
  serviceComboboxRef: React.RefObject<HTMLDivElement | null>;
  serviceMenuRef: React.RefObject<HTMLDivElement | null>;
  /** Cuántas veces está cada servicio en el carrito (key = String(service.id)) */
  cartCountByServiceId?: Record<string, number>;
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
  onRemoveServiceFromCart,
  serviceComboboxRef,
  serviceMenuRef,
  cartCountByServiceId = {},
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
                className="fixed z-3000 bg-white border border-[#edebe9] shadow-xl rounded-sm"
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
        <div className="border-t border-[#f3f2f1] px-4 pb-4 pt-3 sm:px-5">
          <p className="mb-3 text-[11px] font-bold uppercase tracking-wider text-[#605e5c]">Sugerencias rápidas</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {quickServices.map((service) => {
              const cartCount = cartCountByServiceId[String(service.id)] ?? 0;
              const ticketCount = service.ticket_count ?? 0;
              return (
                <div
                  key={service.id}
                  className={`group relative flex flex-col overflow-hidden rounded-xl border bg-white shadow-sm transition hover:shadow-md ${
                    cartCount > 0
                      ? "border-[#0078d4] shadow-[0_0_0_2px_rgba(0,120,212,0.15)]"
                      : "border-[#edebe9] hover:border-[#0078d4]"
                  }`}
                >
                  {/* Imagen con overlay de detalles al hover */}
                  <button
                    type="button"
                    onClick={() => onAddServiceToCart(service)}
                    className="relative h-52 w-full shrink-0 bg-[#f3f2f1] focus:outline-none"
                  >
                    {service.image_url ? (
                      <img
                        src={service.image_url}
                        alt=""
                        className="h-full w-full object-cover transition duration-200 group-hover:scale-[1.04]"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-2xl font-black text-[#c8c6c4]">
                        {service.name.slice(0, 2).toUpperCase()}
                      </div>
                    )}

                    {/* Overlay con detalles — visible solo en hover */}
                    <div className="absolute inset-0 flex flex-col justify-end bg-linear-to-t from-black/70 via-black/20 to-transparent opacity-0 transition-opacity duration-200 group-hover:opacity-100 p-2.5">
                      {service.description && (
                        <p className="line-clamp-2 text-[11px] leading-tight text-white/90 mb-1">
                          {service.description}
                        </p>
                      )}
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-[10px] font-semibold text-white/80">
                          {service.duration_minutes} min
                        </span>
                        {ticketCount > 0 && (
                          <span className="rounded-full bg-white/20 px-1.5 py-0.5 text-[9px] font-bold text-white backdrop-blur-sm">
                            {ticketCount} ticket{ticketCount !== 1 ? "s" : ""}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>

                  {/* Info mínima: solo nombre + precio + controles */}
                  <div className="flex items-center justify-between gap-2 px-2.5 py-2">
                    <div className="min-w-0">
                      <p className="line-clamp-1 text-xs font-semibold text-[#323130]">{service.name}</p>
                      <p className="text-[11px] font-bold text-[#0050a0]">Bs {service.price.toFixed(2)}</p>
                      {service.commission_rate != null && (
                        <p className="text-[10px] text-[#8a8886]">Comisión: {service.commission_rate}%</p>
                      )}
                    </div>

                    {/* Controles +/- */}
                    {cartCount === 0 ? (
                      <button
                        type="button"
                        onClick={() => onAddServiceToCart(service)}
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#0078d4] text-white shadow transition hover:bg-[#006cbe] text-base font-bold leading-none"
                      >
                        +
                      </button>
                    ) : (
                      <div className="flex shrink-0 items-center gap-1">
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); onRemoveServiceFromCart(service); }}
                          className="flex h-7 w-7 items-center justify-center rounded-full border border-[#d2d0ce] bg-white text-[#323130] text-base font-bold shadow-sm transition hover:bg-[#f3f2f1] leading-none"
                        >
                          −
                        </button>
                        <span className="w-5 text-center text-xs font-bold text-[#0078d4]">
                          {cartCount}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); onAddServiceToCart(service); }}
                          className="flex h-7 w-7 items-center justify-center rounded-full bg-[#0078d4] text-white text-base font-bold shadow transition hover:bg-[#006cbe] leading-none"
                        >
                          +
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
