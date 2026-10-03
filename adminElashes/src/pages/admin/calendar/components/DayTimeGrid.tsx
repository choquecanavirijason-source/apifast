import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { useNavigate } from "react-router-dom";
import type { TicketItem } from "../../../../core/services/agenda/agenda.service";
import { parseTicketDate, ticketCardClass, toIsoDate } from "../dailyAgenda.utils";

/**
 * Agenda por horas estilo Apple Calendar, para 1 día (vista Día) o 7 días (vista Semana).
 * - Cada cita es un bloque cuyo alto es su duración; las que se cruzan van lado a lado.
 * - Arrastrar la tarjeta la mueve (también a otro día en la semana); las asas de arriba/abajo la estiran.
 * - Todo se ajusta a bloques de 15 minutos; duración mínima 15 minutos.
 * - En pantallas táctiles la tarjeta se mueve tras mantenerla presionada; las asas responden al instante.
 */

export const GRID_START_MINUTE = 7 * 60;
export const GRID_END_MINUTE = 22 * 60 + 30;
const SNAP_MINUTES = 15;
const MIN_DURATION = 15;
const HOUR_PX = 64;
const PX_PER_MINUTE = HOUR_PX / 60;
const LONG_PRESS_MS = 300;
const MOUSE_DRAG_THRESHOLD_PX = 4;

export type OpenRange = { open: number; close: number };

type DragMode = "move" | "resize-start" | "resize-end";

type DragState = {
  mode: DragMode;
  ticketId: number;
  pointerId: number;
  originX: number;
  originY: number;
  originDay: number;
  originStart: number;
  originEnd: number;
  active: boolean;
  isTouch: boolean;
  longPressTimer: number | null;
  /** Quita los listeners de ventana (el arrastre se sigue en toda la ventana: la tarjeta puede cambiar de columna). */
  detach: () => void;
};

type Preview = { ticketId: number; day: number; start: number; end: number };

type PlacedTicket = { ticket: TicketItem; day: number; start: number; end: number };
type PositionedTicket = PlacedTicket & { column: number; columns: number };

type DayTimeGridProps = {
  tickets: TicketItem[];
  /** Días a mostrar (YYYY-MM-DD): uno para la vista Día, siete para la vista Semana. */
  days: string[];
  /** Horario de atención de cada día en minutos; null = sin horario configurado (todo abierto). */
  getOpenRanges: (dateKey: string) => OpenRange[] | null;
  disabledTicketId?: number | null;
  onCreateAt: (dateKey: string, minuteOfDay: number) => void;
  onChangeTime: (ticket: TicketItem, dateKey: string, startMinute: number, endMinute: number) => void;
  onEdit?: (ticket: TicketItem) => void;
  /** Vista Semana: clic en el encabezado de un día para abrirlo en la vista Día. */
  onSelectDay?: (dateKey: string) => void;
  /** Tipo de dato (dataTransfer) de tickets arrastrados desde fuera (panel de tickets). */
  externalDragType?: string;
  /** Se soltó un ticket externo en un horario. */
  onDropExternal?: (dateKey: string, minuteOfDay: number) => void;
};

const minuteOfDay = (date: Date) => date.getHours() * 60 + date.getMinutes();

export const formatMinute = (minute: number) =>
  new Date(2000, 0, 1, Math.floor(minute / 60), minute % 60).toLocaleTimeString("es-BO", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

const snap = (minutes: number) => Math.round(minutes / SNAP_MINUTES) * SNAP_MINUTES;

/** Reparte en columnas las citas que se cruzan (como Apple/Google: lado a lado). */
function layoutDay(items: PlacedTicket[]): PositionedTicket[] {
  const sorted = [...items].sort((a, b) => a.start - b.start || b.end - a.end);
  const result: PositionedTicket[] = [];
  let cluster: PositionedTicket[] = [];
  let clusterEnd = -1;
  let columnEnds: number[] = [];

  const flush = () => {
    const columns = Math.max(1, columnEnds.length);
    cluster.forEach((item) => result.push({ ...item, columns }));
    cluster = [];
    columnEnds = [];
  };

  for (const item of sorted) {
    if (item.start >= clusterEnd && cluster.length > 0) flush();
    let column = columnEnds.findIndex((end) => end <= item.start);
    if (column === -1) {
      column = columnEnds.length;
      columnEnds.push(item.end);
    } else {
      columnEnds[column] = item.end;
    }
    cluster.push({ ...item, column, columns: 1 });
    clusterEnd = Math.max(clusterEnd, item.end);
  }
  if (cluster.length > 0) flush();
  return result;
}

function closedBandsFor(ranges: OpenRange[] | null) {
  if (!ranges) return [];
  const sorted = [...ranges].sort((a, b) => a.open - b.open);
  const bands: Array<{ start: number; end: number }> = [];
  let cursor = GRID_START_MINUTE;
  for (const range of sorted) {
    if (range.open > cursor) bands.push({ start: cursor, end: Math.min(range.open, GRID_END_MINUTE) });
    cursor = Math.max(cursor, range.close);
  }
  if (cursor < GRID_END_MINUTE) bands.push({ start: cursor, end: GRID_END_MINUTE });
  return bands.filter((band) => band.end > band.start);
}

export default function DayTimeGrid({
  tickets,
  days,
  getOpenRanges,
  disabledTicketId = null,
  onCreateAt,
  onChangeTime,
  onEdit,
  onSelectDay,
  externalDragType,
  onDropExternal,
}: DayTimeGridProps) {
  const navigate = useNavigate();
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const columnsRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const suppressClickRef = useRef(false);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [nowMinute, setNowMinute] = useState(() => minuteOfDay(new Date()));
  /** Espacio libre bajo el mouse: muestra "+ hora" para que se entienda que ahí se crea una cita. */
  const [hoverSlot, setHoverSlot] = useState<{ day: number; minute: number } | null>(null);

  const totalMinutes = GRID_END_MINUTE - GRID_START_MINUTE;
  const gridHeight = totalMinutes * PX_PER_MINUTE;
  const todayKey = toIsoDate(new Date());
  const isWeek = days.length > 1;
  const daysKey = days.join(",");

  const ticketsByDay = useMemo(() => {
    const dayIndex = new Map(days.map((d, i) => [d, i]));
    const placed: PlacedTicket[] = [];
    for (const ticket of tickets) {
      const startDate = parseTicketDate(ticket.start_time);
      const endDate = parseTicketDate(ticket.end_time);
      if (Number.isNaN(startDate.getTime())) continue;
      const day = dayIndex.get(toIsoDate(startDate));
      if (day === undefined) continue;
      const start = minuteOfDay(startDate);
      const rawEnd = Number.isNaN(endDate.getTime())
        ? start + 60
        : toIsoDate(endDate) !== days[day]
          ? GRID_END_MINUTE
          : minuteOfDay(endDate);
      const item = { ticket, day, start, end: Math.max(start + MIN_DURATION, rawEnd) };
      // Mientras se arrastra, la cita se dibuja en su posición nueva.
      placed.push(
        preview && preview.ticketId === ticket.id
          ? { ...item, day: preview.day, start: preview.start, end: preview.end }
          : item,
      );
    }
    return days.map((_, i) => layoutDay(placed.filter((p) => p.day === i)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tickets, daysKey, preview]);

  const openRangesByDay = useMemo(() => days.map((d) => getOpenRanges(d)), [days, getOpenRanges]);

  // Al cambiar de día/semana, desplazar hasta la hora actual (hoy) o el inicio de atención.
  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    const firstOpen = openRangesByDay.find((r) => r?.length)?.[0]?.open ?? 8 * 60;
    const target = days.includes(todayKey) ? minuteOfDay(new Date()) - 60 : firstOpen - 30;
    container.scrollTop = Math.max(0, (target - GRID_START_MINUTE) * PX_PER_MINUTE);
    // Solo al cambiar el rango de días.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [daysKey]);

  useEffect(() => {
    if (!days.includes(todayKey)) return;
    const id = window.setInterval(() => setNowMinute(minuteOfDay(new Date())), 60_000);
    return () => window.clearInterval(id);
  }, [days, todayKey]);

  // En táctil, una vez activado el arrastre hay que impedir que la página se desplace.
  useEffect(() => {
    const columns = columnsRef.current;
    if (!columns) return;
    const blockScroll = (event: TouchEvent) => {
      if (dragRef.current?.active) event.preventDefault();
    };
    columns.addEventListener("touchmove", blockScroll, { passive: false });
    return () => columns.removeEventListener("touchmove", blockScroll);
  }, []);

  const dayAtX = useCallback(
    (clientX: number, fallback: number) => {
      const rect = columnsRef.current?.getBoundingClientRect();
      if (!rect || days.length <= 1) return fallback;
      const index = Math.floor(((clientX - rect.left) / rect.width) * days.length);
      return Math.min(Math.max(index, 0), days.length - 1);
    },
    [days.length],
  );

  const computePreview = useCallback(
    (drag: DragState, clientX: number, clientY: number): Preview => {
      const delta = snap((clientY - drag.originY) / PX_PER_MINUTE);
      const duration = drag.originEnd - drag.originStart;
      if (drag.mode === "move") {
        const start = Math.min(Math.max(drag.originStart + delta, GRID_START_MINUTE), GRID_END_MINUTE - duration);
        return { ticketId: drag.ticketId, day: dayAtX(clientX, drag.originDay), start, end: start + duration };
      }
      if (drag.mode === "resize-start") {
        const start = Math.min(Math.max(drag.originStart + delta, GRID_START_MINUTE), drag.originEnd - MIN_DURATION);
        return { ticketId: drag.ticketId, day: drag.originDay, start, end: drag.originEnd };
      }
      const end = Math.max(Math.min(drag.originEnd + delta, GRID_END_MINUTE), drag.originStart + MIN_DURATION);
      return { ticketId: drag.ticketId, day: drag.originDay, start: drag.originStart, end };
    },
    [dayAtX],
  );

  const clearDrag = useCallback(() => {
    const drag = dragRef.current;
    if (drag?.longPressTimer) window.clearTimeout(drag.longPressTimer);
    drag?.detach();
    dragRef.current = null;
    setPreview(null);
  }, []);

  useEffect(() => {
    const cancelWithEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && dragRef.current) clearDrag();
    };
    document.addEventListener("keydown", cancelWithEscape);
    return () => document.removeEventListener("keydown", cancelWithEscape);
  }, [clearDrag]);

  const beginDrag = (event: ReactPointerEvent<HTMLElement>, item: PositionedTicket, mode: DragMode) => {
    if (event.button !== 0 || disabledTicketId === item.ticket.id) return;
    event.stopPropagation();
    const isTouch = event.pointerType === "touch";
    const drag: DragState = {
      mode,
      ticketId: item.ticket.id,
      pointerId: event.pointerId,
      originX: event.clientX,
      originY: event.clientY,
      originDay: item.day,
      originStart: item.start,
      originEnd: item.end,
      // Las asas se activan al instante; la tarjeta espera movimiento (mouse) o presión larga (táctil).
      active: mode !== "move",
      isTouch,
      longPressTimer: null,
      detach: () => {},
    };
    const startPreview = { ticketId: drag.ticketId, day: drag.originDay, start: drag.originStart, end: drag.originEnd };
    if (isTouch && mode === "move") {
      drag.longPressTimer = window.setTimeout(() => {
        if (dragRef.current !== drag) return;
        drag.active = true;
        setPreview(startPreview);
        if (navigator.vibrate) navigator.vibrate(10);
      }, LONG_PRESS_MS);
    }
    if (drag.active) setPreview(startPreview);
    const onMove = (e: PointerEvent) => handlePointerMove(e);
    const onUp = (e: PointerEvent) => handlePointerUp(e);
    const onCancel = () => clearDrag();
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onCancel);
    drag.detach = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onCancel);
    };
    dragRef.current = drag;
  };

  const handlePointerMove = (event: PointerEvent) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const distance = Math.max(Math.abs(event.clientY - drag.originY), Math.abs(event.clientX - drag.originX));
    if (!drag.active) {
      if (drag.isTouch) {
        // Si el dedo se mueve antes de la presión larga, es un desplazamiento normal.
        if (distance > 8) clearDrag();
        return;
      }
      if (distance < MOUSE_DRAG_THRESHOLD_PX) return;
      drag.active = true;
    }
    setPreview(computePreview(drag, event.clientX, event.clientY));
  };

  const handlePointerUp = (event: PointerEvent) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (drag.active) {
      suppressClickRef.current = true;
      const next = computePreview(drag, event.clientX, event.clientY);
      const ticket = tickets.find((t) => t.id === drag.ticketId);
      if (ticket && (next.day !== drag.originDay || next.start !== drag.originStart || next.end !== drag.originEnd)) {
        onChangeTime(ticket, days[next.day], next.start, next.end);
      }
    }
    clearDrag();
  };

  const handleColumnClick = (event: React.MouseEvent<HTMLDivElement>, dayIndex: number) => {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    const minute = slotAt(event);
    if (minute < GRID_START_MINUTE || minute >= GRID_END_MINUTE) return;
    const ranges = openRangesByDay[dayIndex];
    if (ranges && !ranges.some((r) => minute >= r.open && minute < r.close)) return;
    onCreateAt(days[dayIndex], minute);
  };

  const slotAt = (event: React.MouseEvent<HTMLDivElement> | React.DragEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return GRID_START_MINUTE + Math.floor((event.clientY - rect.top) / PX_PER_MINUTE / SNAP_MINUTES) * SNAP_MINUTES;
  };

  const handleColumnHover = (event: React.MouseEvent<HTMLDivElement>, dayIndex: number) => {
    // Solo sobre espacio libre (no sobre una cita) y sin arrastre en curso.
    if (dragRef.current || (event.target as HTMLElement).closest("[data-agenda-event]")) {
      setHoverSlot(null);
      return;
    }
    const minute = slotAt(event);
    const ranges = openRangesByDay[dayIndex];
    const open = !ranges || ranges.some((r) => minute >= r.open && minute < r.close);
    setHoverSlot(open && minute < GRID_END_MINUTE ? { day: dayIndex, minute } : null);
  };

  const isExternalDrag = (event: React.DragEvent) =>
    Boolean(externalDragType && onDropExternal && event.dataTransfer.types.includes(externalDragType));

  const handleExternalDragOver = (event: React.DragEvent<HTMLDivElement>, dayIndex: number) => {
    if (!isExternalDrag(event)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    const minute = slotAt(event);
    if (hoverSlot?.day !== dayIndex || hoverSlot.minute !== minute) setHoverSlot({ day: dayIndex, minute });
  };

  const handleExternalDrop = (event: React.DragEvent<HTMLDivElement>, dayIndex: number) => {
    if (!isExternalDrag(event)) return;
    event.preventDefault();
    const minute = Math.min(slotAt(event), GRID_END_MINUTE - SNAP_MINUTES);
    setHoverSlot(null);
    onDropExternal?.(days[dayIndex], minute);
  };

  const hours = useMemo(() => {
    const list: number[] = [];
    for (let m = Math.ceil(GRID_START_MINUTE / 60) * 60; m < GRID_END_MINUTE; m += 60) list.push(m);
    return list;
  }, []);

  const toTop = (minute: number) => (minute - GRID_START_MINUTE) * PX_PER_MINUTE;

  const renderTicket = (item: PositionedTicket) => {
    const { ticket, start, end, column, columns } = item;
    const height = Math.max((end - start) * PX_PER_MINUTE, SNAP_MINUTES * PX_PER_MINUTE) - 2;
    const isDragging = preview?.ticketId === ticket.id;
    const disabled = disabledTicketId === ticket.id;
    const primaryService = ticket.service_names?.[0] ?? ticket.service_name ?? "Sin servicio";
    const extraServices = Math.max(0, (ticket.service_names?.length ?? 0) - 1);
    const firstName = ticket.client?.name ?? ticket.client_name.trim().split(/\s+/)[0] ?? ticket.client_name;
    const resizeHandle = (mode: "resize-start" | "resize-end") => (
      <span
        aria-hidden
        onPointerDown={(e) => beginDrag(e, item, mode)}
        className={`absolute inset-x-0 z-10 h-2 cursor-ns-resize [touch-action:none] pointer-coarse:h-3.5 ${
          mode === "resize-start" ? "top-0" : "bottom-0"
        }`}
      >
        <span className="mx-auto mt-0.5 block h-1 w-6 rounded-full bg-current opacity-15 transition-opacity group-hover/event:opacity-50 pointer-coarse:opacity-30" />
      </span>
    );

    return (
      <div
        key={ticket.id}
        data-agenda-event
        role="button"
        tabIndex={0}
        aria-label={`${ticket.client_name}, ${formatMinute(start)} a ${formatMinute(end)}`}
        title="Arrastra para mover · asas para cambiar la duración · doble clic para editar"
        onClick={(e) => e.stopPropagation()}
        onDoubleClick={(e) => {
          e.stopPropagation();
          onEdit?.(ticket);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") onEdit?.(ticket);
        }}
        onPointerDown={(e) => beginDrag(e, item, "move")}
        className={`group/event absolute overflow-hidden rounded-md border border-l-[3px] px-1.5 py-0.5 text-left shadow-sm transition-shadow [touch-action:pan-y] ${ticketCardClass(ticket.status)} ${
          isDragging ? "z-30 cursor-grabbing opacity-90 shadow-lg ring-2 ring-[#9F8351]/60" : "z-10 cursor-grab hover:shadow-md"
        } ${disabled ? "pointer-events-none opacity-50" : ""}`}
        style={{
          top: toTop(start) + 1,
          height,
          left: `calc(${(column / columns) * 100}% + 2px)`,
          width: `calc(${100 / columns}% - 4px)`,
        }}
      >
        {resizeHandle("resize-start")}

        <div className="pointer-events-none flex min-w-0 flex-col leading-tight">
          <div className="flex min-w-0 items-baseline gap-1">
            <span className="truncate text-[12px] font-semibold">{firstName}</span>
            {height < 40 && !isWeek && (
              <span className="shrink-0 text-[11px] tabular-nums opacity-75">{formatMinute(start)}</span>
            )}
          </div>
          {height >= 40 && (
            <span className="truncate text-[11px] tabular-nums opacity-80">
              {formatMinute(start)}
              {isWeek ? "" : ` – ${formatMinute(end)}`}
            </span>
          )}
          {height >= 56 && (
            <span className="truncate text-[11px] opacity-90">
              {primaryService}
              {extraServices > 0 ? ` +${extraServices}` : ""}
            </span>
          )}
          {height >= 76 && ticket.professional_name && (
            <span className="truncate text-[11px] opacity-75">Op: {ticket.professional_name}</span>
          )}
        </div>

        {height >= 100 && !isDragging && !isWeek && (
          <div className="absolute bottom-2.5 left-1.5">
            {!ticket.sale_id ? (
              <button
                type="button"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  navigate("/admin/pos-tracking", {
                    state: { fromAgendaReservation: { appointmentId: ticket.id } },
                  });
                }}
                className="rounded border border-current/30 bg-white/80 px-1.5 py-0.5 text-[11px] font-medium hover:bg-white"
              >
                Pasar a venta
              </button>
            ) : (
              <span className="text-[11px] font-medium">Venta #{ticket.sale_id}</span>
            )}
          </div>
        )}

        {resizeHandle("resize-end")}

        {/* Hora mientras se arrastra (como Apple) */}
        {isDragging && (
          <span className="pointer-events-none absolute bottom-1 right-1 z-20 rounded bg-[#094732] px-1 text-[10px] font-semibold tabular-nums text-white">
            {formatMinute(start)} – {formatMinute(end)}
          </span>
        )}
      </div>
    );
  };

  return (
    <div ref={scrollRef} className="max-h-[min(72vh,900px)] overflow-auto">
      <div className={isWeek ? "min-w-[760px]" : "min-w-[min(100%,560px)]"}>
        {/* Encabezado de días (solo vista Semana) */}
        {isWeek && (
          <div className="sticky top-0 z-[35] flex border-b border-[var(--ui-border)] bg-[var(--ui-surface)]">
            <div className="w-[72px] shrink-0 border-r border-[var(--ui-border)]" />
            <div className="grid flex-1" style={{ gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))` }}>
              {days.map((d) => {
                const date = new Date(`${d}T12:00:00`);
                const isToday = d === todayKey;
                return (
                  <button
                    key={d}
                    type="button"
                    onClick={() => onSelectDay?.(d)}
                    title="Ver este día"
                    className="flex flex-col items-center gap-0.5 border-r border-[var(--ui-border)] py-1.5 transition-colors last:border-r-0 hover:bg-[var(--ui-surface-hover)]"
                  >
                    <span className="text-[11px] font-medium capitalize text-[var(--ui-text-muted)]">
                      {date.toLocaleDateString("es-BO", { weekday: "short" }).replace(".", "")}
                    </span>
                    <span
                      className={`flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold tabular-nums ${
                        isToday ? "bg-[#094732] text-white" : "text-[var(--ui-text)]"
                      }`}
                    >
                      {date.getDate()}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="flex">
          {/* Columna de horas */}
          <div className="relative w-[72px] shrink-0 border-r border-[var(--ui-border)]" style={{ height: gridHeight }}>
            {hours.map((m) => (
              <span
                key={m}
                className="absolute right-2 -translate-y-1/2 whitespace-nowrap text-[11px] tabular-nums text-[var(--ui-text-muted)]"
                style={{ top: toTop(m) }}
              >
                {m === GRID_START_MINUTE ? "" : formatMinute(m)}
              </span>
            ))}
          </div>

          {/* Columnas de días */}
          <div
            ref={columnsRef}
            role="grid"
            aria-label={isWeek ? "Agenda de la semana" : "Agenda del día"}
            className="relative grid flex-1 select-none"
            style={{ height: gridHeight, gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))` }}
          >
            {/* Líneas: hora completa marcada, cuartos de hora suaves */}
            {Array.from({ length: totalMinutes / SNAP_MINUTES }, (_, i) => {
              const m = GRID_START_MINUTE + i * SNAP_MINUTES;
              return (
                <div
                  key={m}
                  className={`pointer-events-none absolute inset-x-0 border-t ${
                    m % 60 === 0 ? "border-[var(--ui-border)]" : "border-dashed border-[var(--ui-border)]/40"
                  }`}
                  style={{ top: toTop(m) }}
                />
              );
            })}

            {days.map((d, dayIndex) => (
              <div
                key={d}
                onClick={(e) => handleColumnClick(e, dayIndex)}
                onMouseMove={(e) => handleColumnHover(e, dayIndex)}
                onMouseLeave={() => setHoverSlot(null)}
                onDragOver={(e) => handleExternalDragOver(e, dayIndex)}
                onDragLeave={() => setHoverSlot(null)}
                onDrop={(e) => handleExternalDrop(e, dayIndex)}
                className={`relative cursor-pointer ${isWeek ? "border-r border-[var(--ui-border)] last:border-r-0" : ""}`}
              >
                {closedBandsFor(openRangesByDay[dayIndex]).map((band) => (
                  <div
                    key={band.start}
                    className="pointer-events-none absolute inset-x-0 bg-[repeating-linear-gradient(135deg,var(--ui-surface-muted)_0,var(--ui-surface-muted)_6px,transparent_6px,transparent_12px)]"
                    style={{ top: toTop(band.start), height: (band.end - band.start) * PX_PER_MINUTE }}
                  />
                ))}

                {d === todayKey && nowMinute >= GRID_START_MINUTE && nowMinute <= GRID_END_MINUTE && (
                  <div className="pointer-events-none absolute inset-x-0 z-20" style={{ top: toTop(nowMinute) }}>
                    <div className="absolute -left-1 -top-[4px] h-2 w-2 rounded-full bg-[#9F8351]" />
                    <div className="h-px bg-[#9F8351]" />
                  </div>
                )}

                {hoverSlot?.day === dayIndex && !preview && (
                  <div
                    className="pointer-events-none absolute inset-x-1 z-[5] flex items-center rounded-md border border-dashed border-[#9F8351]/60 bg-[#9F8351]/8 px-1.5 text-[11px] font-medium text-[#85754a]"
                    style={{ top: toTop(hoverSlot.minute) + 1, height: SNAP_MINUTES * PX_PER_MINUTE * 2 - 2 }}
                  >
                    + {formatMinute(hoverSlot.minute)}
                  </div>
                )}

                {ticketsByDay[dayIndex].map(renderTicket)}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
