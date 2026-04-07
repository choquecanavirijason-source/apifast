import { Tags, Plus } from "lucide-react";
import DataTable, { type DataTableAction, type DataTableColumn } from "../../../components/common/table/DataTable";
import { Button, SectionCard } from "../../../components/common/ui";
import type { CategoryItem } from "../../../core/services/category/category.service";

interface CategoriesSectionProps {
  categories: CategoryItem[];
  columns: DataTableColumn<CategoryItem>[];
  actions: DataTableAction<CategoryItem>[];
  isLoading: boolean;
  onOpenCreateModal: () => void;
}

export default function CategoriesSection({
  categories,
  columns,
  actions,
  isLoading,
  onOpenCreateModal,
}: CategoriesSectionProps) {
  return (
    <SectionCard className="mb-4" bodyClassName="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h3 className="flex items-center gap-2 text-lg font-black text-slate-900">
            <Tags className="h-4 w-4" /> Categorias
          </h3>
          <p className="text-sm text-slate-500">Listado completo de categorias y gestion rapida.</p>
        </div>

        <Button type="button" onClick={onOpenCreateModal} leftIcon={<Plus className="h-4 w-4" />}>
          Nueva categoria
        </Button>
      </div>

      <DataTable
        data={categories}
        columns={columns}
        actions={actions}
        loading={isLoading}
        defaultLimit={5}
        availableLimits={[5, 10, 20]}
        globalSearchPlaceholder="Buscar categoria"
        enableColumnFilters
      />
    </SectionCard>
  );
}
