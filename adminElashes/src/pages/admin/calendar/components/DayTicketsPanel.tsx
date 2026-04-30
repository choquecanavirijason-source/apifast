import { Clock, Ticket } from "lucide-react";

import { Button, SectionCard } from "../../../../components/common/ui";
import { STATUS_LABELS } from "../calendar.constants";
import { formatTime } from "../calendar.utils";
import type { TicketItem } from "../../../../core/services/agenda/agenda.service";

export type DayTicketsPanelProps = {
  selectedDate: string;
  isLoading: boolean;
  selectedDayTickets: TicketItem[];
  onSelectedDateChange: (isoDate: string) => void;
  onOpenAgendaModal: () => void;
  onOpenQuickSale: () => void;
  searchStartDate: string;
  searchEndDate: string;
  onSearchStartDateChange: (isoDate: string) => void;
  onSearchEndDateChange: (isoDate: string) => void;
  onClearSearchRange: () => void;
  ticketSearch: string;
  onTicketSearchChange: (value: string) => void;
  ticketStatusFilter: string;
  onTicketStatusFilterChange: (value: string) => void;
  ticketStatusOptions: string[];
  draggableTickets?: TicketItem[];
  draggingTicketId?: number | null;
  isUpdatingTicketId?: number | null;
  onDragTicketStart?: (ticketId: number) => void;
  onDragTicketEnd?: () => void;
};

export default function DayTicketsPanel({
  selectedDate,
  isLoading,
  selectedDayTickets,
  onSelectedDateChange,
  onOpenAgendaModal,
  onOpenQuickSale,
  searchStartDate,
  searchEndDate,
  onSearchStartDateChange,
  onSearchEndDateChange,
  onClearSearchRange,
  ticketSearch,
  onTicketSearchChange,
  ticketStatusFilter,
  onTicketStatusFilterChange,
  ticketStatusOptions,
  draggableTickets = [],
  draggingTicketId = null,
  isUpdatingTicketId = null,
  onDragTicketStart,
  onDragTicketEnd,
}: DayTicketsPanelProps) {
  return (
    <SectionCard>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-lg font-bold text-slate-800">Citas del día</h3>
          <p className="text-sm text-slate-500">{selectedDate}</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => onSelectedDateChange(e.target.value)}
            className="rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#094732] focus:ring-2 focus:ring-[#094732]/20"
          />
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="inline-flex items-center gap-2 whitespace-nowrap"
            onClick={onOpenAgendaModal}
          >
            <Clock className="h-4 w-4" />
            Agenda por horas
          </Button>
          <Button type="button" size="sm" className="inline-flex items-center gap-2 whitespace-nowrap" onClick={onOpenQuickSale}>
            <Ticket className="h-4 w-4" />
            Asignar ticket
          </Button>
          <div className="flex flex-wrap items-center gap-1 sm:ml-2">
            <input
              type="date"
              value={searchStartDate}
              onChange={(e) => onSearchStartDateChange(e.target.value)}
              className="rounded-xl border border-slate-300 px-2 py-1 text-xs outline-none focus:border-[#094732] focus:ring-2 focus:ring-[#094732]/20"
            />
            <span className="text-xs text-slate-500">a</span>
            <input
              type="date"
              value={searchEndDate}
              onChange={(e) => onSearchEndDateChange(e.target.value)}
              className="rounded-xl border border-slate-300 px-2 py-1 text-xs outline-none focus:border-[#094732] focus:ring-2 focus:ring-[#094732]/20"
            />
            {(searchStartDate || searchEndDate) && (
              <Button type="button" size="sm" variant="ghost" onClick={onClearSearchRange}>
                Limpiar
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="mt-3 grid gap-2 rounded-xl border border-slate-200 bg-slate-50 p-2 sm:grid-cols-[1fr,auto] sm:items-center">
        <input
          type="text"
          value={ticketSearch}
          onChange={(e) => onTicketSearchChange(e.target.value)}
          placeholder="Buscar cliente, ticket o servicio..."
          className="rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#094732] focus:ring-2 focus:ring-[#094732]/20"
        />
        <select
          value={ticketStatusFilter}
          onChange={(e) => onTicketStatusFilterChange(e.target.value)}
          className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-[#094732] focus:ring-2 focus:ring-[#094732]/20"
        >
          <option value="all">Todos los estados</option>
          {ticketStatusOptions.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-4 space-y-3">
        <div className="rounded-2xl border border-[#edebe9] bg-[#faf9f8] p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#605e5c]">
            Tickets pendientes (sin hora / sin operaria)
          </p>
          <p className="mt-1 text-[11px] text-[#605e5c]">Arrastra un ticket al calendario para programarlo.</p>
          <div className="mt-3 max-h-[280px] space-y-2 overflow-y-auto pr-1">
            {draggableTickets.length === 0 ? (
              <p className="rounded-xl border border-dashed border-slate-300 px-3 py-4 text-center text-xs text-slate-500">
                No hay tickets pendientes con los filtros actuales.
              </p>
            ) : (
              draggableTickets.map((ticket) => (
                <article
                  key={`pending-${ticket.id}`}
                  draggable={isUpdatingTicketId !== ticket.id}
                  onDragStart={(event) => {
                    event.dataTransfer.setData("text/plain", String(ticket.id));
                    event.dataTransfer.effectAllowed = "move";
                    onDragTicketStart?.(ticket.id);
                  }}
                  onDragEnd={() => onDragTicketEnd?.()}
                  className={`cursor-grab rounded-xl border bg-white p-2.5 shadow-sm transition active:cursor-grabbing ${
                    draggingTicketId === ticket.id ? "border-[#0078d4] ring-1 ring-[#0078d4]/40" : "border-slate-200"
                  } ${isUpdatingTicketId === ticket.id ? "opacity-60" : ""}`}
                >
                  <p className="text-xs font-bold text-[#094732]">{ticket.ticket_code ?? `#${ticket.id}`}</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">{ticket.client_name}</p>
                  <p className="text-xs text-slate-600 truncate">
                    {ticket.service_names?.length ? ticket.service_names.join(" · ") : ticket.service_name ?? "Sin servicio"}
                  </p>
                  <p className="mt-1 text-[11px] text-slate-500">
                    {ticket.professional_name ? `Operaria: ${ticket.professional_name}` : "Sin operaria asignada"}
                  </p>
                </article>
              ))
            )}
          </div>
        </div>

        {isLoading ? (
          <p className="py-10 text-center text-slate-500">Cargando citas...</p>
        ) : selectedDayTickets.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-6 text-center text-slate-500">
            <p>Sin citas para este día.</p>
            <Button type="button" size="sm" onClick={onOpenQuickSale}>
              Crear y asignar ticket
            </Button>
          </div>
        ) : (
          selectedDayTickets.map((ticket) => (
            <div
              key={ticket.id}
              className={`rounded-2xl border p-3 ${
                ticket.status === "cancelled" ? "border-amber-200 bg-amber-50/50" : "border-slate-200 bg-white"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="inline-flex items-center gap-2 font-mono text-sm font-bold text-[#094732]">
                    <Ticket className="h-4 w-4" />
                    {ticket.ticket_code ?? `#${ticket.id}`}
                  </p>
                  <p className="mt-2 text-sm font-semibold text-slate-900">{ticket.client_name}</p>
                  <p className="text-sm text-slate-600">
                    {ticket.service_names?.length
                      ? ticket.service_names.join(" · ")
                      : ticket.service_name ?? "Sin servicio"}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-slate-800">
                    {formatTime(ticket.start_time)} – {formatTime(ticket.end_time)}
                  </p>
                  <span
                    className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold ${
                      ticket.status === "cancelled" ? "bg-amber-200 text-amber-900" : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {STATUS_LABELS[ticket.status] ?? ticket.status}
                  </span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </SectionCard>
  );
}
