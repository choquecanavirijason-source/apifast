import type { ReactNode } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'full';
  closeOnClickOutside?: boolean;
}

const Modal = ({
  isOpen,
  onClose,
  title,
  children,
  footer,
  size = 'xl',
}: ModalProps) => {
  if (!isOpen) return null;

  const sizeClasses = {
    xs: 'max-w-xs',
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-3xl',
    xl: 'max-w-6xl',
    full: 'w-full h-full max-w-none',
  };

  return (
    <dialog open={isOpen} className="modal z-50" >
      <div
        className={`
          modal-box
          ${sizeClasses[size]}
          overflow-hidden
          bg-gray-50 dark:bg-gray-900/80
          text-gray-900 dark:text-gray-100
          dark:border dark:border-gray-400
          shadow-xl dark:shadow-2xl
          rounded-2xl
          p-6 sm:p-8
          backdrop-blur-md
        `}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-center border-b border-gray-200 dark:border-gray-500 pb-4 mb-4">
          <h3 className="text-2xl font-semibold tracking-tight">{title}</h3>
          <button
            onClick={onClose}
            className="rounded-full p-2 hover:bg-gray-100 dark:hover:bg-gray-800 transition"
            aria-label="Cerrar modal"
          >
            <X className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto max-h-[60vh] pr-1">
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="modal-action mt-6 border-t border-gray-200 dark:border-gray-500 pt-4">
            {footer}
          </div>
        )}
      </div>
    </dialog>
  );
};

export default Modal;