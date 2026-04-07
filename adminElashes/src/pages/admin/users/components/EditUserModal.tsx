import { Check } from "lucide-react";

import GenericModal from "@/components/common/modal/GenericModal";
import { Button } from "@/components/common/ui";

import type { BranchItem, RoleItem, UserItem } from "../types";

interface EditUserModalProps {
  isOpen: boolean;
  selectedUser: UserItem | null;
  roles: RoleItem[];
  branches: BranchItem[];
  editUserName: string;
  editUserEmail: string;
  editUserPhone: string;
  editUserPassword: string;
  editUserRoleId: number | null;
  editUserBranchId: number | null;
  editUserIsActive: boolean;
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
}

export default function EditUserModal({
  isOpen,
  selectedUser,
  roles,
  branches,
  editUserName,
  editUserEmail,
  editUserPhone,
  editUserPassword,
  editUserRoleId,
  editUserBranchId,
  editUserIsActive,
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
}: EditUserModalProps) {
  return (
    <GenericModal isOpen={isOpen} onClose={onClose} title="Editar Usuario" size="lg">
      <div className="space-y-4">
        <p className="text-sm text-slate-500">{selectedUser?.username}</p>

        <div>
          <label className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-emerald-600">
            Nombre de usuario
          </label>
          <input
            value={editUserName}
            onChange={(e) => onNameChange(e.target.value)}
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
          />
        </div>

        <div>
          <label className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-emerald-600">
            Sucursal
          </label>
          <select
            value={editUserBranchId ?? ""}
            onChange={(e) => onBranchChange(Number(e.target.value) || null)}
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
          >
            <option value="">Sin sucursal</option>
            {branches.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-emerald-600">
            Correo
          </label>
          <input
            type="email"
            value={editUserEmail}
            onChange={(e) => onEmailChange(e.target.value)}
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
          />
        </div>

        <div>
          <label className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-emerald-600">
            Teléfono
          </label>
          <input
            value={editUserPhone}
            onChange={(e) => onPhoneChange(e.target.value)}
            placeholder="+59170000000"
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
          />
        </div>

        <div>
          <label className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-emerald-600">
            Nueva contraseña (opcional)
          </label>
          <input
            type="password"
            value={editUserPassword}
            onChange={(e) => onPasswordChange(e.target.value)}
            placeholder="Dejar vacío para mantener la actual"
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
          />
        </div>

        <div>
          <label className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-emerald-600">
            Nivel de acceso
          </label>
          <div className="space-y-3">
            {roles.map((role) => {
              const active = editUserRoleId === role.id;
              return (
                <button
                  key={role.id}
                  type="button"
                  onClick={() => onRoleChange(role.id)}
                  className={`flex w-full items-center justify-between rounded-2xl border px-4 py-4 text-left transition-all ${
                    active
                      ? "border-emerald-500 bg-emerald-50 text-slate-900"
                      : "border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300"
                  }`}
                >
                  <span className="font-bold">{role.name}</span>
                  {active && <Check size={18} className="text-emerald-600" />}
                </button>
              );
            })}
          </div>
        </div>

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
