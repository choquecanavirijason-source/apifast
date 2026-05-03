import type { ReactNode } from "react";

import { useDroppable } from "@dnd-kit/core";

import type { TicketItem } from "../../../../core/services/agenda/agenda.service";

const ACCENT_HEX: Record<string, string> = {
  orange: "#D83B01",
  blue:   "#0078D4",
  green:  "#107C10",
};

export default function DroppableColumn({
  id,
  title,
  subtitle,
  tickets,
  isEmptyLabel,
  renderCard,
  highlightTicket,
  accentColor = "blue",
}: {
  id: string;
  title: string;
  subtitle: string;
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
    <div className="flex h-full flex-col border border-[#c8c6c4] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.06)]">
      {/* Accent stripe */}
      <div style={{ height: 3, backgroundColor: color }} />

      {/* Column header */}
      <div className="flex items-center justify-between gap-2 border-b border-[#edebe9] bg-[#f3f2f1] px-3 py-2">
        <div className="flex items-center gap-2">
          <div style={{ width: 3, height: 20, backgroundColor: color, flexShrink: 0 }} />
          <div>
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#201f1e]">{title}</h3>
            <p className="text-[10px] text-[#605e5c]">{subtitle}</p>
          </div>
        </div>
        <span className="inline-flex min-w-[24px] items-center justify-center border border-[#8a8886] bg-white px-1.5 py-0.5 text-[11px] font-semibold text-[#201f1e]">
          {tickets.length}
        </span>
      </div>

      {/* Drop zone */}
      <div
        ref={setNodeRef}
        className="flex-1 space-y-2 overflow-y-auto p-2 transition-colors lg:min-h-[500px]"
        style={
          isOver
            ? { backgroundColor: "#EFF6FC", outline: "1px solid #0078D4", outlineOffset: "-2px" }
            : { backgroundColor: "#FAF9F8" }
        }
      >
        {!hasTickets ? (
          <div className="flex min-h-[160px] flex-col items-center justify-center border border-dashed border-[#c8c6c4] bg-white px-4 text-center">
            <p className="text-xs font-medium text-[#8a8886]">{isEmptyLabel}</p>
            <p className="mt-0.5 text-[11px] text-[#a19f9d]">Arrastra un ticket aquí para continuar el flujo.</p>
          </div>
        ) : (
          tickets.map((ticket) => (
            <div
              key={ticket.id}
              className={
                highlightTicket?.(ticket)
                  ? "relative border border-[#9dc4e6] bg-[#f0f6fb] p-[2px]"
                  : ""
              }
            >
              {highlightTicket?.(ticket) ? (
                <span
                  className="absolute right-2 top-2 z-10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white"
                  style={{ backgroundColor: "#0078D4" }}
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
