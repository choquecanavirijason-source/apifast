import { SectionCard } from "@/components/common/ui";
import DataTable, { type DataTableColumn } from "@/components/common/table/DataTable";
import { Shield } from "lucide-react";
import type { RoleItem } from "../types";

interface RolesSectionProps {
  roles: RoleItem[];
  loading: boolean;
}

export default function RolesSection({ roles, loading }: RolesSectionProps) {
  const columns: DataTableColumn<RoleItem>[] = [
    {
      key: "name",
      header: "Nombre del Rol",
      sortable: true,
      render: (item) => (
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-emerald-600 shrink-0" />
          <span className="font-semibold text-slate-800">{item.name}</span>
        </div>
      ),
    },
    {
      key: "permissionsCount",
      header: "Total de Permisos",
      sortable: true,
      getValue: (item) => item.permissions?.length ?? 0,
      render: (item) => {
        const count = item.permissions?.length ?? 0;
        return (
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
              count === 0
                ? "bg-slate-100 text-slate-500"
                : "bg-emerald-100 text-emerald-700"
            }`}
          >
            {count === 0 ? "Sin permisos" : `${count} permiso${count !== 1 ? "s" : ""}`}
          </span>
        );
      },
    },
    {
      key: "permissions",
      header: "Permisos Asignados",
      getValue: (item) =>
        item.permissions?.map((p) => p.name).join(", ") ?? "",
      render: (item) => {
        if (!item.permissions?.length)
          return <span className="text-slate-400 text-xs italic">Sin permisos asignados</span>;

        const visible = item.permissions.slice(0, 3);
        const remaining = item.permissions.length - 3;

        return (
          <div className="flex flex-wrap gap-1">
            {visible.map((p) => (
              <span
                key={p.id}
                className="inline-block rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-600"
              >
                {p.name}
              </span>
            ))}
            {remaining > 0 && (
              <span className="inline-block rounded-md bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-500">
                +{remaining} más
              </span>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <SectionCard
      title="Roles del Sistema"
      subtitle="Cada rol agrupa permisos específicos que determinan lo que puede ver y hacer cada usuario."
      bodyClassName="!p-0"
    >
      <DataTable
        data={roles}
        columns={columns}
        loading={loading}
        defaultLimit={10}
        availableLimits={[5, 10, 20, 50]}
        globalSearchPlaceholder="Buscar por nombre de rol o permiso..."
      />
    </SectionCard>
  );
}