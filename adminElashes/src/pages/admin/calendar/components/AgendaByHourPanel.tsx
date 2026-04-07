import type { Dispatch, SetStateAction } from "react";

import { Ticket } from "lucide-react";

import { SectionCard } from "../../../../components/common/ui";
import { STATUS_LABELS } from "../calendar.constants";
import {
  BUSINESS_END_HOUR,
  BUSINESS_START_HOUR,
  SLOT_INTERVAL_MINUTES,
  formatSelectedDateLong,
  formatTime,
  type SlotRow,
} from "../calendar.utils";
import type { TicketItem } from "../../../../core/services/agenda/agenda.service";

export type AgendaByHourPanelProps = {
  selectedDate: string;
  showDatePicker: boolean;
  onDateChange: (isoDate: string) => void;
  onMonthSync: (isoDate: string) => void;
  agendaStatusFilter: "all" | "available" | "occupied" | "cancelled";
  setAgendaStatusFilter: Dispatch<SetStateAction<"all" | "available" | "occupied" | "cancelled">>;
  availableSlots: number;
  occupiedSlots: number;
  cancelledSlots: number;
  isLoading: boolean;
  filteredAgendaSchedule: SlotRow[];
  variant: "inline" | "modal";
};

function getTicketSummary(ticket: TicketItem) {
  return {
    code: ticket.ticket_code ?? `#${ticket.id}`,
    clientName: ticket.client_name,
    services:
      ticket.service_names?.length ? ticket.service_names.join(" · ") : ticket.service_name ?? "Sin servicio",
    time: `${formatTime(ticket.start_time)} – ${formatTime(ticket.end_time)}`,
    status: STATUS_LABELS[ticket.status] ?? ticket.status,
  };
}

export default function AgendaByHourPanel({
  selectedDate,
  showDatePicker,
  onDateChange,
  onMonthSync,
  agendaStatusFilter,
  setAgendaStatusFilter,
  availableSlots,
  occupiedSlots,
  cancelledSlots,
  isLoading,
  filteredAgendaSchedule,
  variant,
}: AgendaByHourPanelProps) {
  const isModal = variant === "modal";
  const Wrapper = isModal ? "div" : SectionCard;
  const wrapperClass = isModal
    ? "rounded-2xl border border-slate-200/80 bg-gradient-to-b from-white to-slate-50/90 p-5 shadow-inner sm:p-7"
    : "";

  return (
    <Wrapper className={wrapperClass}>
      <div
        className={
          isModal
            ? "flex flex-col gap-4 border-b border-slate-200/80 pb-5 sm:flex-row sm:items-end sm:justify-between"
            : "flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
        }
      >
        <div>
          <h3
            className={
              isModal ? "text-2xl font-black tracking-tight text-slate-900" : "text-lg font-bold text-slate-800"
            }
          >
            Agenda por horas
          </h3>
          <p className={isModal ? "mt-1 text-base text-slate-600" : "text-sm text-slate-500"}>
            {isModal
              ? `Bloques de ${SLOT_INTERVAL_MINUTES} min · ${BUSINESS_START_HOUR}:00–${BUSINESS_END_HOUR}:00`
              : `${formatSelectedDateLong(selectedDate)} · Bloques de ${SLOT_INTERVAL_MINUTES} min · ${BUSINESS_START_HOUR}:00–${BUSINESS_END_HOUR}:00`}
          </p>
        </div>
        {showDatePicker ? (
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => {
              const v = e.target.value;
              onDateChange(v);
              onMonthSync(v);
            }}
            className={
              isModal
                ? "rounded-xl border-2 border-slate-200 bg-white px-4 py-2.5 text-base font-semibold text-slate-800 outline-none focus:border-[#094732] focus:ring-4 focus:ring-[#094732]/15"
                : "rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#094732] focus:ring-2 focus:ring-[#094732]/20"
            }
          />
        ) : null}
      </div>

      <div className={isModal ? "mt-5 flex flex-wrap items-center gap-3" : "mt-4 flex flex-wrap items-center gap-3"}>
        <div className="flex items-center gap-2">
          <label className={isModal ? "text-sm font-bold text-slate-600" : "text-xs font-semibold text-slate-500"}>
            Mostrar
          </label>
          <select
            value={agendaStatusFilter}
            onChange={(e) => setAgendaStatusFilter(e.target.value as typeof agendaStatusFilter)}
            className={
              isModal
                ? "rounded-xl border-2 border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 outline-none focus:border-[#094732] focus:ring-4 focus:ring-[#094732]/15"
                : "rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-700 outline-none focus:border-[#094732] focus:ring-2 focus:ring-[#094732]/20"
            }
          >
            <option value="all">Todo el día (línea de tiempo)</option>
            <option value="available">Solo libres</option>
            <option value="occupied">Solo ocupadas</option>
            <option value="cancelled">Solo canceladas</option>
          </select>
        </div>
      </div>

      <div className={isModal ? "mt-5 grid gap-3 sm:grid-cols-3" : "mt-4 grid gap-2.5 sm:grid-cols-3"}>
        <div
          className={
            isModal
              ? "rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white p-4"
              : "rounded-2xl border border-emerald-200 bg-emerald-50/60 p-3"
          }
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p
                className={
                  isModal
                    ? "text-xs font-extrabold uppercase tracking-wide text-emerald-800"
                    : "text-[11px] font-extrabold uppercase tracking-wide text-emerald-700"
                }
              >
                Libres
              </p>
              <p
                className={
                  isModal
                    ? "mt-1 text-xs font-semibold text-emerald-900/75"
                    : "mt-0.5 text-[10px] font-semibold text-emerald-800/75"
                }
              >
                sin cita activa
              </p>
            </div>
            <p
              className={
                isModal
                  ? "text-3xl font-black leading-none text-emerald-950"
                  : "text-xl font-black leading-none text-emerald-900"
              }
            >
              {availableSlots}
            </p>
          </div>
        </div>
        <div
          className={
            isModal
              ? "rounded-2xl border border-rose-200 bg-gradient-to-br from-rose-50 to-white p-4"
              : "rounded-2xl border border-rose-200 bg-rose-50/60 p-3"
          }
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p
                className={
                  isModal
                    ? "text-xs font-extrabold uppercase tracking-wide text-rose-800"
                    : "text-[11px] font-extrabold uppercase tracking-wide text-rose-700"
                }
              >
                Ocupadas
              </p>
              <p
                className={
                  isModal
                    ? "mt-1 text-xs font-semibold text-rose-900/75"
                    : "mt-0.5 text-[10px] font-semibold text-rose-800/75"
                }
              >
                en curso o confirmada
              </p>
            </div>
            <p
              className={
                isModal
                  ? "text-3xl font-black leading-none text-rose-950"
                  : "text-xl font-black leading-none text-rose-900"
              }
            >
              {occupiedSlots}
            </p>
          </div>
        </div>
        <div
          className={
            isModal
              ? "rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 to-white p-4"
              : "rounded-2xl border border-amber-200 bg-amber-50/60 p-3"
          }
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p
                className={
                  isModal
                    ? "text-xs font-extrabold uppercase tracking-wide text-amber-900"
                    : "text-[11px] font-extrabold uppercase tracking-wide text-amber-800"
                }
              >
                Canceladas
              </p>
              <p
                className={
                  isModal
                    ? "mt-1 text-xs font-semibold text-amber-950/70"
                    : "mt-0.5 text-[10px] font-semibold text-amber-900/70"
                }
              >
                cancelación en el bloque
              </p>
            </div>
            <p
              className={
                isModal
                  ? "text-3xl font-black leading-none text-amber-950"
                  : "text-xl font-black leading-none text-amber-900"
              }
            >
              {cancelledSlots}
            </p>
          </div>
        </div>
      </div>

      <div className={isModal ? "mt-8" : "mt-4"}>
        {isLoading ? (
          <p className={isModal ? "py-16 text-center text-lg text-slate-500" : "py-10 text-center text-slate-500"}>
            Cargando agenda...
          </p>
        ) : (
          <div
            className={
              isModal
                ? "overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
                : "overflow-hidden rounded-2xl border border-slate-200 bg-white"
            }
          >
            <div className={isModal ? "divide-y divide-slate-200" : "divide-y divide-slate-100"}>
              {filteredAgendaSchedule.map((slot) => {
                const firstTicket = slot.tickets[0];
                const summary = firstTicket ? getTicketSummary(firstTicket) : null;

                const rowHeight = isModal ? "min-h-[62px]" : "min-h-[54px]";
                const timeCol = isModal
                  ? "w-[4.75rem] sm:w-[5.25rem]"
                  : "w-[4.25rem] sm:w-[4.75rem]";

                const accentBg =
                  slot.status === "occupied" ? "bg-rose-500" : slot.status === "cancelled" ? "bg-amber-500" : "bg-emerald-500";

                const subtleRowBg =
                  slot.status === "available"
                    ? "bg-white"
                    : slot.status === "cancelled"
                      ? "bg-amber-50/20"
                      : "bg-rose-50/10";

                return (
                  <div key={slot.key} className={`grid grid-cols-[auto,1fr] ${rowHeight} ${subtleRowBg}`}>
                    <div
                      className={`shrink-0 ${timeCol} border-r border-slate-200 px-3 py-2 text-right sm:px-4`}
                    >
                      <p className={isModal ? "text-base font-black tabular-nums text-slate-900" : "text-sm font-black tabular-nums text-slate-900"}>
                        {slot.label}
                      </p>
                      <p className={isModal ? "text-xs font-semibold text-slate-400" : "text-[10px] font-semibold text-slate-400"}>
                        {SLOT_INTERVAL_MINUTES} min
                      </p>
                    </div>

                    <div className={isModal ? "relative px-3 py-2 sm:px-4" : "relative px-3 py-2"}>
                      <div className="absolute inset-x-0 top-0 h-px bg-slate-100" aria-hidden />

                      {summary ? (
                        <div
                          className={`flex min-w-0 items-start justify-between gap-3 rounded-xl border border-slate-200 bg-white/95 p-3 shadow-sm sm:p-3.5 ${
                            slot.status === "occupied" ? "ring-1 ring-rose-100" : slot.status === "cancelled" ? "ring-1 ring-amber-100" : ""
                          }`}
                        >
                          <div className={`w-1.5 shrink-0 self-stretch rounded-full ${accentBg}`} aria-hidden />
                          <div className="min-w-0 flex-1">
                            <p className="inline-flex items-center gap-2 font-mono text-xs font-bold text-[#094732] sm:text-sm">
                              <Ticket className={isModal ? "h-4 w-4" : "h-4 w-4"} />
                              {summary.code}
                            </p>
                            <p className={isModal ? "mt-1 text-sm font-semibold text-slate-900" : "mt-1 text-sm font-semibold text-slate-900"}>
                              {summary.clientName}
                            </p>
                            <p className={isModal ? "text-sm text-slate-600" : "text-sm text-slate-600"}>{summary.services}</p>
                            <div className="mt-1 flex flex-wrap items-center gap-2">
                              <span className={isModal ? "text-xs font-semibold text-slate-500" : "text-xs font-semibold text-slate-500"}>
                                {summary.time}
                              </span>
                              <span
                                className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                                  slot.status === "occupied"
                                    ? "bg-rose-100 text-rose-900"
                                    : slot.status === "cancelled"
                                      ? "bg-amber-100 text-amber-900"
                                      : "bg-emerald-100 text-emerald-900"
                                }`}
                              >
                                {summary.status}
                              </span>
                              {slot.tickets.length > 1 ? (
                                <span className="text-xs font-semibold text-slate-500">+{slot.tickets.length - 1} más</span>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="flex h-full items-center justify-between">
                          <span className={isModal ? "text-sm font-semibold text-slate-400" : "text-sm font-semibold text-slate-400"}>
                            Libre
                          </span>
                          <span className={isModal ? "text-xs font-semibold text-slate-300" : "text-xs font-semibold text-slate-300"}>
                            —
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </Wrapper>
  );
}
