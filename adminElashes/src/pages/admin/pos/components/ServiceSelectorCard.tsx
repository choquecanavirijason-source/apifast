import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";

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
  serviceComboboxRef,
  serviceMenuRef,
  cartCountByServiceId = {},
}: ServiceSelectorCardProps) {
  const quickServicesTrackRef = useRef<HTMLDivElement | null>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateQuickScrollState = () => {
    const track = quickServicesTrackRef.current;
    if (!track) {
      setCanScrollLeft(false);
      setCanScrollRight(false);
      return;
    }

    const maxScrollLeft = track.scrollWidth - track.clientWidth;
    setCanScrollLeft(track.scrollLeft > 4);
    setCanScrollRight(maxScrollLeft - track.scrollLeft > 4);
  };

  useEffect(() => {
    const track = quickServicesTrackRef.current;
    if (!track) return;

    updateQuickScrollState();
    track.addEventListener("scroll", updateQuickScrollState, { passive: true });
    window.addEventListener("resize", updateQuickScrollState);

    return () => {
      track.removeEventListener("scroll", updateQuickScrollState);
      window.removeEventListener("resize", updateQuickScrollState);
    };
  }, [quickServices.length]);

  const scrollQuickServices = (direction: "left" | "right") => {
    const track = quickServicesTrackRef.current;
    if (!track) return;
    track.scrollBy({
      left: direction === "left" ? -320 : 320,
      behavior: "smooth",
    });
  };

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
            <div className="relative">
              {canScrollLeft ? (
                <button
                  type="button"
                  onClick={() => scrollQuickServices("left")}
                  className="absolute left-1 top-1/2 z-20 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-[#d2d0ce] bg-white/95 text-[#323130] shadow-sm transition hover:bg-[#f3f2f1]"
                  aria-label="Desplazar a la izquierda"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
              ) : null}
              {canScrollRight ? (
                <button
                  type="button"
                  onClick={() => scrollQuickServices("right")}
                  className="absolute right-1 top-1/2 z-20 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-[#d2d0ce] bg-white/95 text-[#323130] shadow-sm transition hover:bg-[#f3f2f1]"
                  aria-label="Desplazar a la derecha"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              ) : null}

              {canScrollLeft ? (
                <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-10 bg-gradient-to-r from-white to-transparent" />
              ) : null}
              {canScrollRight ? (
                <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-10 bg-gradient-to-l from-white to-transparent" />
              ) : null}

              <div ref={quickServicesTrackRef} className="overflow-x-auto overflow-y-hidden scroll-smooth pb-1">
                <div className="flex snap-x snap-mandatory items-stretch gap-3 pb-2">
                {quickServices.map((service) => {
                  const cartCount = cartCountByServiceId[String(service.id)] ?? 0;
                  return (
                    <button
                      key={service.id}
                      type="button"
                      onClick={() => onAddServiceToCart(service)}
                      className={`group flex h-[338px] w-[268px] shrink-0 snap-start flex-col overflow-hidden rounded-xl border bg-white text-left shadow-sm transition hover:shadow-md ${
                        cartCount > 0
                          ? "border-[#0078d4] shadow-[0_0_0_2px_rgba(0,120,212,0.18)]"
                          : "border-[#edebe9] hover:border-[#0078d4]"
                      }`}
                    >
                      <div className="relative h-[252px] w-full shrink-0 bg-[#f3f2f1]">
                        {service.image_url ? (
                          <img src={service.image_url} alt="" className="h-full w-full object-cover transition group-hover:scale-[1.03]" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-lg font-black text-[#a19f9d]">
                            {service.name.slice(0, 2).toUpperCase()}
                          </div>
                        )}
                        {/* Badge de cantidad en carrito */}
                        {cartCount > 0 && (
                          <span className="absolute left-2 top-2 flex h-7 min-w-7 items-center justify-center rounded-full bg-[#0078d4] px-2 text-xs font-bold text-white shadow-md">
                            ×{cartCount}
                          </span>
                        )}
                        <span className="absolute bottom-2 right-2 rounded-md bg-white/95 px-2 py-0.5 text-[10px] font-bold text-[#323130] opacity-0 shadow transition-opacity group-hover:opacity-100">
                          Bs {service.price.toFixed(2)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-2 p-2.5">
                        <div className="min-w-0">
                          <p className="line-clamp-1 text-xs font-semibold leading-tight text-[#323130]">{service.name}</p>
                          <p className="mt-0.5 line-clamp-1 text-[10px] text-[#605e5c]">{service.description || "Servicio disponible"}</p>
                        </div>
                        {cartCount > 0 && (
                          <span className="shrink-0 rounded-full bg-[#eef6ff] px-2 py-0.5 text-[10px] font-bold text-[#0078d4]">
                            en carrito
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
