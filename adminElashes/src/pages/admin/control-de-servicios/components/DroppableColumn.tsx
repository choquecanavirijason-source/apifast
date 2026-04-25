import type { ReactNode } from "react";

import { useDroppable } from "@dnd-kit/core";
import { Dot } from "lucide-react";

import { SectionCard } from "../../../../components/common/ui";
import type { TicketItem } from "../../../../core/services/agenda/agenda.service";

export default function DroppableColumn({
  id,
  title,
  subtitle,
  tickets,
  isEmptyLabel,
  renderCard,
  highlightTicket,
}: {
  id: string;
  title: string;
  subtitle: string;
  tickets: TicketItem[];
  isEmptyLabel: string;
  renderCard: (ticket: TicketItem) => ReactNode;
  highlightTicket?: (ticket: TicketItem) => boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  const hasTickets = tickets.length > 0;

  return (
    <SectionCard className="h-full border border-[#d2d0ce] bg-[#faf9f8] shadow-[0_1px_2px_rgba(0,0,0,0.06)]">
      <div className="mb-3 rounded-sm border border-[#edebe9] bg-white px-3 py-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="text-[12px] font-semibold uppercase tracking-[0.06em] text-[#323130]">{title}</h3>
            <p className="mt-0.5 text-[11px] text-[#605e5c]">{subtitle}</p>
          </div>
          <span className="inline-flex items-center rounded-sm border border-[#d2d0ce] bg-[#f3f2f1] px-2 py-0.5 text-[11px] font-semibold text-[#323130]">
            {tickets.length}
          </span>
        </div>
      </div>
      <div
        ref={setNodeRef}
        className={`min-h-[220px] space-y-3 rounded-sm border border-[#d2d0ce] bg-white p-2.5 transition-all lg:min-h-[440px] ${
          isOver ? "bg-[#f3f2f1] ring-2 ring-[#0078d4]/35 ring-offset-1 ring-offset-white" : ""
        }`}
      >
        {!hasTickets ? (
          <div className="flex min-h-[160px] flex-col items-center justify-center rounded-sm border border-dashed border-[#d2d0ce] bg-[#faf9f8] px-4 text-center">
            <span className="mb-1 inline-flex h-6 w-6 items-center justify-center rounded-full bg-[#f3f2f1] text-[#605e5c]">
              <Dot className="h-5 w-5" />
            </span>
            <p className="text-xs font-medium text-[#605e5c]">{isEmptyLabel}</p>
            <p className="mt-1 text-[11px] text-[#a19f9d]">Arrastra un ticket aquí para continuar el flujo.</p>
          </div>
        ) : (
          tickets.map((ticket) => (
            <div
              key={ticket.id}
              className={
                highlightTicket?.(ticket)
                  ? "relative rounded-md border border-[#b9d8f7] bg-[#f7fbff] p-0.5 ring-1 ring-[#0078d4]/30 ring-offset-1 ring-offset-white"
                  : ""
              }
            >
              {highlightTicket?.(ticket) ? (
                <span className="absolute right-2 top-2 z-10 inline-flex items-center rounded-sm border border-[#005a9e] bg-[#0078d4] px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                  Nuevo
                </span>
              ) : null}
              {renderCard(ticket)}
            </div>
          ))
        )}
      </div>
    </SectionCard>
  );
}
