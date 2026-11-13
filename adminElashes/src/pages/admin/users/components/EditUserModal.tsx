import { useState } from "react";
import { Check, Eye, EyeOff } from "lucide-react";

import GenericModal from "@/components/common/modal/GenericModal";
import UserPermissionsPanel from "./UserPermissionsPanel";
import { Button } from "@/components/common/ui";

import type { BranchItem, PermissionItem, RoleItem, UserItem } from "../types";

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
  "w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-[#094732] focus:ring-2 focus:ring-[#094732]/10";
const labelClass = "mb-1.5 block text-sm font-medium text-slate-700";

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
  const [showPassword, setShowPassword] = useState(false);

  return (
    <GenericModal isOpen={isOpen} onClose={onClose} title="Editar Usuario" size="lg">
      <div className="space-y-5">
        {selectedUser?.username && (
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
            <p className="text-xs font-medium text-slate-500">Editando usuario</p>
            <p className="truncate text-sm font-semibold text-slate-800">{selectedUser.username}</p>
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass}>Nombre de usuario</label>
            <input
              value={editUserName}
              onChange={(e) => onNameChange(e.target.value)}
              className={fieldClass}
              placeholder="Nombre de usuario"
            />
          </div>

          <div>
            <label className={labelClass}>Correo</label>
            <input
              type="email"
              value={editUserEmail}
              onChange={(e) => onEmailChange(e.target.value)}
              className={fieldClass}
              placeholder="correo@empresa.com"
            />
          </div>

          <div>
            <label className={labelClass}>Teléfono</label>
            <input
              value={editUserPhone}
              onChange={(e) => onPhoneChange(e.target.value)}
              placeholder="+59170000000"
              className={fieldClass}
            />
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
            <label className={labelClass}>Nueva contraseña (opcional)</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={editUserPassword}
                onChange={(e) => onPasswordChange(e.target.value)}
                placeholder="Dejar vacío para mantener la actual"
                className={`${fieldClass} pr-10`}
              />
              <button
                type="button"
                onClick={() => setShowPassword((visible) => !visible)}
                aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                aria-pressed={showPassword}
                className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-500 transition-colors hover:text-slate-700"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>
        </div>

        <div>
          <label className={labelClass}>Nivel de acceso (Rol)</label>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {roles.map((role) => {
              const active = editUserRoleId === role.id;
              return (
                <button
                  key={role.id}
                  type="button"
                  onClick={() => onRoleChange(role.id)}
                  className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left transition-colors focus:outline-none focus:ring-2 focus:ring-[#094732]/20 ${
                    active
                      ? "border-[#094732] bg-emerald-50 text-slate-900"
                      : "border-slate-300 bg-white text-slate-600 hover:border-[#094732]/50 hover:bg-slate-50"
                  }`}
                >
                  <div className="min-w-0">
                    <span className="text-sm font-semibold">{role.name}</span>
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
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <label className={labelClass}>Nivel de habilidad (1-5 estrellas)</label>
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => onSkillLevelChange(star === editUserSkillLevel ? null : star)}
                  aria-label={`Nivel de habilidad ${star}`}
                  aria-pressed={star === editUserSkillLevel}
                  className="rounded text-2xl leading-none transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-amber-300"
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
                  className="ml-2 text-xs text-slate-400 underline hover:text-slate-600"
                >
                  quitar
                </button>
              )}
            </div>
          </div>

          <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition-colors hover:border-slate-300">
            <input
              type="checkbox"
              checked={editUserIsActive}
              onChange={(e) => onActiveChange(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-[#094732] focus:ring-[#094732]"
            />
            <span>
              <span className="block font-semibold text-slate-800">Usuario activo</span>
              <span className="block text-xs font-normal text-slate-500">Permite que este usuario acceda al sistema</span>
            </span>
          </label>
        </div>

        {/* Permisos: los del rol vienen solos; aquí solo se suman extras */}
        <UserPermissionsPanel
          permissions={permissions}
          roles={roles}
          roleId={editUserRoleId}
          directIds={editUserDirectPermissionIds}
          onChange={onDirectPermissionIdsChange}
        />

        <div className="mt-6 flex justify-end gap-3 border-t border-slate-100 pt-4">
          <Button variant="secondary" onClick={onClose} disabled={updatingUser}>
            Cancelar
          </Button>
          <Button onClick={onSubmit} disabled={updatingUser}>
            {updatingUser ? "Guardando..." : "Guardar cambios"}
          </Button>
        </div>
      </div>
    </GenericModal>
  );
}
