import { Inbox } from "lucide-react";

interface EmptyStateProps {
  title?: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export default function EmptyState({
  title = "No hay datos registrados",
  description = "Aun no hay elementos para mostrar en esta tabla.",
  actionLabel,
  onAction,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center text-slate-400">
      <Inbox className="mb-3 h-12 w-12 stroke-1" />
      <p className="text-base font-semibold text-slate-600">{title}</p>
      <p className="mt-1 max-w-md text-sm text-slate-500">{description}</p>

      {actionLabel && onAction ? (
        <button
          type="button"
          onClick={onAction}
          className="mt-5 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
        >
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}
