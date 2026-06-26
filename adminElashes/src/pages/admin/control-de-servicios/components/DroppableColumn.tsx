import type { ReactNode } from "react";

import { useDroppable } from "@dnd-kit/core";

import type { TicketItem } from "../../../../core/services/agenda/agenda.service";

const ACCENT_HEX: Record<string, string> = {
  orange: "#D83B01",
  blue:   "#094732",
  green:  "#107C10",
};

export default function DroppableColumn({
  id,
  title,
  tickets,
  isEmptyLabel,
  renderCard,
  highlightTicket,
  accentColor = "blue",
}: {
  id: string;
  title: string;
  subtitle?: string;
  tickets: TicketItem[];
  isEmptyLabel: string;
  renderCard: (ticket: TicketItem) => ReactNode;
  highlightTicket?: (ticket: TicketItem) => boolean;
  accentColor?: "orange" | "blue" | "green";
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  const color = ACCENT_HEX[accentColor];
  const hasTickets = tickets.length > 0;

  return (
    <div className="flex min-h-0 h-full flex-col border border-[#c8c6c4] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.06)]">
      {/* Accent stripe */}
      <div style={{ height: 3, backgroundColor: color }} />

      {/* Column header — compacto */}
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-[#edebe9] bg-[#f3f2f1] px-2 py-1.5">
        <div className="flex items-center gap-1.5">
          <div style={{ width: 3, height: 14, backgroundColor: color, flexShrink: 0 }} />
          <h3 className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#201f1e]">{title}</h3>
        </div>
        <span className="inline-flex min-w-[20px] items-center justify-center border border-[#8a8886] bg-white px-1 py-0 text-[10px] font-semibold text-[#201f1e]">
          {tickets.length}
        </span>
      </div>

      {/* Drop zone — llena el espacio disponible */}
      <div
        ref={setNodeRef}
        className={`min-h-0 flex-1 space-y-1.5 overflow-y-auto p-1.5 transition-colors duration-150 ${
          isOver ? "bg-[#d1e8df] ring-2 ring-inset ring-[#094732]/50" : "bg-[#faf9f8]"
        }`}
      >
        {!hasTickets ? (
          <div className="flex min-h-[160px] flex-col items-center justify-center border border-dashed border-[#c8c6c4] bg-white px-4 text-center">
            <p className="text-xs font-medium text-[#605e5c]">{isEmptyLabel}</p>
            <p className="mt-0.5 text-[11px] text-[#8a8886]">Suelta aquí el ticket (arrastra desde la tarjeta).</p>
          </div>
        ) : (
          tickets.map((ticket) => (
            <div
              key={ticket.id}
              className={
                highlightTicket?.(ticket)
                  ? "relative border border-[#94c4a9] bg-[#f0f7f4] p-[2px]"
                  : ""
              }
            >
              {highlightTicket?.(ticket) ? (
                <span
                  className="absolute right-2 top-2 z-10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white"
                  style={{ backgroundColor: "#094732" }}
                >
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
