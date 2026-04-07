import { Loader2, Plus } from "lucide-react";

import { Button, SectionCard } from "@/components/common/ui";

import type { RoleItem } from "../types";

interface CreateUserSectionProps {
  roles: RoleItem[];
  newUserName: string;
  newUserEmail: string;
  newUserPassword: string;
  newUserPhone: string;
  newUserRoleId: number | null;
  creatingUser: boolean;
  onNameChange: (value: string) => void;
  onEmailChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onPhoneChange: (value: string) => void;
  onRoleChange: (value: number | null) => void;
  onSubmit: () => void;
}

export default function CreateUserSection({
  roles,
  newUserName,
  newUserEmail,
  newUserPassword,
  newUserPhone,
  newUserRoleId,
  creatingUser,
  onNameChange,
  onEmailChange,
  onPasswordChange,
  onPhoneChange,
  onRoleChange,
  onSubmit,
}: CreateUserSectionProps) {
  return (
    <SectionCard
      title="Crear Usuario"
      subtitle="Registra un nuevo usuario y asígnale un rol para controlar su acceso."
    >
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-4">
          <div>
            <label className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-emerald-600">
              Nombre de usuario
            </label>
            <input
              value={newUserName}
              onChange={(e) => onNameChange(e.target.value)}
              placeholder="Ej: maria"
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
            />
          </div>

          <div>
            <label className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-emerald-600">
              Correo
            </label>
            <input
              type="email"
              value={newUserEmail}
              onChange={(e) => onEmailChange(e.target.value)}
              placeholder="correo@empresa.com"
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
            />
          </div>

          <div>
            <label className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-emerald-600">
              Contraseña
            </label>
            <input
              type="password"
              value={newUserPassword}
              onChange={(e) => onPasswordChange(e.target.value)}
              placeholder="Mínimo 8 caracteres"
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
            />
          </div>

          <div>
            <label className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-emerald-600">
              Teléfono (opcional)
            </label>
            <input
              value={newUserPhone}
              onChange={(e) => onPhoneChange(e.target.value)}
              placeholder="+59170000000"
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
            />
          </div>

          <div>
            <label className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-emerald-600">
              Rol
            </label>
            <select
              value={newUserRoleId ?? ""}
              onChange={(e) => onRoleChange(Number(e.target.value) || null)}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
            >
              <option value="">Selecciona un rol</option>
              {roles.map((role) => (
                <option key={role.id} value={role.id}>
                  {role.name}
                </option>
              ))}
            </select>
          </div>

          <Button
            onClick={onSubmit}
            disabled={creatingUser}
            className="w-full justify-center rounded-2xl py-4 text-sm font-extrabold uppercase tracking-wide"
            leftIcon={creatingUser ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          >
            {creatingUser ? "Creando..." : "Crear Usuario"}
          </Button>
        </div>

        <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-5">
          <h3 className="text-base font-bold text-slate-800">Recomendaciones</h3>
          <ul className="mt-3 space-y-2 text-sm text-slate-600">
            <li>Usa correos válidos para facilitar la gestión del acceso.</li>
            <li>Asigna primero el rol correcto antes de habilitar el usuario.</li>
            <li>El teléfono debe ir en formato internacional si lo registras.</li>
          </ul>
        </div>
      </div>
    </SectionCard>
  );
}
