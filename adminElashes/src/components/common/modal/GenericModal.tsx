import { useEffect, useRef } from "react";
import type { FormEvent, ReactNode } from "react";
import { X } from "lucide-react";
import { toast } from "react-toastify";

type ToastVariant = "success" | "error" | "warning" | "info";

interface ModalToastConfig {
  showOnOpen?: boolean;
  showOnClose?: boolean;
  showOnSubmitSuccess?: boolean;
  showOnSubmitError?: boolean;
  openMessage?: string;
  closeMessage?: string;
  submitSuccessMessage?: string;
  submitErrorMessage?: string;
  closeVariant?: ToastVariant;
}

interface GenericModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
  closeOnBackdrop?: boolean;
  showCloseButton?: boolean;
  contentClassName?: string;
  bodyClassName?: string;
  asForm?: boolean;
  onSubmit?: (event: FormEvent<HTMLFormElement>) => void | Promise<void>;
  toastConfig?: ModalToastConfig;
}

const sizeClassMap = {
  sm: "max-w-md",
  md: "max-w-lg",
  lg: "max-w-2xl",
  xl: "max-w-4xl",
};

export default function GenericModal({
  isOpen,
  onClose,
  title,
  children,
  footer,
  size = "md",
  closeOnBackdrop = true,
  showCloseButton = true,
  contentClassName = "",
  bodyClassName = "",
  asForm = false,
  onSubmit,
  toastConfig,
}: GenericModalProps) {
  const wasOpenRef = useRef(false);

  const showToast = (variant: ToastVariant, message: string) => {
    if (variant === "success") {
      toast.success(message);
      return;
    }
    if (variant === "error") {
      toast.error(message);
      return;
    }
    if (variant === "warning") {
      toast.warning(message);
      return;
    }
    toast.info(message);
  };

  useEffect(() => {
    if (isOpen && !wasOpenRef.current && toastConfig?.showOnOpen) {
      showToast("success", toastConfig.openMessage ?? "Modal abierto correctamente.");
    }
    wasOpenRef.current = isOpen;
  }, [isOpen, toastConfig]);

  const handleClose = () => {
    if (toastConfig?.showOnClose) {
      const closeVariant = toastConfig.closeVariant ?? "warning";
      showToast(closeVariant, toastConfig.closeMessage ?? "Acción cancelada.");
    }
    onClose();
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    if (!onSubmit) return;

    try {
      await onSubmit(event);
      if (toastConfig?.showOnSubmitSuccess) {
        showToast("success", toastConfig.submitSuccessMessage ?? "Acción confirmada correctamente.");
      }
    } catch (error) {
      if (toastConfig?.showOnSubmitError) {
        showToast("error", toastConfig.submitErrorMessage ?? "Ocurrió un error al procesar la acción.");
      }
      throw error;
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-3 py-2 backdrop-blur-sm"
      onClick={closeOnBackdrop ? handleClose : undefined}
      role="presentation"
    >
      {asForm ? (
        <form
          onSubmit={handleSubmit}
          onClick={(event) => event.stopPropagation()}
          className={`w-full ${sizeClassMap[size]} max-h-[calc(100vh-2rem)] rounded-lg border border-slate-200 bg-white p-4 shadow-xl animate-in fade-in duration-150 flex flex-col ${contentClassName}`}
          role="dialog"
          aria-modal="true"
        >
          {(title || showCloseButton) && (
            <div className="mb-3 flex items-center justify-between gap-3">
              {title ? <h3 className="min-w-0 truncate text-base font-semibold text-slate-800">{title}</h3> : <div />}
              {showCloseButton && (
                <button
                  type="button"
                  onClick={handleClose}
                  className="rounded-md p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
                  aria-label="Cerrar"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          )}

          <div className={`flex-1 min-h-0 overflow-y-auto ${bodyClassName}`}>{children}</div>

          {footer ? <div className="mt-4 flex items-center justify-end gap-2">{footer}</div> : null}
        </form>
      ) : (
        <div
          onClick={(event) => event.stopPropagation()}
          className={`w-full ${sizeClassMap[size]} max-h-[calc(100vh-2rem)] rounded-lg border border-slate-200 bg-white p-4 shadow-xl animate-in fade-in duration-150 flex flex-col ${contentClassName}`}
          role="dialog"
          aria-modal="true"
        >
          {(title || showCloseButton) && (
            <div className="mb-3 flex items-center justify-between gap-3">
              {title ? <h3 className="min-w-0 truncate text-base font-semibold text-slate-800">{title}</h3> : <div />}
              {showCloseButton && (
                <button
                  type="button"
                  onClick={handleClose}
                  className="rounded-md p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
                  aria-label="Cerrar"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          )}

          <div className={`flex-1 min-h-0 overflow-y-auto ${bodyClassName}`}>{children}</div>

          {footer ? <div className="mt-4 flex items-center justify-end gap-2">{footer}</div> : null}
        </div>
      )}
    </div>
  );
}
