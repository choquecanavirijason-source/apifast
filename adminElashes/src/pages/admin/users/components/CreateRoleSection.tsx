import { Loader2, Plus } from "lucide-react";

import { Button, SectionCard } from "@/components/common/ui";

import type { PermissionItem } from "../types";

interface CreateRoleSectionProps {
  newRoleName: string;
  newRolePermissions: string[];
  permissionsByModule: Record<string, PermissionItem[]>;
  creatingRole: boolean;
  onNameChange: (value: string) => void;
  onTogglePermission: (permissionName: string) => void;
  onSubmit: () => void;
}

export default function CreateRoleSection({
  newRoleName,
  newRolePermissions,
  permissionsByModule,
  creatingRole,
  onNameChange,
  onTogglePermission,
  onSubmit,
}: CreateRoleSectionProps) {
  return (
    <SectionCard
      title="Crear Rol"
      subtitle="Define un rol nuevo y selecciona permisos agrupados por módulo."
    >
      <div className="space-y-5">
        <div>
          <label className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-emerald-600">
            Nombre del rol
          </label>
          <input
            value={newRoleName}
            onChange={(e) => onNameChange(e.target.value)}
            placeholder="Ej: Secretaria"
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
          />
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-bold text-slate-800">Permisos seleccionados</p>
              <p className="mt-1 text-xs text-slate-500">Marca o desmarca permisos antes de crear el rol.</p>
            </div>
            <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700">
              {newRolePermissions.length} seleccionados
            </span>
          </div>
        </div>

        <div className="space-y-4">
          {Object.entries(permissionsByModule).map(([module, modulePermissions]) => (
            <div key={module} className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-bold capitalize text-slate-900">{module}</h3>
                  <p className="text-xs text-slate-500">{modulePermissions.length} permisos disponibles</p>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {modulePermissions.map((perm) => {
                  const active = newRolePermissions.includes(perm.name);

                  return (
                    <button
                      type="button"
                      key={perm.name}
                      onClick={() => onTogglePermission(perm.name)}
                      className={`rounded-2xl border px-4 py-3 text-left transition-all ${
                        active
                          ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                          : "border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300 hover:bg-slate-100"
                      }`}
                    >
                      <span className="text-sm font-semibold">{perm.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <Button
          onClick={onSubmit}
          disabled={creatingRole}
          className="w-full justify-center rounded-2xl py-4 text-sm font-extrabold uppercase tracking-wide"
          leftIcon={creatingRole ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
        >
          {creatingRole ? "Creando..." : "Crear Rol"}
        </Button>
      </div>
    </SectionCard>
  );
}
