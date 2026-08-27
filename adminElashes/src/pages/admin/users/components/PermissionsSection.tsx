import { SectionCard } from "@/components/common/ui";
import DataTable, { type DataTableColumn } from "@/components/common/table/DataTable";
import { translateModule, translatePermission } from "@/core/utils/permissionLabels";

import type { PermissionItem } from "../types";

interface PermissionsSectionProps {
  permissions: PermissionItem[];
  loading: boolean;
}

export default function PermissionsSection({ permissions, loading }: PermissionsSectionProps) {
  const columns: DataTableColumn<PermissionItem>[] = [
    {
      key: "name",
      header: "Permiso",
      sortable: true,
      getValue: (item) => translatePermission(item.name),
      render: (item) => (
        <span className="font-semibold text-slate-800" title={item.name}>
          {translatePermission(item.name)}
        </span>
      ),
    },
    {
      key: "module",
      header: "Módulo",
      sortable: true,
      getValue: (item) => translateModule(item.name.includes(":") ? item.name.split(":")[0] : "otros"),
      render: (item) => (
        <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">
          {translateModule(item.name.includes(":") ? item.name.split(":")[0] : "otros")}
        </span>
      ),
    },
  ];

  return (
    <SectionCard
      title="Permisos por Módulo"
      bodyClassName="!p-0"
    >
      <DataTable
        data={permissions}
        columns={columns}
        loading={loading}
        defaultLimit={10}
        availableLimits={[5, 10, 20, 50]}
        globalSearchPlaceholder="Buscar permisos..."
      />
    </SectionCard>
  );
}
