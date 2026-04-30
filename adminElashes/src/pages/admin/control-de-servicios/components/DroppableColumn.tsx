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
  compact = false,
}: {
  id: string;
  title: string;
  subtitle: string;
  tickets: TicketItem[];
  isEmptyLabel: string;
  renderCard: (ticket: TicketItem) => ReactNode;
  highlightTicket?: (ticket: TicketItem) => boolean;
  compact?: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  const hasTickets = tickets.length > 0;

  return (
    <SectionCard
      className={`h-full overflow-hidden border ${compact ? "border-[#e1dfdd] bg-white shadow-none" : "border-[#c8c6c4] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.08)]"}`}
      bodyClassName={compact ? "!p-1.5" : "!p-2"}
    >
      <div className="mb-2 border border-[#edebe9] bg-[#f3f2f1] px-2 py-1.5">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#323130]">{title}</h3>
            <p className="mt-0.5 text-[10px] text-[#605e5c]">{subtitle}</p>
          </div>
          <span className="inline-flex min-w-[28px] items-center justify-center rounded-sm border border-[#8a8886] bg-white px-1.5 py-0.5 text-[10px] font-semibold text-[#201f1e]">
            {tickets.length}
          </span>
        </div>
      </div>
      <div
        ref={setNodeRef}
        className={`min-h-[220px] space-y-2 border border-[#d2d0ce] bg-[#fbfbfb] ${compact ? "p-1 lg:min-h-[420px]" : "p-2 lg:min-h-[440px]"} transition-all ${
          isOver ? "border-[#0078d4] bg-[#eff6fc] ring-1 ring-[#0078d4]/25" : ""
        }`}
      >
        {!hasTickets ? (
          <div className="flex min-h-[160px] flex-col items-center justify-center border border-dashed border-[#c8c6c4] bg-white px-4 text-center">
            <span className="mb-1 inline-flex h-6 w-6 items-center justify-center rounded-sm bg-[#f3f2f1] text-[#605e5c]">
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
                  ? "relative border border-[#9dc4e6] bg-[#f5f9fd] p-[3px] ring-1 ring-[#0078d4]/20"
                  : ""
              }
            >
              {highlightTicket?.(ticket) ? (
                <span className="absolute right-2 top-2 z-10 inline-flex items-center border border-[#005a9e] bg-[#0078d4] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white">
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
