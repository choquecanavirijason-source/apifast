import { useMemo, useState } from "react";
import { Check, ChevronDown, ChevronUp, Lock, ShieldCheck } from "lucide-react";

import GenericModal from "@/components/common/modal/GenericModal";
import { Button } from "@/components/common/ui";

import { translatePermission } from "@/core/utils/permissionLabels";
import type { BranchItem, PermissionItem, RoleItem, UserItem } from "../types";

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

interface EditUserModalProps {
  isOpen: boolean;
  selectedUser: UserItem | null;
  roles: RoleItem[];
  branches: BranchItem[];
  permissions: PermissionItem[];
  editUserName: string;
  editUserEmail: string;
  editUserPhone: string;
  editUserPassword: string;
  editUserRoleId: number | null;
  editUserBranchId: number | null;
  editUserIsActive: boolean;
  editUserSkillLevel: number | null;
  editUserDirectPermissionIds: number[];
  updatingUser: boolean;
  onClose: () => void;
  onSubmit: () => void;
  onNameChange: (value: string) => void;
  onEmailChange: (value: string) => void;
  onPhoneChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onRoleChange: (value: number | null) => void;
  onBranchChange: (value: number | null) => void;
  onActiveChange: (value: boolean) => void;
  onSkillLevelChange: (value: number | null) => void;
  onDirectPermissionIdsChange: (ids: number[]) => void;
}

const fieldClass =
  "w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30";
const labelClass =
  "mb-2 block text-xs font-black uppercase tracking-[0.18em] text-emerald-600";

export default function EditUserModal({
  isOpen,
  selectedUser,
  roles,
  branches,
  permissions,
  editUserName,
  editUserEmail,
  editUserPhone,
  editUserPassword,
  editUserRoleId,
  editUserBranchId,
  editUserIsActive,
  editUserSkillLevel,
  editUserDirectPermissionIds,
  updatingUser,
  onClose,
  onSubmit,
  onNameChange,
  onEmailChange,
  onPhoneChange,
  onPasswordChange,
  onRoleChange,
  onBranchChange,
  onActiveChange,
  onSkillLevelChange,
  onDirectPermissionIdsChange,
}: EditUserModalProps) {
  const [permOpen, setPermOpen] = useState(false);

  const rolePermissionIds = useMemo<Set<number>>(() => {
    const role = roles.find((r) => r.id === editUserRoleId);
    return new Set((role?.permissions ?? []).map((p) => p.id));
  }, [roles, editUserRoleId]);

  const directIds = useMemo(() => new Set(editUserDirectPermissionIds), [editUserDirectPermissionIds]);

  const grouped = useMemo(() => groupByModule(permissions), [permissions]);

  const togglePermission = (id: number) => {
    if (rolePermissionIds.has(id)) return; // inherited from role — not toggleable
    const next = new Set(directIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onDirectPermissionIdsChange(Array.from(next));
  };

  const toggleModule = (items: PermissionItem[]) => {
    const toggleable = items.filter((p) => !rolePermissionIds.has(p.id));
    if (toggleable.length === 0) return;
    const allOn = toggleable.every((p) => directIds.has(p.id));
    const next = new Set(directIds);
    for (const p of toggleable) {
      if (allOn) next.delete(p.id);
      else next.add(p.id);
    }
    onDirectPermissionIdsChange(Array.from(next));
  };

  const directCount = editUserDirectPermissionIds.length;

  return (
    <GenericModal isOpen={isOpen} onClose={onClose} title="Editar Usuario" size="lg">
      <div className="space-y-4">
        <p className="text-sm text-slate-500">{selectedUser?.username}</p>

        <div>
          <label className={labelClass}>Nombre de usuario</label>
          <input value={editUserName} onChange={(e) => onNameChange(e.target.value)} className={fieldClass} />
        </div>

        <div>
          <label className={labelClass}>Sucursal</label>
          <select
            value={editUserBranchId ?? ""}
            onChange={(e) => onBranchChange(Number(e.target.value) || null)}
            className={fieldClass}
          >
            <option value="">Sin sucursal</option>
            {branches.map((branch) => (
              <option key={branch.id} value={branch.id}>{branch.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className={labelClass}>Correo</label>
          <input type="email" value={editUserEmail} onChange={(e) => onEmailChange(e.target.value)} className={fieldClass} />
        </div>

        <div>
          <label className={labelClass}>Teléfono</label>
          <input value={editUserPhone} onChange={(e) => onPhoneChange(e.target.value)} placeholder="+59170000000" className={fieldClass} />
        </div>

        <div>
          <label className={labelClass}>Nueva contraseña (opcional)</label>
          <input
            type="password"
            value={editUserPassword}
            onChange={(e) => onPasswordChange(e.target.value)}
            placeholder="Dejar vacío para mantener la actual"
            className={fieldClass}
          />
        </div>

        <div>
          <label className={labelClass}>Nivel de acceso (Rol)</label>
          <div className="space-y-3">
            {roles.map((role) => {
              const active = editUserRoleId === role.id;
              return (
                <button
                  key={role.id}
                  type="button"
                  onClick={() => onRoleChange(role.id)}
                  className={`flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left transition-all ${
                    active
                      ? "border-emerald-500 bg-emerald-50 text-slate-900"
                      : "border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300"
                  }`}
                >
                  <div className="min-w-0">
                    <span className="font-bold">{role.name}</span>
                    {role.permissions && role.permissions.length > 0 && (
                      <span className="ml-2 text-[10px] font-medium text-slate-400">
                        {role.permissions.length} permiso{role.permissions.length !== 1 ? "s" : ""}
                      </span>
                    )}
                  </div>
                  {active && <Check size={18} className="shrink-0 text-emerald-600" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Nivel de habilidad */}
        <div>
          <label className={labelClass}>Nivel de habilidad (1-5 estrellas)</label>
          <div className="flex items-center gap-1">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                onClick={() => onSkillLevelChange(star === editUserSkillLevel ? null : star)}
                className="text-2xl leading-none transition-transform hover:scale-110 focus:outline-none"
                title={`Nivel ${star}`}
              >
                <span className={star <= (editUserSkillLevel ?? 0) ? "text-amber-400" : "text-slate-300"}>
                  ★
                </span>
              </button>
            ))}
            {editUserSkillLevel != null && (
              <button
                type="button"
                onClick={() => onSkillLevelChange(null)}
                className="ml-2 text-xs text-slate-400 hover:text-slate-600 underline"
              >
                quitar
              </button>
            )}
          </div>
        </div>

        {/* Permisos adicionales por usuario */}
        {permissions.length > 0 && (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 overflow-hidden">
            <button
              type="button"
              onClick={() => setPermOpen((v) => !v)}
              className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-slate-100 transition-colors"
            >
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-emerald-600" />
                <span className="text-xs font-black uppercase tracking-[0.18em] text-emerald-600">
                  Permisos adicionales
                </span>
                {directCount > 0 && (
                  <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-bold text-white">
                    +{directCount}
                  </span>
                )}
              </div>
              {permOpen ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
            </button>

            {permOpen && (
              <div className="border-t border-slate-200 px-4 pb-4 pt-3 space-y-4">
                <p className="text-xs text-slate-500">
                  Permisos <span className="font-semibold text-slate-600">grises</span> vienen del rol y no se pueden quitar aquí. Los que puedes marcar se suman al rol de este usuario.
                </p>

                {grouped.map(({ module, label, items }) => {
                  const toggleable = items.filter((p) => !rolePermissionIds.has(p.id));
                  const allToggleableOn = toggleable.length > 0 && toggleable.every((p) => directIds.has(p.id));

                  return (
                    <div key={module}>
                      <div className="mb-1.5 flex items-center justify-between">
                        <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{label}</span>
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
                          const isDirect = directIds.has(perm.id);
                          const checked = fromRole || isDirect;
                          return (
                            <button
                              key={perm.id}
                              type="button"
                              onClick={() => togglePermission(perm.id)}
                              disabled={fromRole}
                              className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-left text-xs transition-all ${
                                fromRole
                                  ? "cursor-default border-slate-200 bg-white text-slate-400"
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
                                {checked && (
                                  fromRole
                                    ? <Lock className="h-2.5 w-2.5 text-slate-500" />
                                    : <Check className="h-2.5 w-2.5 text-white" />
                                )}
                              </div>
                              <span className="truncate font-medium" title={perm.name}>{translatePermission(perm.name)}</span>
                              {fromRole && (
                                <span className="ml-auto shrink-0 text-[9px] text-slate-400">rol</span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700">
          <input
            type="checkbox"
            checked={editUserIsActive}
            onChange={(e) => onActiveChange(e.target.checked)}
            className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
          />
          Usuario activo
        </label>

        <div className="flex justify-end gap-3 pt-2">
          <Button variant="secondary" onClick={onClose} disabled={updatingUser}>Cancelar</Button>
          <Button onClick={onSubmit} disabled={updatingUser}>
            {updatingUser ? "Guardando..." : "Guardar cambios"}
          </Button>
        </div>
      </div>
    </GenericModal>
  );
}
