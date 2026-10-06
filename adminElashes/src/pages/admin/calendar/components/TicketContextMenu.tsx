import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { CheckCircle2, PencilLine, PlayCircle, Wallet } from "lucide-react";
import type { TicketItem } from "../../../../core/services/agenda/agenda.service";

export type TicketContextAction = "start-service" | "finish" | "to-sale" | "edit";

type TicketContextMenuProps = {
  ticket: TicketItem;
  /** Posición del clic derecho (coordenadas de la ventana). */
  x: number;
  y: number;
  onAction: (action: TicketContextAction, ticket: TicketItem) => void;
  onClose: () => void;
};

/** Menú de clic derecho sobre una reserva de la agenda: En servicio, finalizar, pasar a venta o editar. */
export default function TicketContextMenu({ ticket, x, y, onAction, onClose }: TicketContextMenuProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState({ left: x, top: y });

  // Que el menú no se salga de la pantalla.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const { width, height } = el.getBoundingClientRect();
    setPos({
      left: Math.min(x, window.innerWidth - width - 8),
      top: Math.min(y, window.innerHeight - height - 8),
    });
  }, [x, y]);

  useEffect(() => {
    const closeOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) onClose();
    };
    const closeWithKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", closeOutside);
    document.addEventListener("keydown", closeWithKey);
    window.addEventListener("scroll", onClose, true);
    window.addEventListener("resize", onClose);
    return () => {
      document.removeEventListener("mousedown", closeOutside);
      document.removeEventListener("keydown", closeWithKey);
      window.removeEventListener("scroll", onClose, true);
      window.removeEventListener("resize", onClose);
    };
  }, [onClose]);

  const status = (ticket.status ?? "").toLowerCase();
  const inService = status === "in_service";
  const closed = ["completed", "cancelled", "finalizado", "cancelado"].includes(status);

  const items: Array<{ action: TicketContextAction; label: string; hint?: string; icon: typeof PlayCircle; disabled?: boolean }> = [
    {
      action: "start-service",
      label: "Pasar a En servicio",
      hint: inService ? "Ya está en servicio" : closed ? "Reserva cerrada" : !ticket.professional_id ? "Primero asigna operaria" : undefined,
      icon: PlayCircle,
      disabled: inService || closed,
    },
    {
      action: "finish",
      label: "Finalizar atención",
      hint: closed ? "Reserva cerrada" : !inService ? "Primero pásala a En servicio" : "Abre la ventana de finalizar (cuestionario y notas)",
      icon: CheckCircle2,
      disabled: !inService,
    },
    {
      action: "to-sale",
      label: ticket.sale_id ? `Ver venta #${ticket.sale_id}` : "Pasar a venta",
      icon: Wallet,
      disabled: Boolean(ticket.sale_id),
    },
    { action: "edit", label: "Editar reserva", icon: PencilLine },
  ];

  return (
    <div
      ref={ref}
      role="menu"
      aria-label={`Acciones de ${ticket.client_name}`}
      className="fixed z-[60] w-56 rounded-xl border border-[var(--ui-border)] bg-[var(--ui-surface)] p-1.5 shadow-[0_10px_30px_rgba(9,40,29,0.18)]"
      style={pos}
      onContextMenu={(e) => e.preventDefault()}
    >
      <p className="truncate px-2 pb-1 pt-0.5 text-[11px] font-medium text-[var(--ui-text-muted)]">{ticket.client_name}</p>
      {items.map(({ action, label, hint, icon: Icon, disabled }) => (
        <button
          key={action}
          type="button"
          role="menuitem"
          disabled={disabled}
          onClick={() => {
            onAction(action, ticket);
            onClose();
          }}
          className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs text-[var(--ui-text)] transition-colors hover:bg-[var(--ui-surface-hover)] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent"
        >
          <Icon className="h-3.5 w-3.5 shrink-0 text-[var(--ui-text-muted)]" aria-hidden />
          <span className="min-w-0 flex-1">
            <span className="block">{label}</span>
            {hint && <span className="block text-[11px] text-[var(--ui-text-muted)]">{hint}</span>}
          </span>
        </button>
      ))}
    </div>
  );
}
