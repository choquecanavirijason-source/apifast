import { ShieldAlert } from "lucide-react";

interface ForbiddenDialogProps {
  /** Mensaje del servidor (ej. «No puedes manejar el inventario de otra sucursal.»). null = cerrado. */
  message: string | null;
  /** Qué se intentaba hacer, ej. «transferir stock». */
  action?: string;
  onClose: () => void;
}

/** Pantalla de «sin acceso» para cuando el servidor rechaza una acción por permisos o por sucursal (403). */
export function ForbiddenDialog({ message, action, onClose }: ForbiddenDialogProps) {
  if (message === null) return null;
  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/45 px-4 backdrop-blur-[2px]"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="forbidden-title"
        className="w-full max-w-sm overflow-hidden rounded-2xl border border-[var(--ui-border)] bg-[var(--ui-surface)] text-center shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="bg-gradient-to-b from-rose-50 to-transparent px-6 pb-2 pt-7">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-rose-100 text-rose-600 ring-8 ring-rose-50">
            <ShieldAlert className="h-7 w-7" aria-hidden />
          </span>
        </div>
        <div className="px-6 pb-6 pt-3">
          <h3 id="forbidden-title" className="text-lg font-bold text-[var(--ui-text)]">
            Acceso restringido
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-[var(--ui-text-muted)]">
            {message || "No tienes permiso para realizar esta acción."}
          </p>
          <div className="mt-4 rounded-xl border border-[var(--ui-border)] bg-[var(--ui-surface-muted)] px-3 py-2.5 text-left text-xs text-[var(--ui-text-muted)]">
            {action ? <p className="mb-1">Intentabas: <strong className="text-[var(--ui-text)]">{action}</strong></p> : null}
            <p>Tu cuenta solo maneja la sucursal en la que trabajas. Si necesitas hacerlo en otra, pídeselo a un administrador.</p>
          </div>
          <button
            type="button"
            autoFocus
            onClick={onClose}
            className="mt-5 h-11 w-full rounded-lg bg-[#094732] text-sm font-semibold text-white transition hover:bg-[#063324]"
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
}
