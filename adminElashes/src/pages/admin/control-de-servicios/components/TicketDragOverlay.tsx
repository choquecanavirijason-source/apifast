import type { TicketItem } from "../../../../core/services/agenda/agenda.service";
import { formatTime, STATUS_LABELS } from "../control.constants";
import { ticketCardClass } from "../../calendar/dailyAgenda.utils";

/** Vista ligera del ticket mientras se arrastra (DragOverlay) — mismo estilo que los bloques de la Agenda. */
export default function TicketDragOverlay({ ticket }: { ticket: TicketItem }) {
  const services =
    ticket.service_names?.length ? ticket.service_names.join(", ") : ticket.service_name ?? "Sin servicio";

  return (
    <div
      className={`w-[min(100vw-2rem,300px)] cursor-grabbing rounded-lg border border-l-[3px] px-2.5 py-2 shadow-lg ring-2 ring-[#9F8351]/50 ${ticketCardClass(ticket.status)}`}
    >
      <div className="flex min-w-0 items-baseline justify-between gap-2">
        <p className="truncate text-[12px] font-semibold">{ticket.client_name}</p>
        <span className="shrink-0 text-[11px] tabular-nums opacity-75">
          {formatTime(ticket.start_time)} – {formatTime(ticket.end_time)}
        </span>
      </div>
      <div className="mt-0.5 flex items-center justify-between gap-2">
        <p className="truncate text-[11px] opacity-90">{services}</p>
        <span className="shrink-0 rounded-full bg-white/70 px-1.5 py-0.5 text-[10px] font-semibold">
          {STATUS_LABELS[ticket.status] ?? ticket.status}
        </span>
      </div>
    </div>
  );
}
