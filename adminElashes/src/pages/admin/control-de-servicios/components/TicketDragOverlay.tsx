import type { TicketItem } from "../../../../core/services/agenda/agenda.service";
import { formatTime, STATUS_LABELS } from "../control.constants";

const STATUS_STRIP: Record<string, string> = {
  pending:    "#f59e0b",
  waiting:    "#f59e0b",
  confirmed:  "#f59e0b",
  in_service: "#3b82f6",
  completed:  "#10b981",
  cancelled:  "#ef4444",
};

export default function TicketDragOverlay({ ticket }: { ticket: TicketItem }) {
  const services =
    ticket.service_names?.length ? ticket.service_names.join(", ") : ticket.service_name ?? "Sin servicio";
  const strip = STATUS_STRIP[ticket.status] ?? "#cbd5e1";

  return (
    <div
      className="w-[min(100vw-2rem,300px)] cursor-grabbing rounded-xl border border-slate-200 bg-white p-3 shadow-xl"
      style={{ borderLeftWidth: 3, borderLeftColor: strip }}
    >
      <p className="truncate text-sm font-semibold text-slate-900">{ticket.client_name}</p>
      <p className="mt-0.5 truncate text-xs text-slate-500">{services}</p>
      <div className="mt-2 flex items-center justify-between gap-2 border-t border-slate-100 pt-2">
        <span className="text-xs font-semibold text-slate-700">
          {formatTime(ticket.start_time)} – {formatTime(ticket.end_time)}
        </span>
        <span className="rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] font-bold uppercase text-blue-600">
          {STATUS_LABELS[ticket.status] ?? ticket.status}
        </span>
      </div>
      {ticket.ticket_code ? (
        <p className="mt-1 font-mono text-[10px] text-slate-400">{ticket.ticket_code}</p>
      ) : null}
    </div>
  );
}
