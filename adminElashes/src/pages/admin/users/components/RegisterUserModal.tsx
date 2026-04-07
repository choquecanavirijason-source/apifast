import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";

import GenericModal from "@/components/common/modal/GenericModal";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { Button } from "@/components/common/ui";

import type { BranchItem, RoleItem } from "../types";

interface RegisterUserPayload {
  username: string;
  email: string;
  password: string;
  phone: string | null;
  role_id: number;
  branch_id: number | null;
}

interface RegisterUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  roles: RoleItem[];
  branches: BranchItem[];
  isSubmitting: boolean;
  onSubmit: (payload: RegisterUserPayload) => void;
}

export default function RegisterUserModal({
  isOpen,
  onClose,
  roles,
  branches,
  isSubmitting,
  onSubmit,
}: RegisterUserModalProps) {
  const formRef = useRef<HTMLFormElement | null>(null);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [values, setValues] = useState({
    username: "",
    email: "",
    password: "",
    phone: "",
    role_id: "",
    branch_id: "",
  });

  useEffect(() => {
    if (!isOpen) {
      setIsConfirmOpen(false);
      setValues({ username: "", email: "", password: "", phone: "", role_id: "", branch_id: "" });
    }
  }, [isOpen]);

  const handleBeforeSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    formRef.current = event.currentTarget;
    setIsConfirmOpen(true);
  };

  const handleConfirm = () => {
    if (!formRef.current) return;

    const formData = new FormData(formRef.current);
    const username = String(formData.get("username") ?? "").trim();
    const email = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "").trim();
    const phoneRaw = String(formData.get("phone") ?? "").trim();
    const roleIdRaw = String(formData.get("role_id") ?? "").trim();
    const branchIdRaw = String(formData.get("branch_id") ?? "").trim();
    const roleId = Number(roleIdRaw);
    const branchId = branchIdRaw ? Number(branchIdRaw) : null;

    if (!username || !email || !password || !roleId) return;

    onSubmit({
      username,
      email,
      password,
      phone: phoneRaw || null,
      role_id: roleId,
      branch_id: Number.isFinite(Number(branchId)) ? branchId : null,
    });
    setIsConfirmOpen(false);
  };

  return (
    <>
      <GenericModal
        isOpen={isOpen}
        onClose={onClose}
        title="Registrar Usuario"
        asForm
        onSubmit={handleBeforeSubmit}
        size="lg"
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Usuario</label>
            <input
              name="username"
              required
              value={values.username}
              onChange={(event) => setValues((prev) => ({ ...prev, username: event.target.value }))}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#094732]"
              placeholder="Ej: maria"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Correo</label>
            <input
              name="email"
              type="email"
              required
              value={values.email}
              onChange={(event) => setValues((prev) => ({ ...prev, email: event.target.value }))}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#094732]"
              placeholder="correo@empresa.com"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Contrasena</label>
            <input
              name="password"
              type="password"
              required
              value={values.password}
              onChange={(event) => setValues((prev) => ({ ...prev, password: event.target.value }))}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#094732]"
              placeholder="Minimo 8 caracteres"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Telefono</label>
            <input
              name="phone"
              value={values.phone}
              onChange={(event) => setValues((prev) => ({ ...prev, phone: event.target.value }))}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#094732]"
              placeholder="+59170000000"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Rol</label>
            <select
              name="role_id"
              required
              value={values.role_id}
              onChange={(event) => setValues((prev) => ({ ...prev, role_id: event.target.value }))}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-[#094732]"
            >
              <option value="">Selecciona un rol</option>
              {roles.map((role) => (
                <option key={role.id} value={String(role.id)}>
                  {role.name}
                </option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Sucursal</label>
            <select
              name="branch_id"
              value={values.branch_id}
              onChange={(event) => setValues((prev) => ({ ...prev, branch_id: event.target.value }))}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-[#094732]"
            >
              <option value="">Sin sucursal</option>
              {branches.map((branch) => (
                <option key={branch.id} value={String(branch.id)}>
                  {branch.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Guardando..." : "Registrar"}
          </Button>
        </div>
      </GenericModal>

      <ConfirmDialog
        isOpen={isConfirmOpen}
        title="Confirmar registro"
        message="¿Deseas registrar este usuario con los datos ingresados?"
        confirmText="Registrar"
        cancelText="Cancelar"
        variant="success"
        onConfirm={handleConfirm}
        onCancel={() => setIsConfirmOpen(false)}
      />
    </>
  );
}
