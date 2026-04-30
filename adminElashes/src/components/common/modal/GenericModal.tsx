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
  /** Pantalla completa (estilo panel Dynamics / Business Central). */
  fullScreen?: boolean;
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
  fullScreen = false,
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

  const shellFormClass = fullScreen
    ? `h-[100dvh] w-full max-w-none max-h-none rounded-none border-0 border-[#edebe9] bg-[#f3f2f1] p-0 shadow-none flex flex-col min-h-0 ${contentClassName}`
    : `w-full ${sizeClassMap[size]} max-h-[calc(100vh-2rem)] rounded-sm border border-[#d2d0ce] bg-[#faf9f8] p-0 shadow-[0_10px_30px_rgba(0,0,0,0.18)] animate-in fade-in duration-150 flex flex-col ${contentClassName}`;

  const shellDivClass = shellFormClass;

  const headerRowClass = fullScreen
    ? "mb-0 flex shrink-0 items-center justify-between gap-3 border-b border-[#edebe9] bg-[#faf9f8] px-4 py-3"
    : "mb-0 flex shrink-0 items-center justify-between gap-3 border-b border-[#edebe9] bg-[#f3f2f1] px-4 py-3";

  const titleClass = fullScreen
    ? "min-w-0 truncate text-lg font-semibold text-[#323130]"
    : "min-w-0 truncate text-base font-semibold text-[#323130]";

  const closeBtnClass = fullScreen
    ? "rounded-sm p-2 text-[#605e5c] transition-colors hover:bg-[#edebe9] hover:text-[#323130]"
    : "rounded-sm p-2 text-[#605e5c] transition-colors hover:bg-[#edebe9] hover:text-[#323130]";

  const bodyWrapClass = fullScreen
    ? `flex-1 min-h-0 overflow-hidden flex flex-col ${bodyClassName}`
    : `flex-1 min-h-0 overflow-y-auto bg-white px-4 py-3 ${bodyClassName}`;

  const backdropClass = fullScreen
    ? "fixed inset-0 z-50 flex items-stretch justify-stretch bg-[#323130]/45 p-0 backdrop-blur-[1px]"
    : "fixed inset-0 z-50 flex items-center justify-center bg-[#323130]/35 px-3 py-2 backdrop-blur-[1px]";

  return (
    <div
      className={backdropClass}
      onClick={closeOnBackdrop ? handleClose : undefined}
      role="presentation"
    >
      {asForm ? (
        <form
          onSubmit={handleSubmit}
          onClick={(event) => event.stopPropagation()}
          className={shellFormClass}
          role="dialog"
          aria-modal="true"
        >
          {(title || showCloseButton) && (
            <div className={headerRowClass}>
              {title ? <h3 className={titleClass}>{title}</h3> : <div />}
              {showCloseButton && (
                <button type="button" onClick={handleClose} className={closeBtnClass} aria-label="Cerrar">
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          )}

          <div className={bodyWrapClass}>{children}</div>

          {footer ? (
            <div
              className={`flex items-center justify-end gap-2 ${
                fullScreen
                  ? "shrink-0 border-t border-[#edebe9] bg-white px-4 py-3"
                  : "shrink-0 border-t border-[#edebe9] bg-[#faf9f8] px-4 py-3"
              }`}
            >
              {footer}
            </div>
          ) : null}
        </form>
      ) : (
        <div
          onClick={(event) => event.stopPropagation()}
          className={shellDivClass}
          role="dialog"
          aria-modal="true"
        >
          {(title || showCloseButton) && (
            <div className={headerRowClass}>
              {title ? <h3 className={titleClass}>{title}</h3> : <div />}
              {showCloseButton && (
                <button type="button" onClick={handleClose} className={closeBtnClass} aria-label="Cerrar">
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          )}

          <div className={bodyWrapClass}>{children}</div>

          {footer ? (
            <div
              className={`flex items-center justify-end gap-2 ${
                fullScreen
                  ? "shrink-0 border-t border-[#edebe9] bg-white px-4 py-3"
                  : "shrink-0 border-t border-[#edebe9] bg-[#faf9f8] px-4 py-3"
              }`}
            >
              {footer}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
