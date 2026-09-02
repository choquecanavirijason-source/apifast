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
import { CalendarClock, ChevronLeft, ChevronRight, Columns3, HelpCircle, List, MessageCircle, Plus, Printer, Settings2 } from "lucide-react";
import PrintAgendaModal from "./components/PrintAgendaModal";
import ReservationDrawer from "./components/ReservationDrawer";
import WhatsAppValidationPanel from "./components/WhatsAppValidationPanel";
import { toast } from "react-toastify";
import Layout from "../../../components/common/layout";
import { Button, SectionCard } from "../../../components/common/ui";
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
import { parseDragTicketId, parseDropTarget, plannerDropId, stationDropId } from "./dailyAgenda.dnd";
import { buildRescheduleTimes, groupTicketsByHourAndStation } from "./dailyAgenda.utils";
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

type AgendaViewMode = "planner" | "stations";
type MainViewMode = "calendar" | "whatsapp";

const MAIN_VIEW_STORAGE_KEY = "daily-agenda-main-view";

type PlannerSlot = { minuteOfDay: number; stepMinutes: number; label: string };

function buildPlannerSlots(): PlannerSlot[] {
  const slots: PlannerSlot[] = [];
  for (let h = 7; h <= 18; h += 1) {
    for (const m of [0, 15, 30, 45]) {
      slots.push({
        minuteOfDay: h * 60 + m,
        stepMinutes: 15,
        label: new Date(2000, 0, 1, h, m).toLocaleTimeString("es-BO", {
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
        }),
      });
    }
  }
  for (let h = 19; h <= 22; h += 1) {
    for (const m of [0, 30]) {
      if (h === 22 && m > 30) break;
      slots.push({
        minuteOfDay: h * 60 + m,
        stepMinutes: 30,
        label: new Date(2000, 0, 1, h, m).toLocaleTimeString("es-BO", {
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
        }),
      });
    }
  }
  return slots;
}

const PLANNER_SLOTS = buildPlannerSlots();

const toIsoDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

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

const parseTicketDate = (value: string) => {
  if (!value) return new Date("");
  const hasTz = /[zZ]|[+-]\d{2}:\d{2}$/.test(value);
  if (hasTz) return new Date(value);
  const [datePart, timePartRaw = "00:00:00"] = value.split("T");
  const [year, month, day] = datePart.split("-").map(Number);
  const [hour, minute, second] = timePartRaw.split(":").map(Number);
  return new Date(year, (month || 1) - 1, day || 1, hour || 0, minute || 0, second || 0);
};

function slotKeyForTime(minuteOfDay: number, step: number) {
  return Math.floor(minuteOfDay / step) * step;
}

function groupTicketsByPlannerSlot(tickets: TicketItem[], dateKey: string): Map<number, TicketItem[]> {
  const map = new Map<number, TicketItem[]>();
  for (const t of tickets) {
    const start = parseTicketDate(t.start_time);
    if (Number.isNaN(start.getTime()) || toIsoDate(start) !== dateKey) continue;
    const mod = start.getHours() * 60 + start.getMinutes();
    let slotStart: number;
    if (mod >= 7 * 60 && mod < 19 * 60) {
      slotStart = slotKeyForTime(mod, 15);
    } else {
      slotStart = Math.max(19 * 60, slotKeyForTime(mod, 30));
    }
    const list = map.get(slotStart) ?? [];
    list.push(t);
    map.set(slotStart, list);
  }
  for (const [k, list] of map) {
    list.sort((a, b) => a.start_time.localeCompare(b.start_time));
    map.set(k, list);
  }
  return map;
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
  const [branchId, setBranchId] = useState<number | null>(() => getSelectedBranchId());
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

  const [mainView, setMainView] = useState<MainViewMode>(() => {
    try {
      const v = localStorage.getItem(MAIN_VIEW_STORAGE_KEY);
      if (v === "calendar" || v === "whatsapp") return v;
    } catch {
      /* ignore */
    }
    return "calendar";
  });

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

  const setMainViewMode = useCallback((mode: MainViewMode) => {
    setMainView(mode);
    try {
      localStorage.setItem(MAIN_VIEW_STORAGE_KEY, mode);
    } catch {
      /* ignore */
    }
  }, []);

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
      const [ticketData, pros, svc] = await Promise.all([
        AgendaService.listTickets({
          limit: 500,
          branch_id: branchId ?? undefined,
          start_date: selectedDate,
          end_date: selectedDate,
        }),
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
        toast.error("No se pudieron cargar las reservas del día.");
      }
      setTickets([]);
      setProfessionals([]);
      setServices([]);
    } finally {
      if (!options?.silent) setIsLoading(false);
    }
  }, [branchId, selectedDate]);

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

  const isSlotOpen = useCallback((minuteOfDay: number): boolean => {
    if (!openRangesMinutes) return true;
    return openRangesMinutes.some((r) => minuteOfDay >= r.open && minuteOfDay < r.close);
  }, [openRangesMinutes]);

  const visibleTickets = useMemo(() => {
    if (!branchId) return tickets;
    return tickets.filter((t) => {
      if (t.branch_id != null) return Number(t.branch_id) === branchId;
      return true;
    });
  }, [tickets, branchId]);

  const plannerMap = useMemo(
    () => groupTicketsByPlannerSlot(visibleTickets, selectedDate),
    [visibleTickets, selectedDate]
  );

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
    d.setDate(d.getDate() + delta);
    setSelectedDate(toIsoDate(d));
  };

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
        <SectionCard className="mb-3 border border-[#d2d0ce] bg-[#faf9f8]">
          <div className="flex flex-col gap-3">
            <div className="flex min-w-0 items-start gap-2">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-[#c8e6d9] bg-[#ecfdf5] text-[#094732]">
                <CalendarClock className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-[#605e5c]">Calendario · reservas</p>
                <p className="text-[11px] font-medium text-[#094732]">Sucursal: {activeBranchLabel}</p>
                <p className="text-[11px] text-[#605e5c]">
                  Toca una casilla vacía para nueva reserva. Arrastra una tarjeta por el asa (
                  <span className="inline-block align-middle">⋮⋮</span>) a otra hora o puesto (operaria de la sucursal).
                </p>
              </div>
            </div>

            <div
              className="flex flex-nowrap items-center gap-2 overflow-x-auto pb-1"
              role="group"
              aria-label="Tipo de vista"
            >
              <div data-tour="agenda-view-toggle" className="inline-flex shrink-0 rounded-lg border border-[#c8c6c4] bg-white p-0.5 shadow-inner">
                <button
                  type="button"
                  onClick={() => setMainViewMode("calendar")}
                  title="Calendario"
                  className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-2 py-1.5 text-xs font-semibold transition-colors ${
                    mainView === "calendar"
                      ? "bg-[#094732] text-white shadow-sm"
                      : "text-[#605e5c] hover:bg-[#f3f2f1]"
                  }`}
                >
                  <CalendarClock className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  Calendario
                </button>
                <button
                  type="button"
                  onClick={() => setMainViewMode("whatsapp")}
                  title="Validar WhatsApp"
                  className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-2 py-1.5 text-xs font-semibold transition-colors ${
                    mainView === "whatsapp"
                      ? "bg-emerald-600 text-white shadow-sm"
                      : "text-[#605e5c] hover:bg-[#f3f2f1]"
                  }`}
                >
                  <MessageCircle className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  WhatsApp
                </button>
              </div>

              {SHOW_STATIONS_TOGGLE && mainView === "calendar" ? (
                <div className="flex shrink-0 items-center gap-1">
                  <div className="inline-flex rounded-lg border border-[#c8c6c4] bg-white p-0.5 shadow-inner">
                    <button
                      type="button"
                      onClick={() => setViewMode("planner")}
                      title="Planilla horaria"
                      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-2 py-1.5 text-xs font-semibold transition-colors ${
                        agendaView === "planner"
                          ? "bg-[#094732] text-white shadow-sm"
                          : "text-[#605e5c] hover:bg-[#f3f2f1]"
                      }`}
                    >
                      <List className="h-3.5 w-3.5 shrink-0" aria-hidden />
                      Planilla
                    </button>
                    <button
                      type="button"
                      onClick={() => setViewMode("stations")}
                      title="Puestos por sección"
                      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-2 py-1.5 text-xs font-semibold transition-colors ${
                        agendaView === "stations"
                          ? "bg-[#094732] text-white shadow-sm"
                          : "text-[#605e5c] hover:bg-[#f3f2f1]"
                      }`}
                    >
                      <Columns3 className="h-3.5 w-3.5 shrink-0" aria-hidden />
                      Puestos
                    </button>
                  </div>
                  {agendaView === "stations" && canConfigureSections && (
                    <button
                      type="button"
                      onClick={() => setSectionsModalOpen(true)}
                      title="Configurar secciones"
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#c8c6c4] bg-white text-[#605e5c] transition hover:border-[#094732] hover:text-[#094732]"
                    >
                      <Settings2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              ) : null}

              <div data-tour="agenda-date-nav" className="flex shrink-0 flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="h-8 shrink-0"
                onClick={() => setSelectedDate(getLocalDateInputValue())}
              >
                Hoy
              </Button>
              <div className="flex shrink-0 gap-1">
                {weekStrip.map((dayIso) => {
                  const isSel = dayIso === selectedDate;
                  const short = new Date(`${dayIso}T12:00:00`).toLocaleDateString("es-BO", {
                    weekday: "short",
                  });
                  const num = new Date(`${dayIso}T12:00:00`).getDate();
                  return (
                    <button
                      key={dayIso}
                      type="button"
                      onClick={() => setSelectedDate(dayIso)}
                      className={`flex min-w-[38px] shrink-0 flex-col items-center rounded-md border px-1 py-1 text-[10px] transition ${
                        isSel
                          ? "border-[#094732] bg-[#ecfdf5] font-semibold text-[#094732]"
                          : "border-[#edebe9] bg-white text-[#605e5c] hover:border-[#c8c6c4]"
                      }`}
                    >
                      <span className="uppercase leading-none">{short.replace(/\.$/, "")}</span>
                      <span className="text-sm font-bold tabular-nums leading-tight">{num}</span>
                    </button>
                  );
                })}
              </div>

              <div className="flex shrink-0 items-center gap-1">
                <Button type="button" variant="secondary" size="sm" className="h-8 px-2" onClick={() => shiftDate(-1)}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="h-8 w-[140px] shrink-0 rounded-md border border-[#8a8886] px-2 text-sm"
                />
                <Button type="button" variant="secondary" size="sm" className="h-8 px-2" onClick={() => shiftDate(1)}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
              </div>
              <Button
                type="button"
                data-tour="agenda-new-btn"
                size="sm"
                className="h-8 shrink-0 gap-1"
                onClick={() => openNewModal("09:00", null)}
                leftIcon={<Plus className="h-3.5 w-3.5" />}
              >
                Nueva
              </Button>
              <div className="relative shrink-0" ref={printDropdownRef}>
                <Button
                  type="button"
                  data-tour="agenda-print-btn"
                  variant="secondary"
                  size="sm"
                  className="h-8 shrink-0 gap-1"
                  onClick={() => setPrintDropdownOpen((o) => !o)}
                  leftIcon={<Printer className="h-3.5 w-3.5" />}
                >
                  Imprimir
                </Button>
                  {printDropdownOpen && (
                    <div className="absolute right-0 top-full z-20 mt-1 min-w-[170px] rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
                      <button
                        type="button"
                        onClick={() => { setPrintMode("planner"); setPrintDropdownOpen(false); }}
                        className="flex w-full items-center gap-2 px-4 py-2 text-xs text-slate-700 hover:bg-slate-50"
                      >
                        <List className="h-3.5 w-3.5 text-slate-400" />
                        Vista planilla
                      </button>
                      {SHOW_STATIONS_TOGGLE && (
                        <button
                          type="button"
                          onClick={() => { setPrintMode("stations"); setPrintDropdownOpen(false); }}
                          className="flex w-full items-center gap-2 px-4 py-2 text-xs text-slate-700 hover:bg-slate-50"
                        >
                          <Columns3 className="h-3.5 w-3.5 text-slate-400" />
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
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[#c8c6c4] bg-white text-[#605e5c] transition hover:border-[#094732] hover:text-[#094732]"
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
        <section data-tour="agenda-grid" className="mb-2 min-h-0 flex-1 overflow-hidden rounded-sm border border-[#c8c6c4] bg-white shadow-sm print:shadow-none">
          <div className="border-b border-[#c8c6c4] bg-[#f3f2f1] px-3 py-2 text-center text-sm font-semibold uppercase tracking-wide text-[#201f1e] print:bg-[#f3f2f1]">
            {headerTitle}
          </div>
          <div className="flex items-center justify-between border-b border-[#edebe9] bg-[#faf9f8] px-3 py-1">
            <p className="text-[10px] text-[#605e5c]">FECHA DE INICIO ({weekdayUpper})</p>
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
          <div className="max-h-[min(72vh,900px)] overflow-auto">
            <div
              className="grid min-w-[min(100%,720px)]"
              style={{ gridTemplateColumns: "92px minmax(240px, 1fr)" }}
            >
              {PLANNER_SLOTS.map((slot, idx) => {
                const rowTickets = plannerMap.get(slot.minuteOfDay) ?? [];
                const zebra = idx % 2 === 0;
                const slotOpen = isSlotOpen(slot.minuteOfDay);
                const closed = openRangesMinutes !== null && !slotOpen;
                return (
                  <div key={`${slot.minuteOfDay}-${slot.stepMinutes}`} className="contents">
                    <div
                      className={`border-b border-r border-[#edebe9] px-2 py-1.5 text-xs font-medium tabular-nums ${
                        closed
                          ? "bg-[#f3f3f2] text-[#a19f9d]"
                          : zebra ? "bg-[#faf9f8]" : "bg-white"
                      }`}
                    >
                      <span className={closed ? "opacity-60" : ""}>{slot.label}</span>
                      {closed && (
                        <span className="ml-1 text-[9px] font-semibold uppercase tracking-wide text-[#bebbb8]">cerrado</span>
                      )}
                    </div>
                    <AgendaDropCell
                      id={plannerDropId(slot.minuteOfDay)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          const h = Math.floor(slot.minuteOfDay / 60);
                          const m = slot.minuteOfDay % 60;
                          openNewModal(
                            `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`,
                            null
                          );
                        }
                      }}
                      onClick={() => {
                        if (activeDragTicket) return;
                        const h = Math.floor(slot.minuteOfDay / 60);
                        const m = slot.minuteOfDay % 60;
                        openNewModal(
                          `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`,
                          null
                        );
                      }}
                      className={`border-b border-[#edebe9] px-2 py-1.5 transition ${
                        closed
                          ? "cursor-default bg-[#f3f3f2] opacity-60"
                          : `cursor-pointer rounded-sm hover:bg-[#f3f2f1] focus-visible:outline focus-visible:ring-2 focus-visible:ring-[#201f1e]/25 ${
                              zebra ? "bg-[#fafaf9]" : "bg-white"
                            }`
                      }`}
                    >
                      <div className="flex min-h-[88px] flex-wrap items-start gap-1.5 content-start py-0.5">
                        {rowTickets.map((t) => (
                          <DraggableAgendaTicketCard
                            key={t.id}
                            ticket={t}
                            disabled={reschedulingTicketId === t.id}
                          />
                        ))}
                      </div>
                    </AgendaDropCell>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
        ) : null}

        {agendaView === "stations" ? (
        <section className="mb-2 min-h-0 flex-1 overflow-hidden rounded-sm border border-[#edebe9] bg-white shadow-sm">
          <div className="border-b border-[#edebe9] bg-[#f3f2f1] px-3 py-2.5">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold text-[#323130]">Puestos por sección</h2>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  {stationSections.map((sec, idx) => {
                    const from = stationSections.slice(0, idx).reduce((s, x) => s + x.count, 0) + 1;
                    const to = from + sec.count - 1;
                    return (
                      <span
                        key={sec.id}
                        style={{ background: sec.headerBg, color: sec.headerText }}
                        className="rounded-sm px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide"
                      >
                        {from}–{to} · {sec.label}
                      </span>
                    );
                  })}
                  <span className="text-[10px] text-[#605e5c]">
                    · {GRID_FIRST_HOUR}:00–{GRID_LAST_HOUR}:00 · <strong className="text-[#323130]">{activeBranchLabel}</strong>
                  </span>
                </div>
              </div>
              {canConfigureSections && (
                <button
                  type="button"
                  onClick={() => setSectionsModalOpen(true)}
                  className="mt-0.5 inline-flex shrink-0 items-center gap-1 rounded border border-[#c8c6c4] bg-white px-2 py-1 text-[10px] font-semibold text-[#605e5c] transition hover:border-[#094732] hover:text-[#094732]"
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
              <div className="sticky left-0 z-10 border border-[#edebe9] bg-[#d0d0d0] px-1 py-2 text-[9px] font-bold uppercase tracking-wider text-[#605e5c]">
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
                      className="border border-[#edebe9] py-2 text-center text-[11px] font-bold uppercase tracking-wide"
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
              <div className="sticky left-0 z-10 border border-[#edebe9] bg-[#e8e8e8] px-1 py-2 text-[10px] font-semibold uppercase text-[#605e5c]">
                Hora
              </div>
              {stationLabels.map((label, idx) => {
                const sec = stationColSection[idx];
                return (
                  <div
                    key={`${label}-${idx}`}
                    style={{ background: sec?.labelBg ?? "#ecfdf5", color: sec?.headerText ?? "#094732" }}
                    className="border border-[#edebe9] px-1 py-2 text-center text-[10px] font-semibold leading-tight"
                  >
                    {label}
                  </div>
                );
              })}

              {Array.from({ length: GRID_LAST_HOUR - GRID_FIRST_HOUR + 1 }, (_, i) => GRID_FIRST_HOUR + i).map((hour) => (
                <div key={`row-${hour}`} className="contents">
                  <div className="sticky left-0 z-10 border border-[#edebe9] bg-[#f3f2f1] px-2 py-3 text-xs font-semibold tabular-nums">
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
                        className="relative min-h-[88px] cursor-pointer border border-[#edebe9] bg-white p-1.5 transition hover:bg-[#faf9f8] focus-visible:outline focus-visible:ring-2 focus-visible:ring-[#094732]/35 sm:min-h-[96px]"
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
                          className="pointer-events-none absolute bottom-0.5 right-0.5 rounded bg-white/90 px-1 text-[9px] text-[#a19f9d] opacity-60"
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
          <p className="mt-3 text-center text-xs text-[#605e5c]">Cargando reservas…</p>
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
