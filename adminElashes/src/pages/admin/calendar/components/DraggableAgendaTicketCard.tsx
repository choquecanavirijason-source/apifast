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
      title="Arrastra para cambiar hora o puesto"
      className={`max-w-[200px] touch-none ${disabled ? "cursor-not-allowed opacity-40" : "cursor-grab active:cursor-grabbing"} ${
        isDragging ? "opacity-50" : ""
      }`}
      {...listeners}
      {...attributes}
    >
      <AgendaTicketCard ticket={ticket} compact={compact} />
    </div>
  );
}
