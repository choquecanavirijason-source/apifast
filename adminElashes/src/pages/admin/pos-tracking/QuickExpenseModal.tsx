import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, Wallet } from "lucide-react";
import { toast } from "react-toastify";

import GenericModal from "@/components/common/modal/GenericModal";
import { Button } from "@/components/common/ui";
import { CashSessionService } from "@/core/services/cash-session/cash-session.service";
import { ExpenseService, type ExpenseOut } from "@/core/services/expense/expense.service";
import { getApiErrorMessage } from "@/core/utils/apiError";

interface QuickExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  branchId: number | null;
  branchName: string;
}

// Motivos frecuentes: un toque llena la descripción (se puede editar).
const QUICK_REASONS = ["Insumos", "Limpieza", "Transporte", "Emergencia"];

const money = (value: number) => `Bs ${value.toFixed(2)}`;

function todayIso() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

/**
 * Gasto del día a día (comprar algo, pago de emergencia) registrado en dos toques desde la caja.
 * Queda en el historial de gastos, descuenta del efectivo esperado en el corte y en la auditoría.
 */
export default function QuickExpenseModal({ isOpen, onClose, branchId, branchName }: QuickExpenseModalProps) {
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [cashOpen, setCashOpen] = useState<boolean | null>(null);
  const [todayExpenses, setTodayExpenses] = useState<ExpenseOut[]>([]);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const loadToday = useCallback(async () => {
    if (!branchId) return;
    const today = todayIso();
    try {
      const rows = await ExpenseService.list({ branch_id: branchId, from_date: today, to_date: today });
      setTodayExpenses(rows);
    } catch {
      setTodayExpenses([]);
    }
  }, [branchId]);

  useEffect(() => {
    if (!isOpen) return;
    setAmount("");
    setDescription("");
    setPhoto(null);
    setCashOpen(null);
    if (!branchId) return;
    let cancelled = false;
    CashSessionService.getCurrent(branchId)
      .then((session) => { if (!cancelled) setCashOpen(session?.status === "open"); })
      .catch(() => { if (!cancelled) setCashOpen(null); });
    void loadToday();
    return () => { cancelled = true; };
  }, [isOpen, branchId, loadToday]);

  const parsedAmount = Number.parseFloat(amount);
  const amountOk = Number.isFinite(parsedAmount) && parsedAmount > 0;
  const canSave = !saving && !!branchId && cashOpen !== false && amountOk && description.trim().length > 0;
  const todayTotal = todayExpenses.reduce((sum, expense) => sum + expense.amount, 0);

  const handleSave = async () => {
    if (!canSave || !branchId) return;
    setSaving(true);
    try {
      const photo_url = photo ? await ExpenseService.uploadPhoto(photo) : null;
      await ExpenseService.create({
        branch_id: branchId,
        amount: parsedAmount,
        description: description.trim(),
        expense_date: todayIso(),
        photo_url,
      });
      toast.success(`Gasto de ${money(parsedAmount)} registrado.`);
      setAmount("");
      setDescription("");
      setPhoto(null);
      if (fileRef.current) fileRef.current.value = "";
      await loadToday();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No se pudo registrar el gasto."));
    } finally {
      setSaving(false);
    }
  };

  const fieldClass =
    "mt-1 w-full rounded-lg border border-[var(--ui-border-strong)] bg-[var(--ui-input)] px-2.5 py-2 text-sm text-[var(--ui-text)] outline-none focus:border-brand-secondary focus:ring-2 focus:ring-brand-secondary/20";

  return (
    <GenericModal
      isOpen={isOpen}
      onClose={() => { if (!saving) onClose(); }}
      title="Registrar gasto"
      size="md"
      footer={
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={onClose} disabled={saving}>
            Cerrar
          </Button>
          <Button type="button" size="sm" onClick={() => void handleSave()} disabled={!canSave}>
            {saving ? "Guardando…" : "Registrar gasto"}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <p className="text-xs text-[var(--ui-text-muted)]">
          Para compras o pagos del día (también de emergencia). Se descuenta del efectivo de la caja y queda en el historial de gastos de{" "}
          <span className="font-semibold text-[var(--ui-text)]">{branchName || "la sucursal"}</span>.
        </p>

        {!branchId ? (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
            Elige una sucursal específica para registrar un gasto.
          </p>
        ) : cashOpen === false ? (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
            No hay una caja abierta en esta sucursal. Abre la caja antes de registrar gastos para que se descuenten del corte.
          </p>
        ) : null}

        <label className="block text-xs font-medium text-[var(--ui-text-muted)]">
          Monto (Bs) <span className="text-rose-600">*</span>
          <input
            type="number"
            min={0}
            step="0.01"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            onWheel={(e) => e.currentTarget.blur()}
            placeholder="0.00"
            autoFocus
            className={`${fieldClass} text-lg font-bold tabular-nums`}
          />
        </label>

        <div>
          <label className="block text-xs font-medium text-[var(--ui-text-muted)]" htmlFor="quick-expense-description">
            ¿En qué se gastó? <span className="text-rose-600">*</span>
          </label>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {QUICK_REASONS.map((reason) => (
              <button
                key={reason}
                type="button"
                onClick={() => setDescription((prev) => (prev.trim() ? prev : `${reason}: `))}
                className="rounded-full border border-[var(--ui-border-strong)] bg-white px-2.5 py-1 text-[11px] font-semibold text-[var(--ui-text-muted)] transition hover:border-[#094732] hover:text-[#094732]"
              >
                {reason}
              </button>
            ))}
          </div>
          <textarea
            id="quick-expense-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            maxLength={500}
            placeholder="Ej: Compra de agua para las clientas"
            className={`${fieldClass} resize-none`}
          />
        </div>

        <div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => setPhoto(e.target.files?.[0] ?? null)}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-[var(--ui-border-strong)] px-3 py-1.5 text-xs font-semibold text-[var(--ui-text-muted)] transition hover:border-[#094732] hover:text-[#094732]"
          >
            <Camera className="h-3.5 w-3.5" />
            {photo ? `Foto: ${photo.name}` : "Adjuntar foto del comprobante (opcional)"}
          </button>
        </div>

        <div className="rounded-lg border border-[var(--ui-border)] bg-[var(--ui-surface-muted)] p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-xs font-semibold text-[var(--ui-text)]">
              <Wallet className="h-3.5 w-3.5" /> Gastos de hoy
            </span>
            <span className="text-xs font-bold tabular-nums text-[var(--ui-text)]">{money(todayTotal)}</span>
          </div>
          {todayExpenses.length === 0 ? (
            <p className="text-xs text-[var(--ui-text-muted)]">Aún no hay gastos hoy.</p>
          ) : (
            <ul className="max-h-40 space-y-1 overflow-y-auto">
              {todayExpenses.map((expense) => (
                <li key={expense.id} className="flex items-start justify-between gap-3 text-xs">
                  <span className="min-w-0 text-[var(--ui-text)]">
                    {expense.description}
                    {expense.created_by_name ? (
                      <span className="text-[var(--ui-text-muted)]"> · {expense.created_by_name}</span>
                    ) : null}
                  </span>
                  <span className="shrink-0 font-semibold tabular-nums text-[var(--ui-text)]">{money(expense.amount)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </GenericModal>
  );
}
