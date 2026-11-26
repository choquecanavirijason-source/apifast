import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, Banknote, HandCoins, ShieldCheck } from "lucide-react";

/** Motivos más comunes: un clic y listo. "Otro motivo" obliga a escribir el detalle. */
const QUICK_REASONS = [
  "La clienta esperó demasiado y se fue",
  "La clienta decidió no hacerse el servicio",
  "Error al registrar la venta o el ticket",
  "La operaria no estaba disponible",
  "Cobro duplicado",
] as const;
const OTHER = "Otro motivo";
const MIN_LENGTH = 5;

export type CancelDecision = {
  /** Motivo final (opción rápida + detalle). Se guarda en la cancelación y en Auditoría. */
  reason: string;
  /** true = se devuelve el dinero · false = no se devuelve · undefined = no había dinero cobrado. */
  refund: boolean | undefined;
};

type Props = {
  open: boolean;
  /** Ej. "Cancelar ticket" o "Cancelar venta". */
  title: string;
  /** Qué se cancela, ej. "B1-20261126-0003 · Cliente Mostrador". */
  subject: string;
  /** Lo cobrado de lo que se cancela. 0 = nada cobrado: no se pregunta por devolución. */
  amountPaid: number;
  confirmLabel?: string;
  isProcessing?: boolean;
  onCancel: () => void;
  onConfirm: (decision: CancelDecision) => void;
};

/**
 * Cancelar algo ya no es un simple "¿seguro?": pide el motivo y, si la clienta ya pagó, qué pasa con el
 * dinero. Todo queda registrado en Auditoría con el usuario que canceló.
 */
export default function CancelReasonDialog({
  open, title, subject, amountPaid, confirmLabel = "Cancelar", isProcessing = false, onCancel, onConfirm,
}: Props) {
  const [choice, setChoice] = useState<string>("");
  const [detail, setDetail] = useState("");
  const [refund, setRefund] = useState<boolean | null>(null);

  // Cada vez que se abre, empieza limpio.
  useEffect(() => {
    if (open) { setChoice(""); setDetail(""); setRefund(null); }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && !isProcessing) onCancel(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, isProcessing, onCancel]);

  const hasMoney = amountPaid > 0;
  const isOther = choice === OTHER;

  const reason = useMemo(() => {
    const extra = detail.trim();
    if (!choice) return "";
    if (isOther) return extra;
    return extra ? `${choice} — ${extra}` : choice;
  }, [choice, detail, isOther]);

  const reasonValid = reason.length >= MIN_LENGTH;
  const refundValid = !hasMoney || refund !== null;
  const canConfirm = reasonValid && refundValid && !isProcessing;

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[95] flex items-center justify-center bg-slate-900/50 p-3 backdrop-blur-[2px]" onClick={() => { if (!isProcessing) onCancel(); }}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="cancel-dialog-title"
        className="flex max-h-[96dvh] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-[var(--ui-border)] bg-[var(--ui-surface)] shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-start gap-3 border-b border-[var(--ui-border)] px-5 py-4">
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-rose-100 text-rose-600">
            <AlertTriangle className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h2 id="cancel-dialog-title" className="text-base font-semibold text-[var(--ui-text)]">{title}</h2>
            <p className="truncate text-sm text-[var(--ui-text-muted)]">{subject}</p>
          </div>
        </header>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-4">
          {/* Motivo */}
          <section>
            <p className="mb-2 text-sm font-semibold text-[var(--ui-text)]">¿Por qué se cancela? <span className="text-rose-600">*</span></p>
            <div className="flex flex-wrap gap-2">
              {[...QUICK_REASONS, OTHER].map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setChoice(option)}
                  aria-pressed={choice === option}
                  className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                    choice === option
                      ? "border-[#094732] bg-[#094732] text-white"
                      : "border-[var(--ui-border-strong)] bg-white text-[var(--ui-text)] hover:bg-[var(--ui-surface-hover)]"
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>
            {choice && (
              <div className="mt-3">
                <label htmlFor="cancel-detail" className="mb-1 block text-xs font-semibold text-[var(--ui-text-muted)]">
                  {isOther ? "Escribe el motivo" : "Detalle (opcional)"}
                </label>
                <textarea
                  id="cancel-detail"
                  value={detail}
                  onChange={(e) => setDetail(e.target.value)}
                  rows={2}
                  maxLength={300}
                  placeholder={isOther ? "Ej. La clienta tuvo una emergencia y pidió reprogramar" : "Ej. Esperó 40 minutos y pidió su devolución"}
                  className="w-full rounded-lg border border-[var(--ui-border-strong)] bg-white px-3 py-2 text-sm text-[var(--ui-text)] outline-none focus:border-[#094732] focus:ring-1 focus:ring-[#094732]/35"
                />
                {isOther && detail.trim().length > 0 && detail.trim().length < MIN_LENGTH && (
                  <p className="mt-1 text-xs text-rose-600">Escribe al menos {MIN_LENGTH} caracteres.</p>
                )}
              </div>
            )}
          </section>

          {/* Dinero */}
          {hasMoney && (
            <section>
              <p className="mb-2 text-sm font-semibold text-[var(--ui-text)]">
                La clienta ya pagó <span className="text-[#094732]">Bs {amountPaid.toFixed(2)}</span>. ¿Se le devuelve el dinero? <span className="text-rose-600">*</span>
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setRefund(true)}
                  aria-pressed={refund === true}
                  className={`rounded-xl border p-3 text-left transition ${
                    refund === true ? "border-[#094732] bg-[#ecfdf5] ring-1 ring-[#094732]/40" : "border-[var(--ui-border-strong)] bg-white hover:bg-[var(--ui-surface-hover)]"
                  }`}
                >
                  <span className="flex items-center gap-2 text-sm font-semibold text-[var(--ui-text)]"><HandCoins className="h-4 w-4 text-[#094732]" /> Sí, devolver</span>
                  <span className="mt-1 block text-xs text-[var(--ui-text-muted)]">Entrega el dinero a la clienta. Sale del cuadre de caja.</span>
                </button>
                <button
                  type="button"
                  onClick={() => setRefund(false)}
                  aria-pressed={refund === false}
                  className={`rounded-xl border p-3 text-left transition ${
                    refund === false ? "border-[#9F8351] bg-[#fbf7ee] ring-1 ring-[#9F8351]/40" : "border-[var(--ui-border-strong)] bg-white hover:bg-[var(--ui-surface-hover)]"
                  }`}
                >
                  <span className="flex items-center gap-2 text-sm font-semibold text-[var(--ui-text)]"><Banknote className="h-4 w-4 text-[#8a6a1f]" /> No devolver</span>
                  <span className="mt-1 block text-xs text-[var(--ui-text-muted)]">El dinero se queda en caja y el cuadre lo sigue contando.</span>
                </button>
              </div>
            </section>
          )}

          <p className="flex items-center gap-1.5 rounded-lg bg-[var(--ui-surface-muted)] px-3 py-2 text-xs text-[var(--ui-text-muted)]">
            <ShieldCheck className="h-4 w-4 shrink-0 text-[#094732]" />
            Queda registrado en Auditoría: quién canceló, el motivo y qué pasó con el dinero.
          </p>
        </div>

        <footer className="flex justify-end gap-2 border-t border-[var(--ui-border)] bg-[var(--ui-surface-muted)] px-5 py-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={isProcessing}
            className="rounded-lg border border-[var(--ui-border-strong)] bg-white px-4 py-2 text-sm font-medium text-[var(--ui-text)] transition hover:bg-[var(--ui-surface-hover)] disabled:opacity-50"
          >
            Volver
          </button>
          <button
            type="button"
            disabled={!canConfirm}
            onClick={() => onConfirm({ reason, refund: hasMoney ? (refund ?? undefined) : undefined })}
            className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isProcessing ? "Cancelando…" : confirmLabel}
          </button>
        </footer>
      </div>
    </div>,
    document.body,
  );
}
