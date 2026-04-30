import { ChevronLeft, ChevronRight } from "lucide-react";

type CalendarControlsBarProps = {
  jumpSearch: string;
  ticketSearchSuggestions: string[];
  isPendingDrawerOpen: boolean;
  slotMinutes: 60 | 30 | 15;
  visibleStartHour: number;
  visibleEndHour: number;
  onJumpSearchChange: (value: string) => void;
  onClearJumpSearch: () => void;
  onTogglePendingDrawer: () => void;
  onGoPrevWeek: () => void;
  onGoNextWeek: () => void;
  onSlotMinutesChange: (value: 60 | 30 | 15) => void;
  onVisibleStartHourChange: (value: number) => void;
  onVisibleEndHourChange: (value: number) => void;
};

export default function CalendarControlsBar({
  jumpSearch,
  ticketSearchSuggestions,
  isPendingDrawerOpen,
  slotMinutes,
  visibleStartHour,
  visibleEndHour,
  onJumpSearchChange,
  onClearJumpSearch,
  onTogglePendingDrawer,
  onGoPrevWeek,
  onGoNextWeek,
  onSlotMinutesChange,
  onVisibleStartHourChange,
  onVisibleEndHourChange,
}: CalendarControlsBarProps) {
  return (
    <div className="flex items-center justify-between gap-2 border-b border-[#edebe9] bg-[#faf9f8] px-3 py-2">
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1 rounded-sm border border-[#edebe9] bg-white px-1.5 py-1">
          <input
            type="text"
            list="calendar-ticket-search-suggestions"
            value={jumpSearch}
            onChange={(event) => onJumpSearchChange(event.target.value)}
            placeholder="Ir a ticket o cliente..."
            className="h-6 w-[220px] border-0 bg-transparent px-1 text-xs text-[#323130] outline-none placeholder:text-[#8a8886]"
          />
          {jumpSearch ? (
            <button type="button" onClick={onClearJumpSearch} className="h-6 rounded-sm px-1.5 text-[11px] text-[#605e5c] hover:bg-[#f3f2f1]">
              Limpiar todo
            </button>
          ) : null}
          <datalist id="calendar-ticket-search-suggestions">
            {ticketSearchSuggestions.map((value) => (
              <option key={value} value={value} />
            ))}
          </datalist>
        </div>
        <button type="button" onClick={onTogglePendingDrawer} className="h-8 rounded-sm border border-[#edebe9] bg-white px-2 text-xs">
          <span className="inline-flex items-center gap-1">
            {isPendingDrawerOpen ? <ChevronLeft className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
            {isPendingDrawerOpen ? "Ocultar tickets" : "Mostrar tickets"}
          </span>
        </button>
        <button type="button" onClick={onGoPrevWeek} className="h-8 rounded-sm border border-[#edebe9] bg-white px-2 text-xs">
          Semana anterior
        </button>
        <button type="button" onClick={onGoNextWeek} className="h-8 rounded-sm border border-[#edebe9] bg-white px-2 text-xs">
          Semana siguiente
        </button>
      </div>
      <div className="flex items-center gap-2">
        <label className="text-[11px] text-[#605e5c]">
          Intervalo
          <select
            value={slotMinutes}
            onChange={(event) => {
              const value = Number(event.target.value);
              onSlotMinutesChange(value === 15 || value === 30 ? value : 60);
            }}
            className="ml-1 h-7 rounded-sm border border-[#8a8886] px-1 text-xs"
          >
            <option value={60}>1 hora</option>
            <option value={30}>30 minutos</option>
            <option value={15}>15 minutos</option>
          </select>
        </label>
        <label className="text-[11px] text-[#605e5c]">
          Inicio
          <input
            type="number"
            min={0}
            max={23}
            value={visibleStartHour}
            onChange={(event) => onVisibleStartHourChange(Number(event.target.value) || 0)}
            className="ml-1 h-7 w-12 rounded-sm border border-[#8a8886] px-1 text-xs"
          />
        </label>
        <label className="text-[11px] text-[#605e5c]">
          Fin
          <input
            type="number"
            min={0}
            max={23}
            value={visibleEndHour}
            onChange={(event) => onVisibleEndHourChange(Number(event.target.value) || 23)}
            className="ml-1 h-7 w-12 rounded-sm border border-[#8a8886] px-1 text-xs"
          />
        </label>
      </div>
    </div>
  );
}

