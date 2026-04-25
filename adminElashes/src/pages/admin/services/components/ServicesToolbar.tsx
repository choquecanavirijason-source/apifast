import { Plus } from "lucide-react";

import { Button } from "../../../../components/common/ui";

export type ServicesToolbarProps = {
  onCreateCategory: () => void;
};

/** Barra solo para la vista de categorías de servicio (cada servicio del catálogo usa una categoría). */
export default function ServicesToolbar({ onCreateCategory }: ServicesToolbarProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2 className="text-lg font-semibold text-slate-800">Categorías de servicio</h2>
        <p className="text-xs text-slate-500">
          Agrupa el catálogo: cada servicio se asocia a una categoría de servicio.
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Button onClick={onCreateCategory}>
          <Plus className="h-4 w-4" />
          Nueva categoría
        </Button>
      </div>
    </div>
  );
}
