import { Briefcase, Edit, Trash2 } from "lucide-react";

import type { ServiceCategoryOption } from "../../../../core/services/agenda/agenda.service";

export type ServiceCardProps = {
  service: ServiceCategoryOption;
  isMenuOpen: boolean;
  onToggleMenu: () => void;
  onEdit: () => void;
  onDelete: () => void;
};

export default function ServiceCard({ service, onEdit, onDelete }: ServiceCardProps) {
  return (
    <div className="group overflow-hidden rounded-xl border border-slate-200 bg-white transition-all hover:border-slate-300 hover:shadow-md">
      <div className="flex aspect-video items-center justify-center overflow-hidden bg-slate-50">
        {service.image_url ? (
          <img
            src={service.image_url}
            alt={service.name}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <Briefcase className="h-8 w-8 text-slate-300" />
        )}
      </div>

      <div className="border-t border-slate-100 px-3 py-2.5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-slate-700">{service.name}</p>
            {service.description ? (
              <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">{service.description}</p>
            ) : null}
            <span
              className={`mt-1.5 inline-block rounded-full px-2 py-0.5 text-xs ${
                service.is_mobile
                  ? "bg-emerald-100 text-emerald-700"
                  : "bg-slate-100 text-slate-500"
              }`}
            >
              {service.is_mobile ? "Movil" : "No movil"}
            </span>
          </div>
          <div className="flex shrink-0 gap-1 opacity-0 transition-opacity group-hover:opacity-100">
            <button
              type="button"
              onClick={onEdit}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-blue-600"
              title="Editar"
            >
              <Edit className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={onDelete}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
              title="Eliminar"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
