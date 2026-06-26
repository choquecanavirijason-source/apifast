import type { TicketItem } from "../../../../core/services/agenda/agenda.service";

import { formatTime, STATUS_LABELS } from "../control.constants";



const STATUS_STRIP: Record<string, string> = {

  pending: "#D83B01",

  waiting: "#D83B01",

  confirmed: "#D83B01",

  in_service: "#094732",

  completed: "#107C10",

  cancelled: "#A4262C",

};



/** Vista ligera del ticket mientras se arrastra (DragOverlay). */

export default function TicketDragOverlay({ ticket }: { ticket: TicketItem }) {

  const services =

    ticket.service_names?.length ? ticket.service_names.join(", ") : ticket.service_name ?? "Sin servicio";

  const strip = STATUS_STRIP[ticket.status] ?? "#D2D0CE";



  return (

    <div

      className="w-[min(100vw-2rem,300px)] cursor-grabbing border border-[#c8c6c4] bg-white p-3 shadow-[0_8px_16px_rgba(0,0,0,0.14)]"

      style={{ borderLeftWidth: 4, borderLeftColor: strip }}

    >

      <p className="truncate text-sm font-semibold text-[#201f1e]">{ticket.client_name}</p>

      <p className="mt-0.5 truncate text-xs text-[#605e5c]">{services}</p>

      <div className="mt-2 flex items-center justify-between gap-2 border-t border-[#edebe9] pt-2">

        <span className="text-xs font-semibold text-[#323130]">

          {formatTime(ticket.start_time)} – {formatTime(ticket.end_time)}

        </span>

        <span className="border border-[#94c4a9] bg-[#f0f7f4] px-1.5 py-0.5 text-[10px] font-bold uppercase text-[#094732]">

          {STATUS_LABELS[ticket.status] ?? ticket.status}

        </span>

      </div>

      {ticket.ticket_code ? (

        <p className="mt-1 font-mono text-[10px] text-[#8a8886]">{ticket.ticket_code}</p>

      ) : null}

    </div>

  );

}

