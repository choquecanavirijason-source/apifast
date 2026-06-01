import { useState } from "react";
import { ArrowLeftRight, Building2, X } from "lucide-react";
import { toast } from "react-toastify";
import api from "@/core/services/api";
import Button from "@/components/common/ui/Button";
import type { BranchItem, UserItem } from "../types";

interface Props {
  user: UserItem;
  branches: BranchItem[];
  onClose: () => void;
  onSuccess: (updated: UserItem) => void;
}

export default function BranchAssignModal({ user, branches, onClose, onSuccess }: Props) {
  const today = new Date().toISOString().slice(0, 10);
  const homeBranchName = user.branch?.name ?? "Sin sucursal";
  const hasTempActive =
    !!user.temp_branch_id &&
    !!user.temp_branch_until &&
    user.temp_branch_until >= today;

  const [mode, setMode] = useState<"temp" | "permanent">("temp");
  const [selectedBranchId, setSelectedBranchId] = useState<string>(
    String(user.branch_id ?? "")
  );
  const [tempUntil, setTempUntil] = useState(
    hasTempActive ? (user.temp_branch_until ?? "") : ""
  );
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    const branchId = Number(selectedBranchId);
    if (!branchId) return toast.warning("Selecciona una sucursal.");
    if (mode === "temp" && !tempUntil) return toast.warning("Indica la fecha de retorno.");

    setLoading(true);
    try {
      const payload =
        mode === "permanent"
          ? { branch_id: branchId, permanent: true }
          : { branch_id: branchId, permanent: false, temp_until: tempUntil };

      const res = await api.patch<UserItem>(`/admin/users/${user.id}/branch-assignment`, payload);
      toast.success(
        mode === "permanent"
          ? "Sucursal actualizada permanentemente."
          : "Asignación temporal registrada correctamente."
      );
      onSuccess(res.data);
      onClose();
    } catch {
      toast.error("No se pudo reasignar la sucursal.");
    } finally {
      setLoading(false);
    }
  };

  const handleClearTemp = async () => {
    setLoading(true);
    try {
      const res = await api.patch<UserItem>(`/admin/users/${user.id}/branch-assignment`, {
        branch_id: null,
        permanent: false,
      });
      toast.success("Asignación temporal eliminada. La operaria vuelve a su sucursal de origen.");
      onSuccess(res.data);
      onClose();
    } catch {
      toast.error("No se pudo eliminar la asignación temporal.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-md rounded-sm border border-[#edebe9] bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#edebe9] px-5 py-3.5">
          <div className="flex items-center gap-2">
            <ArrowLeftRight className="h-4 w-4 text-[#0078d4]" />
            <div>
              <h2 className="text-sm font-bold text-[#323130]">Reasignar sucursal</h2>
              <p className="text-[11px] text-[#605e5c]">{user.username} · Origen: {homeBranchName}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-sm p-1 text-[#605e5c] hover:bg-[#f3f2f1]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="space-y-4 p-5">
          {/* Asignación temporal activa */}
          {hasTempActive && (
            <div className="flex items-start justify-between rounded-sm border border-[#f0c477] bg-[#fff4ce] px-3 py-2.5">
              <div>
                <p className="text-[11px] font-semibold text-[#8a6a1f]">Asignación temporal activa</p>
                <p className="text-[11px] text-[#605e5c]">
                  Trabajando en otra sucursal hasta el {user.temp_branch_until}
                </p>
              </div>
              <Button
                variant="danger"
                size="sm"
                onClick={() => void handleClearTemp()}
                disabled={loading}
                className="ml-3 shrink-0"
              >
                Cancelar temp.
              </Button>
            </div>
          )}

          {/* Modo */}
          <div className="flex overflow-hidden rounded-sm border border-[#edebe9]">
            <button
              type="button"
              onClick={() => setMode("temp")}
              className={`flex flex-1 items-center justify-center gap-1.5 py-2 text-[11px] font-semibold transition ${mode === "temp" ? "bg-[#0078d4] text-white" : "bg-[#faf9f8] text-[#605e5c] hover:bg-[#f3f2f1]"}`}
            >
              Temporal
            </button>
            <button
              type="button"
              onClick={() => setMode("permanent")}
              className={`flex flex-1 items-center justify-center gap-1.5 py-2 text-[11px] font-semibold transition ${mode === "permanent" ? "bg-[#d83b01] text-white" : "bg-[#faf9f8] text-[#605e5c] hover:bg-[#f3f2f1]"}`}
            >
              Permanente
            </button>
          </div>

          {mode === "permanent" && (
            <p className="rounded-sm border border-[#f1adba] bg-[#fde7e9] px-3 py-2 text-[11px] text-[#a4262c]">
              Esto actualizará la sucursal de origen de la operaria de forma permanente.
            </p>
          )}

          {/* Sucursal destino */}
          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-[#605e5c]">
              <Building2 className="mr-1 inline h-3 w-3" />
              Sucursal destino
            </label>
            <select
              value={selectedBranchId}
              onChange={(e) => setSelectedBranchId(e.target.value)}
              className="w-full rounded-sm border border-[#edebe9] bg-white px-3 py-2 text-sm text-[#323130] outline-none focus:border-[#0078d4]"
            >
              <option value="">Seleccionar...</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                  {b.id === user.branch_id ? " (sucursal de origen)" : ""}
                </option>
              ))}
            </select>
          </div>

          {/* Fecha de retorno (solo temporal) */}
          {mode === "temp" && (
            <div>
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-[#605e5c]">
                Fecha de retorno
              </label>
              <input
                type="date"
                min={today}
                value={tempUntil}
                onChange={(e) => setTempUntil(e.target.value)}
                className="w-full rounded-sm border border-[#edebe9] bg-white px-3 py-2 text-sm text-[#323130] outline-none focus:border-[#0078d4]"
              />
              <p className="mt-1 text-[10px] text-[#605e5c]">
                A partir de esta fecha, la operaria vuelve automáticamente a {homeBranchName}.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-2 border-t border-[#edebe9] px-5 py-3">
          <Button variant="secondary" fullWidth onClick={onClose} disabled={loading}>
            Cancelar
          </Button>
          <Button
            variant={mode === "permanent" ? "danger" : "primary"}
            fullWidth
            onClick={() => void handleSave()}
            disabled={loading}
          >
            {loading ? "Guardando…" : mode === "permanent" ? "Mover permanentemente" : "Asignar temporalmente"}
          </Button>
        </div>
      </div>
    </div>
  );
}
