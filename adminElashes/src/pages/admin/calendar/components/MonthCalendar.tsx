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
}: MonthCalendarProps) {
  const todayKey = getLocalDateInputValue();

  return (
    <SectionCard>
      <div className="flex items-center justify-between gap-3">
        <Button type="button" variant="secondary" size="sm" onClick={onPrevMonth}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <h3 className="text-lg font-bold capitalize text-slate-800">
          {currentMonth.toLocaleDateString("es-BO", { month: "long", year: "numeric" })}
        </h3>
        <Button type="button" variant="secondary" size="sm" onClick={onNextMonth}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      <div className="mt-4 grid grid-cols-7 gap-2 text-center text-xs font-bold uppercase tracking-wide text-slate-500">
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
              ? "from-slate-50 to-white"
              : busyRatio < 0.25
                ? "from-emerald-50/80 to-white"
                : busyRatio < 0.5
                  ? "from-amber-50/70 to-white"
                  : "from-rose-50/80 to-white";

          return (
            <button
              key={key}
              type="button"
              onClick={() => onOpenAgendaModalForDate(key)}
              className={`min-h-[104px] rounded-2xl border p-2 text-left transition bg-gradient-to-br ${heat} ${
                isSelected ? "border-emerald-500 ring-2 ring-emerald-200 shadow-sm" : "border-slate-200 hover:border-slate-300"
              } ${isCurrentMonth ? "text-slate-800" : "text-slate-400 opacity-80"}`}
            >
              <div className="flex items-center justify-between gap-1">
                <span
                  className={`flex h-7 w-7 items-center justify-center rounded-lg text-sm font-bold ${
                    isToday ? "bg-emerald-600 text-white" : ""
                  }`}
                >
                  {date.getDate()}
                </span>
              </div>

              <div className="mt-2 flex flex-wrap gap-0.5">
                <span className="rounded-md bg-emerald-100 px-1 py-0.5 text-[9px] font-bold text-emerald-800">L {counts.free}</span>
                <span className="rounded-md bg-rose-100 px-1 py-0.5 text-[9px] font-bold text-rose-800">O {counts.busy}</span>
                {counts.cancel > 0 ? (
                  <span className="rounded-md bg-amber-100 px-1 py-0.5 text-[9px] font-bold text-amber-900">C {counts.cancel}</span>
                ) : null}
              </div>

              <div
                className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-200"
                title={`Libres ${counts.free} · Ocupados ${counts.busy}`}
              >
                <div className="h-full rounded-full bg-rose-500 transition-all" style={{ width: `${Math.round(busyRatio * 100)}%` }} />
              </div>

              <div className="mt-2 space-y-1">
                {(ticketsByDay[key] ?? []).slice(0, 2).map((ticket) => (
                  <div
                    key={ticket.id}
                    className={`rounded-lg px-1.5 py-0.5 text-[9px] leading-tight ${
                      ticket.status === "cancelled" ? "bg-amber-100 text-amber-900" : "bg-slate-100 text-slate-700"
                    }`}
                  >
                    <p className="font-bold">{formatTime(ticket.start_time)}</p>
                    <p className="truncate">{ticket.client_name}</p>
                  </div>
                ))}
                {(ticketsByDay[key]?.length ?? 0) > 2 ? (
                  <p className="px-0.5 text-[9px] font-semibold text-slate-500">+{(ticketsByDay[key]?.length ?? 0) - 2} citas</p>
                ) : null}
              </div>
            </button>
          );
        })}
      </div>
    </SectionCard>
  );
}
