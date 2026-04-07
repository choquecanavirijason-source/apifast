import { ChevronDown, Search } from "lucide-react";

import GenericModal from "../../../../components/common/modal/GenericModal";
import type { ServiceCategoryOption, ServiceOption } from "../../../../core/services/agenda/agenda.service";

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
};

export default function CategorySelectionModal({
  isOpen,
  onClose,
  fieldClass,
  serviceCategories,
  categoryModalSearch,
  onCategoryModalSearchChange,
  categoryModalFilterId,
  onCategoryModalFilterChange,
  onClear,
  filteredModalServices,
  selectionCounts,
  onIncrementSelection,
}: CategorySelectionModalProps) {
  return (
    <GenericModal
      isOpen={isOpen}
      onClose={onClose}
      title={undefined}
      size="xl"
      contentClassName="max-w-none w-full h-[calc(100vh-2rem)] p-0"
      bodyClassName="p-6"
    >
      <div className="flex flex-col gap-4">
        <div className="grid gap-3 sm:grid-cols-[1fr_220px_auto]">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              value={categoryModalSearch}
              onChange={(event) => onCategoryModalSearchChange(event.target.value)}
              placeholder="Buscar por servicio o precio..."
              className={`${fieldClass} pl-10`}
            />
          </div>
          <div className="relative">
            <select
              value={categoryModalFilterId}
              onChange={(event) => onCategoryModalFilterChange(event.target.value)}
              className={`${fieldClass} appearance-none cursor-pointer`}
            >
              <option value="all">Todas las categorias</option>
              {serviceCategories.map((category) => (
                <option key={category.id} value={String(category.id)}>
                  {category.name}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
          </div>
          <button
            type="button"
            onClick={onClear}
            className="h-11 cursor-pointer rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
          >
            Limpiar
          </button>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
          {filteredModalServices.length === 0 ? (
            <p className="text-sm text-slate-400">No hay servicios para los filtros actuales.</p>
          ) : (
            filteredModalServices.map((service) => {
              const selectionCount = selectionCounts[String(service.id)] ?? 0;

              return (
                <button
                  key={service.id}
                  type="button"
                  onClick={() => onIncrementSelection(String(service.id))}
                  className="group flex cursor-pointer flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white text-left shadow-sm transition hover:border-emerald-300 hover:shadow-md hover:scale-[1.03]"
                >
                  <div className="relative h-72 w-full bg-slate-100">
                    {service.image_url ? (
                      <img src={service.image_url} alt={service.name} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-sm font-semibold text-slate-400">
                        {service.name.slice(0, 2).toUpperCase()}
                      </div>
                    )}
                    {selectionCount > 0 ? (
                      <span className="absolute left-3 top-3 rounded-full bg-emerald-600 px-2 py-1 text-[11px] font-bold text-white shadow">
                        {selectionCount}
                      </span>
                    ) : null}
                    <span className="absolute right-3 top-3 rounded-full bg-white/90 px-2 py-1 text-[11px] font-bold text-slate-700 shadow">
                      Bs {service.price.toFixed(2)}
                    </span>
                    <div className="absolute inset-0 flex items-end bg-slate-900/70 opacity-0 transition group-hover:opacity-100">
                      <div className="w-full p-3 text-xs text-white">
                        <p className="text-sm font-semibold">{service.name}</p>
                        <p className="mt-1 text-[11px] text-emerald-100">{service.category?.name ?? "Sin categoria"}</p>
                        {service.description ? (
                          <p className="mt-2 text-[11px] text-slate-200 line-clamp-3">{service.description}</p>
                        ) : null}
                        <p className="mt-3 text-[11px] font-semibold text-emerald-200">Click para agregar</p>
                      </div>
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>

        <div className="sticky bottom-0 mt-8 flex flex-col gap-3 border-t border-slate-100 bg-white/95 pt-4 pb-2 backdrop-blur sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-slate-500">
            Agregados en esta vista:{" "}
            <span className="font-semibold text-slate-700">
              {Object.values(selectionCounts).reduce((acc, value) => acc + value, 0)}
            </span>
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="cursor-pointer rounded-2xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </GenericModal>
  );
}
