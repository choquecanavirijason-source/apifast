import { useMemo } from "react";
import type { TicketItem } from "../../../../core/services/agenda/agenda.service";
import { parseTicketDate, toIsoDate } from "../dailyAgenda.utils";

type MonthAgendaViewProps = {
  tickets: TicketItem[];
  /** Días visibles (6 semanas de lunes a domingo), ver `buildMonthGrid`. */
  days: string[];
  /** Mes que se está viendo (YYYY-MM); los días de otros meses se ven atenuados. */
  monthKey: string;
  onSelectDay: (dateKey: string) => void;
  onEdit?: (ticket: TicketItem) => void;
};

const MAX_VISIBLE = 3;
const WEEKDAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

/** 42 días (6 semanas, lunes a domingo) que cubren el mes de `isoDate`. */
export function buildMonthGrid(isoDate: string): string[] {
  const [year, month] = isoDate.split("-").map(Number);
  const first = new Date(year, (month || 1) - 1, 1, 12);
  const offset = (first.getDay() + 6) % 7; // lunes = 0
  const start = new Date(first);
  start.setDate(first.getDate() - offset);
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return toIsoDate(d);
  });
}

const formatTime = (date: Date) =>
  date.toLocaleTimeString("es-BO", { hour: "numeric", minute: "2-digit", hour12: true });

/** Vista Mes: cada día muestra sus primeras citas; clic en el día abre la vista Día. */
export default function MonthAgendaView({ tickets, days, monthKey, onSelectDay, onEdit }: MonthAgendaViewProps) {
  const todayKey = toIsoDate(new Date());

  const byDay = useMemo(() => {
    const map = new Map<string, Array<{ ticket: TicketItem; start: Date }>>();
    for (const ticket of tickets) {
      const start = parseTicketDate(ticket.start_time);
      if (Number.isNaN(start.getTime())) continue;
      const key = toIsoDate(start);
      const list = map.get(key) ?? [];
      list.push({ ticket, start });
      map.set(key, list);
    }
    for (const list of map.values()) list.sort((a, b) => a.start.getTime() - b.start.getTime());
    return map;
  }, [tickets]);

  return (
    <div className="max-h-[min(72vh,900px)] overflow-auto">
      <div className="min-w-[640px]">
        <div className="grid grid-cols-7 border-b border-[var(--ui-border)] bg-[var(--ui-surface)]">
          {WEEKDAYS.map((w) => (
            <div key={w} className="py-1.5 text-center text-[11px] font-medium text-[var(--ui-text-muted)]">
              {w}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {days.map((d) => {
            const date = new Date(`${d}T12:00:00`);
            const inMonth = d.startsWith(monthKey);
            const isToday = d === todayKey;
            const items = byDay.get(d) ?? [];
            const hidden = items.length - MAX_VISIBLE;
            return (
              <div
                key={d}
                role="button"
                tabIndex={0}
                onClick={() => onSelectDay(d)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") onSelectDay(d);
                }}
                title="Ver este día"
                className={`flex min-h-[104px] cursor-pointer flex-col gap-0.5 border-b border-r border-[var(--ui-border)] p-1 transition-colors hover:bg-[var(--ui-surface-hover)] [&:nth-child(7n)]:border-r-0 ${
                  inMonth ? "bg-[var(--ui-surface)]" : "bg-[var(--ui-surface-muted)]"
                }`}
              >
                <span
                  className={`mb-0.5 flex h-6 w-6 items-center justify-center self-center rounded-full text-xs font-semibold tabular-nums ${
                    isToday
                      ? "bg-[#094732] text-white"
                      : inMonth
                        ? "text-[var(--ui-text)]"
                        : "text-[var(--ui-text-muted)] opacity-60"
                  }`}
                >
                  {date.getDate()}
                </span>
                {items.slice(0, MAX_VISIBLE).map(({ ticket, start }) => (
                  <button
                    key={ticket.id}
                    type="button"
                    onClick={(e) => e.stopPropagation()}
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      onEdit?.(ticket);
                    }}
                    title={`${ticket.client_name} · doble clic para editar`}
                    className="flex min-w-0 items-center gap-1 rounded px-1 py-0.5 text-left text-[11px] text-[var(--ui-text)] hover:bg-[var(--ui-accent-soft)]"
                  >
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#9F8351]" aria-hidden />
                    <span className="shrink-0 tabular-nums text-[var(--ui-text-muted)]">{formatTime(start)}</span>
                    <span className="truncate font-medium">{ticket.client_name.split(/\s+/)[0]}</span>
                  </button>
                ))}
                {hidden > 0 && (
                  <span className="px-1 text-[11px] font-medium text-[var(--ui-text-muted)]">+{hidden} más</span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
