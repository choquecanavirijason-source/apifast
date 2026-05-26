import type { ReactNode } from "react";

import { useDroppable } from "@dnd-kit/core";

import type { TicketItem } from "../../../../core/services/agenda/agenda.service";

const ACCENT: Record<string, { hex: string; ring: string; dropBg: string }> = {
  orange: { hex: "#f59e0b", ring: "ring-amber-300/60",  dropBg: "bg-amber-50" },
  blue:   { hex: "#3b82f6", ring: "ring-blue-300/60",   dropBg: "bg-blue-50"  },
  green:  { hex: "#10b981", ring: "ring-emerald-300/60", dropBg: "bg-emerald-50" },
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
  const accent = ACCENT[accentColor];
  const hasTickets = tickets.length > 0;

  return (
    <div className="flex h-full flex-col rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      {/* Accent stripe */}
      <div style={{ height: 3, backgroundColor: accent.hex }} />

      {/* Column header */}
      <div className="flex items-center justify-between gap-2 border-b border-slate-100 bg-slate-50 px-3 py-2.5">
        <div className="flex items-center gap-2">
          <div
            className="shrink-0 rounded-full"
            style={{ width: 8, height: 8, backgroundColor: accent.hex }}
          />
          <div>
            <h3 className="text-[11px] font-bold uppercase tracking-[0.07em] text-slate-700">{title}</h3>
            <p className="text-[10px] text-slate-400">{subtitle}</p>
          </div>
        </div>
        <span className="flex min-w-5.5 items-center justify-center rounded-full bg-slate-200 px-1.5 py-0.5 text-[11px] font-bold text-slate-600">
          {tickets.length}
        </span>
      </div>

      {/* Drop zone */}
      <div
        ref={setNodeRef}
        className={`flex-1 space-y-2 overflow-y-auto p-2.5 transition-colors duration-150 lg:min-h-125 ${
          isOver
            ? `${accent.dropBg} ring-2 ring-inset ${accent.ring}`
            : "bg-slate-50/50"
        }`}
      >
        {!hasTickets ? (
          <div className="flex min-h-40 flex-col items-center justify-center rounded-lg border border-dashed border-slate-200 bg-white px-4 text-center">
            <p className="text-xs font-medium text-slate-400">{isEmptyLabel}</p>
            <p className="mt-0.5 text-[11px] text-slate-300">Suelta aquí el ticket para moverlo.</p>
          </div>
        ) : (
          tickets.map((ticket) => (
            <div
              key={ticket.id}
              className={
                highlightTicket?.(ticket)
                  ? "relative rounded-lg border border-blue-200 bg-blue-50/60 p-0.5"
                  : ""
              }
            >
              {highlightTicket?.(ticket) ? (
                <span className="absolute right-2 top-2 z-10 rounded-full bg-blue-500 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white">
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
