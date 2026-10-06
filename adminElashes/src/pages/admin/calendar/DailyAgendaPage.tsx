import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  closestCenter,
  pointerWithin,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { CalendarClock, ChevronLeft, ChevronRight, Columns3, HelpCircle, List, ListTodo, MessageCircle, Minus, Plus, Printer, Settings2 } from "lucide-react";
import PrintAgendaModal from "./components/PrintAgendaModal";
import ReservationDrawer from "./components/ReservationDrawer";
import WhatsAppValidationPanel from "./components/WhatsAppValidationPanel";
import { toast } from "react-toastify";
import { useNavigate } from "react-router-dom";
import Layout from "../../../components/common/layout";
import { SectionCard, SegmentedTabs } from "../../../components/common/ui";
import RegisterClientModal from "../clients/RegisterClientModal";
import { ClientService } from "../../../core/services/client/client.service";
import type { EyeTypeOption } from "../../../core/services/client/client.service";
import { BranchService } from "../../../core/services/branch/branch.service";
import {
  AgendaService,
  type ClientForSelect,
  type ProfessionalForSelect,
  type ServiceOption,
  type TicketItem,
} from "../../../core/services/agenda/agenda.service";
import { BRANCH_STORAGE_KEY, getSelectedBranchId } from "../../../core/utils/branch";
import { getApiErrorMessage } from "../../../core/utils/apiError";
import { getLocalDateInputValue } from "./calendar.utils";
import { parseDragTicketId, parseDropTarget, stationDropId } from "./dailyAgenda.dnd";
import {
  buildRescheduleTimes,
  formatLocalDateTime,
  getAppointmentDurationMs,
  groupTicketsByHourAndStation,
  parseTicketDate,
  toIsoDate,
} from "./dailyAgenda.utils";
import DayTimeGrid, { type OpenRange } from "./components/DayTimeGrid";
import MonthAgendaView, { buildMonthGrid } from "./components/MonthAgendaView";
import YearAgendaView, { buildYearRange } from "./components/YearAgendaView";
import AgendaHintsBar from "./components/AgendaHintsBar";
import TicketsSidePanel, { TICKET_DRAG_MIME } from "./components/TicketsSidePanel";
import CalendarScopeMenu, { type CalendarScope } from "./components/CalendarScopeMenu";
import EditReservationModal from "./components/EditReservationModal";
import TicketContextMenu, { type TicketContextAction } from "./components/TicketContextMenu";
import AgendaDropCell from "./components/AgendaDropCell";
import AgendaTicketCard from "./components/AgendaTicketCard";
import DraggableAgendaTicketCard from "./components/DraggableAgendaTicketCard";
import StationSectionsModal from "./components/StationSectionsModal";
import AgendaTutorialModal, { getAgendaTutorialStorageKey } from "./components/AgendaTutorialModal";
import { useStationSections } from "../../../core/hooks/useStationSections";
import useAuth from "../../../core/hooks/useAuth";

const GRID_FIRST_HOUR = 9;
const GRID_LAST_HOUR = 20;

const AGENDA_VIEW_STORAGE_KEY = "daily-agenda-view-mode";
// Oculto de momento: "Puestos por sección" no tiene asignación real de
// operaria a puesto, solo llena columnas por índice de la lista, confunde.
// Poner en true el día que se agregue esa asignación real.
const SHOW_STATIONS_TOGGLE = false;
const AGENDA_REFRESH_EVENT = "agendarefresh";
const AGENDA_POLL_MS = 20_000;

/**
 * Barra de herramientas de la agenda: paleta neutra (blanco + grises Fluent).
 * El verde de marca queda solo para el estado activo y la acción principal.
 */
const TB_BTN =
  "inline-flex h-8 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-md border border-[var(--ui-border-strong)] bg-white px-2.5 text-xs font-semibold text-[var(--ui-text)] transition-colors hover:bg-[var(--ui-surface-hover)] hover:text-[var(--ui-text)]";
const TB_ICON_BTN =
  "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-[var(--ui-border-strong)] bg-white text-[var(--ui-text-muted)] transition-colors hover:bg-[var(--ui-surface-hover)] hover:text-[var(--ui-text)]";
const TB_DIVIDER = "hidden h-6 w-px shrink-0 bg-[var(--ui-surface-hover)] sm:block";

type AgendaViewMode = "planner" | "stations";
type MainViewMode = "calendar" | "whatsapp";

const SCOPE_STEP_LABEL = {
  day: { prev: "Día anterior", next: "Día siguiente" },
  week: { prev: "Semana anterior", next: "Semana siguiente" },
  month: { prev: "Mes anterior", next: "Mes siguiente" },
  year: { prev: "Año anterior", next: "Año siguiente" },
} as const;
const TICKETS_PAGE_SIZE = 500; // máximo que acepta el backend por página
/** Capacidad de atención simultánea (columnas de la vista Día), guardada por sucursal en este navegador. */
const CAPACITY_STORAGE_PREFIX = "agenda-capacity:";
const DEFAULT_CAPACITY = 8;
const MAX_CAPACITY = 20;
const readCapacity = (branchId: number | null) => {
  try {
    const saved = Number(localStorage.getItem(`${CAPACITY_STORAGE_PREFIX}${branchId ?? "all"}`));
    return Number.isInteger(saved) && saved >= 1 && saved <= MAX_CAPACITY ? saved : DEFAULT_CAPACITY;
  } catch {
    return DEFAULT_CAPACITY;
  }
};

/** Semana calendario (lun–dom) que contiene `isoDate`. */
function buildWeekStrip(isoDate: string): string[] {
  const center = new Date(`${isoDate}T12:00:00`);
  const dow = center.getDay();
  const toMonday = dow === 0 ? -6 : 1 - dow;
  const monday = new Date(center);
  monday.setDate(center.getDate() + toMonday);
  return Array.from({ length: 7 }, (_, i) => {
    const day = new Date(monday);
    day.setDate(monday.getDate() + i);
    return toIsoDate(day);
  });
}

export type DailyAgendaPageProps = {
  /** Dentro del hub Caja & seguimiento: sin título global duplicado. */
  embedded?: boolean;
};

export default function DailyAgendaPage({ embedded = false }: DailyAgendaPageProps) {
  const { isAdmin, hasRole, user } = useAuth();
  const canConfigureSections = isAdmin() || hasRole("Secretaria");
  const { sections: stationSections, saveSections, totalStations } = useStationSections();
  const [sectionsModalOpen, setSectionsModalOpen] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const tutorialStorageKey = useMemo(() => getAgendaTutorialStorageKey(user?.id), [user?.id]);

  // Primera vez que este usuario entra a la Agenda del día: mostrar la guía
  // rápida. La key es por usuario, no por navegador, porque varias operarias
  // suelen compartir la misma laptop.
  useEffect(() => {
    if (!user?.id) return;
    try {
      if (!localStorage.getItem(tutorialStorageKey)) setShowTutorial(true);
    } catch {
      // localStorage puede fallar en modo privado — simplemente no se muestra.
    }
  }, [tutorialStorageKey, user?.id]);

  // Mapa columna (0-based) → sección
  const stationColSection = stationSections.flatMap((s) =>
    Array.from({ length: s.count }, () => s)
  );

  const [selectedDate, setSelectedDate] = useState(() => getLocalDateInputValue());
  // Pedido del cliente (2026-10-06): al entrar a la agenda siempre se abre la vista Día.
  const [calendarScope, setCalendarScope] = useState<CalendarScope>("day");
  // Días visibles según la vista (Día / Semana / Mes) y rango a pedir al backend.
  const visibleDays = useMemo(() => {
    if (calendarScope === "week") return buildWeekStrip(selectedDate);
    if (calendarScope === "month") return buildMonthGrid(selectedDate);
    if (calendarScope === "year") return buildYearRange(selectedDate);
    return [selectedDate];
  }, [calendarScope, selectedDate]);
  const rangeStart = visibleDays[0];
  const rangeEnd = visibleDays[visibleDays.length - 1];
  const [branchId, setBranchId] = useState<number | null>(() => getSelectedBranchId());
  const [capacity, setCapacityState] = useState(() => readCapacity(getSelectedBranchId()));
  useEffect(() => setCapacityState(readCapacity(branchId)), [branchId]);
  const setCapacity = useCallback(
    (next: number) => {
      const value = Math.min(MAX_CAPACITY, Math.max(1, next));
      setCapacityState(value);
      try {
        localStorage.setItem(`${CAPACITY_STORAGE_PREFIX}${branchId ?? "all"}`, String(value));
      } catch {
        /* ignore */
      }
    },
    [branchId]
  );
  const [tickets, setTickets] = useState<TicketItem[]>([]);
  const [professionals, setProfessionals] = useState<ProfessionalForSelect[]>([]);
  const [services, setServices] = useState<ServiceOption[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalTime, setModalTime] = useState("09:00");
  const [modalProId, setModalProId] = useState<number | null>(null);
  const [isRegisterClientOpen, setIsRegisterClientOpen] = useState(false);
  const [eyeTypes, setEyeTypes] = useState<EyeTypeOption[]>([]);
  const [branches, setBranches] = useState<Array<{ id: number; name: string; opening_hours?: Array<{ day: string; ranges: Array<{ open_time: string; close_time: string }> }> | null }>>([]);
  const [eyeTypesError, setEyeTypesError] = useState<string | null>(null);
  const [isLoadingEyeTypes, setIsLoadingEyeTypes] = useState(false);
  const [registeredClientPick, setRegisteredClientPick] = useState<ClientForSelect | null>(null);
  const [activeDragTicket, setActiveDragTicket] = useState<TicketItem | null>(null);
  const [reschedulingTicketId, setReschedulingTicketId] = useState<number | null>(null);
  const [printMode, setPrintMode] = useState<"planner" | "stations" | null>(null);
  const [printDropdownOpen, setPrintDropdownOpen] = useState(false);
  const printDropdownRef = useRef<HTMLDivElement>(null);

  const dndSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 120, tolerance: 6 } })
  );

  const collisionDetection: CollisionDetection = (args) => {
    const pointerHits = pointerWithin(args);
    if (pointerHits.length > 0) return pointerHits;
    return closestCenter(args);
  };

  // Pedido del cliente: al entrar a la agenda siempre se ve "Calendario" (WhatsApp no se recuerda).
  const [mainView, setMainView] = useState<MainViewMode>("calendar");

  // "Puestos por sección" oculto de momento: no hay asignación real de
  // operaria a puesto (solo llena columnas por orden de índice de la lista),
  // así que confunde más de lo que ayuda. Queda el código para retomarlo el
  // día que se agregue una asignación real de operaria a puesto.
  const [agendaView, setAgendaView] = useState<AgendaViewMode>("planner");

  const setViewMode = useCallback((mode: AgendaViewMode) => {
    setAgendaView(mode);
    try {
      localStorage.setItem(AGENDA_VIEW_STORAGE_KEY, mode);
    } catch {
      /* ignore */
    }
  }, []);

  const setMainViewMode = useCallback((mode: MainViewMode) => setMainView(mode), []);

  const handleValidationTicketUpdated = useCallback((updated: TicketItem) => {
    setTickets((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
  }, []);

  const loadEyeTypes = useCallback(async () => {
    setIsLoadingEyeTypes(true);
    setEyeTypesError(null);
    try {
      const data = await ClientService.listEyeTypes({ limit: 100 });
      setEyeTypes(data.length > 0 ? data : []);
    } catch {
      setEyeTypesError("No se pudieron cargar. Intenta de nuevo.");
    } finally {
      setIsLoadingEyeTypes(false);
    }
  }, []);

  useEffect(() => {
    void loadEyeTypes();
  }, [loadEyeTypes]);

  useEffect(() => {
    BranchService.list({ limit: 200 })
      .then((data) => setBranches(data))
      .catch(() => setBranches([]));
  }, []);

  const consumeRegisteredClientPick = useCallback(() => setRegisteredClientPick(null), []);

  const handleRegisterClientSubmit = async (form: HTMLFormElement) => {
    const formData = new FormData(form);
    const nombre = String(formData.get("nombre") ?? "").trim();
    const apellido = String(formData.get("apellido") ?? "").trim();
    const edadRaw = String(formData.get("edad") ?? "").trim();
    const phoneCountryCode = String(formData.get("phone_country_code") ?? "+591").trim();
    const phone = String(formData.get("phone") ?? "").trim();
    const eyeTypeRaw = String(formData.get("eye_type_id") ?? "").trim();
    const branchRaw = String(formData.get("branch_id") ?? "").trim();

    if (!nombre || !apellido) {
      toast.warning("Nombre y apellido son obligatorios.");
      return;
    }

    const parsedEdad = Number(edadRaw);
    const edad = edadRaw && Number.isFinite(parsedEdad) ? parsedEdad : undefined;
    if (edad !== undefined && (edad < 1 || edad > 100)) {
      toast.warning(edad < 1 ? "La edad no puede ser 0." : "La edad no puede ser mayor a 100.");
      return;
    }

    const normalizedPhone = phone.replace(/\D/g, "");
    const formattedPhone = normalizedPhone ? `${phoneCountryCode}${normalizedPhone}` : undefined;

    const parsedEyeTypeId = Number(eyeTypeRaw);
    const eye_type_id = eyeTypeRaw && Number.isFinite(parsedEyeTypeId) && parsedEyeTypeId > 0 ? parsedEyeTypeId : undefined;

    const parsedBranchId = Number(branchRaw);
    let branch_id: number | undefined =
      branchRaw && Number.isFinite(parsedBranchId) && parsedBranchId > 0 ? parsedBranchId : undefined;

    if (!branch_id && branchId) {
      branch_id = branchId;
    }

    try {
      const created = await ClientService.create({
        name: nombre,
        last_name: apellido,
        age: edad,
        phone: formattedPhone,
        eye_type_id,
        branch_id,
      });

      setRegisteredClientPick({
        id: created.id,
        nombre: created.nombre,
        apellido: created.apellido,
        phone: created.phone ?? null,
      });
      toast.success("Cliente registrado correctamente.");
      setIsRegisterClientOpen(false);
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, "No se pudo registrar la clienta."));
    }
  };

  const loadAgendaContext = useCallback(async (options?: { silent?: boolean }) => {
    if (!options?.silent) setIsLoading(true);
    try {
      // Semana/Mes pueden tener más de 500 citas: se piden por páginas.
      const loadRangeTickets = async () => {
        const all: TicketItem[] = [];
        for (let page = 0; page < 10; page += 1) {
          const batch = await AgendaService.listTickets({
            skip: page * TICKETS_PAGE_SIZE,
            limit: TICKETS_PAGE_SIZE,
            branch_id: branchId ?? undefined,
            start_date: rangeStart,
            end_date: rangeEnd,
          });
          all.push(...batch);
          if (batch.length < TICKETS_PAGE_SIZE) break;
        }
        return all;
      };
      const [ticketData, pros, svc] = await Promise.all([
        loadRangeTickets(),
        AgendaService.listProfessionalsForSelect({
          limit: 200,
          role_name: "Operaria",
          branch_id: branchId ?? undefined,
        }),
        AgendaService.listServices({ limit: 200, branch_id: branchId ?? undefined }),
      ]);
      setTickets(ticketData);
      setProfessionals(pros);
      setServices(svc);
    } catch {
      if (!options?.silent) {
        toast.error("No se pudieron cargar las reservas.");
      }
      setTickets([]);
      setProfessionals([]);
      setServices([]);
    } finally {
      if (!options?.silent) setIsLoading(false);
    }
  }, [branchId, rangeStart, rangeEnd]);

  useEffect(() => {
    const handleBranchChange = () => {
      setBranchId(getSelectedBranchId());
      setModalOpen(false);
      setActiveDragTicket(null);
      setPrintMode(null);
    };
    const onStorage = (ev: StorageEvent) => {
      if (ev.key === BRANCH_STORAGE_KEY) handleBranchChange();
    };
    const onAgendaRefresh = () => void loadAgendaContext({ silent: true });
    window.addEventListener("branchchange", handleBranchChange);
    window.addEventListener("storage", onStorage);
    window.addEventListener(AGENDA_REFRESH_EVENT, onAgendaRefresh);
    return () => {
      window.removeEventListener("branchchange", handleBranchChange);
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(AGENDA_REFRESH_EVENT, onAgendaRefresh);
    };
  }, [loadAgendaContext]);

  useEffect(() => {
    void loadAgendaContext();
  }, [loadAgendaContext]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void loadAgendaContext({ silent: true });
      }
    }, AGENDA_POLL_MS);
    return () => window.clearInterval(intervalId);
  }, [loadAgendaContext]);

  useEffect(() => {
    if (!printDropdownOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (printDropdownRef.current && !printDropdownRef.current.contains(e.target as Node)) {
        setPrintDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [printDropdownOpen]);

  const weekdayUpper = useMemo(() => {
    try {
      return new Date(`${selectedDate}T12:00:00`).toLocaleDateString("es-BO", { weekday: "long" }).toUpperCase();
    } catch {
      return "—";
    }
  }, [selectedDate]);

  const headerTitle = useMemo(() => {
    try {
      const d = new Date(`${selectedDate}T12:00:00`);
      const wd = d.toLocaleDateString("es-BO", { weekday: "long" });
      const cap = wd.charAt(0).toUpperCase() + wd.slice(1);
      const rest = d.toLocaleDateString("es-BO", { day: "2-digit", month: "2-digit", year: "2-digit" });
      return `${cap} ${rest}`;
    } catch {
      return selectedDate;
    }
  }, [selectedDate]);

  const weekStrip = useMemo(() => buildWeekStrip(selectedDate), [selectedDate]);

  /** Título del período visible: día, rango de la semana o mes. */
  const periodTitle = useMemo(() => {
    if (calendarScope === "day") return headerTitle;
    const date = new Date(`${selectedDate}T12:00:00`);
    if (calendarScope === "year") return String(date.getFullYear());
    if (calendarScope === "month") {
      const label = date.toLocaleDateString("es-BO", { month: "long", year: "numeric" });
      return label.charAt(0).toUpperCase() + label.slice(1);
    }
    const first = new Date(`${visibleDays[0]}T12:00:00`);
    const last = new Date(`${visibleDays[visibleDays.length - 1]}T12:00:00`);
    const fmt = (d: Date) => d.toLocaleDateString("es-BO", { day: "numeric", month: "short" }).replace(".", "");
    return `${fmt(first)} – ${fmt(last)} ${last.getFullYear()}`;
  }, [calendarScope, headerTitle, selectedDate, visibleDays]);

  /** Abre un mes concreto en la vista Mes (desde Año). */
  const openMonth = useCallback((dateKey: string) => {
    setSelectedDate(dateKey);
    setCalendarScope("month");
  }, []);

  /** Abre un día concreto en la vista Día (desde Semana, Mes o Año). */
  const openDay = useCallback(
    (dateKey: string) => {
      setSelectedDate(dateKey);
      setCalendarScope("day");
    },
    []
  );

  const activeBranchLabel = useMemo(() => {
    if (!branchId) return "Todas las sucursales";
    return branches.find((b) => b.id === branchId)?.name ?? `Sucursal #${branchId}`;
  }, [branchId, branches]);

  const todayOpeningHours = useMemo(() => {
    if (!branchId) return null;
    const branch = branches.find((b) => b.id === branchId);
    if (!branch?.opening_hours) return null;
    const DAYS_ES = ["domingo", "lunes", "martes", "miercoles", "jueves", "viernes", "sabado"];
    const dayName = DAYS_ES[new Date(`${selectedDate}T12:00:00`).getDay()];
    const daySchedule = branch.opening_hours.find((d) => d.day === dayName);
    if (!daySchedule) return null;
    const validRanges = daySchedule.ranges.filter((r) => r.open_time && r.close_time);
    return validRanges.length > 0 ? validRanges : null;
  }, [branchId, branches, selectedDate]);

  const openRangesMinutes = useMemo(() => {
    if (!todayOpeningHours) return null;
    return todayOpeningHours.map((r) => {
      const [oh, om] = r.open_time.split(":").map(Number);
      const [ch, cm] = r.close_time.split(":").map(Number);
      return { open: oh * 60 + om, close: ch * 60 + cm };
    });
  }, [todayOpeningHours]);

  /** Horario de atención de un día cualquiera (en minutos), para las vistas Día y Semana. */
  const getOpenRanges = useCallback(
    (dateKey: string): OpenRange[] | null => {
      if (!branchId) return null;
      const branch = branches.find((b) => b.id === branchId);
      if (!branch?.opening_hours) return null;
      const DAYS_ES = ["domingo", "lunes", "martes", "miercoles", "jueves", "viernes", "sabado"];
      const dayName = DAYS_ES[new Date(`${dateKey}T12:00:00`).getDay()];
      const daySchedule = branch.opening_hours.find((d) => d.day === dayName);
      const ranges = (daySchedule?.ranges ?? [])
        .filter((r) => r.open_time && r.close_time)
        .map((r) => {
          const [oh, om] = r.open_time.split(":").map(Number);
          const [ch, cm] = r.close_time.split(":").map(Number);
          return { open: oh * 60 + om, close: ch * 60 + cm };
        });
      // Sin horario cargado para ese día se considera abierto (igual que antes).
      return ranges.length > 0 ? ranges : null;
    },
    [branchId, branches]
  );

  const visibleTickets = useMemo(() => {
    if (!branchId) return tickets;
    return tickets.filter((t) => {
      if (t.branch_id != null) return Number(t.branch_id) === branchId;
      return true;
    });
  }, [tickets, branchId]);

  const stationGridMap = useMemo(
    () => groupTicketsByHourAndStation(visibleTickets, selectedDate, professionals.slice(0, totalStations)),
    [visibleTickets, selectedDate, professionals, totalStations]
  );

  const stationLabels = useMemo(() => {
    const labels: string[] = [];
    for (let i = 0; i < totalStations; i += 1) {
      const p = professionals[i];
      labels.push(p ? `${i + 1} · ${p.username}` : `${i + 1}`);
    }
    return labels;
  }, [professionals, totalStations]);

  const openNewModal = (time: string, professionalId: number | null) => {
    setModalTime(time);
    setModalProId(professionalId);
    setModalOpen(true);
  };

  const shiftDate = (delta: number) => {
    const d = new Date(`${selectedDate}T12:00:00`);
    if (calendarScope === "year") d.setFullYear(d.getFullYear() + delta, 0, 1);
    else if (calendarScope === "month") d.setMonth(d.getMonth() + delta, 1);
    else d.setDate(d.getDate() + delta * (calendarScope === "week" ? 7 : 1));
    setSelectedDate(toIsoDate(d));
  };

  const [editingTicket, setEditingTicket] = useState<TicketItem | null>(null);
  // Menú de clic derecho sobre una cita (pedido del cliente): En servicio / venta / editar.
  const navigate = useNavigate();
  const [contextMenu, setContextMenu] = useState<{ ticket: TicketItem; x: number; y: number } | null>(null);
  const closeContextMenu = useCallback(() => setContextMenu(null), []);
  // Panel de tickets (antes en la "Vista semanal de citas"): buscar, filtrar y arrastrar al calendario.
  const [ticketsPanelOpen, setTicketsPanelOpen] = useState(false);
  const [ticketsPanelRefresh, setTicketsPanelRefresh] = useState(0);
  const draggedPanelTicketRef = useRef<TicketItem | null>(null);

  const patchTicket = useCallback((ticketId: number, patch: Partial<TicketItem>) => {
    setTickets((prev) => prev.map((item) => (item.id === ticketId ? { ...item, ...patch } : item)));
  }, []);

  const rescheduleTicket = useCallback(
    async (
      ticketId: number,
      target: { hour: number; minute: number; professionalId?: number | null }
    ) => {
      const ticket = tickets.find((item) => item.id === ticketId);
      if (!ticket) return;

      const { start_time, end_time } = buildRescheduleTimes(
        ticket,
        selectedDate,
        target.hour,
        target.minute
      );

      const nextProfessionalId =
        target.professionalId !== undefined ? target.professionalId : ticket.professional_id;
      const nextProfessionalName =
        nextProfessionalId != null
          ? professionals.find((p) => p.id === nextProfessionalId)?.username ?? null
          : null;

      const snapshot: TicketItem = { ...ticket };
      patchTicket(ticketId, {
        start_time,
        end_time,
        professional_id: nextProfessionalId,
        professional_name: nextProfessionalName,
        ...(branchId != null ? { branch_id: branchId } : {}),
      });

      setReschedulingTicketId(ticketId);
      try {
        const updated = await AgendaService.updateAppointment(ticketId, {
          start_time,
          end_time,
          ...(branchId != null ? { branch_id: branchId } : {}),
          ...(target.professionalId !== undefined ? { professional_id: target.professionalId } : {}),
        });
        patchTicket(ticketId, {
          start_time: updated.start_time,
          end_time: updated.end_time,
          professional_id: updated.professional_id,
          professional_name: updated.professional_name,
          branch_id: updated.branch_id ?? branchId ?? ticket.branch_id,
          branch_name: updated.branch_name ?? ticket.branch_name,
        });
        toast.success("Reserva reprogramada.");
      } catch (err: unknown) {
        patchTicket(ticketId, snapshot);
        toast.error(getApiErrorMessage(err, "No se pudo reprogramar la reserva."));
      } finally {
        setReschedulingTicketId(null);
      }
    },
    [branchId, patchTicket, professionals, selectedDate, tickets]
  );

  /** Mueve o estira una cita en la vista del día (minutos desde las 00:00 del día seleccionado). */
  const changeTicketTime = useCallback(
    async (ticket: TicketItem, dateKey: string, startMinute: number, endMinute: number) => {
      const ticketId = ticket.id;

      const [year, month, day] = dateKey.split("-").map(Number);
      const at = (minute: number) =>
        formatLocalDateTime(new Date(year, (month || 1) - 1, day || 1, Math.floor(minute / 60), minute % 60, 0));
      const start_time = at(startMinute);
      const end_time = at(endMinute);

      const snapshot: TicketItem = { ...ticket };
      patchTicket(ticketId, { start_time, end_time });
      setReschedulingTicketId(ticketId);
      try {
        const updated = await AgendaService.updateAppointment(ticketId, {
          start_time,
          end_time,
          ...(branchId != null ? { branch_id: branchId } : {}),
        });
        patchTicket(ticketId, { start_time: updated.start_time, end_time: updated.end_time });
        toast.success("Horario de la reserva actualizado.");
        // Si venía del panel (fuera del rango visible), recargar para que aparezca en el calendario.
        if (!tickets.some((item) => item.id === ticketId)) void loadAgendaContext({ silent: true });
        setTicketsPanelRefresh((n) => n + 1);
      } catch (err: unknown) {
        // Si choca con otra cita (409) u ocurre otro error, la cita vuelve a su lugar.
        patchTicket(ticketId, snapshot);
        toast.error(getApiErrorMessage(err, "No se pudo cambiar el horario de la reserva."));
      } finally {
        setReschedulingTicketId(null);
      }
    },
    [branchId, loadAgendaContext, patchTicket, tickets]
  );

  /** "Pasar a En servicio" desde el clic derecho: mismas reglas que "Iniciar atención" en Control de servicios. */
  const startServiceFromAgenda = useCallback(
    async (ticket: TicketItem) => {
      if (!ticket.professional_id) {
        toast.warning("Asigna una operaria antes de pasar a En servicio.");
        setEditingTicket(ticket);
        return;
      }
      const busyWith = tickets.find(
        (t) => t.id !== ticket.id && t.professional_id === ticket.professional_id && t.status === "in_service"
      );
      if (busyWith) {
        toast.error(
          `La operaria ya está atendiendo a ${busyWith.client_name}. Finaliza ese servicio antes de iniciar uno nuevo.`
        );
        return;
      }
      const snapshot: TicketItem = { ...ticket };
      patchTicket(ticket.id, { status: "in_service" });
      setReschedulingTicketId(ticket.id);
      try {
        // Igual que en Control de servicios: el choque de horario no aplica al iniciar la atención.
        await AgendaService.updateAppointment(ticket.id, { status: "in_service", skip_availability_check: true });
        toast.success(`${ticket.client_name} pasó a En servicio.`);
        setTicketsPanelRefresh((n) => n + 1);
        window.dispatchEvent(new Event(AGENDA_REFRESH_EVENT));
      } catch (err: unknown) {
        patchTicket(ticket.id, snapshot);
        toast.error(getApiErrorMessage(err, "No se pudo pasar a En servicio."));
      } finally {
        setReschedulingTicketId(null);
      }
    },
    [patchTicket, tickets]
  );

  const handleContextAction = useCallback(
    (action: TicketContextAction, ticket: TicketItem) => {
      if (action === "edit") setEditingTicket(ticket);
      else if (action === "start-service") void startServiceFromAgenda(ticket);
      else if (action === "finish") {
        // Finalizar registra seguimiento (operaria, notas, cuestionario): se usa la misma ventana de Control de servicios.
        navigate("/admin/services/queue", { state: { finishAppointmentId: ticket.id } });
      }
      else if (action === "to-sale" && !ticket.sale_id) {
        navigate("/admin/pos-tracking", { state: { fromAgendaReservation: { appointmentId: ticket.id } } });
      }
    },
    [navigate, startServiceFromAgenda]
  );

  /** Clic en un ticket del panel: ir a su semana y abrir la edición. */
  const openTicketFromPanel = useCallback((ticket: TicketItem) => {
    const start = parseTicketDate(ticket.start_time);
    if (!Number.isNaN(start.getTime())) setSelectedDate(toIsoDate(start));
    setCalendarScope((scope) => (scope === "year" || scope === "month" ? "week" : scope));
    setEditingTicket(ticket);
  }, []);

  /** Se soltó un ticket del panel en el calendario: se agenda ahí conservando su duración. */
  const dropPanelTicket = useCallback(
    (dateKey: string, minute: number) => {
      const ticket = draggedPanelTicketRef.current;
      draggedPanelTicketRef.current = null;
      if (!ticket) return;
      const duration = Math.round(getAppointmentDurationMs(ticket) / 60_000);
      void changeTicketTime(ticket, dateKey, minute, Math.min(minute + duration, 24 * 60 - 1));
    },
    [changeTicketTime]
  );

  const handleDragStart = (event: DragStartEvent) => {
    const ticket = event.active.data.current?.ticket as TicketItem | undefined;
    if (ticket) setActiveDragTicket(ticket);
  };

  const handleDragCancel = () => {
    setActiveDragTicket(null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveDragTicket(null);
    const { active, over } = event;
    if (!over || reschedulingTicketId != null) return;

    const ticketId = parseDragTicketId(active.id);
    const dropTarget = parseDropTarget(over.id);
    if (ticketId == null || !dropTarget) return;

    if (dropTarget.type === "planner") {
      const hour = Math.floor(dropTarget.minuteOfDay / 60);
      const minute = dropTarget.minuteOfDay % 60;
      void rescheduleTicket(ticketId, { hour, minute });
      return;
    }

    const pro = professionals[dropTarget.col];
    void rescheduleTicket(ticketId, {
      hour: dropTarget.hour,
      minute: 0,
      professionalId: pro?.id ?? null,
    });
  };

  const layoutPageClass = embedded
    ? "!min-h-0 flex flex-1 flex-col !bg-transparent !p-0 h-full"
    : undefined;
  const layoutContainerClass = embedded
    ? "!border-0 !shadow-none !rounded-none flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden bg-transparent !p-0 max-w-none"
    : undefined;

  return (
    <div
      className={
        embedded
          ? "flex min-h-0 w-full flex-1 flex-col overflow-auto bg-transparent"
          : "min-h-0 w-full overflow-auto bg-transparent"
      }
    >
      <Layout
        title={embedded ? undefined : "Agenda del día"}
        subtitle={
          embedded
            ? undefined
            : "Planilla horaria o puestos (1–8). Arrastra reservas para cambiar hora u operaria; toca un hueco vacío para crear cita."
        }
        variant="table"
        pageClassName={layoutPageClass}
        containerClassName={layoutContainerClass}
      >
        <SectionCard
          className="mb-3 border border-[var(--ui-border)] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
          bodyClassName="px-3 py-2.5"
        >
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            {/* Grupo 1 — vista principal */}
            <div data-tour="agenda-view-toggle" role="group" aria-label="Tipo de vista">
              <SegmentedTabs
                options={[
                  { id: "calendar", label: "Calendario", icon: <CalendarClock className="h-3.5 w-3.5" aria-hidden /> },
                  { id: "whatsapp", label: "WhatsApp", icon: <MessageCircle className="h-3.5 w-3.5" aria-hidden /> },
                ]}
                value={mainView}
                onChange={setMainViewMode}
              />
            </div>

            {/* Grupo 2 — modo de calendario */}
            {SHOW_STATIONS_TOGGLE && mainView === "calendar" ? (
              <>
                <span aria-hidden className={TB_DIVIDER} />
                <div className="flex shrink-0 items-center gap-1.5">
                  <div role="group" aria-label="Vista de agenda">
                    <SegmentedTabs
                      options={[
                        { id: "planner", label: "Planilla", icon: <List className="h-3.5 w-3.5" aria-hidden /> },
                        { id: "stations", label: "Puestos", icon: <Columns3 className="h-3.5 w-3.5" aria-hidden /> },
                      ]}
                      value={agendaView}
                      onChange={setViewMode}
                    />
                  </div>
                  {agendaView === "stations" && canConfigureSections && (
                    <button
                      type="button"
                      onClick={() => setSectionsModalOpen(true)}
                      title="Configurar secciones"
                      aria-label="Configurar secciones"
                      className={TB_ICON_BTN}
                    >
                      <Settings2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </>
            ) : null}

            <span aria-hidden className={TB_DIVIDER} />

            {/* Grupo 3 — navegación de fecha */}
            <div data-tour="agenda-date-nav" className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setSelectedDate(getLocalDateInputValue())}
                title="Ir al día de hoy"
                className={TB_BTN}
              >
                Hoy
              </button>

              <div className="flex shrink-0 items-center">
                <button
                  type="button"
                  onClick={() => shiftDate(-1)}
                  title={SCOPE_STEP_LABEL[calendarScope].prev}
                  aria-label={SCOPE_STEP_LABEL[calendarScope].prev}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-l-md border border-[var(--ui-border-strong)] bg-white text-[var(--ui-text-muted)] transition-colors hover:bg-[var(--ui-surface-hover)] hover:text-[var(--ui-text)]"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  aria-label="Fecha de la agenda"
                  className="h-8 w-[132px] border-y border-[var(--ui-border-strong)] bg-white px-2 text-xs text-[var(--ui-text)] outline-none focus:ring-1 focus:ring-brand/40"
                />
                <button
                  type="button"
                  onClick={() => shiftDate(1)}
                  title={SCOPE_STEP_LABEL[calendarScope].next}
                  aria-label={SCOPE_STEP_LABEL[calendarScope].next}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-r-md border border-[var(--ui-border-strong)] bg-white text-[var(--ui-text-muted)] transition-colors hover:bg-[var(--ui-surface-hover)] hover:text-[var(--ui-text)]"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>

              {calendarScope === "day" && (
              <div className="flex shrink-0 gap-1">
                {weekStrip.map((dayIso) => {
                  const isSel = dayIso === selectedDate;
                  const isToday = dayIso === getLocalDateInputValue();
                  const day = new Date(`${dayIso}T12:00:00`);
                  const short = day.toLocaleDateString("es-BO", { weekday: "short" });
                  const num = day.getDate();
                  return (
                    <button
                      key={dayIso}
                      type="button"
                      onClick={() => setSelectedDate(dayIso)}
                      aria-pressed={isSel}
                      title={day.toLocaleDateString("es-BO", {
                        weekday: "long",
                        day: "numeric",
                        month: "long",
                      })}
                      className={`flex min-w-[38px] shrink-0 flex-col items-center rounded-md border px-1 py-1 text-[10px] transition-colors ${
                        isSel
                          ? "border-brand bg-white font-semibold text-brand ring-1 ring-brand/20"
                          : "border-[var(--ui-border)] bg-white text-[var(--ui-text-muted)] hover:bg-[var(--ui-surface-hover)] hover:text-[var(--ui-text)]"
                      }`}
                    >
                      <span className="capitalize leading-none">{short.replace(/\.$/, "")}</span>
                      <span className="text-sm font-bold tabular-nums leading-tight">{num}</span>
                      <span
                        aria-hidden
                        className={`mt-0.5 h-1 w-1 rounded-full ${isToday ? "bg-brand" : "bg-transparent"}`}
                      />
                    </button>
                  );
                })}
              </div>
              )}
            </div>

            {/* Grupo 4 — acciones */}
            <div className="ml-auto flex shrink-0 items-center gap-2">
              <button
                type="button"
                data-tour="agenda-tickets-btn"
                onClick={() => setTicketsPanelOpen((open) => !open)}
                aria-pressed={ticketsPanelOpen}
                title={ticketsPanelOpen ? "Ocultar panel de tickets" : "Ver tickets para buscar o arrastrar al calendario"}
                className={`inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border px-3 text-xs font-semibold transition-colors ${
                  ticketsPanelOpen
                    ? "border-[var(--ui-accent)] bg-[var(--ui-accent-soft)] text-[var(--ui-accent)]"
                    : "border-[var(--ui-border-strong)] bg-[var(--ui-surface)] text-[var(--ui-text)] hover:bg-[var(--ui-surface-hover)]"
                }`}
              >
                <ListTodo className="h-3.5 w-3.5" aria-hidden />
                Tickets
              </button>
              {calendarScope === "day" && (
                <div
                  className="flex h-8 shrink-0 items-center rounded-lg border border-[var(--ui-border-strong)] bg-[var(--ui-surface)]"
                  title="Capacidad: cuántas clientas se atienden a la vez (columnas de la vista Día)"
                  data-tour="agenda-capacity"
                >
                  <button
                    type="button"
                    onClick={() => setCapacity(capacity - 1)}
                    disabled={capacity <= 1}
                    aria-label="Quitar una columna"
                    className="flex h-full w-7 items-center justify-center rounded-l-lg text-[var(--ui-text-muted)] hover:bg-[var(--ui-surface-hover)] hover:text-[var(--ui-text)] disabled:opacity-40"
                  >
                    <Minus className="h-3.5 w-3.5" />
                  </button>
                  <span className="px-1.5 text-xs text-[var(--ui-text-muted)]">
                    Capacidad <span className="font-semibold tabular-nums text-[var(--ui-text)]">{capacity}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setCapacity(capacity + 1)}
                    disabled={capacity >= MAX_CAPACITY}
                    aria-label="Agregar una columna"
                    className="flex h-full w-7 items-center justify-center rounded-r-lg text-[var(--ui-text-muted)] hover:bg-[var(--ui-surface-hover)] hover:text-[var(--ui-text)] disabled:opacity-40"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
              <CalendarScopeMenu value={calendarScope} onChange={setCalendarScope} />
              <button
                type="button"
                data-tour="agenda-new-btn"
                onClick={() => openNewModal("09:00", null)}
                title="Nueva reserva"
                className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md bg-brand px-3 text-xs font-semibold text-white transition-colors hover:bg-brand-hover"
              >
                <Plus className="h-3.5 w-3.5" aria-hidden />
                Nueva
              </button>

              <div className="relative shrink-0" ref={printDropdownRef}>
                <button
                  type="button"
                  data-tour="agenda-print-btn"
                  onClick={() => setPrintDropdownOpen((o) => !o)}
                  title="Imprimir agenda"
                  aria-haspopup="menu"
                  aria-expanded={printDropdownOpen}
                  className={TB_BTN}
                >
                  <Printer className="h-3.5 w-3.5" aria-hidden />
                  Imprimir
                </button>
                {printDropdownOpen && (
                  <div
                    role="menu"
                    className="absolute right-0 top-full z-20 mt-1 min-w-[176px] rounded-md border border-[var(--ui-border)] bg-white py-1 shadow-lg"
                  >
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => { setPrintMode("planner"); setPrintDropdownOpen(false); }}
                      className="flex w-full items-center gap-2 px-3 py-2 text-xs text-[var(--ui-text)] transition-colors hover:bg-[var(--ui-surface-hover)]"
                    >
                      <List className="h-3.5 w-3.5 text-[var(--ui-text-muted)]" aria-hidden />
                      Vista planilla
                    </button>
                    {SHOW_STATIONS_TOGGLE && (
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => { setPrintMode("stations"); setPrintDropdownOpen(false); }}
                        className="flex w-full items-center gap-2 px-3 py-2 text-xs text-[var(--ui-text)] transition-colors hover:bg-[var(--ui-surface-hover)]"
                      >
                        <Columns3 className="h-3.5 w-3.5 text-[var(--ui-text-muted)]" aria-hidden />
                        Vista puestos 1–8
                      </button>
                    )}
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={() => setShowTutorial(true)}
                title="Ver guía rápida de la agenda"
                aria-label="Ver guía rápida de la agenda"
                className={TB_ICON_BTN}
              >
                <HelpCircle className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </SectionCard>

        {mainView === "whatsapp" ? (
          <WhatsAppValidationPanel
            tickets={visibleTickets}
            branchLabel={activeBranchLabel}
            selectedDate={selectedDate}
            onTicketUpdated={handleValidationTicketUpdated}
          />
        ) : (
        <DndContext
          sensors={dndSensors}
          collisionDetection={collisionDetection}
          onDragStart={handleDragStart}
          onDragCancel={handleDragCancel}
          onDragEnd={handleDragEnd}
        >
        {agendaView === "planner" ? (
        <section data-tour="agenda-grid" className="mb-2 min-h-0 flex-1 overflow-hidden rounded-lg border border-[var(--ui-border-strong)] bg-white shadow-sm print:shadow-none">
          <div className="border-b border-[var(--ui-border-strong)] bg-[var(--ui-surface-muted)] px-3 py-2 text-center text-sm font-semibold text-[var(--ui-text)] print:bg-[var(--ui-surface-muted)]">
            {periodTitle}
          </div>
          {calendarScope === "day" && (
            <div className="flex items-center justify-between border-b border-[var(--ui-border)] bg-[var(--ui-surface-muted)] px-3 py-1">
              <p className="text-[10px] text-[var(--ui-text-muted)]">FECHA DE INICIO ({weekdayUpper})</p>
              {openRangesMinutes !== null ? (
                todayOpeningHours ? (
                  <p className="text-[10px] font-semibold text-[#107c10]">
                    Horario: {todayOpeningHours.map((r) => `${r.open_time}–${r.close_time}`).join(" / ")}
                  </p>
                ) : (
                  <p className="text-[10px] font-semibold text-[#a4262c]">Cerrado hoy</p>
                )
              ) : null}
            </div>
          )}
          <div className="flex flex-col lg:flex-row">
          {ticketsPanelOpen && (
            <TicketsSidePanel
              branchId={branchId}
              refreshKey={ticketsPanelRefresh}
              onClose={() => setTicketsPanelOpen(false)}
              onOpenTicket={openTicketFromPanel}
              onDragTicket={(ticket) => {
                if (ticket) draggedPanelTicketRef.current = ticket;
              }}
            />
          )}
          <div className="min-w-0 flex-1">
          {calendarScope !== "year" && <AgendaHintsBar />}
          {calendarScope === "year" ? (
            <YearAgendaView
              tickets={visibleTickets}
              year={Number(selectedDate.slice(0, 4))}
              onSelectDay={openDay}
              onSelectMonth={openMonth}
            />
          ) : calendarScope === "month" ? (
            <MonthAgendaView
              tickets={visibleTickets}
              days={visibleDays}
              monthKey={selectedDate.slice(0, 7)}
              onSelectDay={openDay}
              onEdit={setEditingTicket}
              onTicketContextMenu={(ticket, x, y) => setContextMenu({ ticket, x, y })}
            />
          ) : (
            <DayTimeGrid
              tickets={visibleTickets}
              days={visibleDays}
              getOpenRanges={getOpenRanges}
              disabledTicketId={reschedulingTicketId}
              onCreateAt={(dateKey, minute) => {
                setSelectedDate(dateKey);
                openNewModal(
                  `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`,
                  null
                );
              }}
              onChangeTime={(ticket, dateKey, startMinute, endMinute) =>
                void changeTicketTime(ticket, dateKey, startMinute, endMinute)
              }
              externalDragType={TICKET_DRAG_MIME}
              onDropExternal={dropPanelTicket}
              capacity={calendarScope === "day" ? capacity : undefined}
              onEdit={setEditingTicket}
              onTicketContextMenu={(ticket, x, y) => setContextMenu({ ticket, x, y })}
              onSelectDay={openDay}
            />
          )}
          </div>
          </div>
        </section>
        ) : null}

        {agendaView === "stations" ? (
        <section className="mb-2 min-h-0 flex-1 overflow-hidden rounded-lg border border-[var(--ui-border)] bg-white shadow-sm">
          <div className="border-b border-[var(--ui-border)] bg-[var(--ui-surface-muted)] px-3 py-2.5">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold text-[var(--ui-text)]">Puestos por sección</h2>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  {stationSections.map((sec, idx) => {
                    const from = stationSections.slice(0, idx).reduce((s, x) => s + x.count, 0) + 1;
                    const to = from + sec.count - 1;
                    return (
                      <span
                        key={sec.id}
                        style={{ background: sec.headerBg, color: sec.headerText }}
                        className="rounded-lg px-2 py-0.5 text-[11px] font-semibold"
                      >
                        {from}–{to} · {sec.label}
                      </span>
                    );
                  })}
                  <span className="text-[10px] text-[var(--ui-text-muted)]">
                    · {GRID_FIRST_HOUR}:00–{GRID_LAST_HOUR}:00 · <strong className="text-[var(--ui-text)]">{activeBranchLabel}</strong>
                  </span>
                </div>
              </div>
              {canConfigureSections && (
                <button
                  type="button"
                  onClick={() => setSectionsModalOpen(true)}
                  className="mt-0.5 inline-flex shrink-0 items-center gap-1 rounded border border-[var(--ui-border-strong)] bg-white px-2 py-1 text-[10px] font-semibold text-[var(--ui-text-muted)] transition hover:border-[#094732] hover:text-[#094732]"
                >
                  <Settings2 className="h-3 w-3" />
                  Configurar
                </button>
              )}
            </div>
          </div>
          <div className="max-h-[min(72vh,900px)] overflow-auto p-2 sm:p-3">
            <div
              className="grid w-full min-w-[min(100%,920px)]"
              style={{
                gridTemplateColumns: `72px repeat(${totalStations}, minmax(88px, 1fr))`,
              }}
            >
              {/* ── Fila 1: encabezados de sección ─────────────────────────── */}
              <div className="sticky left-0 z-10 border border-[var(--ui-border)] bg-[#d0d0d0] px-1 py-2 text-[11px] font-semibold text-[var(--ui-text-muted)]">
                Sección
              </div>
              {(() => {
                let startNum = 1;
                return stationSections.map((section) => {
                  const from = startNum;
                  const to = startNum + section.count - 1;
                  startNum = to + 1;
                  return (
                    <div
                      key={section.id}
                      style={{
                        gridColumn: `span ${section.count}`,
                        background: section.headerBg,
                        color: section.headerText,
                      }}
                      className="border border-[var(--ui-border)] py-2 text-center text-[11px] font-semibold"
                    >
                      {section.label}
                      <span className="ml-1.5 rounded bg-white/50 px-1.5 py-0.5 text-[10px] font-semibold">
                        {from}–{to}
                      </span>
                    </div>
                  );
                });
              })()}

              {/* ── Fila 2: etiquetas de puesto (hora + operarias) ─────────── */}
              <div className="sticky left-0 z-10 border border-[var(--ui-border)] bg-[#e8e8e8] px-1 py-2 text-[11px] font-semibold text-[var(--ui-text-muted)]">
                Hora
              </div>
              {stationLabels.map((label, idx) => {
                const sec = stationColSection[idx];
                return (
                  <div
                    key={`${label}-${idx}`}
                    style={{ background: sec?.labelBg ?? "#ecfdf5", color: sec?.headerText ?? "#094732" }}
                    className="border border-[var(--ui-border)] px-1 py-2 text-center text-[10px] font-semibold leading-tight"
                  >
                    {label}
                  </div>
                );
              })}

              {Array.from({ length: GRID_LAST_HOUR - GRID_FIRST_HOUR + 1 }, (_, i) => GRID_FIRST_HOUR + i).map((hour) => (
                <div key={`row-${hour}`} className="contents">
                  <div className="sticky left-0 z-10 border border-[var(--ui-border)] bg-[var(--ui-surface-muted)] px-2 py-3 text-xs font-semibold tabular-nums">
                    {String(hour).padStart(2, "0")}:00
                  </div>
                  {Array.from({ length: totalStations }, (_, col) => {
                    const key = `${hour}__${col}`;
                    const cellTickets = stationGridMap.get(key) ?? [];
                    const pro = professionals[col];
                    return (
                      <AgendaDropCell
                        key={key}
                        id={stationDropId(hour, col)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            openNewModal(`${String(hour).padStart(2, "0")}:00`, pro?.id ?? null);
                          }
                        }}
                        onClick={() => {
                          if (activeDragTicket) return;
                          openNewModal(`${String(hour).padStart(2, "0")}:00`, pro?.id ?? null);
                        }}
                        className="relative min-h-[88px] cursor-pointer border border-[var(--ui-border)] bg-white p-1.5 transition hover:bg-[var(--ui-surface-hover)] focus-visible:outline focus-visible:ring-2 focus-visible:ring-[#094732]/35 sm:min-h-[96px]"
                      >
                        <div className="flex min-h-[80px] flex-wrap items-start gap-1 content-start">
                          {cellTickets.map((t) => (
                            <DraggableAgendaTicketCard
                              key={t.id}
                              ticket={t}
                              compact
                              disabled={reschedulingTicketId === t.id}
                            />
                          ))}
                        </div>
                        <span
                          className="pointer-events-none absolute bottom-0.5 right-0.5 rounded bg-white/90 px-1 text-[9px] text-[var(--ui-text-muted)] opacity-60"
                          aria-hidden
                        >
                          +
                        </span>
                      </AgendaDropCell>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </section>
        ) : null}

        {isLoading ? (
          <p className="mt-3 text-center text-xs text-[var(--ui-text-muted)]">Cargando reservas…</p>
        ) : null}

        <DragOverlay dropAnimation={null}>
          {activeDragTicket ? (
            <AgendaTicketCard ticket={activeDragTicket} compact={agendaView === "stations"} />
          ) : null}
        </DragOverlay>
        </DndContext>
        )}
      </Layout>

      <ReservationDrawer
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSaved={() => {
          void loadAgendaContext();
          window.dispatchEvent(new Event(AGENDA_REFRESH_EVENT));
        }}
        branchId={branchId}
        services={services}
        professionals={professionals}
        selectedDate={selectedDate}
        initialTime={modalTime}
        initialProfessionalId={modalProId}
        registeredClient={registeredClientPick}
        onConsumeRegisteredClient={consumeRegisteredClientPick}
        onOpenRegisterClient={() => setIsRegisterClientOpen(true)}
        openingHoursToday={todayOpeningHours}
      />

      {contextMenu && (
        <TicketContextMenu
          ticket={contextMenu.ticket}
          x={contextMenu.x}
          y={contextMenu.y}
          onAction={handleContextAction}
          onClose={closeContextMenu}
        />
      )}

      <EditReservationModal
        ticket={editingTicket}
        onClose={() => setEditingTicket(null)}
        onSaved={(updated) => {
          setTickets((prev) => prev.map((t) => (t.id === updated.id ? { ...t, ...updated } : t)));
          setEditingTicket(null);
          setTicketsPanelRefresh((n) => n + 1);
          void loadAgendaContext({ silent: true });
          window.dispatchEvent(new Event(AGENDA_REFRESH_EVENT));
        }}
        branchId={branchId}
        services={services}
        professionals={professionals}
      />

      <RegisterClientModal
        isOpen={isRegisterClientOpen}
        onClose={() => setIsRegisterClientOpen(false)}
        onSubmit={handleRegisterClientSubmit}
        eyeTypes={eyeTypes}
        branches={branches}
        eyeTypesError={eyeTypesError}
        isLoadingEyeTypes={isLoadingEyeTypes}
        onRetryEyeTypes={() => void loadEyeTypes()}
        mode="create"
        initialClient={null}
        defaultBranchId={branchId}
      />

      {printMode !== null && (
        <PrintAgendaModal
          tickets={visibleTickets}
          professionals={professionals}
          selectedDate={selectedDate}
          initialMode={printMode}
          onClose={() => setPrintMode(null)}
        />
      )}

      <StationSectionsModal
        isOpen={sectionsModalOpen}
        onClose={() => setSectionsModalOpen(false)}
        sections={stationSections}
        onSave={saveSections}
      />

      {showTutorial && (
        <AgendaTutorialModal
          onClose={() => setShowTutorial(false)}
          storageKey={tutorialStorageKey}
          openReservation={() => openNewModal("09:00", null)}
          closeReservation={() => setModalOpen(false)}
        />
      )}
    </div>
  );
}
