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
        <h3 className="text-base font-semibold text-slate-800">{title}</h3>
        <div className="mt-2 mb-5 text-sm text-slate-500 leading-relaxed">{message}</div>
        <div className="flex justify-end gap-2">
          <button
            className="px-4 py-2 rounded-lg border border-slate-200 bg-white text-slate-600 text-sm font-medium hover:bg-slate-50 transition"
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
                  ? "px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-800 text-white text-sm font-medium transition"
                  : variant === "success"
                    ? "px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium transition"
                    : "px-4 py-2 rounded-lg bg-[#094732] hover:bg-[#063324] text-white text-sm font-medium transition"
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
