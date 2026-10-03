import { useEffect, useMemo, useState } from "react";
import { ChevronDown, Minus, Search, ShoppingBag, X } from "lucide-react";

import GenericModal from "../../../../components/common/modal/GenericModal";
import type { ServiceCategoryOption, ServiceOption } from "../../../../core/services/agenda/agenda.service";

const bcField =
  "w-full h-10 rounded-lg border border-[var(--ui-border-strong)] bg-white px-3 text-sm text-[var(--ui-text)] outline-none transition focus:border-[#094732] focus:ring-1 focus:ring-[#094732]";

type CategorySelectionModalProps = {
  isOpen: boolean;
  onClose: () => void;
  fieldClass: string;
  serviceCategories: ServiceCategoryOption[];
  categoryModalSearch: string;
  onCategoryModalSearchChange: (value: string) => void;
  categoryModalFilterId: string;
  onCategoryModalFilterChange: (value: string) => void;
  onClear: () => void;
  filteredModalServices: ServiceOption[];
  selectionCounts: Record<string, number>;
  onIncrementSelection: (serviceId: string) => void;
  servicesCatalog: ServiceOption[];
  onDecrementSelection: (serviceId: string) => void;
};

export default function CategorySelectionModal({
  isOpen,
  onClose,
  fieldClass: _fieldClass,
  serviceCategories,
  categoryModalSearch,
  onCategoryModalSearchChange,
  categoryModalFilterId,
  onCategoryModalFilterChange,
  onClear,
  filteredModalServices,
  selectionCounts,
  onIncrementSelection,
  servicesCatalog,
  onDecrementSelection,
}: CategorySelectionModalProps) {
  const [cartDrawerOpen, setCartDrawerOpen] = useState(false);

  useEffect(() => {
    if (!isOpen) setCartDrawerOpen(false);
  }, [isOpen]);

  const { totalQty, totalBs, cartLines } = useMemo(() => {
    let qty = 0;
    let bs = 0;
    const lines: Array<{ service: ServiceOption; count: number }> = [];

    for (const [id, count] of Object.entries(selectionCounts)) {
      if (!count) continue;
      const service = servicesCatalog.find((s) => String(s.id) === id);
      if (!service) continue;
      qty += count;
      bs += service.price * count;
      lines.push({ service, count });
    }

    lines.sort((a, b) => a.service.name.localeCompare(b.service.name));
    return { totalQty: qty, totalBs: bs, cartLines: lines };
  }, [selectionCounts, servicesCatalog]);

  return (
    <GenericModal
      isOpen={isOpen}
      onClose={onClose}
      title="Catálogo de servicios"
      fullScreen
      size="xl"
      contentClassName=""
      bodyClassName="p-0"
    >
      <div className="flex min-h-0 flex-1 flex-col bg-[var(--ui-surface-muted)]">
        {/* Barra tipo command (Dynamics) */}
        <div className="shrink-0 border-b border-[var(--ui-border)] bg-white px-4 py-3 shadow-[0_1px_0_#edebe9] sm:px-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold text-[var(--ui-text-muted)]">Total estimado</p>
              <p className="mt-0.5 text-2xl font-semibold tabular-nums text-[#094732] sm:text-3xl">Bs {totalBs.toFixed(2)}</p>
              <p className="mt-1 text-xs text-[var(--ui-text-muted)]">
                <span className="font-semibold text-[var(--ui-text)]">{totalQty}</span> unidades en esta venta
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setCartDrawerOpen(true)}
                className="relative flex h-10 items-center gap-2 rounded-lg border border-[var(--ui-border-strong)] bg-white px-4 text-sm font-semibold text-[var(--ui-text)] shadow-sm transition hover:bg-[var(--ui-surface-hover)]"
              >
                <ShoppingBag className="h-4 w-4 text-[#094732]" />
                Detalle del carrito
                {totalQty > 0 ? (
                  <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#094732] px-1 text-[10px] font-bold text-white ring-2 ring-white">
                    {totalQty}
                  </span>
                ) : null}
              </button>
            </div>
          </div>
        </div>

        {/* Filtros — panel blanco */}
        <div className="shrink-0 border-b border-[var(--ui-border)] bg-white px-4 py-3 sm:px-5">
          <div className="grid gap-2 sm:grid-cols-[1fr_minmax(0,200px)_auto] sm:gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--ui-text-muted)]" />
              <input
                value={categoryModalSearch}
                onChange={(event) => onCategoryModalSearchChange(event.target.value)}
                placeholder="Buscar servicio o precio..."
                className={`${bcField} pl-9`}
              />
            </div>
            <div className="relative">
              <select
                value={categoryModalFilterId}
                onChange={(event) => onCategoryModalFilterChange(event.target.value)}
                className={`${bcField} cursor-pointer appearance-none pr-9`}
              >
                <option value="all">Todas las categorías</option>
                {serviceCategories.map((category) => (
                  <option key={category.id} value={String(category.id)}>
                    {category.name}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--ui-text-muted)]" />
            </div>
            <button
              type="button"
              onClick={onClear}
              className="h-10 cursor-pointer rounded-lg border border-[var(--ui-border-strong)] bg-[var(--ui-surface-muted)] px-4 text-xs font-semibold text-[var(--ui-text)] transition hover:bg-[var(--ui-surface-hover)]"
            >
              Limpiar filtros
            </button>
          </div>
        </div>

        {/* Cinta de seleccionados */}
        {cartLines.length > 0 ? (
          <div className="shrink-0 border-b border-[var(--ui-border)] bg-[var(--ui-surface-muted)] px-4 py-2 sm:px-5">
            <p className="mb-2 text-[11px] font-semibold text-[var(--ui-text-muted)]">Seleccionados</p>
            <div className="flex max-h-24 flex-wrap gap-2 overflow-y-auto">
              {cartLines.map(({ service, count }) => (
                <div
                  key={service.id}
                  className="inline-flex max-w-full items-center gap-2 rounded-lg border border-[#094732]/40 bg-[var(--ui-accent-soft)] py-1 pl-1 pr-2 text-left shadow-sm"
                >
                  <div className="h-9 w-9 shrink-0 overflow-hidden rounded-lg bg-[var(--ui-surface-hover)]">
                    {service.image_url ? (
                      <img src={service.image_url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full items-center justify-center text-[10px] font-bold text-[var(--ui-text-muted)]">
                        {service.name.slice(0, 2).toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold text-[var(--ui-text)]">{service.name}</p>
                    <p className="text-[10px] text-[var(--ui-text-muted)]">
                      ×{count} · Bs {(service.price * count).toFixed(2)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {/* Grid a pantalla completa */}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-5">
          <div className="mx-auto grid max-w-[1920px] grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
            {filteredModalServices.length === 0 ? (
              <p className="col-span-full py-16 text-center text-sm text-[var(--ui-text-muted)]">No hay servicios para los filtros actuales.</p>
            ) : (
              filteredModalServices.map((service) => {
                const selectionCount = selectionCounts[String(service.id)] ?? 0;
                const isSelected = selectionCount > 0;

                return (
                  <button
                    key={service.id}
                    type="button"
                    onClick={() => onIncrementSelection(String(service.id))}
                    className={`group flex cursor-pointer flex-col overflow-hidden rounded-lg border bg-white text-left shadow-[0_1px_2px_rgba(0,0,0,0.06)] transition hover:shadow-md ${
                      isSelected
                        ? "border-[#094732] ring-2 ring-[#094732]/30"
                        : "border-[var(--ui-border)] hover:border-[var(--ui-border-strong)]"
                    }`}
                  >
                    <div className="relative aspect-[5/4] w-full min-h-[140px] bg-[var(--ui-surface-muted)] sm:min-h-[160px]">
                      {service.image_url ? (
                        <img
                          src={service.image_url}
                          alt={service.name}
                          className="h-full w-full object-cover transition duration-200 group-hover:opacity-95"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-lg font-semibold text-[var(--ui-text-muted)]">
                          {service.name.slice(0, 2).toUpperCase()}
                        </div>
                      )}
                      {isSelected ? (
                        <span className="absolute left-2 top-2 rounded-lg bg-[#094732] px-2 py-0.5 text-xs font-bold text-white shadow">
                          ×{selectionCount}
                        </span>
                      ) : null}
                      <span className="absolute right-2 top-2 rounded-lg bg-white/95 px-2 py-0.5 text-xs font-semibold text-[var(--ui-text)] shadow ring-1 ring-[#edebe9]">
                        Bs {service.price.toFixed(2)}
                      </span>
                    </div>
                    <div className="border-t border-[var(--ui-border)] bg-[var(--ui-surface-muted)] px-2.5 py-2">
                      <p className="line-clamp-2 text-xs font-semibold leading-snug text-[var(--ui-text)]">{service.name}</p>
                      <p className="mt-0.5 text-[10px] text-[var(--ui-text-muted)]">{service.category?.name ?? "Sin categoría"}</p>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      </div>

      {cartDrawerOpen ? (
        <>
          <button
            type="button"
            className="fixed inset-0 z-[60] bg-[#021a12]/40"
            aria-label="Cerrar carrito"
            onClick={() => setCartDrawerOpen(false)}
          />
          <div
            className="fixed right-0 top-0 z-[70] flex h-full w-full max-w-md flex-col border-l border-[var(--ui-border)] bg-white shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-label="Carrito de servicios"
          >
            <div className="flex items-center justify-between border-b border-[var(--ui-border)] bg-[var(--ui-surface-muted)] px-4 py-3">
              <div>
                <p className="text-[11px] font-semibold text-[var(--ui-text-muted)]">Carrito</p>
                <p className="text-base font-semibold text-[var(--ui-text)]">
                  {totalQty} {totalQty === 1 ? "unidad" : "unidades"}
                </p>
                <p className="mt-0.5 text-xl font-semibold tabular-nums text-[#094732]">Bs {totalBs.toFixed(2)}</p>
              </div>
              <button
                type="button"
                onClick={() => setCartDrawerOpen(false)}
                className="rounded-lg p-2 text-[var(--ui-text-muted)] transition hover:bg-[var(--ui-surface-hover)]"
                aria-label="Cerrar panel"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
              {cartLines.length === 0 ? (
                <p className="px-2 py-8 text-center text-sm text-[var(--ui-text-muted)]">Sin ítems. Pulse las tarjetas del catálogo.</p>
              ) : (
                <ul className="space-y-2">
                  {cartLines.map(({ service, count }) => (
                    <li
                      key={service.id}
                      className="flex gap-3 rounded-lg border border-[var(--ui-border)] bg-[var(--ui-surface-muted)] p-3"
                    >
                      <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-[var(--ui-border)] bg-white">
                        {service.image_url ? (
                          <img src={service.image_url} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full items-center justify-center text-[10px] font-bold text-[var(--ui-text-muted)]">
                            {service.name.slice(0, 2).toUpperCase()}
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-[var(--ui-text)]">{service.name}</p>
                        <p className="text-xs text-[var(--ui-text-muted)]">Bs {service.price.toFixed(2)} c/u</p>
                        <p className="mt-1 text-sm font-semibold text-[var(--ui-text)]">
                          Bs {(service.price * count).toFixed(2)}
                          <span className="ml-2 font-normal text-[var(--ui-text-muted)]">×{count}</span>
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => onDecrementSelection(String(service.id))}
                        className="flex h-9 w-9 shrink-0 items-center justify-center self-center rounded-lg border border-[var(--ui-border-strong)] bg-white text-[var(--ui-text)] transition hover:bg-[var(--ui-surface-hover)]"
                        title="Quitar una unidad"
                      >
                        <Minus className="h-4 w-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="border-t border-[var(--ui-border)] bg-white px-4 py-3">
              <p className="text-center text-[11px] text-[var(--ui-text-muted)]">Los cambios se aplican a la venta en curso</p>
              <button
                type="button"
                onClick={() => setCartDrawerOpen(false)}
                className="mt-2 w-full rounded-lg bg-[#094732] py-2.5 text-sm font-semibold text-white transition hover:bg-[#063324]"
              >
                Volver al catálogo
              </button>
            </div>
          </div>
        </>
      ) : null}
    </GenericModal>
  );
}
