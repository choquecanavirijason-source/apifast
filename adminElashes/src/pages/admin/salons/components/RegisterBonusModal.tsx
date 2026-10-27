import { useEffect, useState, type FormEvent } from "react";
import { toast } from "react-toastify";
import GenericModal from "@/components/common/modal/GenericModal";
import { Button } from "@/components/common/ui";
import { AgendaService, type ProfessionalForSelect } from "@/core/services/agenda/agenda.service";
import { OperatorBonusService, type OperatorBonusOut } from "@/core/services/expense/expense.service";
import { getApiErrorMessage } from "@/core/utils/apiError";

const fieldClass =
  "w-full rounded-lg border border-[var(--ui-border-strong)] bg-white px-3 py-2 text-sm text-[var(--ui-text)] outline-none transition focus:border-brand-secondary focus:ring-1 focus:ring-brand-secondary/35";

const REASON_MAX = 300;

/** Fecha local de hoy en YYYY-MM-DD (toISOString daría la de UTC). */
const todayLocal = () => new Date().toLocaleDateString("en-CA");

interface Props {
  isOpen: boolean;
  /** Sucursal activa del Corte de Caja; null = la de la operaria. */
  branchId: number | null;
  onClose: () => void;
  onSaved: (bonus: OperatorBonusOut) => void;
}

export default function RegisterBonusModal({ isOpen, branchId, onClose, onSaved }: Props) {
  const [professionals, setProfessionals] = useState<ProfessionalForSelect[]>([]);
  const [professionalId, setProfessionalId] = useState("");
  const [amount, setAmount] = useState("");
  const [bonusDate, setBonusDate] = useState(todayLocal);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setProfessionalId("");
    setAmount("");
    setBonusDate(todayLocal());
    setReason("");
    AgendaService.listProfessionalsForSelect({ limit: 200, role_name: "Operaria", branch_id: branchId ?? undefined })
      .then(setProfessionals)
      .catch(() => {
        setProfessionals([]);
        toast.error("No se pudo cargar la lista de operarias.");
      });
  }, [isOpen, branchId]);

  const parsedAmount = Number(amount);
  const canSave =
    professionalId !== "" && Number.isFinite(parsedAmount) && parsedAmount > 0 && bonusDate !== "" &&
    reason.trim().length > 0 && !saving;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSave) return;
    setSaving(true);
    try {
      const saved = await OperatorBonusService.create({
        professional_id: Number(professionalId),
        amount: Math.round(parsedAmount * 100) / 100,
        bonus_date: bonusDate,
        reason: reason.trim(),
        branch_id: branchId ?? undefined,
      });
      toast.success(`Extra de Bs ${saved.amount.toFixed(2)} registrado para ${saved.professional_name}.`);
      onSaved(saved);
    } catch (err) {
      toast.error(getApiErrorMessage(err, "No se pudo registrar el extra."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <GenericModal
      isOpen={isOpen}
      onClose={() => { if (!saving) onClose(); }}
      title="Registrar Extra / Bono"
      size="md"
      asForm
      onSubmit={handleSubmit}
      footer={
        <>
          <Button type="button" variant="secondary" size="sm" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button type="submit" size="sm" disabled={!canSave}>
            {saving ? "Guardando…" : "Registrar"}
          </Button>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="sm:col-span-2">
          <span className="text-xs font-semibold text-[var(--ui-text-muted)]">Operaria</span>
          <select
            required
            value={professionalId}
            onChange={(e) => setProfessionalId(e.target.value)}
            className={`${fieldClass} mt-1`}
          >
            <option value="">Elige una operaria</option>
            {professionals.map((p) => (
              <option key={p.id} value={p.id}>{p.username}</option>
            ))}
          </select>
        </label>
        <label>
          <span className="text-xs font-semibold text-[var(--ui-text-muted)]">Monto (Bs)</span>
          <input
            type="number"
            required
            min="0.01"
            step="0.01"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className={`${fieldClass} mt-1`}
            placeholder="0.00"
          />
        </label>
        <label>
          <span className="text-xs font-semibold text-[var(--ui-text-muted)]">Fecha</span>
          <input
            type="date"
            required
            value={bonusDate}
            onChange={(e) => setBonusDate(e.target.value)}
            className={`${fieldClass} mt-1`}
          />
        </label>
        <label className="sm:col-span-2">
          <span className="text-xs font-semibold text-[var(--ui-text-muted)]">Motivo / Notas</span>
          <textarea
            required
            rows={3}
            maxLength={REASON_MAX}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className={`${fieldClass} mt-1 resize-none`}
            placeholder="Ej. Incentivo por superar meta de 4 a 5 servicios"
          />
          <span className="mt-0.5 block text-right text-[11px] text-[var(--ui-text-muted)]">
            {reason.length}/{REASON_MAX}
          </span>
        </label>
      </div>
      <p className="mt-2 text-xs text-[var(--ui-text-muted)]">
        Cuenta como egreso en el Corte de Caja de la fecha elegida
        {branchId ? " (sucursal activa)" : " (sucursal de la operaria)"}.
      </p>
    </GenericModal>
  );
}
