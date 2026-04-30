import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button, SectionCard } from "../../../../components/common/ui";
import { formatDayKey, formatTime, getLocalDateInputValue } from "../calendar.utils";
import type { TicketItem } from "../../../../core/services/agenda/agenda.service";

export type MonthCalendarProps = {
  currentMonth: Date;
  calendarDays: Date[];
  monthDaySlotCounts: Record<string, { free: number; busy: number; cancel: number }>;
  selectedDate: string;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onOpenAgendaModalForDate: (dateKey: string) => void;
  ticketsByDay: Record<string, TicketItem[]>;
  draggingTicketId?: number | null;
  onDropTicket?: (ticketId: number, dateKey: string) => void;
};

export default function MonthCalendar({
  currentMonth,
  calendarDays,
  monthDaySlotCounts,
  selectedDate,
  onPrevMonth,
  onNextMonth,
  onOpenAgendaModalForDate,
  ticketsByDay,
  draggingTicketId = null,
  onDropTicket,
}: MonthCalendarProps) {
  const todayKey = getLocalDateInputValue();

  return (
    <SectionCard className="border border-[#d2d0ce] bg-[#faf9f8]">
      <div className="flex items-center justify-between gap-3">
        <Button type="button" variant="secondary" size="sm" onClick={onPrevMonth}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <h3 className="text-lg font-semibold capitalize text-[#323130]">
          {currentMonth.toLocaleDateString("es-BO", { month: "long", year: "numeric" })}
        </h3>
        <Button type="button" variant="secondary" size="sm" onClick={onNextMonth}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      <div className="mt-4 grid grid-cols-7 gap-2 text-center text-xs font-semibold uppercase tracking-wide text-[#605e5c]">
        {["Lun", "Mar", "Mie", "Jue", "Vie", "Sab", "Dom"].map((label) => (
          <div key={label}>{label}</div>
        ))}
      </div>

      <div className="mt-3 grid grid-cols-7 gap-2">
        {calendarDays.map((date) => {
          const key = formatDayKey(date);
          const counts = monthDaySlotCounts[key] ?? { free: 0, busy: 0, cancel: 0 };
          const totalBlocks = counts.free + counts.busy + counts.cancel;
          const busyRatio = totalBlocks > 0 ? counts.busy / totalBlocks : 0;
          const isCurrentMonth = date.getMonth() === currentMonth.getMonth();
          const isSelected = key === selectedDate;
          const isToday = key === todayKey;

          const heat =
            counts.busy === 0 && counts.cancel === 0
              ? "from-[#f3f2f1] to-white"
              : busyRatio < 0.25
                ? "from-[#e6f2e6] to-white"
                : busyRatio < 0.5
                  ? "from-[#fff4ce] to-white"
                  : "from-rose-50/80 to-white";

          return (
            <button
              key={key}
              type="button"
              onClick={() => onOpenAgendaModalForDate(key)}
              onDragOver={(event) => {
                if (!draggingTicketId) return;
                event.preventDefault();
              }}
              onDrop={(event) => {
                event.preventDefault();
                if (!onDropTicket) return;
                const raw = event.dataTransfer.getData("text/plain");
                const droppedId = Number(raw || draggingTicketId);
                if (!Number.isFinite(droppedId)) return;
                onDropTicket(droppedId, key);
              }}
              className={`min-h-[104px] rounded-2xl border p-2 text-left transition bg-gradient-to-br ${heat} ${
                isSelected ? "border-[#0078d4] ring-2 ring-[#0078d4]/25 shadow-sm" : "border-[#d2d0ce] hover:border-[#8a8886]"
              } ${isCurrentMonth ? "text-[#323130]" : "text-[#a19f9d] opacity-80"} ${
                draggingTicketId ? "cursor-copy hover:ring-2 hover:ring-[#0078d4]/35" : ""
              }`}
            >
              <div className="flex items-center justify-between gap-1">
                <span
                  className={`flex h-7 w-7 items-center justify-center rounded-lg text-sm font-bold ${
                    isToday ? "bg-[#0078d4] text-white" : ""
                  }`}
                >
                  {date.getDate()}
                </span>
              </div>

              <div className="mt-2 flex flex-wrap gap-0.5">
                <span className="rounded-sm bg-[#dff6dd] px-1 py-0.5 text-[9px] font-bold text-[#0f6c2f]">L {counts.free}</span>
                <span className="rounded-sm bg-[#fde7e9] px-1 py-0.5 text-[9px] font-bold text-[#a4262c]">O {counts.busy}</span>
                {counts.cancel > 0 ? (
                  <span className="rounded-sm bg-[#fff4ce] px-1 py-0.5 text-[9px] font-bold text-[#8a6d00]">C {counts.cancel}</span>
                ) : null}
              </div>

              <div
                className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-[#edebe9]"
                title={`Libres ${counts.free} · Ocupados ${counts.busy}`}
              >
                <div className="h-full rounded-full bg-[#d13438] transition-all" style={{ width: `${Math.round(busyRatio * 100)}%` }} />
              </div>

              <div className="mt-2 space-y-1">
                {(ticketsByDay[key] ?? []).slice(0, 2).map((ticket) => (
                  <div
                    key={ticket.id}
                    className={`rounded-lg px-1.5 py-0.5 text-[9px] leading-tight ${
                      ticket.status === "cancelled" ? "bg-[#fff4ce] text-[#8a6d00]" : "bg-[#f3f2f1] text-[#323130]"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <p className="font-bold">{formatTime(ticket.start_time)}</p>
                      <span
                        className={`rounded-sm px-1 py-[1px] text-[8px] font-bold ${
                          ticket.status === "cancelled"
                            ? "bg-amber-200 text-amber-900"
                            : ticket.status === "in_service"
                              ? "bg-emerald-200 text-emerald-900"
                              : "bg-slate-200 text-slate-700"
                        }`}
                      >
                        {ticket.status}
                      </span>
                    </div>
                    <p className="truncate font-semibold">{ticket.client_name}</p>
                    <p className="truncate text-[8px] text-[#605e5c]">
                      {ticket.service_names?.length ? ticket.service_names.join(" · ") : ticket.service_name ?? "Sin servicio"}
                    </p>
                  </div>
                ))}
                {(ticketsByDay[key]?.length ?? 0) > 2 ? (
                  <p className="px-0.5 text-[9px] font-semibold text-[#605e5c]">+{(ticketsByDay[key]?.length ?? 0) - 2} citas</p>
                ) : null}
              </div>
            </button>
          );
        })}
      </div>
    </SectionCard>
  );
}
