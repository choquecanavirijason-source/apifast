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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onCancel}
    >
      <div
        className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-800 p-6 md:p-8 w-full max-w-md"
        onClick={(event) => event.stopPropagation()}
      >
        <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">{title}</h3>
        <div className="py-4 text-gray-700 dark:text-gray-200">{message}</div>
        <div className="flex justify-end gap-2">
          <button
            className="px-4 py-2 rounded-lg bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600 font-semibold transition"
            onClick={onCancel}
            disabled={isProcessing}
          >
            {cancelLabel}
          </button>
          <button
            className={
              variant === "danger"
                ? "px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white font-semibold transition"
                : variant === "secondary"
                  ? "px-4 py-2 rounded-lg bg-gray-600 hover:bg-gray-700 text-white font-semibold transition"
                  : variant === "success"
                    ? "px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold transition"
                    : "px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold transition"
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
