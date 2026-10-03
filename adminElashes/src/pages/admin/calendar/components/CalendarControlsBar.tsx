import { Search, X } from "lucide-react";

type CalendarControlsBarProps = {
  jumpSearch: string;
  ticketSearchSuggestions: string[];
  slotMinutes: 60 | 30 | 15;
  visibleStartHour: number;
  visibleEndHour: number;
  onJumpSearchChange: (value: string) => void;
  onClearJumpSearch: () => void;
  onGoPrevWeek: () => void;
  onGoNextWeek: () => void;
  onSlotMinutesChange: (value: 60 | 30 | 15) => void;
  onVisibleStartHourChange: (value: number) => void;
  onVisibleEndHourChange: (value: number) => void;
};

export default function CalendarControlsBar({
  jumpSearch,
  ticketSearchSuggestions,
  slotMinutes,
  visibleStartHour,
  visibleEndHour,
  onJumpSearchChange,
  onClearJumpSearch,
  onGoPrevWeek,
  onGoNextWeek,
  onSlotMinutesChange,
  onVisibleStartHourChange,
  onVisibleEndHourChange,
}: CalendarControlsBarProps) {
  return (
    <div className="flex items-center justify-between gap-2 border-b border-[var(--ui-border)] bg-[var(--ui-surface-muted)] px-3 py-2">
      <div className="flex items-center gap-2">
        <div className={`flex items-center gap-1 rounded-md border bg-white px-2 py-1 shadow-sm transition-colors ${jumpSearch ? "border-[var(--ui-accent)] ring-1 ring-brand-secondary/30" : "border-[var(--ui-border-strong)] hover:border-brand-secondary"}`}>
          <Search className="h-3.5 w-3.5 shrink-0 text-[var(--ui-text-muted)]" />
          <input
            type="text"
            list="calendar-ticket-search-suggestions"
            value={jumpSearch}
            onChange={(event) => onJumpSearchChange(event.target.value)}
            placeholder="Buscar ticket o cliente..."
            className="h-6 w-[240px] border-0 bg-transparent px-1 text-xs text-[var(--ui-text)] outline-none placeholder:text-[var(--ui-text-muted)]"
          />
          {jumpSearch ? (
            <button type="button" onClick={onClearJumpSearch} className="flex h-5 w-5 items-center justify-center rounded-full text-[var(--ui-text-muted)] hover:bg-[var(--ui-surface-hover)]">
              <X className="h-3 w-3" />
            </button>
          ) : null}
          <datalist id="calendar-ticket-search-suggestions">
            {ticketSearchSuggestions.map((value) => (
              <option key={value} value={value} />
            ))}
          </datalist>
        </div>
        <button type="button" onClick={onGoPrevWeek} className="h-8 rounded-lg border border-[var(--ui-border)] bg-white px-2 text-xs">
          Semana anterior
        </button>
        <button type="button" onClick={onGoNextWeek} className="h-8 rounded-lg border border-[var(--ui-border)] bg-white px-2 text-xs">
          Semana siguiente
        </button>
      </div>
      <div className="flex items-center gap-2">
        <label className="text-[11px] text-[var(--ui-text-muted)]">
          Intervalo
          <select
            value={slotMinutes}
            onChange={(event) => {
              const value = Number(event.target.value);
              onSlotMinutesChange(value === 15 || value === 30 ? value : 60);
            }}
            className="ml-1 h-7 rounded-lg border border-[var(--ui-border-strong)] px-1 text-xs"
          >
            <option value={60}>1 hora</option>
            <option value={30}>30 minutos</option>
            <option value={15}>15 minutos</option>
          </select>
        </label>
        <label className="text-[11px] text-[var(--ui-text-muted)]">
          Inicio
          <input
            type="number"
            min={0}
            max={23}
            value={visibleStartHour}
            onChange={(event) => onVisibleStartHourChange(Number(event.target.value) || 0)}
            className="ml-1 h-7 w-12 rounded-lg border border-[var(--ui-border-strong)] px-1 text-xs"
          />
        </label>
        <label className="text-[11px] text-[var(--ui-text-muted)]">
          Fin
          <input
            type="number"
            min={0}
            max={23}
            value={visibleEndHour}
            onChange={(event) => onVisibleEndHourChange(Number(event.target.value) || 23)}
            className="ml-1 h-7 w-12 rounded-lg border border-[var(--ui-border-strong)] px-1 text-xs"
          />
        </label>
      </div>
    </div>
  );
}

