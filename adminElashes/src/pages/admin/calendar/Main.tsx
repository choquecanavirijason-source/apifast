import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { CalendarDays, Maximize2, Minimize2, ShoppingCart } from "lucide-react";
import { toast } from "react-toastify";
import { AgendaService, type TicketItem } from "../../../core/services/agenda/agenda.service";
import Layout from "../../../components/common/layout";
import { Button, SectionCard } from "../../../components/common/ui";
import GenericModal from "../../../components/common/modal/GenericModal";
import { BRANCH_STORAGE_KEY, getSelectedBranchId } from "../../../core/utils/branch";
import PosPage from "../pos/Main";

import AgendaByHourPanel from "./components/AgendaByHourPanel";
import AgendaByHourModal from "./components/AgendaByHourModal";
import DayTicketsPanel from "./components/DayTicketsPanel";
import MonthCalendar from "./components/MonthCalendar";
import {
  computeSlotsForDay,
  formatDayKey,
  getLocalDateInputValue,
  startOfCalendarGrid,
} from "./calendar.utils";

export type CalendarPageProps = { embedded?: boolean };

export default function CalendarPage({ embedded = false }: CalendarPageProps) {
  const fullscreenRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const location = useLocation();
  const [tickets, setTickets] = useState<TicketItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState(getLocalDateInputValue());
  const [agendaStatusFilter, setAgendaStatusFilter] = useState<"all" | "available" | "occupied" | "cancelled">("all");
  const [searchStartDate, setSearchStartDate] = useState("");
  const [searchEndDate, setSearchEndDate] = useState("");
  const [activeBranchId, setActiveBranchId] = useState<number | null>(() => getSelectedBranchId());
  const [currentMonth, setCurrentMonth] = useState(() => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), 1);
  });
  const [agendaModalOpen, setAgendaModalOpen] = useState(false);
  const [quickSaleOpen, setQuickSaleOpen] = useState(false);

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

  const ticketsByDay = useMemo(() => {
    return tickets.reduce<Record<string, TicketItem[]>>((acc, ticket) => {
      const key = ticket.start_time.slice(0, 10);
      acc[key] = [...(acc[key] ?? []), ticket].sort((a, b) => a.start_time.localeCompare(b.start_time));
      return acc;
    }, {});
  }, [tickets]);

  const calendarDays = useMemo(() => {
    const start = startOfCalendarGrid(currentMonth);
    return Array.from({ length: 42 }, (_, index) => {
      const date = new Date(start);
      date.setDate(start.getDate() + index);
      return date;
    });
  }, [currentMonth]);

  const monthDaySlotCounts = useMemo(() => {
    const map: Record<string, { free: number; busy: number; cancel: number }> = {};
    for (const date of calendarDays) {
      const key = formatDayKey(date);
      const slots = computeSlotsForDay(key, ticketsByDay[key] ?? []);
      map[key] = {
        free: slots.filter((s) => s.status === "available").length,
        busy: slots.filter((s) => s.status === "occupied").length,
        cancel: slots.filter((s) => s.status === "cancelled").length,
      };
    }
    return map;
  }, [calendarDays, ticketsByDay]);

  const selectedDayTickets = useMemo(() => {
    let ticketsList = [...(ticketsByDay[selectedDate] ?? [])];
    if (searchStartDate && searchEndDate) {
      ticketsList = tickets.filter((ticket) => {
        const ticketDate = ticket.start_time.slice(0, 10);
        return ticketDate >= searchStartDate && ticketDate <= searchEndDate;
      });
    }
    return ticketsList.sort((a, b) => a.start_time.localeCompare(b.start_time));
  }, [selectedDate, ticketsByDay, searchStartDate, searchEndDate, tickets]);

  const selectedDaySchedule = useMemo(
    () => computeSlotsForDay(selectedDate, selectedDayTickets),
    [selectedDate, selectedDayTickets]
  );

  const availableSlots = selectedDaySchedule.filter((slot) => slot.status === "available").length;
  const occupiedSlots = selectedDaySchedule.filter((slot) => slot.status === "occupied").length;
  const cancelledSlots = selectedDaySchedule.filter((slot) => slot.status === "cancelled").length;

  const path = location.pathname;
  const isCitasView = path.endsWith("/citas");
  const isAgendaView = path.endsWith("/agenda");
  const showCitas = !isAgendaView;
  const showAgenda = !isCitasView;
  const showAgendaDatePicker = !showCitas;
  const showAgendaInline = showAgenda && !showCitas;
  const openAgendaModalForDate = (dateKey: string) => {
    setSelectedDate(dateKey);
    setAgendaModalOpen(true);
  };

  const filteredAgendaSchedule = useMemo(() => {
    if (agendaStatusFilter === "all") return selectedDaySchedule;
    return selectedDaySchedule.filter((slot) => slot.status === agendaStatusFilter);
  }, [agendaStatusFilter, selectedDaySchedule]);

  const handleFullscreen = () => {
    if (fullscreenRef.current) {
      if (isFullscreen) {
        void document.exitFullscreen();
      } else {
        void fullscreenRef.current.requestFullscreen();
      }
    }
  };

  useEffect(() => {
    const onFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

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
          <SectionCard className="border border-emerald-100 bg-emerald-50/60">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-emerald-100 p-2 text-[#094732]">
                  <CalendarDays className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-semibold text-slate-800">Calendario operativo</p>
                  <p className="text-sm text-slate-600">
                    Toca un día en el calendario para abrir la agenda por horas en pantalla grande. Los indicadores L / O / C son libres, ocupados y
                    cancelados.
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" size="sm" onClick={() => setQuickSaleOpen(true)}>
                  <ShoppingCart className="h-4 w-4" />
                  Venta rapida
                </Button>
                {!embedded ? (
                  <Button type="button" variant="secondary" size="sm" onClick={handleFullscreen} aria-label="Pantalla completa">
                    {isFullscreen ? <Minimize2 className="h-5 w-5" /> : <Maximize2 className="h-5 w-5" />}
                  </Button>
                ) : null}
                <Button type="button" variant="secondary" size="sm" onClick={() => void loadTickets()}>
                  Actualizar
                </Button>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-3 rounded-xl border border-emerald-200/60 bg-white/70 px-3 py-2 text-[11px] font-semibold text-slate-600">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                Libre
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-rose-500" />
                Ocupado
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
                Cancelado
              </span>
            </div>
          </SectionCard>
        }
      >
        <div className={showCitas ? "grid gap-4 lg:grid-cols-[1.4fr,1fr]" : "grid gap-4"}>
          {showCitas ? (
            <MonthCalendar
              currentMonth={currentMonth}
              calendarDays={calendarDays}
              monthDaySlotCounts={monthDaySlotCounts}
              selectedDate={selectedDate}
              onPrevMonth={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))}
              onNextMonth={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))}
              onOpenAgendaModalForDate={openAgendaModalForDate}
              ticketsByDay={ticketsByDay}
            />
          ) : null}

          <div className="space-y-4">
            {showCitas ? (
              <DayTicketsPanel
                selectedDate={selectedDate}
                isLoading={isLoading}
                selectedDayTickets={selectedDayTickets}
                onSelectedDateChange={(iso) => {
                  setSelectedDate(iso);
                  const pickedDate = new Date(`${iso}T00:00:00`);
                  setCurrentMonth(new Date(pickedDate.getFullYear(), pickedDate.getMonth(), 1));
                }}
                onOpenAgendaModal={() => setAgendaModalOpen(true)}
                searchStartDate={searchStartDate}
                searchEndDate={searchEndDate}
                onSearchStartDateChange={setSearchStartDate}
                onSearchEndDateChange={setSearchEndDate}
                onClearSearchRange={() => {
                  setSearchStartDate("");
                  setSearchEndDate("");
                }}
              />
            ) : null}

            {showAgendaInline ? (
              <AgendaByHourPanel
                selectedDate={selectedDate}
                showDatePicker={showAgendaDatePicker}
                onDateChange={setSelectedDate}
                onMonthSync={(iso) => {
                  const pickedDate = new Date(`${iso}T00:00:00`);
                  setCurrentMonth(new Date(pickedDate.getFullYear(), pickedDate.getMonth(), 1));
                }}
                agendaStatusFilter={agendaStatusFilter}
                setAgendaStatusFilter={setAgendaStatusFilter}
                availableSlots={availableSlots}
                occupiedSlots={occupiedSlots}
                cancelledSlots={cancelledSlots}
                isLoading={isLoading}
                filteredAgendaSchedule={filteredAgendaSchedule}
                variant="inline"
              />
            ) : null}
          </div>
        </div>
      </Layout>

      {showCitas ? (
        <AgendaByHourModal
          isOpen={agendaModalOpen}
          onClose={() => setAgendaModalOpen(false)}
          selectedDate={selectedDate}
          onDateChange={setSelectedDate}
          onMonthSync={(iso) => {
            const pickedDate = new Date(`${iso}T00:00:00`);
            setCurrentMonth(new Date(pickedDate.getFullYear(), pickedDate.getMonth(), 1));
          }}
          agendaStatusFilter={agendaStatusFilter}
          setAgendaStatusFilter={setAgendaStatusFilter}
          availableSlots={availableSlots}
          occupiedSlots={occupiedSlots}
          cancelledSlots={cancelledSlots}
          isLoading={isLoading}
          filteredAgendaSchedule={filteredAgendaSchedule}
        />
      ) : null}

      <GenericModal
        isOpen={quickSaleOpen}
        onClose={() => setQuickSaleOpen(false)}
        title={`Venta rapida y reserva · ${selectedDate}`}
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
