import { useMemo } from "react";
import type { TicketItem } from "../../../../core/services/agenda/agenda.service";
import { parseTicketDate, toIsoDate } from "../dailyAgenda.utils";
import { buildMonthGrid } from "./MonthAgendaView";

type YearAgendaViewProps = {
  tickets: TicketItem[];
  year: number;
  onSelectDay: (dateKey: string) => void;
  onSelectMonth: (dateKey: string) => void;
};

const WEEKDAY_INITIALS = ["L", "M", "M", "J", "V", "S", "D"];

/** 1 de enero a 31 de diciembre del año de `isoDate`. */
export function buildYearRange(isoDate: string): string[] {
  const year = Number(isoDate.slice(0, 4));
  const days: string[] = [];
  const d = new Date(year, 0, 1, 12);
  while (d.getFullYear() === year) {
    days.push(toIsoDate(d));
    d.setDate(d.getDate() + 1);
  }
  return days;
}

/** Vista Año: 12 meses pequeños; los días con reservas llevan un punto. Clic en un día abre la vista Día. */
export default function YearAgendaView({ tickets, year, onSelectDay, onSelectMonth }: YearAgendaViewProps) {
  const todayKey = toIsoDate(new Date());

  const countByDay = useMemo(() => {
    const map = new Map<string, number>();
    for (const ticket of tickets) {
      const start = parseTicketDate(ticket.start_time);
      if (Number.isNaN(start.getTime())) continue;
      const key = toIsoDate(start);
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return map;
  }, [tickets]);

  return (
    <div className="max-h-[min(72vh,900px)] overflow-auto p-3">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 12 }, (_, monthIndex) => {
          const firstKey = `${year}-${String(monthIndex + 1).padStart(2, "0")}-01`;
          const monthKey = firstKey.slice(0, 7);
          const name = new Date(year, monthIndex, 1).toLocaleDateString("es-BO", { month: "long" });
          return (
            <div key={monthKey} className="rounded-lg border border-[var(--ui-border)] bg-[var(--ui-surface)] p-2">
              <button
                type="button"
                onClick={() => onSelectMonth(firstKey)}
                title="Ver este mes"
                className="mb-1 w-full rounded-md px-1 py-0.5 text-left text-xs font-semibold capitalize text-[var(--ui-text)] hover:bg-[var(--ui-surface-hover)]"
              >
                {name}
              </button>
              <div className="grid grid-cols-7 text-center">
                {WEEKDAY_INITIALS.map((w, i) => (
                  <span key={i} className="py-0.5 text-[10px] font-medium text-[var(--ui-text-muted)]">
                    {w}
                  </span>
                ))}
                {buildMonthGrid(firstKey).map((d) => {
                  const inMonth = d.startsWith(monthKey);
                  if (!inMonth) return <span key={d} />;
                  const count = countByDay.get(d) ?? 0;
                  const isToday = d === todayKey;
                  return (
                    <button
                      key={d}
                      type="button"
                      onClick={() => onSelectDay(d)}
                      title={count ? `${count} reserva${count === 1 ? "" : "s"}` : "Sin reservas"}
                      className={`relative mx-auto flex h-6 w-6 items-center justify-center rounded-full text-[11px] tabular-nums transition-colors ${
                        isToday
                          ? "bg-[#094732] font-semibold text-white"
                          : "text-[var(--ui-text)] hover:bg-[var(--ui-surface-hover)]"
                      }`}
                    >
                      {Number(d.slice(8))}
                      {count > 0 && (
                        <span className="absolute -bottom-0.5 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-[#9F8351]" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
