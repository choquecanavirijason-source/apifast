import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import { CheckSquare, Square } from "lucide-react";

import GenericModal from "@/components/common/modal/GenericModal";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { Button } from "@/components/common/ui";
import { translateAction, translateModule } from "@/core/utils/permissionLabels";
import type { PermissionItem, RoleItem } from "../types";

interface EditRoleModalProps {
  isOpen: boolean;
  onClose: () => void;
  role: RoleItem | null;
  permissions: PermissionItem[];
  isSubmitting: boolean;
  onSubmit: (roleId: number, payload: { name: string; permission_ids: number[] }) => void;
}

export default function EditRoleModal({
  isOpen,
  onClose,
  role,
  permissions,
  isSubmitting,
  onSubmit,
}: EditRoleModalProps) {
  const formRef = useRef<HTMLFormElement | null>(null);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [roleName, setRoleName] = useState("");
  const [selectedPermissionIds, setSelectedPermissionIds] = useState<number[]>([]);

  useEffect(() => {
    if (isOpen && role) {
      setRoleName(role.name);
      setSelectedPermissionIds(role.permissions?.map((p) => p.id) ?? []);
    }
    if (!isOpen) {
      setIsConfirmOpen(false);
      setRoleName("");
      setSelectedPermissionIds([]);
    }
  }, [isOpen, role]);

  const permissionsByModule = useMemo(() => {
    return permissions.reduce<Record<string, PermissionItem[]>>((acc, permission) => {
      const key = permission.name.includes(":")
        ? permission.name.split(":")[0]
        : "otros";
      if (!acc[key]) acc[key] = [];
      acc[key].push(permission);
      return acc;
    }, {});
  }, [permissions]);

  const togglePermission = (id: number) => {
    setSelectedPermissionIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const toggleModule = (modulePermissions: PermissionItem[]) => {
    const moduleIds = modulePermissions.map((p) => p.id);
    const allSelected = moduleIds.every((id) => selectedPermissionIds.includes(id));
    if (allSelected) {
      setSelectedPermissionIds((prev) => prev.filter((id) => !moduleIds.includes(id)));
    } else {
      setSelectedPermissionIds((prev) => [...new Set([...prev, ...moduleIds])]);
    }
  };

  const handleBeforeSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    formRef.current = event.currentTarget;
    setIsConfirmOpen(true);
  };

  const handleConfirm = () => {
    if (!role || !roleName.trim()) return;
    onSubmit(role.id, { name: roleName.trim(), permission_ids: selectedPermissionIds });
    setIsConfirmOpen(false);
  };

  const selectedCount = selectedPermissionIds.length;
  const totalCount = permissions.length;

  return (
    <>
      <GenericModal
        isOpen={isOpen}
        onClose={onClose}
        title={`Editar Rol: ${role?.name ?? ""}`}
        asForm
        onSubmit={handleBeforeSubmit}
        size="xl"
      >
        <div className="space-y-5">
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
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-700">Permisos del rol</p>
                <p className="text-xs text-slate-400">
                  Controla qué secciones y acciones puede ver y realizar este rol.
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

            <div className="max-h-[380px] space-y-3 overflow-y-auto rounded-xl border border-slate-200 p-3">
              {Object.entries(permissionsByModule).map(([module, modulePerms]) => {
                const moduleIds = modulePerms.map((p) => p.id);
                const selectedInModule = moduleIds.filter((id) =>
                  selectedPermissionIds.includes(id)
                ).length;
                const allInModuleSelected = selectedInModule === moduleIds.length;
                const someInModuleSelected = selectedInModule > 0 && !allInModuleSelected;

                return (
                  <div key={module} className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                    <button
                      type="button"
                      onClick={() => toggleModule(modulePerms)}
                      className="mb-2 flex w-full items-center justify-between rounded-lg px-1 py-0.5 transition hover:bg-slate-100"
                    >
                      <div className="flex items-center gap-2">
                        {allInModuleSelected ? (
                          <CheckSquare className="h-4 w-4 text-emerald-600" />
                        ) : someInModuleSelected ? (
                          <CheckSquare className="h-4 w-4 text-emerald-400" />
                        ) : (
                          <Square className="h-4 w-4 text-slate-400" />
                        )}
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
                          {translateModule(module)}
                        </span>
                      </div>
                      <span className="text-xs text-slate-400">
                        {selectedInModule}/{moduleIds.length}
                      </span>
                    </button>

                    <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                      {modulePerms.map((permission) => {
                        const checked = selectedPermissionIds.includes(permission.id);
                        const rawLabel = permission.name.includes(":")
                          ? permission.name.split(":").slice(1).join(":").trim()
                          : permission.name;
                        const label = translateAction(rawLabel);

                        return (
                          <label
                            key={permission.id}
                            title={permission.name}
                            className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-xs transition ${
                              checked
                                ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                                : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => togglePermission(permission.id)}
                              className="h-4 w-4 rounded border-slate-300 accent-emerald-600"
                            />
                            <span className="capitalize">{label}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-between">
          <p className="text-xs text-slate-400">
            {selectedCount > 0
              ? `Este rol tendrá ${selectedCount} permiso${selectedCount !== 1 ? "s" : ""} asignado${selectedCount !== 1 ? "s" : ""}.`
              : "Sin permisos — el usuario no verá ninguna sección protegida."}
          </p>
          <div className="flex gap-3">
            <Button type="button" variant="secondary" onClick={onClose} disabled={isSubmitting}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Guardando..." : "Guardar cambios"}
            </Button>
          </div>
        </div>
      </GenericModal>

      <ConfirmDialog
        isOpen={isConfirmOpen}
        title="¿Guardar cambios en el rol?"
        message={`Se actualizarán los permisos del rol "${roleName}". Los usuarios con este rol verán los cambios la próxima vez que inicien sesión.`}
        confirmText="Sí, guardar"
        cancelText="Revisar"
        variant="success"
        onConfirm={handleConfirm}
        onCancel={() => setIsConfirmOpen(false)}
      />
    </>
  );
}
