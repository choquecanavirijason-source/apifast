import type { DragEvent } from "react";

import type { ProfessionalForSelect, TicketItem } from "../../../../core/services/agenda/agenda.service";

type PendingTicketsPanelProps = {
  isOpen: boolean;
  isLoading: boolean;
  pendingTickets: TicketItem[];
  selectedDate: string;
  ticketSearch: string;
  ticketStatusFilter: string;
  ticketStatusOptions: string[];
  draggingTicketId: number | null;
  isUpdatingTicketId: number | null;
  professionals: ProfessionalForSelect[];
  onTicketSearchChange: (value: string) => void;
  onTicketStatusFilterChange: (value: string) => void;
  onDragStartTicket: (event: DragEvent<HTMLElement>, ticketId: number) => void;
  onDragEndTicket: () => void;
  onUpdateTicket: (ticketId: number, payload: { date?: string; time?: string; professional_id?: number | null; status?: string }) => Promise<void>;
  parseTicketDate: (value: string) => Date;
  toIsoDate: (value: Date) => string;
  toTimeValue: (hour: number, minute: number) => string;
  getTicketStatusCardClass: (status?: string | null) => string;
  getTicketStatusTextClass: (status?: string | null) => string;
  getTicketServiceSummary: (ticket: TicketItem) => string;
  getTicketPriceLabel: (ticket: TicketItem) => string;
};

export default function PendingTicketsPanel({
  isOpen,
  isLoading,
  pendingTickets,
  selectedDate,
  ticketSearch,
  ticketStatusFilter,
  ticketStatusOptions,
  draggingTicketId,
  isUpdatingTicketId,
  professionals,
  onTicketSearchChange,
  onTicketStatusFilterChange,
  onDragStartTicket,
  onDragEndTicket,
  onUpdateTicket,
  parseTicketDate,
  toIsoDate,
  toTimeValue,
  getTicketStatusCardClass,
  getTicketStatusTextClass,
  getTicketServiceSummary,
  getTicketPriceLabel,
}: PendingTicketsPanelProps) {
  return (
    <aside
      className={`min-h-0 overflow-y-auto rounded-sm border border-[#edebe9] bg-[#faf9f8] p-3 transition-all duration-200 ${
        isOpen ? "translate-x-0 opacity-100" : "-translate-x-4 opacity-0 pointer-events-none p-0 border-transparent"
      }`}
    >
      <div className="mb-3 grid gap-2">
        <input
          type="text"
          value={ticketSearch}
          onChange={(event) => onTicketSearchChange(event.target.value)}
          placeholder="Buscar ticket, cliente, servicio..."
          className="h-9 rounded-sm border border-[#8a8886] bg-white px-2 text-xs text-[#323130] outline-none focus:border-[#0078d4]"
        />
        <select
          value={ticketStatusFilter}
          onChange={(event) => onTicketStatusFilterChange(event.target.value)}
          className="h-9 rounded-sm border border-[#8a8886] bg-white px-2 text-xs text-[#323130] outline-none focus:border-[#0078d4]"
        >
          <option value="all">Todos los estados</option>
          {ticketStatusOptions.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
      </div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#605e5c]">Tickets pendientes y en servicio</p>
      <div className="space-y-2">
        {isLoading ? <p className="text-xs text-[#605e5c]">Cargando tickets...</p> : null}
        {pendingTickets.map((ticket) => {
          const start = parseTicketDate(ticket.start_time);
          const dateValue = Number.isNaN(start.getTime()) ? selectedDate : toIsoDate(start);
          const timeValue = Number.isNaN(start.getTime()) ? "09:00" : toTimeValue(start.getHours(), start.getMinutes());
          return (
            <article
              key={`pending-${ticket.id}`}
              draggable={isUpdatingTicketId !== ticket.id}
              onDragStart={(event) => onDragStartTicket(event, ticket.id)}
              onDragEnd={onDragEndTicket}
              className={`rounded-sm border p-2.5 shadow-sm ${getTicketStatusCardClass(ticket.status)} ${
                draggingTicketId === ticket.id ? "ring-1 ring-[#0078d4]/40" : ""
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <p className={`text-xs font-bold ${getTicketStatusTextClass(ticket.status)}`}>{ticket.ticket_code ?? `#${ticket.id}`}</p>
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold capitalize ${getTicketStatusTextClass(ticket.status)} bg-white/80`}
                >
                  {ticket.status}
                </span>
              </div>
              <p className="mt-1 text-sm font-semibold text-[#323130]">{ticket.client_name}</p>
              <p className="truncate text-[11px] text-[#605e5c]">{getTicketServiceSummary(ticket)}</p>
              <div className="mt-1 flex items-center justify-between gap-2 text-[10px] text-[#605e5c]">
                <span className="truncate">{ticket.branch_name ?? "Sin sucursal"}</span>
                <span className="font-semibold text-[#323130]">{getTicketPriceLabel(ticket)}</span>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-1.5">
                <input
                  type="date"
                  value={dateValue}
                  onChange={(event) => void onUpdateTicket(ticket.id, { date: event.target.value })}
                  className="h-7 rounded-sm border border-[#8a8886] bg-white px-1.5 text-[11px]"
                />
                <input
                  type="time"
                  value={timeValue}
                  onChange={(event) => void onUpdateTicket(ticket.id, { time: event.target.value })}
                  className="h-7 rounded-sm border border-[#8a8886] bg-white px-1.5 text-[11px]"
                />
              </div>
              <div className="mt-1.5 grid grid-cols-2 gap-1.5">
                <select
                  value={ticket.professional_id ?? ""}
                  onChange={(event) =>
                    void onUpdateTicket(ticket.id, {
                      professional_id: event.target.value ? Number(event.target.value) : null,
                    })
                  }
                  className="h-7 rounded-sm border border-[#8a8886] bg-white px-1.5 text-[11px]"
                >
                  <option value="">Operaria…</option>
                  {professionals.map((professional) => (
                    <option key={professional.id} value={professional.id}>
                      {professional.username}
                    </option>
                  ))}
                </select>
                <select
                  value={ticket.status}
                  onChange={(event) => void onUpdateTicket(ticket.id, { status: event.target.value })}
                  className="h-7 rounded-sm border border-[#8a8886] bg-white px-1.5 text-[11px]"
                >
                  {ticketStatusOptions.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </div>
            </article>
          );
        })}
      </div>
    </aside>
  );
}

