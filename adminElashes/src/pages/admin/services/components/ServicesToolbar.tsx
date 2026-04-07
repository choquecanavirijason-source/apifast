import { Plus } from "lucide-react";

import { Button } from "../../../../components/common/ui";

export type ServicesToolbarProps = {
  mode: "services" | "categories";
  onCreateCategory: () => void;
  onCreateService: () => void;
};

export default function ServicesToolbar({ mode, onCreateCategory, onCreateService }: ServicesToolbarProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2 className="text-lg font-semibold text-slate-800">
          {mode === "categories" ? "Servicios categorias" : "Catalogo de servicios"}
        </h2>
        <p className="text-xs text-slate-500">
          {mode === "categories"
            ? "Administra las categorias de servicio."
            : "Administra unicamente los servicios del catalogo."}
        </p>
      </div>
      <div className="flex items-center gap-2">
        {mode === "categories" ? (
          <Button onClick={onCreateCategory}>
            <Plus className="h-4 w-4" />
            Nueva categoria
          </Button>
        ) : (
          <Button onClick={onCreateService}>
            <Plus className="h-4 w-4" />
            Nuevo servicio
          </Button>
        )}
      </div>
    </div>
  );
}
