import { Plus, Search } from "lucide-react";

import { Button } from "../../../../components/common/ui";

export type ServicesToolbarProps = {
  onCreateCategory: () => void;
  search: string;
  onSearchChange: (value: string) => void;
};

/** Barra solo para la vista de categorías de servicio (cada servicio del catálogo usa una categoría). */
export default function ServicesToolbar({ onCreateCategory, search, onSearchChange }: ServicesToolbarProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 className="text-lg font-semibold text-slate-800">Categorías de servicio</h2>
      <div className="flex flex-1 items-center justify-end gap-3">
        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#605e5c]" />
          <input
            type="text"
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Buscar categoría..."
            className="h-9 w-full rounded-sm border border-[#8a8886] bg-white pl-9 pr-3 text-sm text-[#323130] outline-none transition focus:border-[#0078d4] focus:ring-1 focus:ring-[#0078d4]/35"
          />
        </div>
        <Button onClick={onCreateCategory} leftIcon={<Plus className="h-4 w-4" />}>
          Nueva categoría
        </Button>
      </div>
    </div>
  );
}
