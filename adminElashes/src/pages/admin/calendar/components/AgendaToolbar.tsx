import {
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  Columns3,
  List,
  Plus,
} from "lucide-react";
import FilterActionBar from "../../../../components/common/FilterActionBar";
import { Button } from "../../../../components/common/ui";
import type { AgendaViewMode } from "../dailyAgenda.constants";

type AgendaToolbarProps = {
  agendaView: AgendaViewMode;
  onViewChange: (mode: AgendaViewMode) => void;
  selectedDate: string;
  weekStrip: string[];
  monthLabel: string;
  dayNumber: string;
  onSelectDate: (iso: string) => void;
  onShiftDate: (delta: number) => void;
  onToday: () => void;
  onNewReservation: () => void;
};

export default function AgendaToolbar({
  agendaView,
  onViewChange,
  selectedDate,
  weekStrip,
  monthLabel,
  dayNumber,
  onSelectDate,
  onShiftDate,
  onToday,
  onNewReservation,
}: AgendaToolbarProps) {
  const viewBtnClass = (active: boolean) =>
    `inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-all ${
      active
        ? "bg-white text-[#094732] shadow-sm ring-1 ring-black/5"
        : "text-slate-500 hover:bg-slate-200/50 hover:text-slate-700"
    }`;

  return (
    <FilterActionBar
      left={
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-emerald-100 bg-emerald-50 text-[#094732]">
            <CalendarClock className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-800">Agenda del día</p>
            <p className="text-xs text-slate-500">
              Toca una casilla vacía para reservar. Cobro en POS desde cada ticket.
            </p>
          </div>
        </div>
      }
      right={
        <div className="flex w-full flex-col gap-3 sm:w-auto">
          <div className="flex w-fit rounded-xl border border-slate-200 bg-slate-100/80 p-1">
            <button type="button" onClick={() => onViewChange("planner")} className={viewBtnClass(agendaView === "planner")}>
              <List className="h-3.5 w-3.5" />
              Planilla
            </button>
            <button type="button" onClick={() => onViewChange("stations")} className={viewBtnClass(agendaView === "stations")}>
              <Columns3 className="h-3.5 w-3.5" />
              Puestos 1–8
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={onToday}>
              Hoy
            </Button>
            <div className="flex max-w-[min(100vw-2rem,480px)] gap-1 overflow-x-auto pb-0.5">
              {weekStrip.map((dayIso) => {
                const isSel = dayIso === selectedDate;
                const short = new Date(`${dayIso}T12:00:00`).toLocaleDateString("es-BO", { weekday: "short" });
                const num = new Date(`${dayIso}T12:00:00`).getDate();
                return (
                  <button
                    key={dayIso}
                    type="button"
                    onClick={() => onSelectDate(dayIso)}
                    className={`flex min-w-[44px] shrink-0 flex-col items-center rounded-lg border px-1.5 py-1 text-[10px] transition ${
                      isSel
                        ? "border-[#094732] bg-emerald-50 font-semibold text-[#094732]"
                        : "border-slate-200 bg-white text-slate-500 hover:border-slate-300"
                    }`}
                  >
                    <span className="uppercase leading-none">{short.replace(/\.$/, "")}</span>
                    <span className="text-sm font-bold tabular-nums leading-tight">{num}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-slate-500">
              {monthLabel} · día <strong className="text-slate-800">{dayNumber}</strong>
            </span>
            <Button type="button" variant="secondary" size="sm" className="!px-2" onClick={() => onShiftDate(-1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => onSelectDate(e.target.value)}
              className="h-9 rounded-xl border border-slate-200 px-2 text-sm text-slate-700 outline-none focus:border-[#094732]"
            />
            <Button type="button" variant="secondary" size="sm" className="!px-2" onClick={() => onShiftDate(1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button type="button" size="sm" leftIcon={<Plus className="h-4 w-4" />} onClick={onNewReservation}>
              Nueva reserva
            </Button>
          </div>
        </div>
      }
    />
  );
}
