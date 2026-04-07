import type { ReactNode } from "react";

import { useDroppable } from "@dnd-kit/core";

import { SectionCard } from "../../../../components/common/ui";
import type { TicketItem } from "../../../../core/services/agenda/agenda.service";

export default function DroppableColumn({
  id,
  title,
  subtitle,
  tickets,
  isEmptyLabel,
  renderCard,
}: {
  id: string;
  title: string;
  subtitle: string;
  tickets: TicketItem[];
  isEmptyLabel: string;
  renderCard: (ticket: TicketItem) => ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });

  return (
    <SectionCard className="h-full">
      <h3 className="text-base font-semibold text-slate-800">{title}</h3>
      <p className="text-xs text-slate-500">{subtitle}</p>
      <div
        ref={setNodeRef}
        className={`mt-4 min-h-[220px] lg:min-h-[440px] space-y-3 rounded-xl border border-slate-100 bg-slate-50/40 p-2.5 transition-colors ${
          isOver ? "bg-slate-100/90 ring-2 ring-slate-300 ring-dashed" : ""
        }`}
      >
        {tickets.length === 0 ? (
          <p className="py-6 text-center text-xs text-slate-400">{isEmptyLabel}</p>
        ) : (
          tickets.map((ticket) => renderCard(ticket))
        )}
      </div>
    </SectionCard>
  );
}
