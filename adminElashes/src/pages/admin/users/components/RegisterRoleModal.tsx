import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { Info } from "lucide-react";

import GenericModal from "@/components/common/modal/GenericModal";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { Button } from "@/components/common/ui";
import RolePermissionPicker from "./RolePermissionPicker";
import type { PermissionItem } from "../types";

interface RegisterRoleModalProps {
  isOpen: boolean;
  onClose: () => void;
  permissions: PermissionItem[];
  isSubmitting: boolean;
  onSubmit: (payload: { name: string; permission_ids: number[] }) => void;
}

export default function RegisterRoleModal({
  isOpen,
  onClose,
  permissions,
  isSubmitting,
  onSubmit,
}: RegisterRoleModalProps) {
  const formRef = useRef<HTMLFormElement | null>(null);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [roleName, setRoleName] = useState("");
  const [selectedPermissionIds, setSelectedPermissionIds] = useState<number[]>([]);

  useEffect(() => {
    if (!isOpen) {
      setIsConfirmOpen(false);
      setRoleName("");
      setSelectedPermissionIds([]);
    }
  }, [isOpen]);

  const handleBeforeSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    formRef.current = event.currentTarget;
    setIsConfirmOpen(true);
  };

  const handleConfirm = () => {
    const trimmedName = roleName.trim();
    if (!trimmedName) return;
    onSubmit({ name: trimmedName, permission_ids: selectedPermissionIds });
    setIsConfirmOpen(false);
  };

  const selectedCount = selectedPermissionIds.length;
  const totalCount = permissions.length;

  return (
    <>
      <GenericModal
        isOpen={isOpen}
        onClose={onClose}
        title="Crear Nuevo Rol"
        asForm
        onSubmit={handleBeforeSubmit}
        size="xl"
      >
        <div className="space-y-5">

          {/* Nombre */}
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">
              Nombre del rol <span className="text-red-500">*</span>
            </label>
            <input
              required
              value={roleName}
              onChange={(e) => setRoleName(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-[#094732] focus:ring-2 focus:ring-[#094732]/10"
              placeholder="Ej: Recepcionista, Supervisor, Cajero..."
            />
            <p className="mt-1 text-xs text-slate-400">
              Elige un nombre descriptivo que refleje la función del usuario.
            </p>
          </div>

          {/* Encabezado permisos */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-700">
                  Permisos del rol
                </p>
                <p className="text-xs text-slate-400">
                  Selecciona qué acciones podrá realizar este rol en el sistema.
                </p>
              </div>
              <span
                className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                  selectedCount > 0
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-slate-100 text-slate-500"
                }`}
              >
                {selectedCount} / {totalCount} seleccionados
              </span>
            </div>

            {selectedCount === 0 && (
              <div className="mb-3 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>
                  Puedes crear el rol sin permisos y asignarlos después desde la sección de roles.
                </span>
              </div>
            )}

            <RolePermissionPicker permissions={permissions} selectedIds={selectedPermissionIds} onChange={setSelectedPermissionIds} />
          </div>
        </div>

        {/* Acciones */}
        <div className="mt-6 flex items-center justify-between">
          <p className="text-xs text-slate-400">
            {selectedCount > 0
              ? `Este rol tendrá ${selectedCount} permiso${selectedCount !== 1 ? "s" : ""} asignado${selectedCount !== 1 ? "s" : ""}.`
              : "No hay permisos seleccionados aún."}
          </p>
          <div className="flex gap-3">
            <Button type="button" variant="secondary" onClick={onClose} disabled={isSubmitting}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Guardando..." : "Crear rol"}
            </Button>
          </div>
        </div>
      </GenericModal>

      <ConfirmDialog
        isOpen={isConfirmOpen}
        title="¿Confirmar creación del rol?"
        message={
          selectedCount > 0
            ? `Se creará el rol "${roleName}" con ${selectedCount} permiso${selectedCount !== 1 ? "s" : ""} asignado${selectedCount !== 1 ? "s" : ""}.`
            : `Se creará el rol "${roleName}" sin permisos. Podrás asignarlos después.`
        }
        confirmText="Sí, crear rol"
        cancelText="Revisar"
        variant="success"
        onConfirm={handleConfirm}
        onCancel={() => setIsConfirmOpen(false)}
      />
    </>
  );
}