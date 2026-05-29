import { useState, useEffect } from "react";
import GenericModal from "@/components/common/modal/GenericModal";
import { Button } from "@/components/common/ui";
import type { BranchItem, UserItem } from "../types";

interface SkillLevelModalProps {
  isOpen: boolean;
  user: UserItem | null;
  branches: BranchItem[];
  onClose: () => void;
  onSubmit: (userId: number, level: number | null, branchId: number | null, phone: string | null) => Promise<void>;
  submitting: boolean;
}

export default function SkillLevelModal({
  isOpen,
  user,
  branches,
  onClose,
  onSubmit,
  submitting,
}: SkillLevelModalProps) {
  const [selected, setSelected] = useState<number | null>(null);
  const [hovered, setHovered] = useState<number | null>(null);
  const [selectedBranch, setSelectedBranch] = useState<number | null>(null);
  const [phone, setPhone] = useState("");

  useEffect(() => {
    if (isOpen) {
      setSelected(user?.skill_level ?? null);
      setSelectedBranch(user?.branch_id ?? user?.branch?.id ?? null);
      setPhone(user?.phone ?? "");
    }
  }, [isOpen, user]);

  const display = hovered ?? selected ?? 0;

  const handleSubmit = async () => {
    if (!user) return;
    const cleanPhone = phone.trim() || null;
    await onSubmit(user.id, selected, selectedBranch, cleanPhone);
  };

  return (
    <GenericModal
      isOpen={isOpen}
      onClose={onClose}
      title="Editar operaria"
      size="sm"
    >
      <div className="space-y-5">
        <div className="text-center">
          <p className="text-sm font-semibold text-slate-700">{user?.username}</p>
          <p className="text-xs text-slate-400">Operaria</p>
        </div>

        {/* Teléfono */}
        <div className="space-y-1">
          <label className="block text-xs font-semibold text-slate-600">Teléfono</label>
          <input
            type="tel"
            value={phone}
            disabled={submitting}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+591 70000000"
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-[#094732] disabled:opacity-50"
          />
        </div>

        {/* Nivel de experiencia */}
        <div className="flex flex-col items-center gap-3">
          <p className="text-xs font-semibold text-slate-600">Nivel de experiencia</p>
          <div className="flex items-center gap-1">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                disabled={submitting}
                onClick={() => setSelected(star === selected ? null : star)}
                onMouseEnter={() => setHovered(star)}
                onMouseLeave={() => setHovered(null)}
                className="text-4xl leading-none transition-transform hover:scale-110 focus:outline-none disabled:opacity-50"
                title={`Nivel ${star}`}
              >
                <span className={star <= display ? "text-amber-400" : "text-slate-200"}>
                  ★
                </span>
              </button>
            ))}
          </div>

          <p className="text-xs text-slate-500">
            {selected
              ? `Nivel ${selected} de 5 — ${["", "Principiante", "Básico", "Intermedio", "Avanzado", "Experta"][selected]}`
              : "Sin nivel asignado — haz clic en una estrella"}
          </p>

          {selected !== null && (
            <button
              type="button"
              onClick={() => setSelected(null)}
              className="text-xs text-slate-400 hover:text-slate-600 underline"
            >
              Quitar nivel
            </button>
          )}
        </div>

        {/* Sucursal */}
        <div className="space-y-1">
          <label className="block text-xs font-semibold text-slate-600">Sucursal</label>
          <select
            value={selectedBranch ?? ""}
            disabled={submitting}
            onChange={(e) => setSelectedBranch(Number(e.target.value) || null)}
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-[#094732] disabled:opacity-50"
          >
            <option value="">Sin sucursal</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </div>

        <div className="flex justify-end gap-3 border-t border-slate-100 pt-4">
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? "Guardando..." : "Guardar"}
          </Button>
        </div>
      </div>
    </GenericModal>
  );
}
