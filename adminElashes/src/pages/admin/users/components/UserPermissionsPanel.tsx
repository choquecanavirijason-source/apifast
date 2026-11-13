import { useMemo, useState } from "react";
import { Check, ChevronDown, ChevronUp, Lock, ShieldCheck } from "lucide-react";

import { translatePermission } from "@/core/utils/permissionLabels";
import type { PermissionItem, RoleItem } from "../types";

const MODULE_LABELS: Record<string, string> = {
  clients: "Clientes",
  tracking: "Seguimiento",
  forms: "Formularios",
  catalog: "Catálogo",
  services: "Servicios",
  appointments: "Citas & Agenda",
  payments: "Caja & Pagos",
  inventory: "Inventario",
  branches: "Salones / Sucursales",
  users: "Usuarios",
  settings: "Configuración",
  ai: "Asistente IA",
};

function groupByModule(permissions: PermissionItem[]): Array<{ module: string; label: string; items: PermissionItem[] }> {
  const map = new Map<string, PermissionItem[]>();
  for (const p of permissions) {
    const mod = p.name.split(":")[0] ?? p.name;
    if (!map.has(mod)) map.set(mod, []);
    map.get(mod)!.push(p);
  }
  return Array.from(map.entries()).map(([module, items]) => ({
    module,
    label: MODULE_LABELS[module] ?? module,
    items,
  }));
}

interface UserPermissionsPanelProps {
  /** Catálogo completo de permisos. Puede venir vacío si quien usa la pantalla no puede verlo (entonces solo se muestran los del rol). */
  permissions: PermissionItem[];
  roles: RoleItem[];
  /** Rol elegido: sus permisos llegan solos y no se pueden quitar aquí. */
  roleId: number | null;
  /** Permisos EXTRA (directos) que se suman a los del rol. */
  directIds: number[];
  onChange: (ids: number[]) => void;
  /** Abierto desde el inicio (al crear un usuario conviene verlo). */
  defaultOpen?: boolean;
}

/**
 * Permisos de un usuario: los de su rol vienen marcados y bloqueados (no hay que elegirlos desde cero)
 * y se pueden sumar permisos extra. Se usa al crear y al editar un usuario.
 */
export default function UserPermissionsPanel({
  permissions,
  roles,
  roleId,
  directIds,
  onChange,
  defaultOpen = false,
}: UserPermissionsPanelProps) {
  const [open, setOpen] = useState(defaultOpen);

  const role = useMemo(() => roles.find((r) => r.id === roleId) ?? null, [roles, roleId]);
  const rolePermissionIds = useMemo<Set<number>>(() => new Set((role?.permissions ?? []).map((p) => p.id)), [role]);
  const directSet = useMemo(() => new Set(directIds), [directIds]);
  const grouped = useMemo(() => groupByModule(permissions), [permissions]);
  const roleGrouped = useMemo(() => groupByModule(role?.permissions ?? []), [role]);

  // Un extra que el rol ya trae no se cuenta dos veces (pasa al cambiar de rol).
  const extraCount = directIds.filter((id) => !rolePermissionIds.has(id)).length;
  const canPickExtras = permissions.length > 0;

  const toggleOne = (id: number) => {
    if (rolePermissionIds.has(id)) return;
    const next = new Set(directSet);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange(Array.from(next));
  };

  const toggleModule = (items: PermissionItem[]) => {
    const toggleable = items.filter((p) => !rolePermissionIds.has(p.id));
    if (toggleable.length === 0) return;
    const allOn = toggleable.every((p) => directSet.has(p.id));
    const next = new Set(directSet);
    for (const p of toggleable) {
      if (allOn) next.delete(p.id);
      else next.add(p.id);
    }
    onChange(Array.from(next));
  };

  if (!role && !canPickExtras) return null;

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between px-4 py-3 text-left transition-colors hover:bg-slate-100"
      >
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
          <span className="text-xs font-semibold text-emerald-700">Permisos</span>
          {role && (
            <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-bold text-slate-600">
              {rolePermissionIds.size} del rol {role.name}
            </span>
          )}
          {extraCount > 0 && (
            <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-bold text-white">+{extraCount} adicionales</span>
          )}
        </div>
        {open ? <ChevronUp className="h-4 w-4 shrink-0 text-slate-400" /> : <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />}
      </button>

      {open && (
        <div className="space-y-4 border-t border-slate-200 px-4 pb-4 pt-3">
          {role ? (
            <p className="text-xs text-slate-500">
              Con el rol <span className="font-semibold text-slate-700">{role.name}</span> ya recibe estos permisos
              automáticamente: <span className="font-semibold text-slate-600">no hay que marcarlos</span>.
              {canPickExtras ? " Marca solo los que quieras sumarle." : ""}
            </p>
          ) : (
            <p className="text-xs text-slate-500">Elige primero un rol: sus permisos se asignan solos.</p>
          )}

          {canPickExtras
            ? grouped.map(({ module, label, items }) => {
                const toggleable = items.filter((p) => !rolePermissionIds.has(p.id));
                const allToggleableOn = toggleable.length > 0 && toggleable.every((p) => directSet.has(p.id));
                return (
                  <div key={module}>
                    <div className="mb-1.5 flex items-center justify-between">
                      <span className="text-[11px] font-semibold text-slate-500">{label}</span>
                      {toggleable.length > 0 && (
                        <button
                          type="button"
                          onClick={() => toggleModule(items)}
                          className="text-[10px] font-semibold text-emerald-600 hover:underline"
                        >
                          {allToggleableOn ? "Quitar todos" : "Dar todos"}
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
                      {items.map((perm) => {
                        const fromRole = rolePermissionIds.has(perm.id);
                        const isDirect = directSet.has(perm.id);
                        const checked = fromRole || isDirect;
                        return (
                          <button
                            key={perm.id}
                            type="button"
                            onClick={() => toggleOne(perm.id)}
                            disabled={fromRole}
                            className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-left text-xs transition-all ${
                              fromRole
                                ? "cursor-default border-slate-200 bg-white text-slate-500"
                                : isDirect
                                  ? "border-emerald-400 bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
                                  : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                            }`}
                          >
                            <div
                              className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                                checked
                                  ? fromRole
                                    ? "border-slate-300 bg-slate-200"
                                    : "border-emerald-500 bg-emerald-500"
                                  : "border-slate-300 bg-white"
                              }`}
                            >
                              {checked && (fromRole ? <Lock className="h-2.5 w-2.5 text-slate-500" /> : <Check className="h-2.5 w-2.5 text-white" />)}
                            </div>
                            <span className="truncate font-medium" title={perm.name}>
                              {translatePermission(perm.name)}
                            </span>
                            {fromRole && <span className="ml-auto shrink-0 text-[9px] text-slate-400">rol</span>}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })
            : // Sin catálogo completo (p. ej. Admin o Secretaria): solo se muestran los del rol, sin poder cambiarlos.
              roleGrouped.map(({ module, label, items }) => (
                <div key={module}>
                  <span className="mb-1.5 block text-[11px] font-semibold text-slate-500">{label}</span>
                  <div className="flex flex-wrap gap-1.5">
                    {items.map((perm) => (
                      <span
                        key={perm.id}
                        className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-600"
                        title={perm.name}
                      >
                        <Lock className="h-2.5 w-2.5 text-slate-400" aria-hidden />
                        {translatePermission(perm.name)}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
        </div>
      )}
    </div>
  );
}
