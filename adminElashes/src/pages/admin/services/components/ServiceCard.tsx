import { MoreVertical } from "lucide-react";

import { SectionCard } from "../../../../components/common/ui";
import type { ServiceCategoryOption } from "../../../../core/services/agenda/agenda.service";

export type ServiceCardProps = {
  service: ServiceCategoryOption;
  isMenuOpen: boolean;
  onToggleMenu: () => void;
  onEdit: () => void;
  onDelete: () => void;
};

export default function ServiceCard({
  service,
  isMenuOpen,
  onToggleMenu,
  onEdit,
  onDelete,
}: ServiceCardProps) {
  return (
    <SectionCard key={service.id} className="relative" bodyClassName="!p-4">
      {service.image_url ? (
        <img
          src={service.image_url}
          alt={service.name}
          className="mb-3 h-56 w-full rounded-xl border border-slate-200 bg-slate-50 object-contain"
          loading="lazy"
        />
      ) : null}

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-base font-semibold text-slate-800">{service.name}</h3>
          <p className="mt-0.5 text-xs text-slate-500">{service.description || "Sin descripcion"}</p>
        </div>
        <button
          type="button"
          onClick={onToggleMenu}
          className="cursor-pointer rounded-lg p-1 text-slate-500 hover:bg-slate-100"
          aria-label="Abrir menu"
        >
          <MoreVertical className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-3 flex items-center gap-2 text-xs text-slate-600">
        <span className="rounded-full bg-slate-100 px-2 py-1">Categoria</span>
        <span
          className={`rounded-full px-2 py-1 ${
            service.is_mobile ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"
          }`}
        >
          {service.is_mobile ? "Movil" : "No movil"}
        </span>
      </div>

      {isMenuOpen ? (
        <div className="absolute right-4 top-12 z-10 w-40 rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
          <button
            type="button"
            onClick={onEdit}
            className="w-full rounded-lg px-3 py-2 text-left text-sm text-slate-600 hover:bg-slate-50"
          >
            Editar
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="w-full rounded-lg px-3 py-2 text-left text-sm text-rose-600 hover:bg-rose-50"
          >
            Eliminar
          </button>
        </div>
      ) : null}
    </SectionCard>
  );
}
