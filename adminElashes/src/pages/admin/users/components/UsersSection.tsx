import { ArrowLeftRight, CalendarClock, Info, Settings2, Trash2 } from "lucide-react";

import { SectionCard } from "@/components/common/ui";
import DataTable, { type DataTableAction, type DataTableColumn } from "@/components/common/table/DataTable";

import type { UserItem } from "../types";
import { getRoleName } from "../types";

interface UsersSectionProps {
  users: UserItem[];
  loading: boolean;
  onEditUser: (user: UserItem) => void;
  onDeleteUser?: (user: UserItem) => void;
  onAssignBranch?: (user: UserItem) => void;
}

export default function UsersSection({ users, loading, onEditUser, onDeleteUser, onAssignBranch }: UsersSectionProps) {
  const today = new Date().toISOString().slice(0, 10);
  const formatCreatedAt = (value?: string | null) => {
    if (!value) return "Sin fecha";
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value;
    return parsed.toLocaleString("es-BO", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const columns: DataTableColumn<UserItem>[] = [
    {
      key: "username",
      header: "Usuario",
      sortable: true,
      render: (item) => <span className="font-semibold text-slate-800">{item.username}</span>,
    },
    {
      key: "email",
      header: "Correo",
      sortable: true,
      render: (item) => item.email,
    },
    {
      key: "phone",
      header: "Telefono",
      render: (item) => item.phone || "Sin telefono",
    },
    {
      key: "role",
      header: "Rol",
      sortable: true,
      getValue: (item) => getRoleName(item.role),
      render: (item) => (
        <div className="flex items-center gap-1.5">
          <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs font-bold text-emerald-700">
            {getRoleName(item.role)}
          </span>
          {item.skill_level != null && (
            <span className="text-xs text-amber-400" title={`Nivel ${item.skill_level}/5`}>
              {"★".repeat(item.skill_level)}{"☆".repeat(5 - item.skill_level)}
            </span>
          )}
        </div>
      ),
    },
    {
      key: "branch",
      header: "Sucursal",
      sortable: true,
      getValue: (item) => item.branch?.name ?? "Sin sucursal",
      render: (item) => {
        const hasTempActive =
          !!item.temp_branch_id &&
          !!item.temp_branch_until &&
          item.temp_branch_until >= today;
        return (
          <div className="flex flex-col gap-0.5">
            <span className="text-xs text-[#323130]">{item.branch?.name ?? "Sin sucursal"}</span>
            {hasTempActive && (
              <span className="inline-flex items-center gap-1 rounded-full bg-[#fff4ce] px-1.5 py-0.5 text-[9px] font-bold text-[#8a6a1f]">
                ⚡ Temp. hasta {item.temp_branch_until}
              </span>
            )}
          </div>
        );
      },
    },
    {
      key: "created_at",
      header: "Creado",
      sortable: true,
      getValue: (item) => item.created_at ?? "",
      render: (item) => (
        <div
          className="inline-flex items-center gap-1 text-xs text-slate-600"
          title={`Usuario creado: ${formatCreatedAt(item.created_at)}`}
        >
          <CalendarClock className="h-3.5 w-3.5" />
          <span>{item.created_at ? formatCreatedAt(item.created_at) : "Sin fecha"}</span>
          <Info className="h-3 w-3 text-slate-400" />
        </div>
      ),
    },
    {
      key: "is_active",
      header: "Estado",
      sortable: true,
      getValue: (item) => (item.is_active ? "activo" : "inactivo"),
      render: (item) =>
        item.is_active ? (
          <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-bold text-emerald-700">Activo</span>
        ) : (
          <span className="rounded-full bg-rose-100 px-2 py-1 text-xs font-bold text-rose-700">Inactivo</span>
        ),
    },
  ];

  const actions: DataTableAction<UserItem>[] = [
    {
      label: "Editar",
      icon: <Settings2 className="h-4 w-4" />,
      onClick: onEditUser,
    },
    ...(onAssignBranch ? [{
      label: "Reasignar sucursal",
      icon: <ArrowLeftRight className="h-4 w-4" />,
      onClick: onAssignBranch,
    }] : []),
    ...(onDeleteUser ? [{
      label: "Eliminar",
      icon: <Trash2 className="h-4 w-4" />,
      variant: "danger" as const,
      onClick: onDeleteUser,
    }] : []),
  ];

  return (
    <SectionCard
      title="Listado de Usuarios"
      subtitle="Vista general de usuarios, correo, teléfono, rol y estado del sistema."
      bodyClassName="!p-0"
    >
      <DataTable
        data={users}
        columns={columns}
        actions={actions}
        loading={loading}
        defaultLimit={10}
        availableLimits={[5, 10, 20, 50]}
        globalSearchPlaceholder="Buscar por usuario, correo o rol..."
        tableMinWidth="min-w-[560px]"
      />
    </SectionCard>
  );
}
