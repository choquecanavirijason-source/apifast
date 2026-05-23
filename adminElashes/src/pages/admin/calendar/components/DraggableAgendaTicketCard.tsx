import { GripVertical } from "lucide-react";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import type { TicketItem } from "../../../../core/services/agenda/agenda.service";
import { agendaDragId } from "../dailyAgenda.dnd";
import AgendaTicketCard from "./AgendaTicketCard";

type DraggableAgendaTicketCardProps = {
  ticket: TicketItem;
  compact?: boolean;
  disabled?: boolean;
};

export default function DraggableAgendaTicketCard({
  ticket,
  compact = false,
  disabled = false,
}: DraggableAgendaTicketCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: agendaDragId(ticket.id),
    data: { ticket },
    disabled,
  });

  const style = transform
    ? { transform: CSS.Translate.toString(transform), zIndex: isDragging ? 20 : undefined }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex max-w-[200px] items-start gap-0.5 ${isDragging ? "opacity-50" : ""}`}
    >
      <button
        type="button"
        title="Arrastrar para cambiar hora o puesto"
        className={`mt-1 flex h-6 w-5 shrink-0 cursor-grab items-center justify-center rounded border border-[#c8c6c4] bg-white text-[#605e5c] hover:bg-[#f3f2f1] active:cursor-grabbing ${
          disabled ? "cursor-not-allowed opacity-40" : ""
        }`}
        disabled={disabled}
        onClick={(e) => e.stopPropagation()}
        {...listeners}
        {...attributes}
      >
        <GripVertical className="h-3.5 w-3.5" aria-hidden />
      </button>
      <AgendaTicketCard ticket={ticket} compact={compact} />
    </div>
  );
}
