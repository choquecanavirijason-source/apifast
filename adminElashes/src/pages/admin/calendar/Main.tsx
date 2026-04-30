import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import { CalendarDays, Printer } from "lucide-react";
import { toast } from "react-toastify";
import { AgendaService, type ProfessionalForSelect, type TicketItem } from "../../../core/services/agenda/agenda.service";
import Layout from "../../../components/common/layout";
import { Button, SectionCard } from "../../../components/common/ui";
import GenericModal from "../../../components/common/modal/GenericModal";
import { BRANCH_STORAGE_KEY, getSelectedBranchId } from "../../../core/utils/branch";
import PosPage from "../pos/Main";
import { getLocalDateInputValue } from "./calendar.utils";
import PendingTicketsPanel from "./components/PendingTicketsPanel";
import CalendarControlsBar from "./components/CalendarControlsBar";

export type CalendarPageProps = { embedded?: boolean };

const toIsoDate = (value: Date) => value.toISOString().slice(0, 10);
const toTimeValue = (hour: number, minute: number) => `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
const toLocalDateTimeValue = (value: Date) =>
  `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}T${toTimeValue(
    value.getHours(),
    value.getMinutes()
  )}:00`;
const moneyFormatter = new Intl.NumberFormat("es-BO", {
  style: "currency",
  currency: "BOB",
  maximumFractionDigits: 2,
});
const parseTicketDate = (value: string) => {
  if (!value) return new Date("");
  const hasTimezone = /[zZ]|[+-]\d{2}:\d{2}$/.test(value);
  if (hasTimezone) return new Date(value);
  const [datePart, timePartRaw = "00:00:00"] = value.split("T");
  const [year, month, day] = datePart.split("-").map(Number);
  const [hour, minute, second] = timePartRaw.split(":").map(Number);
  return new Date(year, (month || 1) - 1, day || 1, hour || 0, minute || 0, second || 0);
};
const startOfWeek = (dateText: string) => {
  const base = new Date(`${dateText}T00:00:00`);
  const day = base.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(base);
  monday.setDate(base.getDate() + diff);
  return monday;
};
const normalizeSearchText = (value: string) => value.trim().toLowerCase();

export default function CalendarPage({ embedded = false }: CalendarPageProps) {
  const fullscreenRef = useRef<HTMLDivElement>(null);
  const draggingTicketIdRef = useRef<number | null>(null);
  const calendarScrollRef = useRef<HTMLElement | null>(null);
  const [tickets, setTickets] = useState<TicketItem[]>([]);
  const [professionals, setProfessionals] = useState<ProfessionalForSelect[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedDate] = useState(getLocalDateInputValue());
  const [ticketSearch, setTicketSearch] = useState("");
  const [jumpSearch, setJumpSearch] = useState("");
  const [ticketStatusFilter, setTicketStatusFilter] = useState<string>("all");
  const [activeBranchId, setActiveBranchId] = useState<number | null>(() => getSelectedBranchId());
  const [calendarDate, setCalendarDate] = useState(getLocalDateInputValue());
  const [visibleStartHour, setVisibleStartHour] = useState(7);
  const [visibleEndHour, setVisibleEndHour] = useState(20);
  const [slotMinutes, setSlotMinutes] = useState<60 | 30 | 15>(30);
  const [quickSaleOpen, setQuickSaleOpen] = useState(false);
  const [draggingTicketId, setDraggingTicketId] = useState<number | null>(null);
  const [dragOverCellKey, setDragOverCellKey] = useState<string | null>(null);
  const [isUpdatingTicketId, setIsUpdatingTicketId] = useState<number | null>(null);
  const [isPendingDrawerOpen, setIsPendingDrawerOpen] = useState(true);

  const loadTickets = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await AgendaService.listTickets({
        limit: 500,
        branch_id: activeBranchId ?? undefined,
      });
      setTickets(data);
    } catch (error) {
      console.error("Error cargando calendario:", error);
      toast.error("No se pudieron cargar las citas del calendario.");
      setTickets([]);
    } finally {
      setIsLoading(false);
    }
  }, [activeBranchId]);

  useEffect(() => {
    void loadTickets();
  }, [loadTickets]);

  useEffect(() => {
    const loadProfessionals = async () => {
      try {
        const data = await AgendaService.listProfessionalsForSelect({ limit: 200 });
        setProfessionals(data);
      } catch (error) {
        console.error("Error cargando operarias:", error);
        setProfessionals([]);
      }
    };
    void loadProfessionals();
  }, []);

  useEffect(() => {
    const handleChange = () => setActiveBranchId(getSelectedBranchId());
    const handleStorage = (event: StorageEvent) => {
      if (event.key === BRANCH_STORAGE_KEY) {
        handleChange();
      }
    };
    window.addEventListener("storage", handleStorage);
    window.addEventListener("branchchange", handleChange);
    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("branchchange", handleChange);
    };
  }, []);

  const filteredTickets = useMemo(() => {
    return tickets.filter((ticket) => {
      return ticketStatusFilter === "all" || ticket.status === ticketStatusFilter;
    });
  }, [tickets, ticketStatusFilter]);

  const ticketStatusOptions = useMemo(() => {
    const uniqueStatuses = Array.from(new Set(tickets.map((ticket) => ticket.status).filter(Boolean)));
    return uniqueStatuses.sort((a, b) => a.localeCompare(b, "es"));
  }, [tickets]);

  const ticketSearchSuggestions = useMemo(() => {
    const values = new Set<string>();
    tickets.forEach((ticket) => {
      if (ticket.ticket_code?.trim()) values.add(ticket.ticket_code.trim());
      if (ticket.client_name?.trim()) values.add(ticket.client_name.trim());
      if (ticket.ticket_code?.trim() && ticket.client_name?.trim()) {
        values.add(`${ticket.ticket_code.trim()} · ${ticket.client_name.trim()}`);
      }
    });
    return Array.from(values).sort((a, b) => a.localeCompare(b, "es"));
  }, [tickets]);

  const matchedSearchTicket = useMemo(() => {
    const query = normalizeSearchText(jumpSearch);
    if (!query) return null;
    const matches = tickets.filter((ticket) => {
      const ticketCode = normalizeSearchText(ticket.ticket_code ?? "");
      const clientName = normalizeSearchText(ticket.client_name ?? "");
      const combined = normalizeSearchText(`${ticket.ticket_code ?? ""} · ${ticket.client_name ?? ""}`);
      const ticketId = String(ticket.id);
      return (
        ticketCode.includes(query) ||
        clientName.includes(query) ||
        combined.includes(query) ||
        ticketId.includes(query)
      );
    });
    if (!matches.length) return null;
    return matches.sort((a, b) => a.start_time.localeCompare(b.start_time))[0];
  }, [jumpSearch, tickets]);

  useEffect(() => {
    if (!matchedSearchTicket) return;
    const start = parseTicketDate(matchedSearchTicket.start_time);
    if (Number.isNaN(start.getTime())) return;
    const weekMonday = startOfWeek(toIsoDate(start));
    const nextCalendarDate = toIsoDate(weekMonday);
    if (calendarDate !== nextCalendarDate) {
      setCalendarDate(nextCalendarDate);
    }
  }, [calendarDate, matchedSearchTicket]);

  useEffect(() => {
    if (!matchedSearchTicket) return;
    const start = parseTicketDate(matchedSearchTicket.start_time);
    if (Number.isNaN(start.getTime())) return;
    const minuteOfDay = start.getHours() * 60 + start.getMinutes();
    const normalizedMinute =
      slotMinutes === 15
        ? Math.floor(minuteOfDay / 15) * 15
        : slotMinutes === 30
          ? Math.floor(minuteOfDay / 30) * 30
          : Math.floor(minuteOfDay / 60) * 60;
    const cellKey = `${toIsoDate(start)}__${normalizedMinute}`;
    const scrollToCell = () => {
      const target = calendarScrollRef.current?.querySelector<HTMLElement>(`[data-slot-key="${cellKey}"]`);
      if (target) {
        target.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
      }
    };
    const frame = window.requestAnimationFrame(scrollToCell);
    return () => window.cancelAnimationFrame(frame);
  }, [matchedSearchTicket, slotMinutes, calendarDate]);

  const weekStart = useMemo(() => startOfWeek(calendarDate || selectedDate), [calendarDate, selectedDate]);
  const weekDays = useMemo(() => {
    const formatter = new Intl.DateTimeFormat("es-BO", { weekday: "short", day: "2-digit", month: "2-digit" });
    return Array.from({ length: 7 }, (_, index) => {
      const date = new Date(weekStart);
      date.setDate(weekStart.getDate() + index);
      return {
        isoDate: toIsoDate(date),
        label: formatter.format(date).replace(".", ""),
      };
    });
  }, [weekStart]);

  const calendarSlots = useMemo(() => {
    const start = Math.max(0, Math.min(23, visibleStartHour));
    const end = Math.max(start, Math.min(23, visibleEndHour));
    const slots: Array<{ hour: number; minute: number; minuteOfDay: number; label: string }> = [];
    for (let hour = start; hour <= end; hour += 1) {
      if (slotMinutes === 60) {
        slots.push({ hour, minute: 0, minuteOfDay: hour * 60, label: toTimeValue(hour, 0) });
      } else if (slotMinutes === 30) {
        slots.push({ hour, minute: 0, minuteOfDay: hour * 60, label: toTimeValue(hour, 0) });
        slots.push({ hour, minute: 30, minuteOfDay: hour * 60 + 30, label: toTimeValue(hour, 30) });
      } else {
        slots.push({ hour, minute: 0, minuteOfDay: hour * 60, label: toTimeValue(hour, 0) });
        slots.push({ hour, minute: 15, minuteOfDay: hour * 60 + 15, label: toTimeValue(hour, 15) });
        slots.push({ hour, minute: 30, minuteOfDay: hour * 60 + 30, label: toTimeValue(hour, 30) });
        slots.push({ hour, minute: 45, minuteOfDay: hour * 60 + 45, label: toTimeValue(hour, 45) });
      }
    }
    return slots;
  }, [slotMinutes, visibleEndHour, visibleStartHour]);
  const now = new Date();
  const todayKey = toIsoDate(now);
  const currentMinuteOfDay = now.getHours() * 60 + now.getMinutes();

  const pendingTickets = useMemo(() => {
    return filteredTickets.filter((ticket) => {
      const status = (ticket.status ?? "").toLowerCase();
      return status === "pending" || status === "in_service";
    });
  }, [filteredTickets]);

  const ticketsByCell = useMemo(() => {
    const grouped = new Map<string, TicketItem[]>();
    tickets.forEach((ticket) => {
      const start = parseTicketDate(ticket.start_time);
      if (Number.isNaN(start.getTime())) return;
      const dateKey = toIsoDate(start);
      if (!weekDays.some((day) => day.isoDate === dateKey)) return;
      const minuteOfDay = start.getHours() * 60 + start.getMinutes();
      const normalizedMinute =
        slotMinutes === 15
          ? Math.floor(minuteOfDay / 15) * 15
          : slotMinutes === 30
            ? Math.floor(minuteOfDay / 30) * 30
            : Math.floor(minuteOfDay / 60) * 60;
      const key = `${dateKey}__${normalizedMinute}`;
      const existing = grouped.get(key) ?? [];
      grouped.set(key, [...existing, ticket].sort((a, b) => a.start_time.localeCompare(b.start_time)));
    });
    return grouped;
  }, [tickets, slotMinutes, weekDays]);

  const handlePrintCalendar = () => {
    window.print();
  };

  const updateTicket = useCallback(
    async (ticketId: number, payload: { date?: string; time?: string; professional_id?: number | null; status?: string }) => {
      const ticket = tickets.find((item) => item.id === ticketId);
      if (!ticket) return;
      const baseStart = parseTicketDate(ticket.start_time);
      const baseEnd = parseTicketDate(ticket.end_time);
      const durationMs = !Number.isNaN(baseStart.getTime()) && !Number.isNaN(baseEnd.getTime())
        ? Math.max(30 * 60 * 1000, baseEnd.getTime() - baseStart.getTime())
        : 60 * 60 * 1000;
      const nextDate = payload.date ?? toIsoDate(baseStart);
      const nextTime = payload.time ?? toTimeValue(baseStart.getHours(), baseStart.getMinutes());
      const [year, month, day] = nextDate.split("-").map(Number);
      const [hour, minute] = nextTime.split(":").map(Number);
      const nextStart = new Date(year, (month || 1) - 1, day || 1, hour || 0, minute || 0, 0);
      const nextEnd = new Date(nextStart.getTime() + durationMs);

      setIsUpdatingTicketId(ticketId);
      try {
        await AgendaService.updateAppointment(ticketId, {
          start_time: toLocalDateTimeValue(nextStart),
          end_time: toLocalDateTimeValue(nextEnd),
          professional_id: payload.professional_id,
          status: payload.status,
        });
        await loadTickets();
        toast.success("Ticket actualizado.");
      } catch (error) {
        console.error("Error actualizando ticket:", error);
        toast.error("No se pudo actualizar el ticket.");
      } finally {
        setIsUpdatingTicketId(null);
        setDraggingTicketId(null);
      }
    },
    [loadTickets, tickets]
  );

  const handleDropInCell = (event: DragEvent<HTMLDivElement>, dateKey: string, hour: number, minute: number) => {
    event.preventDefault();
    if (isUpdatingTicketId != null) return;
    const raw = event.dataTransfer.getData("text/plain");
    const fallbackId = draggingTicketIdRef.current ?? draggingTicketId;
    const ticketId = Number(raw || fallbackId);
    if (!Number.isFinite(ticketId)) return;
    const ticket = tickets.find((item) => item.id === ticketId);
    if (!ticket) return;
    setDragOverCellKey(null);
    void updateTicket(ticketId, { date: dateKey, time: toTimeValue(hour, minute) });
  };

  const handleDragStartTicket = (event: DragEvent<HTMLElement>, ticketId: number) => {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", String(ticketId));
    draggingTicketIdRef.current = ticketId;
    setDraggingTicketId(ticketId);
  };

  const handleDragEndTicket = () => {
    draggingTicketIdRef.current = null;
    setDraggingTicketId(null);
    setDragOverCellKey(null);
  };

  const getTicketDurationLabel = (ticket: TicketItem) => {
    const start = parseTicketDate(ticket.start_time);
    const end = parseTicketDate(ticket.end_time);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return "60 min";
    const mins = Math.max(1, Math.round((end.getTime() - start.getTime()) / 60000));
    if (mins >= 60) {
      const h = Math.floor(mins / 60);
      const rest = mins % 60;
      return rest ? `${h}h ${rest}m` : `${h}h`;
    }
    return `${mins} min`;
  };

  const getTicketStatusCardClass = (status?: string | null) => {
    const normalized = (status ?? "").toLowerCase();
    if (normalized === "pending") return "border-amber-300 bg-amber-50";
    if (normalized === "completed") return "border-emerald-300 bg-emerald-50";
    if (normalized === "cancelled") return "border-rose-300 bg-rose-50";
    return "border-[#c7e0b4] bg-[#f3f9ec]";
  };

  const getTicketStatusTextClass = (status?: string | null) => {
    const normalized = (status ?? "").toLowerCase();
    if (normalized === "pending") return "text-amber-800";
    if (normalized === "completed") return "text-emerald-800";
    if (normalized === "cancelled") return "text-rose-800";
    return "text-[#094732]";
  };

  const getTicketPriceLabel = (ticket: TicketItem) => {
    if (ticket.service_prices?.length) {
      const total = ticket.service_prices.reduce((sum, price) => sum + (Number.isFinite(price) ? price : 0), 0);
      return moneyFormatter.format(total);
    }
    if (typeof ticket.service_price === "number" && Number.isFinite(ticket.service_price)) {
      return moneyFormatter.format(ticket.service_price);
    }
    return "Sin precio";
  };

  const getTicketServiceSummary = (ticket: TicketItem) => {
    const services = ticket.service_names?.filter(Boolean) ?? [];
    if (services.length > 1) return `${services[0]} +${services.length - 1}`;
    if (services.length === 1) return services[0];
    return ticket.service_name ?? "Sin servicio";
  };

  const professionalMap = useMemo(
    () => new Map(professionals.map((professional) => [professional.id, professional.username])),
    [professionals]
  );

  const layoutPageClass = embedded
    ? "!min-h-0 flex flex-1 flex-col !bg-transparent !p-0 h-full"
    : undefined;
  const layoutContainerClass = embedded
    ? "!border-0 !shadow-none !rounded-none flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden bg-transparent !p-0 max-w-none"
    : undefined;

  return (
    <div ref={fullscreenRef} className="h-full min-h-0 w-full overflow-y-auto bg-transparent">
      <Layout
        title={embedded ? undefined : "Calendario de Citas"}
        subtitle={embedded ? undefined : "Consulta las citas y tickets programados por fecha."}
        variant="table"
        pageClassName={layoutPageClass}
        containerClassName={layoutContainerClass}
        topContent={
          <SectionCard className="border border-[#d2d0ce] bg-[#faf9f8]">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center">
                <div className="flex h-8 w-8 items-center justify-center rounded-md border border-[#c7e0f4] bg-[#deecf9] text-[#005a9e] shadow-sm">
                  <CalendarDays className="h-4 w-4" />
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-1.5 rounded-md border border-[#edebe9] bg-white/80 p-1">
               
                <Button type="button" variant="secondary" size="sm" onClick={handlePrintCalendar} className="h-8 px-2.5 text-xs shadow-sm">
                  <Printer className="h-3.5 w-3.5" />
                  Imprimir calendario
                </Button>
              </div>
            </div>
          </SectionCard>
        }
      >
        <div
          className={`grid min-h-[72vh] ${isPendingDrawerOpen ? "gap-4 xl:grid-cols-[360px_minmax(0,1fr)]" : "gap-2 xl:grid-cols-[0px_minmax(0,1fr)]"}`}
        >
          <PendingTicketsPanel
            isOpen={isPendingDrawerOpen}
            isLoading={isLoading}
            pendingTickets={pendingTickets}
            selectedDate={selectedDate}
            ticketSearch={ticketSearch}
            ticketStatusFilter={ticketStatusFilter}
            ticketStatusOptions={ticketStatusOptions}
            draggingTicketId={draggingTicketId}
            isUpdatingTicketId={isUpdatingTicketId}
            professionals={professionals}
            onTicketSearchChange={setTicketSearch}
            onTicketStatusFilterChange={setTicketStatusFilter}
            onDragStartTicket={handleDragStartTicket}
            onDragEndTicket={handleDragEndTicket}
            onUpdateTicket={updateTicket}
            parseTicketDate={parseTicketDate}
            toIsoDate={toIsoDate}
            toTimeValue={toTimeValue}
            getTicketStatusCardClass={getTicketStatusCardClass}
            getTicketStatusTextClass={getTicketStatusTextClass}
            getTicketServiceSummary={getTicketServiceSummary}
            getTicketPriceLabel={getTicketPriceLabel}
          />

          <section ref={calendarScrollRef as React.RefObject<HTMLElement>} className="min-h-0 overflow-auto rounded-sm border border-[#edebe9] bg-white">
            <CalendarControlsBar
              jumpSearch={jumpSearch}
              ticketSearchSuggestions={ticketSearchSuggestions}
              isPendingDrawerOpen={isPendingDrawerOpen}
              slotMinutes={slotMinutes}
              visibleStartHour={visibleStartHour}
              visibleEndHour={visibleEndHour}
              onJumpSearchChange={setJumpSearch}
              onClearJumpSearch={() => {
                setJumpSearch("");
              }}
              onTogglePendingDrawer={() => setIsPendingDrawerOpen((prev) => !prev)}
              onGoPrevWeek={() => {
                const previous = new Date(weekStart);
                previous.setDate(weekStart.getDate() - 7);
                setCalendarDate(toIsoDate(previous));
              }}
              onGoNextWeek={() => {
                const next = new Date(weekStart);
                next.setDate(weekStart.getDate() + 7);
                setCalendarDate(toIsoDate(next));
              }}
              onSlotMinutesChange={setSlotMinutes}
              onVisibleStartHourChange={setVisibleStartHour}
              onVisibleEndHourChange={setVisibleEndHour}
            />

            <div
              className="grid min-w-[1060px] bg-white"
              style={{ gridTemplateColumns: `88px repeat(${Math.max(1, weekDays.length)}, minmax(180px, 1fr))` }}
            >
              <div className="sticky top-0 z-20 border-b border-r border-[#edebe9] bg-[#f3f2f1] px-2 py-2 text-[11px] font-semibold uppercase text-[#605e5c]">
                Hora
              </div>
              {weekDays.map((day) => (
                <div
                  key={day.isoDate}
                  className={`sticky top-0 z-20 border-b border-r border-[#edebe9] px-2 py-2 text-xs font-semibold ${
                    day.isoDate === todayKey ? "bg-[#deecf9] text-[#004578]" : "bg-[#f3f2f1]"
                  }`}
                >
                  <p className="uppercase">{day.label}</p>
                  <p className="text-[10px] font-medium text-[#605e5c]">{day.isoDate}</p>
                </div>
              ))}

              {calendarSlots.map((slot) => (
                <div key={`row-${slot.minuteOfDay}`} className="contents">
                  <div
                    className={`border-b border-r border-[#edebe9] px-2 py-2 text-xs font-semibold tabular-nums ${
                      slot.minute === 0
                        ? "bg-[#f3f2f1] text-[#323130]"
                        : slotMinutes === 15 && (slot.minute === 15 || slot.minute === 45)
                          ? "bg-[#fcfcfb] text-[#a19f9d]"
                          : "bg-[#faf9f8] text-[#8a8886]"
                    }`}
                  >
                    <span className={slot.minute === 0 ? "" : "opacity-80"}>{slot.label}</span>
                  </div>
                  {weekDays.map((day) => {
                    const key = `${day.isoDate}__${slot.minuteOfDay}`;
                    const cellTickets = ticketsByCell.get(key) ?? [];
                    const isActiveDropCell = dragOverCellKey === key;
                    const isTodayColumn = day.isoDate === todayKey;
                    const isCurrentHourRow =
                      isTodayColumn &&
                      currentMinuteOfDay >= slot.minuteOfDay &&
                      currentMinuteOfDay < slot.minuteOfDay + slotMinutes;
                    return (
                      <div
                        key={`${day.isoDate}-${slot.minuteOfDay}`}
                        data-slot-key={key}
                        onDragOver={(event) => {
                          event.preventDefault();
                          if (draggingTicketId != null) setDragOverCellKey(key);
                        }}
                        onDragEnter={() => {
                          if (draggingTicketId != null) setDragOverCellKey(key);
                        }}
                        onDragLeave={() => {
                          if (dragOverCellKey === key) setDragOverCellKey(null);
                        }}
                        onDrop={(event) => {
                          handleDropInCell(event, day.isoDate, slot.hour, slot.minute);
                        }}
                        className={`border-b border-r border-[#edebe9] p-1.5 transition ${
                          draggingTicketId
                            ? isActiveDropCell
                              ? "cursor-copy bg-[#deecf9] ring-1 ring-inset ring-[#0078d4]/45"
                              : "cursor-copy hover:bg-[#eef6ff]"
                            : isCurrentHourRow
                              ? "bg-[#fff4ce]/60"
                              : isTodayColumn
                                ? "bg-[#fafcff]"
                                : "bg-white"
                        } ${slotMinutes === 15 ? "min-h-[64px]" : slotMinutes === 30 ? "min-h-[82px]" : "min-h-[96px]"}`}
                      >
                        <div className={`flex flex-col gap-1 ${slotMinutes === 15 ? "min-h-[56px]" : slotMinutes === 30 ? "min-h-[70px]" : "min-h-[84px]"}`}>
                          {cellTickets.map((ticket) => {
                            const start = parseTicketDate(ticket.start_time);
                            const timeText = Number.isNaN(start.getTime()) ? "--:--" : toTimeValue(start.getHours(), start.getMinutes());
                            const timeValue = Number.isNaN(start.getTime()) ? "09:00" : toTimeValue(start.getHours(), start.getMinutes());
                            return (
                              <article
                                key={ticket.id}
                                draggable={isUpdatingTicketId !== ticket.id}
                                onDragStart={(event) => handleDragStartTicket(event, ticket.id)}
                                onDragEnd={handleDragEndTicket}
                                className={`rounded-sm border px-2 py-1 text-[11px] shadow-sm ${getTicketStatusCardClass(ticket.status)} ${
                                  draggingTicketId === ticket.id ? "scale-[0.99] opacity-80 ring-1 ring-[#0078d4]/40" : ""
                                }`}
                              >
                                <div className="flex items-start justify-between gap-1">
                                  <p className={`truncate font-semibold ${getTicketStatusTextClass(ticket.status)}`}>
                                    {ticket.ticket_code ?? `#${ticket.id}`} · {ticket.client_name}
                                  </p>
                                  <span className={`rounded-full px-1 py-0.5 text-[9px] font-semibold capitalize ${getTicketStatusTextClass(ticket.status)} bg-white/85`}>
                                    {ticket.status}
                                  </span>
                                </div>
                                <p className="truncate text-[10px] text-[#605e5c]">
                                  {timeText} · {getTicketDurationLabel(ticket)} · {professionalMap.get(ticket.professional_id ?? -1) ?? "Sin operaria"}
                                </p>
                                <p className="truncate text-[10px] text-[#605e5c]">
                                  {getTicketServiceSummary(ticket)} · {getTicketPriceLabel(ticket)}
                                </p>
                                {ticket.branch_name ? <p className="truncate text-[10px] text-[#8a8886]">{ticket.branch_name}</p> : null}
                                <div className="mt-1 grid grid-cols-3 gap-1">
                                  <input
                                    type="time"
                                    value={timeValue}
                                    onChange={(event) => void updateTicket(ticket.id, { time: event.target.value })}
                                    className="h-6 rounded-sm border border-[#8a8886] bg-white px-1 text-[10px]"
                                  />
                                  <select
                                    value={ticket.professional_id ?? ""}
                                    onChange={(event) =>
                                      void updateTicket(ticket.id, {
                                        professional_id: event.target.value ? Number(event.target.value) : null,
                                      })
                                    }
                                    className="h-6 rounded-sm border border-[#8a8886] bg-white px-1 text-[10px]"
                                  >
                                    <option value="">Operaria…</option>
                                    {professionals.map((professional) => (
                                      <option key={professional.id} value={professional.id}>
                                        {professional.username}
                                      </option>
                                    ))}
                                  </select>
                                  <select
                                    value={ticket.status}
                                    onChange={(event) => void updateTicket(ticket.id, { status: event.target.value })}
                                    className="h-6 rounded-sm border border-[#8a8886] bg-white px-1 text-[10px]"
                                  >
                                    {ticketStatusOptions.map((status) => (
                                      <option key={status} value={status}>
                                        {status}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                              </article>
                            );
                          })}
                          {cellTickets.length === 0 ? (
                            <p className="mt-auto text-center text-[10px] text-[#a19f9d]">
                              {isCurrentHourRow ? "Hora actual" : "Suelta ticket aqui"}
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
      </Layout>

      <GenericModal
        isOpen={quickSaleOpen}
        onClose={() => setQuickSaleOpen(false)}
        title={`Asignar ticket y venta rápida · ${selectedDate}`}
        size="xl"
        contentClassName="!max-w-[96vw] xl:!max-w-[92vw] !max-h-[95vh]"
        bodyClassName="!overflow-y-auto"
      >
        <div className="min-h-[78vh]">
          <PosPage embedded initialDate={selectedDate} />
        </div>
      </GenericModal>
    </div>
  );
}
