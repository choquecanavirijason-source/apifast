import { useEffect, useMemo, useState, type DragEvent } from "react";
import { CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, ShoppingCart } from "lucide-react";
import { TICKET_STATUS_OPTIONS } from "../pos.constants";
import type { TicketItem } from "../../../../core/services/agenda/agenda.service";
import type {
  CartLine,
  PosSaleStepTwoProps as BasePosSaleStepTwoProps,
} from "../pos.types";
import PosSaleDrawer from "./PosSaleDrawer";

// Extiende el tipo de props para incluir las nuevas props
interface PosSaleStepTwoExtraProps {
  cartCount?: number;
  animateCart?: boolean;
}

type PosSaleStepTwoProps = BasePosSaleStepTwoProps & PosSaleStepTwoExtraProps;

const toIsoDate = (value: Date) => value.toISOString().slice(0, 10);
const toTimeValue = (hour: number, minute: number) =>
  `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;

const DEFAULT_BRANCH_RANGE = [{ open_time: "09:00", close_time: "19:00" }];

type BranchOpeningRange = { open_time: string; close_time: string };
type BranchOpeningDay = { day: string; ranges: BranchOpeningRange[] };

const parseIsoToLocalDateMinute = (iso: string) => {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return null;
  return {
    date: toIsoDate(parsed),
    minuteOfDay: parsed.getHours() * 60 + parsed.getMinutes(),
  };
};

/** Etiqueta legible de duración (p. ej. 90 → "1 h 30 min"). */
const formatDurationLabel = (minutes: number) => {
  const m = Math.max(1, Math.round(minutes));
  if (m >= 60) {
    const h = Math.floor(m / 60);
    const rest = m % 60;
    return rest > 0 ? `${h} h ${rest} min` : `${h} h`;
  }
  return `${m} min`;
};

const getEndTimeLabelForLine = (line: CartLine, lineDate: string) => {
  const [hourPart, minutePart] = (line.time || "09:00").split(":");
  const hour = Number(hourPart);
  const minute = Number(minutePart);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
  const start = new Date(`${lineDate}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00`);
  if (Number.isNaN(start.getTime())) return null;
  const end = new Date(start.getTime() + Math.max(1, line.duration_minutes) * 60_000);
  return toTimeValue(end.getHours(), end.getMinutes());
};

const getFixedTicketTimeRange = (ticket: TicketItem) => {
  const start = new Date(ticket.start_time);
  const end = new Date(ticket.end_time);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return { startLabel: "--:--", endLabel: "--:--", durationMins: null as number | null };
  }
  const durationMins = Math.max(1, Math.round((end.getTime() - start.getTime()) / 60_000));
  return {
    startLabel: toTimeValue(start.getHours(), start.getMinutes()),
    endLabel: toTimeValue(end.getHours(), end.getMinutes()),
    durationMins,
  };
};

const startOfWeek = (dateText: string) => {
  const base = new Date(`${dateText}T00:00:00`);
  if (Number.isNaN(base.getTime())) return new Date();
  const day = base.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(base);
  monday.setDate(base.getDate() + diff);
  return monday;
};

export default function PosSaleStepTwo({
  cartLines,
  existingTickets,
  services,
  clientDisplayName,
  editingSaleCode = null,
  subtotal: _subtotal,
  total,
  onRemoveLine,
  professionals,
  lineAvailability,
  saleBaseDate,
  updateLine,
  setAvailabilityPreviewLineId,
  setAvailabilityPreviewDate,
  setAvailabilitySearch,
  isSubmitting,
  onCheckout,
  onBack: _onBack,
  onOpenSalesHistory: _onOpenSalesHistory,
  clientComboboxRef,
  clientSearch,
  setClientSearch,
  setClientId,
  isClientMenuOpen,
  setIsClientMenuOpen,
  filteredClients,
  selectedClient,
  clientPhone,
  clientAddress,
  sellerId,
  setSellerId,
  discountValue,
  setDiscountValue,
  discountType,
  setDiscountType,
  paymentMethod,
  setPaymentMethod,
  notes,
  setNotes,
  onOpenRegisterClient,
  onAddServiceToCart,
  branchOpeningHours = null,
  cartCount = cartLines.length,
  animateCart = false,
}: PosSaleStepTwoProps) {
  const [calendarDate, setCalendarDate] = useState(saleBaseDate);
  const [draggingLineId, setDraggingLineId] = useState<string | null>(null);
  const [visibleStartHour, setVisibleStartHour] = useState(9);
  const [visibleEndHour, setVisibleEndHour] = useState(19);
  const [slotMinutes, setSlotMinutes] = useState<60 | 30>(60);
  const [isSaleDrawerOpen, setIsSaleDrawerOpen] = useState(false);
  const [isTicketsPanelOpen, setIsTicketsPanelOpen] = useState(false);

  useEffect(() => {
    setCalendarDate((current) => current || saleBaseDate);
  }, [saleBaseDate]);

  const normalizedBranchSchedule = useMemo(() => {
    if (!branchOpeningHours || branchOpeningHours.length === 0) return [] as BranchOpeningDay[];
    return branchOpeningHours.map((item) => ({
      day: item.day.trim().toLowerCase(),
      ranges: (item.ranges || [])
        .filter((range) => range.open_time && range.close_time && range.open_time < range.close_time)
        .map((range) => ({ open_time: range.open_time, close_time: range.close_time })),
    }));
  }, [branchOpeningHours]);

  const getRangesForDate = (_isoDate: string): BranchOpeningRange[] => DEFAULT_BRANCH_RANGE;

  const getFirstOpenTimeForDate = (isoDate: string) => getRangesForDate(isoDate)[0]?.open_time ?? "09:00";

  const isMinuteInRanges = (minuteOfDay: number, ranges: BranchOpeningRange[]) => {
    return ranges.some((range) => {
      const [openHour, openMinute] = range.open_time.split(":").map(Number);
      const [closeHour, closeMinute] = range.close_time.split(":").map(Number);
      const openTotal = openHour * 60 + openMinute;
      const closeTotal = closeHour * 60 + closeMinute;
      return minuteOfDay >= openTotal && minuteOfDay <= closeTotal;
    });
  };

  const normalizeTimeForDate = (date: string, rawTime: string) => {
    const ranges = getRangesForDate(date);
    const [hourPart, minutePart] = (rawTime || "").split(":");
    const hour = Number(hourPart);
    const minute = Number(minutePart);
    if (!Number.isFinite(hour) || !Number.isFinite(minute)) return getFirstOpenTimeForDate(date);
    const minuteOfDay = hour * 60 + minute;
    if (isMinuteInRanges(minuteOfDay, ranges)) return toTimeValue(hour, minute);

    const firstRange = ranges[0];
    const lastRange = ranges[ranges.length - 1];
    const [firstHour, firstMinute] = firstRange.open_time.split(":").map(Number);
    const [lastHour, lastMinute] = lastRange.close_time.split(":").map(Number);
    const minAllowed = firstHour * 60 + firstMinute;
    const maxAllowed = lastHour * 60 + lastMinute;
    if (minuteOfDay < minAllowed) return firstRange.open_time;
    if (minuteOfDay > maxAllowed) return lastRange.close_time;
    return getFirstOpenTimeForDate(date);
  };

  const weekStart = useMemo(() => startOfWeek(calendarDate || saleBaseDate), [calendarDate, saleBaseDate]);

  const weekDays = useMemo(() => {
    const formatter = new Intl.DateTimeFormat("es-BO", { weekday: "short", day: "2-digit", month: "2-digit" });
    return Array.from({ length: 7 }, (_, i) => {
      const date = new Date(weekStart);
      date.setDate(weekStart.getDate() + i);
      const isoDate = toIsoDate(date);
      return {
        isoDate,
        label: formatter.format(date).replace(".", ""),
      };
    });
  }, [weekStart]);

  const todayIso = useMemo(() => toIsoDate(new Date()), []);

  const calendarSlots = useMemo(() => {
    const start = Math.max(0, Math.min(23, visibleStartHour));
    const end = Math.max(start, Math.min(23, visibleEndHour));
    const slots: Array<{ hour: number; minute: number; minuteOfDay: number; label: string }> = [];
    for (let hour = start; hour <= end; hour += 1) {
      if (slotMinutes === 60) {
        slots.push({
          hour,
          minute: 0,
          minuteOfDay: hour * 60,
          label: toTimeValue(hour, 0),
        });
      } else {
        slots.push({
          hour,
          minute: 0,
          minuteOfDay: hour * 60,
          label: toTimeValue(hour, 0),
        });
        slots.push({
          hour,
          minute: 30,
          minuteOfDay: hour * 60 + 30,
          label: toTimeValue(hour, 30),
        });
      }
    }
    const rangesForCalendarDate = getRangesForDate(calendarDate || saleBaseDate);
    return slots.filter((slot) => isMinuteInRanges(slot.minuteOfDay, rangesForCalendarDate));
  }, [calendarDate, saleBaseDate, slotMinutes, visibleEndHour, visibleStartHour]);

  useEffect(() => {
    const ranges = getRangesForDate(calendarDate || saleBaseDate);
    const firstRange = ranges[0];
    const lastRange = ranges[ranges.length - 1];
    const [firstHour] = firstRange.open_time.split(":").map(Number);
    const [lastHour] = lastRange.close_time.split(":").map(Number);
    setVisibleStartHour(firstHour);
    setVisibleEndHour(lastHour);
  }, [calendarDate, saleBaseDate, normalizedBranchSchedule]);

  const servicesById = useMemo(() => {
    return new Map(services.map((service) => [String(service.id), service]));
  }, [services]);

  const professionalNameById = useMemo(
    () => new Map(professionals.map((professional) => [String(professional.id), professional.username])),
    [professionals]
  );

  const fixedTicketsByCell = useMemo(() => {
    const grouped = new Map<string, (typeof existingTickets)[number][]>();

    existingTickets.forEach((ticket) => {
      if ((ticket.status ?? "") === "cancelled") return;

      const parsedStart = parseIsoToLocalDateMinute(ticket.start_time);
      if (!parsedStart) return;

      const isInWeek = weekDays.some((day) => day.isoDate === parsedStart.date);
      if (!isInWeek) return;

      const normalizedMinuteOfDay =
        slotMinutes === 30
          ? Math.floor(parsedStart.minuteOfDay / 30) * 30
          : Math.floor(parsedStart.minuteOfDay / 60) * 60;
      const key = `${parsedStart.date}__${normalizedMinuteOfDay}`;
      const existing = grouped.get(key) ?? [];
      grouped.set(key, [...existing, ticket].sort((a, b) => a.start_time.localeCompare(b.start_time)));
    });

    return grouped;
  }, [existingTickets, slotMinutes, weekDays]);

  const normalizeLineDate = (line: CartLine) => line.date?.trim() || saleBaseDate;

  const ticketsByCell = useMemo(() => {
    const grouped = new Map<string, CartLine[]>();

    cartLines.forEach((line) => {
      if (line.without_time) return;
      const lineDate = normalizeLineDate(line);
      const isInWeek = weekDays.some((day) => day.isoDate === lineDate);
      if (!isInWeek) return;

      const [hourPart, minutePart] = (line.time || "").split(":");
      const hour = Number(hourPart);
      const minute = Number(minutePart);
      if (!Number.isFinite(hour) || !Number.isFinite(minute)) return;
      const minuteOfDay = hour * 60 + minute;
      const normalizedMinuteOfDay =
        slotMinutes === 30 ? Math.floor(minuteOfDay / 30) * 30 : Math.floor(minuteOfDay / 60) * 60;
      const key = `${lineDate}__${normalizedMinuteOfDay}`;
      const existing = grouped.get(key) ?? [];
      grouped.set(key, [...existing, line]);
    });

    return grouped;
  }, [cartLines, saleBaseDate, slotMinutes, weekDays]);

  const openAvailabilityPreview = (lineId: string, targetDate: string) => {
    setAvailabilityPreviewLineId(lineId);
    setAvailabilityPreviewDate(targetDate);
    setAvailabilitySearch("");
  };

  const applyTicketToCalendarCell = (
    lineId: string,
    targetDate: string,
    hour: number,
    minute: number
  ) => {
    const targetMinuteOfDay = hour * 60 + minute;
    if (!isMinuteInRanges(targetMinuteOfDay, getRangesForDate(targetDate))) return;
    updateLine(lineId, {
      date: targetDate,
      time: toTimeValue(hour, minute),
      without_time: false,
    });
  };


  const canScheduleTickets = true;

  const handleDropInCell = (
    event: DragEvent<HTMLDivElement>,
    targetDate: string,
    hour: number,
    minute: number
  ) => {
    event.preventDefault();
    if (!canScheduleTickets) return;
    const droppedLineId = event.dataTransfer.getData("text/plain") || draggingLineId;
    if (!droppedLineId) return;
    applyTicketToCalendarCell(droppedLineId, targetDate, hour, minute);
    setDraggingLineId(null);
  };

  const lineValidationMap = useMemo(() => {
    const map = new Map<string, { valid: boolean; message: string }>();
    cartLines.forEach((line) => {
      if (!line.service_id) {
        map.set(line.localId, { valid: false, message: "Selecciona servicio" });
        return;
      }
      if (!line.date) {
        map.set(line.localId, { valid: false, message: "Selecciona fecha" });
        return;
      }
      if (!line.professional_id) {
        map.set(line.localId, { valid: false, message: "Selecciona operaria" });
        return;
      }
      if (line.without_time || !line.time) {
        map.set(line.localId, { valid: false, message: "Asigna hora (arrastra al calendario)" });
        return;
      }
      const availability = lineAvailability[line.localId];
      if (!availability) {
        map.set(line.localId, { valid: false, message: "Validando disponibilidad..." });
        return;
      }
      if (!availability.available) {
        const conflicts = availability.conflictCount || 1;
        map.set(line.localId, {
          valid: false,
          message: `Operaria ocupada (${conflicts} conflicto${conflicts > 1 ? "s" : ""})`,
        });
        return;
      }
      map.set(line.localId, { valid: true, message: "Ticket validado para venta" });
    });
    return map;
  }, [cartLines, lineAvailability]);

  const primaryActionLabel = editingSaleCode ? "Guardar cambios de venta" : "Confirmar venta";

  const cacheTicketsBeforeCheckout = () => {
    const cacheKey = "pos_finalized_tickets_cache";
    const payload = {
      savedAt: new Date().toISOString(),
      editingSaleCode,
      tickets: cartLines.map((line) => ({
        localId: line.localId,
        service_id: line.service_id,
        professional_id: line.professional_id,
        date: line.date,
        time: line.time,
        without_time: line.without_time,
        duration_minutes: line.duration_minutes,
        price: line.price,
        status: line.status,
      })),
    };
    localStorage.setItem(cacheKey, JSON.stringify(payload));
  };

  const handleConfirmSaleFlow = () => {
    cacheTicketsBeforeCheckout();
    onCheckout();
  };

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col bg-[#f3f2f1] text-[#323130]">
      

      <div className="min-h-0 flex-1 overflow-hidden">
        <div className="flex h-full w-full min-h-0 flex-col overflow-hidden rounded-sm border border-[#edebe9] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.06)]">
          <div className="flex shrink-0 items-center justify-between border-b border-[#edebe9] bg-[#faf9f8] px-4 py-3">
            <div className="flex items-center gap-2">
              <ShoppingCart className="h-4 w-4 text-[#0078d4]" />
              <span className="text-sm font-semibold text-[#323130]">Planificador visual</span>
              {editingSaleCode ? (
                <span className="rounded-sm border border-[#f5d7a1] bg-[#fff4ce] px-2 py-0.5 text-[10px] font-semibold text-[#8a6a1f]">
                  Editando: {editingSaleCode}
                </span>
              ) : null}
              {cartLines.length > 0 ? (
                <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[#0078d4] px-1.5 text-[10px] font-bold text-white">
                  {cartLines.length}
                </span>
              ) : null}
            </div>
            <div className="flex items-center gap-2">
              <label htmlFor="planner-date" className="text-[11px] font-medium text-[#605e5c]">
                Fecha base
              </label>
              <input
                id="planner-date"
                type="date"
                value={calendarDate}
                onChange={(event) => setCalendarDate(event.target.value || saleBaseDate)}
                className="h-8 rounded-sm border border-[#8a8886] bg-white px-2 text-xs text-[#323130] outline-none focus:border-[#0078d4] focus:ring-1 focus:ring-[#0078d4]/35"
              />
              <button
                type="button"
                onClick={() => {
                  const previous = new Date(weekStart);
                  previous.setDate(weekStart.getDate() - 7);
                  setCalendarDate(toIsoDate(previous));
                }}
                className="h-8 rounded-sm border border-[#edebe9] bg-white px-2 text-xs font-medium text-[#323130] transition hover:bg-[#f3f2f1]"
              >
                Semana anterior
              </button>
              <button
                type="button"
                onClick={() => {
                  const next = new Date(weekStart);
                  next.setDate(weekStart.getDate() + 7);
                  setCalendarDate(toIsoDate(next));
                }}
                className="h-8 rounded-sm border border-[#edebe9] bg-white px-2 text-xs font-medium text-[#323130] transition hover:bg-[#f3f2f1]"
              >
                Semana siguiente
              </button>
            </div>
          </div>

          {cartLines.length === 0 ? (
            <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 py-16 text-[#605e5c]">
              <div className="flex h-14 w-14 items-center justify-center rounded-sm border border-[#edebe9] bg-[#faf9f8]">
                <ShoppingCart className="h-6 w-6 opacity-40" />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium">Sin tickets en el carito</p>
                <p className="mt-0.5 text-xs">Vuelve al paso anterior y agrega servicios para planificarlos</p>
              </div>
            </div>
          ) : (
            <div className="relative min-h-0 flex flex-1 flex-col gap-2 xl:flex-row">
              <aside
                className={`min-h-0 overflow-hidden rounded-sm bg-[#faf9f8] transition-all duration-300 ease-in-out ${
                  isTicketsPanelOpen
                    ? "xl:w-[360px] xl:border xl:border-[#edebe9] xl:p-3 xl:opacity-100"
                    : "xl:w-0 xl:border-0 xl:p-0 xl:opacity-0"
                }`}
              >
                <div className="min-h-0 overflow-y-auto">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#605e5c]">
                  Tickets (arrastra al calendario)
                </p>
                <div className="space-y-2">
                  {cartLines.map((line) => {
                    const service = servicesById.get(line.service_id);
                    const assignedDate = normalizeLineDate(line);
                    const selectedHour = line.time?.slice(0, 5) || "";
                    return (
                      <article
                        key={line.localId}
                        draggable={canScheduleTickets}
                        onDragStart={(event) => {
                          if (!canScheduleTickets) return;
                          event.dataTransfer.setData("text/plain", line.localId);
                          event.dataTransfer.effectAllowed = "move";
                          setDraggingLineId(line.localId);
                        }}
                        onDragEnd={() => setDraggingLineId(null)}
                        className={`select-none rounded-sm border bg-white p-3 shadow-sm transition ${
                          canScheduleTickets
                            ? `cursor-grab active:cursor-grabbing ${
                                draggingLineId === line.localId
                                  ? "scale-[0.99] border-[#0078d4] opacity-80 ring-1 ring-[#0078d4]/45"
                                  : "border-[#edebe9] hover:border-[#9fd3ff]"
                              }`
                            : "cursor-not-allowed border-[#edebe9] opacity-90"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-[#323130]">
                              {service?.name ?? "Servicio"}
                            </p>
                            <p className="text-[11px] text-[#605e5c]">
                              {line.duration_minutes} min - Bs {line.price.toFixed(2)}
                            </p>
                            <p className={`text-[10px] font-medium ${canScheduleTickets ? "text-[#0078d4]" : "text-[#a19f9d]"}`}>
                              {canScheduleTickets ? "Arrastra este ticket al calendario" : "Programación bloqueada hasta confirmar la venta"}
                            </p>
                          </div>
                          <button
                            type="button"
                            disabled={!canScheduleTickets}
                            onClick={() => openAvailabilityPreview(line.localId, assignedDate)}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-sm border border-[#edebe9] bg-[#faf9f8] text-[#0078d4] transition hover:bg-[#f3f2f1] disabled:cursor-not-allowed disabled:opacity-45"
                            title="Ver ocupación del día"
                          >
                            <CalendarDays className="h-3.5 w-3.5" />
                          </button>
                        </div>

                        <div className="mt-2 grid gap-2">
                          <select
                            value={line.service_id}
                            onChange={(event) => updateLine(line.localId, { service_id: event.target.value })}
                            className="h-8 rounded-sm border border-[#8a8886] bg-white px-2 text-xs text-[#323130] outline-none focus:border-[#0078d4] focus:ring-1 focus:ring-[#0078d4]/35"
                          >
                            <option value="">Servicio…</option>
                            {services.map((serviceOption) => (
                              <option key={serviceOption.id} value={String(serviceOption.id)}>
                                {serviceOption.name}
                              </option>
                            ))}
                          </select>

                          <div className="grid grid-cols-2 gap-2">
                            <input
                              type="date"
                              value={line.date}
                              onChange={(event) => updateLine(line.localId, { date: event.target.value })}
                              onBlur={(event) => {
                                if (!event.target.value) updateLine(line.localId, { date: saleBaseDate });
                              }}
                              disabled={!canScheduleTickets}
                              className="h-8 rounded-sm border border-[#8a8886] bg-white px-2 text-xs text-[#323130] outline-none focus:border-[#0078d4] focus:ring-1 focus:ring-[#0078d4]/35 disabled:cursor-not-allowed disabled:bg-[#f3f2f1]"
                            />
                            <input
                              type="time"
                              min="09:00"
                              max="19:00"
                              value={line.time}
                              onChange={(event) =>
                                updateLine(line.localId, {
                                  time: normalizeTimeForDate(normalizeLineDate(line), event.target.value),
                                })
                              }
                              onBlur={(event) =>
                                updateLine(line.localId, {
                                  time: normalizeTimeForDate(normalizeLineDate(line), event.target.value),
                                })
                              }
                              disabled={!canScheduleTickets || line.without_time}
                              className="h-8 rounded-sm border border-[#8a8886] bg-white px-2 text-xs text-[#323130] outline-none focus:border-[#0078d4] focus:ring-1 focus:ring-[#0078d4]/35 disabled:cursor-not-allowed disabled:bg-[#f3f2f1]"
                            />
                          </div>

                          <div className="grid grid-cols-[1fr_auto] gap-2">
                            <select
                              value={line.professional_id}
                              onChange={(event) =>
                                updateLine(line.localId, { professional_id: event.target.value })
                              }
                              disabled={!canScheduleTickets}
                              className="h-8 rounded-sm border border-[#8a8886] bg-white px-2 text-xs text-[#323130] outline-none focus:border-[#0078d4] focus:ring-1 focus:ring-[#0078d4]/35 disabled:cursor-not-allowed disabled:bg-[#f3f2f1]"
                            >
                              <option value="">Operaria…</option>
                              {professionals.map((professional) => (
                                <option key={professional.id} value={String(professional.id)}>
                                  {professional.username}
                                </option>
                              ))}
                            </select>
                            <label
                              className={`inline-flex h-8 items-center gap-1 whitespace-nowrap rounded-sm border border-[#edebe9] px-2 text-[11px] ${
                                canScheduleTickets ? "text-[#605e5c]" : "cursor-not-allowed text-[#a19f9d]"
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={line.without_time}
                                disabled={!canScheduleTickets}
                                onChange={(event) =>
                                  updateLine(line.localId, {
                                    without_time: event.target.checked,
                                    time: event.target.checked ? "" : selectedHour || "09:00",
                                  })
                                }
                                className="rounded-sm border-[#8a8886] text-[#0078d4] focus:ring-[#0078d4] disabled:cursor-not-allowed"
                              />
                              Sin hora
                            </label>
                          </div>

                          <select
                            value={line.status}
                            onChange={(event) =>
                              updateLine(line.localId, {
                                status: event.target.value === "in_service" ? "in_service" : "pending",
                              })
                            }
                            className="h-8 rounded-sm border border-[#8a8886] bg-white px-2 text-xs text-[#323130] outline-none focus:border-[#0078d4] focus:ring-1 focus:ring-[#0078d4]/35"
                          >
                            {TICKET_STATUS_OPTIONS.map((statusOption) => (
                              <option key={statusOption.value} value={statusOption.value}>
                                {statusOption.label}
                              </option>
                            ))}
                          </select>
                        </div>

                        {(() => {
                          const validation = lineValidationMap.get(line.localId);
                          return (
                            <p className={`mt-2 text-[11px] font-medium ${validation?.valid ? "text-[#107c10]" : "text-[#d13438]"}`}>
                              {validation?.message ?? "Pendiente de validación"}
                            </p>
                          );
                        })()}
                      </article>
                    );
                  })}
                </div>
                </div>
              </aside>

              <button
                type="button"
                onClick={() => setIsTicketsPanelOpen((current) => !current)}
                className={`absolute left-0 top-1/2 z-20 hidden -translate-y-1/2 items-center justify-center rounded-r-sm border border-l-0 border-[#edebe9] bg-white p-1.5 text-[#605e5c] shadow-sm transition hover:bg-[#f3f2f1] xl:inline-flex ${
                  isTicketsPanelOpen ? "xl:left-[360px]" : "xl:left-0"
                }`}
                title={isTicketsPanelOpen ? "Ocultar tickets" : "Mostrar tickets"}
                aria-label={isTicketsPanelOpen ? "Ocultar panel de tickets" : "Mostrar panel de tickets"}
              >
                {isTicketsPanelOpen ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </button>

              <section className="min-h-0 flex-1 overflow-auto rounded-sm border border-[#edebe9] bg-white">
                <div className="flex items-center justify-end gap-2 border-b border-[#edebe9] bg-[#faf9f8] px-3 py-2">
                  <div className="mr-auto flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        const previousDay = new Date(calendarDate || saleBaseDate);
                        previousDay.setDate(previousDay.getDate() - 1);
                        setCalendarDate(toIsoDate(previousDay));
                      }}
                      className="inline-flex h-7 w-7 items-center justify-center rounded-sm border border-[#8a8886] bg-white text-[#605e5c] transition hover:bg-[#f3f2f1]"
                      title="Ver día anterior"
                      aria-label="Ver día anterior"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const nextDay = new Date(calendarDate || saleBaseDate);
                        nextDay.setDate(nextDay.getDate() + 1);
                        setCalendarDate(toIsoDate(nextDay));
                      }}
                      className="inline-flex h-7 w-7 items-center justify-center rounded-sm border border-[#8a8886] bg-white text-[#605e5c] transition hover:bg-[#f3f2f1]"
                      title="Ver día siguiente"
                      aria-label="Ver día siguiente"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const previousWeek = new Date(calendarDate || saleBaseDate);
                        previousWeek.setDate(previousWeek.getDate() - 7);
                        setCalendarDate(toIsoDate(previousWeek));
                      }}
                      className="inline-flex h-7 w-7 items-center justify-center rounded-sm border border-[#8a8886] bg-white text-[#605e5c] transition hover:bg-[#f3f2f1]"
                      title="Mover una semana a la izquierda"
                      aria-label="Mover una semana a la izquierda"
                    >
                      <ChevronsLeft className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const nextWeek = new Date(calendarDate || saleBaseDate);
                        nextWeek.setDate(nextWeek.getDate() + 7);
                        setCalendarDate(toIsoDate(nextWeek));
                      }}
                      className="inline-flex h-7 w-7 items-center justify-center rounded-sm border border-[#8a8886] bg-white text-[#605e5c] transition hover:bg-[#f3f2f1]"
                      title="Mover una semana a la derecha"
                      aria-label="Mover una semana a la derecha"
                    >
                      <ChevronsRight className="h-4 w-4" />
                    </button>
                  </div>
                  <label className="text-[11px] text-[#605e5c]">
                    Intervalo
                    <select
                      value={slotMinutes}
                      onChange={(event) => setSlotMinutes(event.target.value === "30" ? 30 : 60)}
                      className="ml-1 h-7 rounded-sm border border-[#8a8886] px-1 text-xs"
                    >
                      <option value={60}>1 hora</option>
                      <option value={30}>30 minutos</option>
                    </select>
                  </label>
                  <label className="text-[11px] text-[#605e5c]">
                    Hora inicial
                    <input
                      type="number"
                      min={9}
                      max={19}
                      value={visibleStartHour}
                      onChange={(event) => {
                        const next = Number(event.target.value);
                        setVisibleStartHour(Math.max(9, Math.min(19, Number.isFinite(next) ? next : 9)));
                      }}
                      className="ml-1 h-7 w-14 rounded-sm border border-[#8a8886] px-1 text-xs"
                    />
                  </label>
                  <label className="text-[11px] text-[#605e5c]">
                    Hora final
                    <input
                      type="number"
                      min={9}
                      max={19}
                      value={visibleEndHour}
                      onChange={(event) => {
                        const next = Number(event.target.value);
                        setVisibleEndHour(Math.max(9, Math.min(19, Number.isFinite(next) ? next : 19)));
                      }}
                      className="ml-1 h-7 w-14 rounded-sm border border-[#8a8886] px-1 text-xs"
                    />
                  </label>
                </div>
                <div
                  className="grid min-w-[980px]"
                  style={{
                    gridTemplateColumns: `88px repeat(${Math.max(1, weekDays.length)}, minmax(170px, 1fr))`,
                  }}
                >
                  <div className="sticky top-0 z-20 border-b border-r border-[#edebe9] bg-[#faf9f8] px-2 py-2 text-[11px] font-semibold uppercase text-[#605e5c]">
                    Hora
                  </div>
                  {weekDays.map((day) => (
                    <div
                      key={day.isoDate}
                      className={`sticky top-0 z-20 border-b border-r border-[#edebe9] px-2 py-2 text-xs font-semibold text-[#323130] ${
                        day.isoDate === todayIso ? "bg-[#eaf4ff]" : "bg-[#faf9f8]"
                      }`}
                    >
                      <p className="uppercase">{day.label}</p>
                      <p className="text-[10px] font-medium text-[#605e5c]">{day.isoDate}</p>
                    </div>
                  ))}

                  {calendarSlots.map((slot) => (
                    <div key={`row-${slot.minuteOfDay}`} className="contents">
                      <div
                        className="border-b border-r border-[#edebe9] bg-[#faf9f8] px-2 py-2 text-xs font-medium text-[#605e5c]"
                      >
                        {slot.label}
                      </div>
                      {weekDays.map((day) => {
                        const key = `${day.isoDate}__${slot.minuteOfDay}`;
                        const cellLines = ticketsByCell.get(key) ?? [];
                        const fixedCellTickets = fixedTicketsByCell.get(key) ?? [];
                        const hasFixedTickets = fixedCellTickets.length > 0;
                        const hasConflicts = cellLines.some(
                          (line) => lineAvailability[line.localId] && !lineAvailability[line.localId].available
                        );

                        return (
                          <div
                            key={`${day.isoDate}-${slot.minuteOfDay}`}
                            onDragOver={(event) => {
                              if (canScheduleTickets) event.preventDefault();
                            }}
                            onDrop={(event) => handleDropInCell(event, day.isoDate, slot.hour, slot.minute)}
                            className={`min-h-[74px] border-b border-r border-[#edebe9] p-1.5 transition-colors ${
                              hasFixedTickets
                                ? "bg-[#f3f2f1]"
                                : hasConflicts
                                  ? "bg-[#fff4f4]"
                                  : day.isoDate === todayIso
                                    ? "bg-[#f8fbff]"
                                    : "bg-white"
                            } ${
                              canScheduleTickets && draggingLineId
                                ? "cursor-copy hover:bg-[#eef6ff] hover:ring-1 hover:ring-inset hover:ring-[#0078d4]/40"
                                : ""
                            }`}
                          >
                            <div className="flex min-h-[62px] flex-col gap-1">
                              {fixedCellTickets.map((ticket) => {
                                const serviceName =
                                  (ticket.service_name ?? (ticket.service_names ?? []).join(" · ")) || "Servicio";
                                const professionalName =
                                  ticket.professional_name?.trim() ||
                                  (ticket.professional_id
                                    ? professionalNameById.get(String(ticket.professional_id))
                                    : undefined) ||
                                  "Sin operaria";
                                const { startLabel, endLabel, durationMins } = getFixedTicketTimeRange(ticket);
                                const durationText =
                                  durationMins != null
                                    ? formatDurationLabel(durationMins)
                                    : "—";
                                return (
                                  <div
                                    key={`fixed-${ticket.id}`}
                                    className="rounded-sm border border-[#c8c6c4] bg-[#e1dfdd] px-2 py-1 text-left text-[11px] text-[#323130]"
                                    title="Ticket existente en agenda (no editable)"
                                  >
                                    <p className="truncate font-semibold">{serviceName}</p>
                                    <p className="mt-0.5 text-[10px] leading-snug text-[#605e5c]">
                                      <span className="font-medium text-[#323130]">
                                        {startLabel} – {endLabel}
                                      </span>
                                      <span className="text-[#605e5c]"> · {durationText}</span>
                                    </p>
                                    <p className="mt-0.5 truncate text-[10px] text-[#605e5c]">{professionalName}</p>
                                    <p className="mt-0.5 truncate text-[10px] text-[#605e5c]">
                                      {ticket.client_name || "Cliente"}
                                    </p>
                                  </div>
                                );
                              })}

                              {cellLines.map((line) => {
                                const service = servicesById.get(line.service_id);
                                const availability = lineAvailability[line.localId];
                                const lineDate = normalizeLineDate(line);
                                const startLabel = (line.time || "--:--").slice(0, 5);
                                const endLabel = getEndTimeLabelForLine(line, lineDate);
                                const durationText = formatDurationLabel(line.duration_minutes);
                                return (
                                  <article
                                    key={line.localId}
                                    draggable={canScheduleTickets}
                                    onDragStart={(event) => {
                                      if (!canScheduleTickets) return;
                                      event.dataTransfer.setData("text/plain", line.localId);
                                      event.dataTransfer.effectAllowed = "move";
                                      setDraggingLineId(line.localId);
                                    }}
                                    onDragEnd={() => setDraggingLineId(null)}
                                    className={`rounded-sm border px-2 py-1 text-left text-[11px] shadow-sm transition ${
                                      availability?.available
                                        ? "border-[#c7e0b4] bg-[#f3f9ec] text-[#234f1e]"
                                        : "border-[#f1b6b8] bg-[#fff5f5] text-[#a4262c]"
                                    } ${
                                      canScheduleTickets && draggingLineId === line.localId
                                        ? "scale-[0.98] opacity-70"
                                        : ""
                                    } ${
                                      canScheduleTickets
                                        ? "cursor-grab active:cursor-grabbing"
                                        : "cursor-default opacity-80"
                                    }`}
                                  >
                                    <div className="flex items-start justify-between gap-2">
                                      <p className="truncate font-semibold">{service?.name ?? "Servicio"}</p>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          openAvailabilityPreview(line.localId, normalizeLineDate(line))
                                        }
                                        className="rounded-sm border border-[#edebe9] bg-white/80 p-1 text-[#0078d4] hover:bg-white"
                                        title="Ver ocupación del día"
                                      >
                                        <CalendarDays className="h-3 w-3" />
                                      </button>
                                    </div>
                                    <p className="mt-0.5 text-[10px] leading-snug text-[#323130]">
                                      <span className="font-semibold">
                                        {startLabel}
                                        {endLabel ? ` – ${endLabel}` : ""}
                                      </span>
                                      <span className="text-[#605e5c]"> · {durationText}</span>
                                      {" · "}
                                      {professionalNameById.get(line.professional_id) ?? "Sin operaria"}
                                      {!availability?.available
                                        ? ` · ${availability?.conflictCount ?? 1} conflicto(s)`
                                        : ""}
                                    </p>
                                    <p className="mt-0.5 truncate text-[10px] text-[#605e5c]">
                                      Cliente: {clientDisplayName}
                                    </p>
                                    <div className="mt-1 grid grid-cols-[1fr_auto] gap-1.5">
                                      <input
                                        type="date"
                                        value={line.date}
                                        onChange={(event) =>
                                          updateLine(line.localId, { date: event.target.value || normalizeLineDate(line) })
                                        }
                                        className="h-7 rounded-sm border border-[#8a8886] bg-white px-1.5 text-[10px] text-[#323130] outline-none focus:border-[#0078d4] focus:ring-1 focus:ring-[#0078d4]/35"
                                      />
                                      <span className="inline-flex items-center rounded-sm border border-[#edebe9] bg-[#faf9f8] px-2 text-[10px] text-[#605e5c]">
                                        Fecha
                                      </span>
                                    </div>
                                    <div className="mt-1 grid grid-cols-[1fr_auto] gap-1.5">
                                      <input
                                        type="time"
                                        min="09:00"
                                        max="19:00"
                                        value={line.time}
                                        onChange={(event) =>
                                          updateLine(line.localId, {
                                            time: normalizeTimeForDate(normalizeLineDate(line), event.target.value),
                                          })
                                        }
                                        onBlur={(event) =>
                                          updateLine(line.localId, {
                                            time: normalizeTimeForDate(normalizeLineDate(line), event.target.value),
                                          })
                                        }
                                        disabled={line.without_time}
                                        className="h-7 rounded-sm border border-[#8a8886] bg-white px-1.5 text-[10px] text-[#323130] outline-none focus:border-[#0078d4] focus:ring-1 focus:ring-[#0078d4]/35 disabled:bg-[#f3f2f1]"
                                      />
                                      <select
                                        value={line.professional_id}
                                        onChange={(event) =>
                                          updateLine(line.localId, { professional_id: event.target.value })
                                        }
                                        className="h-7 rounded-sm border border-[#8a8886] bg-white px-1.5 text-[10px] text-[#323130] outline-none focus:border-[#0078d4] focus:ring-1 focus:ring-[#0078d4]/35"
                                      >
                                        <option value="">Operaria…</option>
                                        {professionals.map((professional) => (
                                          <option key={professional.id} value={String(professional.id)}>
                                            {professional.username}
                                          </option>
                                        ))}
                                      </select>
                                    </div>
                                  </article>
                                );
                              })}

                              {cellLines.length === 0 && fixedCellTickets.length === 0 ? (
                                <p className="mt-auto text-center text-[10px] text-[#a19f9d]">
                                  Suelta ticket aqui
                                </p>
                              ) : null}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </section>
            </div>
          )}
        </div>
      </div>

      <div className="fixed bottom-6 right-44 z-[42] flex gap-3">
      
        <button
          type="button"
          disabled
          className="flex h-14 min-w-14 items-center justify-center rounded-full bg-[#323130] px-4 text-sm font-semibold text-white shadow-lg shadow-slate-900/25"
          aria-label={`Total a cobrar Bs ${total.toFixed(2)}`}
          title={`Total a cobrar: Bs ${total.toFixed(2)}`}
        >
          Bs {total.toFixed(2)}
        </button>
        <button
          type="button"
          onClick={handleConfirmSaleFlow}
          disabled={isSubmitting || cartLines.length === 0}
          className={`flex h-14 min-w-14 items-center justify-center rounded-full px-4 text-sm font-semibold text-white shadow-lg shadow-slate-900/25 transition-all focus:outline-none focus-visible:ring-2 ${
            isSubmitting || cartLines.length === 0
              ? "cursor-not-allowed bg-[#a19f9d] focus-visible:ring-[#a19f9d]"
              : "bg-[#0078d4] hover:bg-[#005a9e] focus-visible:ring-[#0078d4]"
          }`}
          aria-label={primaryActionLabel}
          title={primaryActionLabel}
        >
          {isSubmitting ? (
            <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
          ) : (
            <>
              <CheckCircle2 className="h-7 w-7" />
            </>
          )}
        </button>
      </div>

      <div className="fixed bottom-6 right-6 z-[42] flex items-center gap-3">
        <button
          type="button"
          onClick={() => setIsSaleDrawerOpen(true)}
          className={`relative flex h-14 min-w-14 items-center justify-center rounded-full bg-[#0078d4] text-white shadow-lg shadow-slate-900/25 transition-all hover:bg-[#005a9e] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0078d4] ${
            animateCart ? "scale-125 bg-emerald-500" : "scale-100"
          }`}
          aria-label={`Detalle de la venta: ${cartCount} servicios seleccionados`}
        >
          <ShoppingCart className="h-6 w-6" />
          <span className="absolute -right-0.5 -top-0.5 flex h-6 min-w-6 items-center justify-center rounded-full bg-emerald-600 px-1.5 text-xs font-bold text-white ring-2 ring-white">
            {cartCount}
          </span>
        </button>
      </div>

      <PosSaleDrawer
        isOpen={isSaleDrawerOpen}
        onClose={() => setIsSaleDrawerOpen(false)}
        cartLines={cartLines}
        services={services}
        subtotal={_subtotal}
        total={total}
        onRemoveLine={onRemoveLine}
        onChangeLineService={(localId, serviceId) => {
          const selectedService = services.find((service) => String(service.id) === serviceId);
          if (!selectedService) return;
          updateLine(localId, {
            service_id: String(selectedService.id),
            duration_minutes: selectedService.duration_minutes,
            price: Number(selectedService.price ?? 0),
          });
        }}
        onAddServiceById={(serviceId) => {
          const selectedService = services.find((service) => String(service.id) === serviceId);
          if (!selectedService) return;
          onAddServiceToCart(selectedService);
        }}
        clientComboboxRef={clientComboboxRef}
        clientSearch={clientSearch}
        setClientSearch={setClientSearch}
        setClientId={setClientId}
        isClientMenuOpen={isClientMenuOpen}
        setIsClientMenuOpen={setIsClientMenuOpen}
        filteredClients={filteredClients}
        selectedClient={selectedClient}
        clientPhone={clientPhone}
        clientAddress={clientAddress}
        sellerId={sellerId}
        setSellerId={setSellerId}
        discountValue={discountValue}
        setDiscountValue={setDiscountValue}
        discountType={discountType}
        setDiscountType={setDiscountType}
        paymentMethod={paymentMethod}
        setPaymentMethod={setPaymentMethod}
        notes={notes}
        setNotes={setNotes}
        onOpenRegisterClient={onOpenRegisterClient}
        professionals={professionals}
        primaryActionLabel={primaryActionLabel}
        onPrimaryAction={() => {
          setIsSaleDrawerOpen(false);
          handleConfirmSaleFlow();
        }}
        primaryActionDisabled={isSubmitting || cartCount === 0}
        footerHint={
          editingSaleCode
            ? "Guarda cambios para actualizar la venta."
            : "Confirma venta para guardar en base de datos y actualizar cache local."
        }
      />
    </div>
  );
}
