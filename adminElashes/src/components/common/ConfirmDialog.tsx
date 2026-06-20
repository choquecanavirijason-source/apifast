import type { ReactNode } from "react";


interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: ReactNode;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  isProcessing?: boolean;
  variant?: 'primary' | 'secondary' | 'danger' | 'success';
}

export const ConfirmDialog = ({
  isOpen,
  title,
  message,
  confirmText,
  cancelText,
  onConfirm,
  onCancel,
  isProcessing = false,
  variant = 'primary'
}: ConfirmDialogProps) => {
  const confirmLabel = confirmText ?? "Confirmar";
  const cancelLabel = cancelText ?? "Cancelar";
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-[2px]"
      onClick={onCancel}
    >
      <div
        className="bg-white rounded-xl shadow-lg border border-slate-200 p-6 w-full max-w-sm mx-4"
        onClick={(event) => event.stopPropagation()}
      >
        <h3 className="text-base font-semibold text-brand-tertiary">{title}</h3>
        <div className="mt-2 mb-5 text-sm text-brand-tertiary-soft leading-relaxed">{message}</div>
        <div className="flex justify-end gap-2">
          <button
            className="px-4 py-2 rounded-lg border border-brand-secondary/40 bg-white text-brand-tertiary text-sm font-medium hover:bg-brand-secondary/10 transition"
            onClick={onCancel}
            disabled={isProcessing}
          >
            {cancelLabel}
          </button>
          <button
            className={
              variant === "danger"
                ? "px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-sm font-medium transition"
                : variant === "secondary"
                  ? "px-4 py-2 rounded-lg bg-brand-secondary hover:bg-brand-secondary-hover text-white text-sm font-medium transition"
                  : variant === "success"
                    ? "px-4 py-2 rounded-lg bg-brand hover:bg-brand-hover text-white text-sm font-medium transition"
                    : "px-4 py-2 rounded-lg bg-brand hover:bg-brand-hover text-white text-sm font-medium transition"
            }
            onClick={onConfirm}
            disabled={isProcessing}
          >
            {isProcessing ? "Procesando..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
