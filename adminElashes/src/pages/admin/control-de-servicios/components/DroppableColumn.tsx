import type { ReactNode } from "react";
import { useDroppable } from "@dnd-kit/core";
import type { TicketItem } from "../../../../core/services/agenda/agenda.service";

export default function DroppableColumn({
  id,
  title,
  tickets,
  isEmptyLabel,
  renderCard,
  highlightTicket,
  dataTour,
}: {
  id: string;
  title: string;
  subtitle?: string;
  tickets: TicketItem[];
  isEmptyLabel: string;
  renderCard: (ticket: TicketItem) => ReactNode;
  highlightTicket?: (ticket: TicketItem) => boolean;
  dataTour?: string;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  const hasTickets = tickets.length > 0;

  return (
    <div data-tour={dataTour} className="flex min-h-0 h-full flex-col border border-[var(--ui-border-strong)] bg-white">
      {/* Column header — compacto */}
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-[var(--ui-border-strong)] bg-[var(--ui-surface-muted)] px-2 py-1.5">
        <h3 className="text-[11px] font-semibold text-[var(--ui-text)]">{title}</h3>
        <span className="inline-flex min-w-[20px] items-center justify-center border border-[var(--ui-border-strong)] bg-white px-1 py-0 text-[10px] font-semibold text-[var(--ui-text)]">
          {tickets.length}
        </span>
      </div>

      {/* Drop zone */}
      <div
        ref={setNodeRef}
        className={`min-h-0 flex-1 space-y-2 overflow-y-auto p-2.5 transition-colors duration-150 ${
          isOver ? "bg-[var(--ui-surface-muted)] ring-2 ring-inset ring-[#201f1e]/30" : "bg-[var(--ui-surface-muted)]"
        }`}
      >
        {!hasTickets ? (
          <div className="flex min-h-[160px] flex-col items-center justify-center gap-2 border border-dashed border-[var(--ui-border-strong)] bg-white px-4 text-center">
            <p className="text-xs font-medium text-[var(--ui-text-muted)]">{isEmptyLabel}</p>
            <p className="text-[10px] text-[var(--ui-text-muted)]">Arrastra un ticket aquí o usa las acciones de la tarjeta.</p>
          </div>
        ) : (
          tickets.map((ticket) => (
            <div
              key={ticket.id}
              className={
                highlightTicket?.(ticket)
                  ? "relative border border-[#201f1e] bg-white p-[2px]"
                  : ""
              }
            >
              {highlightTicket?.(ticket) ? (
                <span className="absolute right-2 top-2 z-10 border border-[#201f1e] bg-white px-1.5 py-0.5 text-[11px] font-semibold text-[var(--ui-text)]">
                  Nuevo
                </span>
              ) : null}
              {renderCard(ticket)}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
