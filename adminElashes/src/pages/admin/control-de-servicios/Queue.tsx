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
import { ChevronDown, HelpCircle, Plus, RefreshCw, Tv2, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useWebSocket, type WsEvent } from "@/core/hooks/useWebSocket";
import { toast } from "react-toastify";

import Layout from "../../../components/common/layout";
import { Button } from "../../../components/common/ui";
import GenericModal from "../../../components/common/modal/GenericModal";
import { ConfirmDialog } from "../../../components/common/ConfirmDialog";
import { AgendaService, type ClientForSelect, type ProfessionalForSelect, type ServiceCategoryOption, type ServiceOption, type TicketItem } from "../../../core/services/agenda/agenda.service";
import { CatalogService, type QuestionnaireItem } from "../../../core/services/catalog/catalog.service";
import { ClientService, type EyeTypeOption } from "../../../core/services/client/client.service";
import { BranchService } from "../../../core/services/branch/branch.service";
import RegisterClientModal from "../clients/RegisterClientModal";
import { TrackingService } from "../../../core/services/tracking/tracking.service";
import { BRANCH_STORAGE_KEY, getSelectedBranchId } from "../../../core/utils/branch";
import { getApiErrorMessage } from "../../../core/utils/apiError";

import { COLUMN_TO_STATUS, getColumnForStatus, STATUS_LABELS, todayDate } from "./control.constants";
import {
  BC_BTN_PRIMARY,
  BC_BTN_SECONDARY,
  BC_FIELD,
  BC_INFO_BOX,
  BC_LABEL,
  BC_PAGE,
  BC_CONTAINER,
  BC_TEXTAREA,
  BC_WARN_BOX,
} from "./control.bc365.styles";
import DraggableTicketCard from "./components/DraggableTicketCard";
import DroppableColumn from "./components/DroppableColumn";
import TicketDragOverlay from "./components/TicketDragOverlay";
import QueueTvDisplay from "./components/QueueTvDisplay";
import OperariaStatusPanel from "./components/OperariaStatusPanel";
import QueueTutorialModal, { getQueueTutorialStorageKey } from "./components/QueueTutorialModal";
import { useOperariaStatuses } from "./queue/useOperariaStatuses";
import useAuth from "../../../core/hooks/useAuth";

// TEMPORAL (2026-08-17): Control de servicios normalmente solo muestra las
// citas del día seleccionado. Para agilizar pruebas end-to-end (reservar
// desde marketplace y verla aparecer acá sin cambiar de fecha), se muestran
// todas las citas de hoy en adelante (no las pasadas). Para volver a como
// estaba (solo el día seleccionado), poner en false.
const SHOW_ALL_DATES_FOR_TESTING = true;

const Main = ({ embedded = false }: { embedded?: boolean }) => {
  const navigate = useNavigate();
  const [tickets, setTickets] = useState<TicketItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeBranchId, setActiveBranchId] = useState<number | null>(() => getSelectedBranchId());
  const [professionals, setProfessionals] = useState<ProfessionalForSelect[]>([]);
  const [questionnaires, setQuestionnaires] = useState<QuestionnaireItem[]>([]);
  const [isFinishModalOpen, setIsFinishModalOpen] = useState(false);
  const [finishTarget, setFinishTarget] = useState<TicketItem | null>(null);
  const [finishNotes, setFinishNotes] = useState("");
  const [finishProfessionalId, setFinishProfessionalId] = useState("");
  const [finishQuestionnaireId, setFinishQuestionnaireId] = useState("");
  const [questionnaire, setQuestionnaire] = useState<QuestionnaireItem | null>(null);
  const [questionnaireResponses, setQuestionnaireResponses] = useState<Record<string, unknown>>({});
  const [isQuestionnaireModalOpen, setIsQuestionnaireModalOpen] = useState(false);
  const [isSubmittingTracking, setIsSubmittingTracking] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [countdown, setCountdown] = useState(15);
  const [tvMode, setTvMode] = useState(false);
  const [operariasOpen, setOperariasOpen] = useState(true);
  const [showTutorial, setShowTutorial] = useState(false);
  const { user } = useAuth();
  const tutorialStorageKey = useMemo(() => getQueueTutorialStorageKey(user?.id), [user?.id]);

  // Primera vez que este usuario entra al tablero de atención: mostrar la
  // guía rápida. La key es por usuario, no por navegador, porque varias
  // operarias suelen compartir la misma laptop.
  useEffect(() => {
    if (!user?.id) return;
    try {
      if (!localStorage.getItem(tutorialStorageKey)) setShowTutorial(true);
    } catch {
      // localStorage puede fallar en modo privado — simplemente no se muestra.
    }
  }, [tutorialStorageKey, user?.id]);
  const [filterService] = useState("");
  const [filterClient] = useState("");
  const [filterDate] = useState(todayDate());
  const [filterTime] = useState("");
  const [filterProfessionalId] = useState("");
  const [ticketToDelete, setTicketToDelete] = useState<TicketItem | null>(null);
  const [deleteConfirmationCode, setDeleteConfirmationCode] = useState("");
  const [isDeletingTicket, setIsDeletingTicket] = useState(false);
  const [editingTicketId, setEditingTicketId] = useState<number | null>(null);
  const [activeDragTicket, setActiveDragTicket] = useState<TicketItem | null>(null);
  const [isDraggingBoard, setIsDraggingBoard] = useState(false);
  const [servicesLookup, setServicesLookup] = useState<ServiceOption[]>([]);
  const [categoriesLookup, setCategoriesLookup] = useState<ServiceCategoryOption[]>([]);
  const [categoryRequiresQuestionnaire, setCategoryRequiresQuestionnaire] = useState(false);
  const [finishSiblingIds, setFinishSiblingIds] = useState<number[]>([]);

  // Clienta del ticket — se puede corregir/asignar antes de finalizar en vez
  // de quedarse con "Cliente Mostrador" para siempre.
  const [clients, setClients] = useState<ClientForSelect[]>([]);
  const [eyeTypes, setEyeTypes] = useState<EyeTypeOption[]>([]);
  const [eyeTypesError, setEyeTypesError] = useState<string | null>(null);
  const [isLoadingEyeTypes, setIsLoadingEyeTypes] = useState(false);
  const [branches, setBranches] = useState<{ id: number; name: string }[]>([]);
  const [registerClientTarget, setRegisterClientTarget] = useState<TicketItem | null>(null);

  // Cola por operaria: si al liberarse una operaria hay clientas esperándola
  // específicamente (ya asignadas mientras estaba ocupada), se pregunta si
  // arrancar con la siguiente en vez de hacerlo solo/automático.
  const [queuePromptTicket, setQueuePromptTicket] = useState<TicketItem | null>(null);

  const dndSensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 120, tolerance: 6 },
    })
  );

  const collisionDetection: CollisionDetection = (args) => {
    const pointerHits = pointerWithin(args);
    if (pointerHits.length > 0) return pointerHits;
    return closestCenter(args);
  };

  const REFRESH_INTERVAL = 45;

  // El polling (cada 45s) y el WS pueden disparar varios loadTickets() en
  // paralelo (p. ej. uno arrancó justo antes de mover un ticket y responde
  // después). Sin esto, esa respuesta vieja pisaba el cambio recién hecho
  // con el estado de antes — el ticket "volvía" hasta el próximo refresh.
  // Solo se aplica la respuesta de la petición más reciente.
  const loadTicketsRequestIdRef = useRef(0);

  const loadTickets = useCallback(async (silent = false) => {
    if (!silent) setIsLoading(true);
    const requestId = ++loadTicketsRequestIdRef.current;
    try {
      const today = todayDate();
      const data = await AgendaService.listTickets({
        limit: 500,
        branch_id: activeBranchId ?? undefined,
        start_date: SHOW_ALL_DATES_FOR_TESTING ? today : (filterDate || today),
        end_date: SHOW_ALL_DATES_FOR_TESTING ? undefined : (filterDate || today),
      });
      if (requestId !== loadTicketsRequestIdRef.current) return;
      setTickets(data);
      setLastRefresh(new Date());
      setCountdown(REFRESH_INTERVAL);
    } catch (error) {
      if (requestId !== loadTicketsRequestIdRef.current) return;
      console.error("Error cargando tickets:", error);
      if (!silent) toast.error("No se pudo cargar el tablero de atencion.");
      if (!silent) setTickets([]);
    } finally {
      if (requestId === loadTicketsRequestIdRef.current && !silent) setIsLoading(false);
    }
  }, [activeBranchId, filterDate]);

  useEffect(() => {
    void loadTickets();
  }, [loadTickets]);

  // WebSocket: actualización en tiempo real
  const applyWsEvent = useCallback((event: WsEvent) => {
    if (event.event === "ticket_created") {
      void loadTickets();
      return;
    }
    setTickets((prev) => {
      if (event.event === "ticket_deleted") {
        return prev.filter((t) => t.id !== event.ticket_id);
      }
      // event.professional_id ya viene con el valor real (puede ser null si
      // se quitó la operaria) — usar "??" acá pisaba ese null con el valor
      // viejo y la operaria "revivía" en la tarjeta apenas llegaba el evento.
      const professional = event.professional_id != null
        ? professionals.find((p) => p.id === event.professional_id)
        : null;
      return prev.map((t) =>
        t.id === event.ticket_id
          ? { ...t, status: event.status, professional_id: event.professional_id, professional_name: professional?.username ?? null }
          : t
      );
    });
  }, [loadTickets, professionals]);

  useWebSocket(activeBranchId, applyWsEvent);

  // Auto-refresh cada 15 segundos (respaldo si WS cae)
  useEffect(() => {
    const interval = window.setInterval(() => {
      void loadTickets();
    }, REFRESH_INTERVAL * 1000);
    return () => window.clearInterval(interval);
  }, [loadTickets]);

  // Contador regresivo
  useEffect(() => {
    const tick = window.setInterval(() => {
      setCountdown((prev) => (prev <= 1 ? REFRESH_INTERVAL : prev - 1));
    }, 1000);
    return () => window.clearInterval(tick);
  }, [loadTickets]);

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 60000);
    return () => window.clearInterval(interval);
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

  // Profesionales filtrados por sucursal activa — se recarga al cambiar de sucursal
  useEffect(() => {
    AgendaService.listProfessionalsForSelect({
      limit: 200,
      ...(activeBranchId ? { branch_id: activeBranchId } : {}),
    })
      .then(setProfessionals)
      .catch((error) => {
        console.error("Error cargando profesionales:", error);
        setProfessionals([]);
      });
  }, [activeBranchId]);

  // Clientas para poder asignarlas/corregirlas en un ticket antes de finalizar
  useEffect(() => {
    AgendaService.listClientsForSelect({
      limit: 200,
      ...(activeBranchId ? { branch_id: activeBranchId } : {}),
    })
      .then(setClients)
      .catch(() => setClients([]));
  }, [activeBranchId]);

  useEffect(() => {
    setIsLoadingEyeTypes(true);
    setEyeTypesError(null);
    ClientService.listEyeTypes({ limit: 100 })
      .then(setEyeTypes)
      .catch(() => setEyeTypesError("No se pudieron cargar. Intenta de nuevo."))
      .finally(() => setIsLoadingEyeTypes(false));

    BranchService.list({ limit: 200 })
      .then(setBranches)
      .catch(() => setBranches([]));
  }, []);

  useEffect(() => {
    CatalogService.listQuestionnaires({ limit: 200 })
      .then(setQuestionnaires)
      .catch(() => setQuestionnaires([]));

    AgendaService.listServices({ limit: 300 })
      .then(setServicesLookup)
      .catch(() => {});

    AgendaService.listServiceCategories()
      .then(setCategoriesLookup)
      .catch(() => {});
  }, []);

  const getTicketDate = (iso: string) => {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return "";
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  };

  const getTicketTime = (iso: string) => {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return "";
    const h = String(date.getHours()).padStart(2, "0");
    const m = String(date.getMinutes()).padStart(2, "0");
    return `${h}:${m}`;
  };

  const formatLocalDateTime = (date: Date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    const h = String(date.getHours()).padStart(2, "0");
    const mi = String(date.getMinutes()).padStart(2, "0");
    const s = String(date.getSeconds()).padStart(2, "0");
    return `${y}-${m}-${d}T${h}:${mi}:${s}`;
  };

  // Cada ticket de la agenda es su propia tarjeta independiente, aunque
  // venga de la misma venta — el modo "Separados" del POS crea un
  // Appointment por servicio justamente para que cada uno se pueda asignar,
  // iniciar, mover y finalizar por separado (distinta operaria, distinto
  // horario). Antes esto agrupaba por sale_id en una sola tarjeta con "+N",
  // lo cual deshacía visualmente esa separación. El modo "Junto" no necesita
  // agrupamiento: ya crea un solo Appointment con varios service_ids, que
  // llega aquí con su propio service_names ya completo.
  const mergeTicketsBySaleId = (ticketList: TicketItem[]): TicketItem[] => ticketList;

  const filteredTickets = useMemo(() => {
    const serviceTerm = filterService.trim().toLowerCase();
    const clientTerm = filterClient.trim().toLowerCase();

    return tickets.filter((ticket) => {
      const servicesText = `${ticket.service_name ?? ""} ${(ticket.service_names ?? []).join(" ")}`.toLowerCase();
      const clientText = `${ticket.client_name ?? ""}`.toLowerCase();
      const ticketDate = getTicketDate(ticket.start_time);
      const ticketTime = getTicketTime(ticket.start_time);

      const matchesService = !serviceTerm || servicesText.includes(serviceTerm);
      const matchesClient = !clientTerm || clientText.includes(clientTerm);
      const matchesDate = SHOW_ALL_DATES_FOR_TESTING
        ? ticketDate >= todayDate()
        : !filterDate || ticketDate === filterDate;
      const matchesTime = !filterTime || ticketTime === filterTime;
      const matchesProfessional =
        !filterProfessionalId || String(ticket.professional_id ?? "") === filterProfessionalId;

      return matchesService && matchesClient && matchesDate && matchesTime && matchesProfessional;
    });
  }, [tickets, filterService, filterClient, filterDate, filterTime, filterProfessionalId]);

  // Resumen + previsualización de mantenimiento/retiro para el modal
  // "Finalizar atención" — mismo criterio que el backend (tracking_service:
  // días del Service, sólo si la categoría tiene el check activado), calculado
  // acá para mostrarlo antes de guardar, no después.
  const finishPreview = useMemo(() => {
    if (!finishTarget) return null;

    const serviceId = finishTarget.service_id ?? finishTarget.service_ids?.[0] ?? null;
    const service = serviceId ? servicesLookup.find((s) => s.id === serviceId) : undefined;
    const category = service?.category_id
      ? categoriesLookup.find((c) => c.id === service.category_id)
      : undefined;

    const addDays = (days: number) => {
      const d = new Date();
      d.setDate(d.getDate() + days);
      return d.toLocaleDateString("es-BO", { day: "numeric", month: "long", year: "numeric" });
    };

    const maintenanceDate =
      category?.has_maintenance && service?.maintenance_days != null
        ? addDays(service.maintenance_days)
        : null;
    const removalDate =
      category?.has_removal && service?.removal_days != null
        ? addDays(service.removal_days)
        : null;

    return {
      clientName: finishTarget.client_name,
      serviceNames: finishTarget.service_names?.length ? finishTarget.service_names : [finishTarget.service_name].filter(Boolean),
      totalPrice: (finishTarget.service_prices?.length ? finishTarget.service_prices : [finishTarget.service_price])
        .filter((p): p is number => typeof p === "number")
        .reduce((sum, p) => sum + p, 0),
      maintenanceDate,
      removalDate,
    };
  }, [finishTarget, servicesLookup, categoriesLookup]);

  // Orden de llegada: el ticket más viejo (id más chico) primero, los nuevos
  // se van agregando al final de la columna en vez de aparecer arriba.
  const byArrivalOrder = (a: TicketItem, b: TicketItem) => a.id - b.id;

  const waitingTickets = useMemo(
    () => mergeTicketsBySaleId(
      filteredTickets.filter((ticket) => !ticket.is_ia && ["pending", "waiting", "confirmed"].includes(ticket.status))
    ).sort(byArrivalOrder),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filteredTickets]
  );

  const inServiceTickets = useMemo(
    () => mergeTicketsBySaleId(
      filteredTickets.filter((ticket) => !ticket.is_ia && ticket.status === "in_service")
    ).sort(byArrivalOrder),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filteredTickets]
  );

  const completedTickets = useMemo(
    () => mergeTicketsBySaleId(
      filteredTickets.filter((ticket) => !ticket.is_ia && ticket.status === "completed")
    ).sort(byArrivalOrder),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filteredTickets]
  );

  const operariaStatuses = useOperariaStatuses(tickets, professionals);

  // El selector "Asignar operaria" del popup de edición usaba `professional.is_busy`
  // (una foto de `professionals` que solo se refresca en ciertos puntos), por eso
  // podía mostrar "Libre" a una operaria que el tablero ya sabía "En servicio".
  // `operariaStatuses` se deriva en vivo de `tickets`, así que es la fuente correcta.
  const busyProfessionalIds = useMemo(
    () => new Set(operariaStatuses.filter((o) => o.currentStatus === "in_service").map((o) => o.professionalId)),
    [operariaStatuses]
  );

  const handleNoShow = async (ticket: TicketItem) => {
    const siblingIds = getSiblingIds(ticket);
    const allIds = [ticket.id, ...siblingIds];
    const snapshot = tickets;
    applyGroupMoveLocally(allIds, { status: "cancelled" });
    try {
      await Promise.all(allIds.map((id) => AgendaService.updateAppointment(id, { status: "cancelled" })));
      if (ticket.client_id) {
        ClientService.update(ticket.client_id, { status: "sin_estado" }).catch(() => {});
      }
      toast.success(`Turno ${ticket.ticket_code ?? `#${ticket.id}`} cancelado — no se presentó.`);
      await loadTickets(true);
    } catch (error) {
      setTickets(snapshot);
      toast.error(getApiErrorMessage(error, "No se pudo cancelar el turno."));
    }
  };

  const handleCancelTicket = async (ticket: TicketItem) => {
    const siblingIds = getSiblingIds(ticket);
    const allIds = [ticket.id, ...siblingIds];
    const snapshot = tickets;
    applyGroupMoveLocally(allIds, { status: "cancelled" });
    try {
      await Promise.all(allIds.map((id) => AgendaService.updateAppointment(id, { status: "cancelled" })));
      if (ticket.client_id) {
        ClientService.update(ticket.client_id, { status: "sin_estado" }).catch(() => {});
      }
      toast.success(`Ticket ${ticket.ticket_code ?? `#${ticket.id}`} cancelado.`);
      await loadTickets(true);
    } catch (error) {
      setTickets(snapshot);
      toast.error(getApiErrorMessage(error, "No se pudo cancelar el ticket."));
    }
  };

  const handleStartService = async (ticket: TicketItem) => {
    if (!ticket.professional_id) {
      toast.warning("Asigna una operaria antes de iniciar la atención.");
      return;
    }

    const alreadyInService = inServiceTickets.find(
      (t) => t.professional_id === ticket.professional_id && t.id !== ticket.id
    );
    if (alreadyInService) {
      const clientName = alreadyInService.client_name ?? "otro cliente";
      toast.error(
        `La operaria ya está atendiendo a ${clientName}. Finaliza ese servicio antes de iniciar uno nuevo.`
      );
      return;
    }

    const siblingIds = getSiblingIds(ticket);
    const allIds = [ticket.id, ...siblingIds];
    if (isGroupBusy(allIds)) return;
    markGroupBusy(allIds);
    const snapshot = tickets;
    applyGroupMoveLocally(allIds, { status: "in_service" });
    try {
      // El chequeo que importa acá (¿la operaria ya está atendiendo a otra
      // persona ahora mismo?) ya se hizo arriba. El chequeo de "choque de
      // horario" del backend es para agenda reservada — los tickets en cola
      // suelen compartir el mismo horario "de relleno" entre sí, así que ese
      // chequeo los rechazaba sin que hubiera ningún conflicto real.
      await Promise.all(allIds.map((id) => AgendaService.updateAppointment(id, { status: "in_service", skip_availability_check: true })));
      toast.success("Atención iniciada.");
      void loadTickets();
    } catch (error) {
      setTickets(snapshot);
      console.error("Error iniciando atención:", error);
      toast.error(getApiErrorMessage(error, "No se pudo iniciar la atención."));
    } finally {
      clearGroupBusy(allIds);
    }
  };

  // Se llama después de finalizar/completar un ticket — si la operaria que
  // acaba de liberarse tiene otra clienta esperándola (ya asignada), ofrece
  // pasarla a servicio en vez de dejarlo para que alguien se acuerde solo.
  const checkQueueForFreedOperaria = (professionalId: number | null | undefined) => {
    if (!professionalId) return;
    const next = [...waitingTickets]
      .filter((t) => t.professional_id === professionalId)
      .sort((a, b) => a.start_time.localeCompare(b.start_time))[0];
    if (next) setQueuePromptTicket(next);
  };

  const handleConfirmQueueStart = async () => {
    if (!queuePromptTicket) return;
    const ticket = queuePromptTicket;
    setQueuePromptTicket(null);
    await handleStartService(ticket);
  };

  const handleOpenFinishModal = (ticket: TicketItem) => {
    // Determine questionnaire from service category config
    const serviceId = ticket.service_id ?? ticket.service_ids?.[0] ?? null;
    let autoQuestionnaireId = "";
    let autoRequired = false;

    if (serviceId) {
      const svc = servicesLookup.find((s) => s.id === serviceId);
      if (svc?.category_id) {
        const cat = categoriesLookup.find((c) => c.id === svc.category_id);
        if (cat?.questionnaire_id) {
          autoQuestionnaireId = String(cat.questionnaire_id);
          autoRequired = Boolean(cat.questionnaire_required);
        }
      }
    }

    setFinishTarget(ticket);
    setFinishSiblingIds(getSiblingIds(ticket));
    setFinishNotes("");
    // Precargar con la operaria que ya está asignada al ticket — si no se
    // toca el selector, no debería volver a pedirla como si no hubiera nadie.
    setFinishProfessionalId(ticket.professional_id ? String(ticket.professional_id) : "");
    setFinishQuestionnaireId(autoQuestionnaireId);
    setCategoryRequiresQuestionnaire(autoRequired);
    setQuestionnaire(null);
    setQuestionnaireResponses({});
    setIsQuestionnaireModalOpen(false);

    if (autoQuestionnaireId) {
      void handleQuestionnaireChange(autoQuestionnaireId);
    }

    setIsFinishModalOpen(true);
  };

  const handleQuestionnaireChange = async (id: string) => {
    setFinishQuestionnaireId(id);

    if (!id) {
      setQuestionnaire(null);
      setQuestionnaireResponses({});
      setIsQuestionnaireModalOpen(false);
      return;
    }

    try {
      const data = await CatalogService.getQuestionnaire(Number(id));
      setQuestionnaire(data);
      setQuestionnaireResponses({});
    } catch (error) {
      console.error("Error cargando cuestionario:", error);
      toast.error("No se pudo cargar el cuestionario.");
      setQuestionnaire(null);
      setIsQuestionnaireModalOpen(false);
    }
  };

  const handleFinishService = async () => {
    if (!finishTarget) return;

    if (!activeBranchId) {
      toast.warning("Selecciona una sucursal para finalizar.");
      return;
    }

    const isMinor = typeof finishTarget.client_age === "number" && finishTarget.client_age < 18;
    const hasQuestionnaire = Boolean(finishQuestionnaireId);

    if (isMinor && !hasQuestionnaire) {
      toast.warning("La clienta es menor de edad. El cuestionario es obligatorio para finalizar.");
      return;
    }

    if (categoryRequiresQuestionnaire && !hasQuestionnaire) {
      toast.warning("Este servicio requiere cuestionario para finalizar.");
      return;
    }

    setIsSubmittingTracking(true);
    const freedProfessionalId = finishTarget.professional_id;

    try {
      await TrackingService.create({
        client_id: finishTarget.client_id,
        appointment_id: finishTarget.id,
        branch_id: activeBranchId,
        professional_id: finishProfessionalId ? Number(finishProfessionalId) : undefined,
        questionnaire_id: finishQuestionnaireId ? Number(finishQuestionnaireId) : undefined,
        design_notes: finishNotes.trim() || undefined,
        last_application_date: new Date().toISOString(),
        questionnaire_responses: questionnaireResponses,
      });

      await AgendaService.updateAppointment(finishTarget.id, { status: "completed" });
      // Completar también los tickets hermanos del mismo sale (ticket "juntos")
      if (finishSiblingIds.length > 0) {
        applyGroupMoveLocally(finishSiblingIds, { status: "completed" });
        await Promise.all(finishSiblingIds.map((id) => AgendaService.updateAppointment(id, { status: "completed" })));
      }
      toast.success("Atencion finalizada y tracking registrado.");
      setIsFinishModalOpen(false);
      setFinishTarget(null);
      setFinishSiblingIds([]);
    } catch (error) {
      console.error("Error finalizando atencion:", error);
      toast.error(getApiErrorMessage(error, "No se pudo finalizar la atencion."));
    } finally {
      setIsSubmittingTracking(false);
    }

    AgendaService.listProfessionalsForSelect({
      limit: 200,
      ...(activeBranchId ? { branch_id: activeBranchId } : {}),
    })
      .then(setProfessionals)
      .catch(() => {});
    checkQueueForFreedOperaria(freedProfessionalId);
    void loadTickets();
  };

  const handleDragStart = (event: DragStartEvent) => {
    const id = event.active.id;
    if (typeof id !== "string" || !id.startsWith("ticket-")) return;
    const ticketId = Number(id.replace("ticket-", ""));
    const ticket = tickets.find((t) => t.id === ticketId) ?? null;
    setActiveDragTicket(ticket);
    setIsDraggingBoard(true);
  };

  const handleDragCancel = () => {
    setActiveDragTicket(null);
    setIsDraggingBoard(false);
  };

  // IDs de tickets con una petición de cambio de estado en curso — evita que
  // un doble clic (o arrastrar rápido) dispare dos peticiones superpuestas
  // para el mismo grupo, que pueden resolver en distinto orden y dejar a los
  // tickets hermanos de una venta con un status distinto entre sí (el grupo
  // se "parte" visualmente hasta el próximo refresh).
  const pendingTicketIdsRef = useRef<Set<number>>(new Set());

  const isGroupBusy = (ids: number[]) => ids.some((id) => pendingTicketIdsRef.current.has(id));
  const markGroupBusy = (ids: number[]) => ids.forEach((id) => pendingTicketIdsRef.current.add(id));
  const clearGroupBusy = (ids: number[]) => ids.forEach((id) => pendingTicketIdsRef.current.delete(id));

  const applyTicketMoveLocally = (ticketId: number, patch: Partial<TicketItem>) => {
    setTickets((prev) => prev.map((t) => (t.id === ticketId ? { ...t, ...patch } : t)));
  };

  const applyGroupMoveLocally = (ids: number[], patch: Partial<TicketItem>) => {
    setTickets((prev) => prev.map((t) => (ids.includes(t.id) ? { ...t, ...patch } : t)));
  };

  // Cada ticket se mueve/asigna/finaliza de forma independiente, aunque
  // comparta sale_id con otros (ver comentario de mergeTicketsBySaleId).
  const getSiblingIds = (_ticket: TicketItem): number[] => [];

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveDragTicket(null);
    setIsDraggingBoard(false);

    const { active, over } = event;
    if (!over) return;

    const ticketId =
      typeof active.id === "string" && active.id.startsWith("ticket-")
        ? Number(active.id.replace("ticket-", ""))
        : null;
    const targetColumn = String(over.id);

    if (!ticketId || !["waiting", "in_service", "completed", "ia"].includes(targetColumn)) return;

    const ticket = tickets.find((t) => t.id === ticketId);
    if (!ticket) return;

    const siblingIds = getSiblingIds(ticket);

    if (targetColumn === "ia") {
      if (ticket.is_ia) return;

      const allIds = [ticketId, ...siblingIds];
      if (isGroupBusy(allIds)) return;
      markGroupBusy(allIds);
      const snapshot = tickets;
      applyGroupMoveLocally(allIds, { is_ia: true });
      try {
        await Promise.all(allIds.map((id) => AgendaService.updateAppointment(id, { is_ia: true })));
        toast.success("Ticket movido a Tickets con IA.");
        void loadTickets(true);
      } catch (error) {
        setTickets(snapshot);
        console.error("Error moviendo ticket a IA:", error);
        toast.error(getApiErrorMessage(error, "No se pudo mover el ticket a IA."));
      } finally {
        clearGroupBusy(allIds);
      }
      return;
    }

    if (!["waiting", "in_service", "completed"].includes(targetColumn)) return;

    const newStatus = COLUMN_TO_STATUS[targetColumn];
    if (!newStatus) return;

    const currentColumn = getColumnForStatus(ticket.status);
    const statusUnchanged = currentColumn === targetColumn;
    if (statusUnchanged && !ticket.is_ia) return;

    if (newStatus === "in_service" && !ticket.professional_id) {
      toast.warning("Asigna una operaria antes de mover a En servicio.");
      return;
    }

    const allIds = [ticketId, ...siblingIds];
    if (isGroupBusy(allIds)) return;
    markGroupBusy(allIds);
    const snapshot = tickets;
    applyGroupMoveLocally(allIds, { status: newStatus, is_ia: false });

    try {
      await Promise.all(allIds.map((id) => AgendaService.updateAppointment(id, {
        status: newStatus,
        is_ia: false,
        skip_availability_check: true,
      })));
      toast.success(`Ticket movido a ${STATUS_LABELS[newStatus] ?? targetColumn}.`);
      void loadTickets(true);
    } catch (error) {
      setTickets(snapshot);
      console.error("Error moviendo ticket:", error);
      toast.error(getApiErrorMessage(error, "No se pudo mover el ticket."));
    } finally {
      clearGroupBusy(allIds);
    }
  };

  const handleDeleteClick = (ticket: TicketItem) => {
    setTicketToDelete(ticket);
    setDeleteConfirmationCode("");
  };

  const handleMarkCompleted = async (ticket: TicketItem) => {
    const siblingIds = getSiblingIds(ticket);
    const allIds = [ticket.id, ...siblingIds];
    if (isGroupBusy(allIds)) return;
    markGroupBusy(allIds);
    const snapshot = tickets;
    applyGroupMoveLocally(allIds, { status: "completed" });
    try {
      await Promise.all(allIds.map((id) => AgendaService.updateAppointment(id, { status: "completed" })));
      toast.success("Ticket finalizado.");
      checkQueueForFreedOperaria(ticket.professional_id);
      void loadTickets();
    } catch (error) {
      setTickets(snapshot);
      console.error("Error finalizando ticket:", error);
      toast.error(getApiErrorMessage(error, "No se pudo finalizar el ticket."));
    } finally {
      clearGroupBusy(allIds);
    }
  };

  const handleSaveTicketEdits = async (
    ticket: TicketItem,
    payload: { date: string; time: string; professionalId: string; isIa: boolean }
  ) => {
    const safeDate = payload.date?.trim();
    const safeTime = payload.time?.trim();

    if (!safeDate || !safeTime) {
      toast.warning("Fecha y hora son obligatorias para actualizar el ticket.");
      return;
    }

    const nextStart = new Date(`${safeDate}T${safeTime}:00`);
    if (Number.isNaN(nextStart.getTime())) {
      toast.warning("La fecha u hora ingresada no es válida.");
      return;
    }

    const currentStartMs = new Date(ticket.start_time).getTime();
    const currentEndMs = new Date(ticket.end_time).getTime();
    const durationMs = Number.isFinite(currentStartMs) && Number.isFinite(currentEndMs)
      ? Math.max(60_000, currentEndMs - currentStartMs)
      : 60 * 60 * 1000;
    const nextEnd = new Date(nextStart.getTime() + durationMs);

    // La operaria se asigna a TODO el grupo (mismos service_names de una
    // misma venta), no solo al ticket "principal" que muestra la tarjeta —
    // si no, los demás quedaban sin operaria y al pasar a "En servicio" se
    // separaban del grupo sin validar el choque de horario de la operaria.
    const siblingIds = getSiblingIds(ticket);
    const allIds = [ticket.id, ...siblingIds];
    if (isGroupBusy(allIds)) return;
    markGroupBusy(allIds);
    const professionalId = payload.professionalId ? Number(payload.professionalId) : null;

    const snapshot = tickets;
    applyGroupMoveLocally(allIds, {
      professional_id: professionalId,
      is_ia: payload.isIa,
    });
    setEditingTicketId(ticket.id);
    try {
      await AgendaService.updateAppointment(ticket.id, {
        start_time: formatLocalDateTime(nextStart),
        end_time: formatLocalDateTime(nextEnd),
        professional_id: professionalId,
        is_ia: payload.isIa,
        // Este popup ya no deja tocar fecha/hora, solo operaria — no tiene
        // sentido bloquear por choque de horario: se la está poniendo en su
        // cola para cuando se libere, no reservando ese horario exacto.
        skip_availability_check: true,
      });
      await Promise.all(siblingIds.map((id) => AgendaService.updateAppointment(id, {
        professional_id: professionalId,
        is_ia: payload.isIa,
        skip_availability_check: true,
      })));

      toast.success("Ticket actualizado.");
      void loadTickets();
    } catch (error) {
      setTickets(snapshot);
      console.error("Error actualizando ticket:", error);
      toast.error("No se pudo actualizar fecha, hora u operaria del ticket.");
    } finally {
      setEditingTicketId(null);
      clearGroupBusy(allIds);
    }
  };

  const handleChangeTicketClient = async (ticket: TicketItem, clientId: string) => {
    const parsed = Number(clientId);
    if (!clientId || Number.isNaN(parsed)) return;
    const client = clients.find((c) => c.id === parsed);
    const snapshot = tickets;
    applyTicketMoveLocally(ticket.id, {
      client_id: parsed,
      client_name: client ? `${client.nombre} ${client.apellido}`.trim() : ticket.client_name,
    });
    setEditingTicketId(ticket.id);
    try {
      await AgendaService.updateAppointment(ticket.id, { client_id: parsed });
      toast.success("Clienta actualizada.");
      void loadTickets();
    } catch (error) {
      setTickets(snapshot);
      console.error("Error actualizando clienta del ticket:", error);
      toast.error(getApiErrorMessage(error, "No se pudo actualizar la clienta del ticket."));
    } finally {
      setEditingTicketId(null);
    }
  };

  const handleRegisterClientSubmit = async (form: HTMLFormElement) => {
    if (!registerClientTarget) return;
    const fd = new FormData(form);
    const nombre = String(fd.get("nombre") ?? "").trim();
    const apellido = String(fd.get("apellido") ?? "").trim();
    const edadRaw = String(fd.get("edad") ?? "").trim();
    const phoneCC = String(fd.get("phone_country_code") ?? "+591").trim();
    const phone = String(fd.get("phone") ?? "").trim();
    const eyeRaw = String(fd.get("eye_type_id") ?? "").trim();
    const branchRaw = String(fd.get("branch_id") ?? "").trim();
    if (!nombre || !apellido) { toast.warning("Nombre y apellido son obligatorios."); return; }
    const parsedEdad = Number(edadRaw);
    const edad = edadRaw && Number.isFinite(parsedEdad) ? parsedEdad : undefined;
    if (edad !== undefined && (edad < 1 || edad > 100)) {
      toast.warning(edad < 1 ? "La edad no puede ser 0." : "La edad no puede ser mayor a 100.");
      return;
    }
    const normalizedPhone = phone.replace(/\D/g, "");
    const parsedEyeTypeId = Number(eyeRaw);
    const eye_type_id = eyeRaw && Number.isFinite(parsedEyeTypeId) && parsedEyeTypeId > 0 ? parsedEyeTypeId : undefined;
    const parsedBranchId = Number(branchRaw);
    const branch_id = branchRaw && Number.isFinite(parsedBranchId) && parsedBranchId > 0
      ? parsedBranchId
      : (activeBranchId ?? undefined);
    try {
      const created = await ClientService.create({
        name: nombre, last_name: apellido, age: edad,
        phone: normalizedPhone ? `${phoneCC}${normalizedPhone}` : undefined,
        eye_type_id, branch_id,
      });
      setClients((prev) => [{ id: created.id, nombre: created.nombre, apellido: created.apellido, phone: created.phone }, ...prev]);
      await handleChangeTicketClient(registerClientTarget, String(created.id));
      // Si se registró desde el modal de "Finalizar atención", ese modal
      // tiene su propia copia del ticket (finishTarget) — sincronizarla
      // también, si no, se sigue viendo la clienta anterior hasta cerrarlo.
      setFinishTarget((prev) =>
        prev && prev.id === registerClientTarget.id
          ? { ...prev, client_id: created.id, client_name: `${created.nombre} ${created.apellido}`.trim() }
          : prev
      );
      toast.success("Clienta registrada y asignada al ticket.");
      setRegisterClientTarget(null);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No se pudo registrar la clienta."));
    }
  };

  const handleConfirmDelete = async () => {
    if (!ticketToDelete) return;

    const normalizeCode = (value: string) => value.replace(/\s+/g, "").toUpperCase();
    const requiredCodeRaw = ticketToDelete.ticket_code?.trim() || String(ticketToDelete.id);
    const requiredCode = normalizeCode(requiredCodeRaw);
    const typedCode = normalizeCode(deleteConfirmationCode.trim());
    const numericId = String(ticketToDelete.id);
    const ticketDigits = (ticketToDelete.ticket_code ?? "").replace(/\D/g, "");
    const matchesTicketDigits = ticketDigits && typedCode === ticketDigits;

    if (!typedCode || (typedCode !== requiredCode && typedCode !== numericId && !matchesTicketDigits)) {
      toast.warning("Codigo incorrecto. Debes ingresar el codigo del ticket para eliminar.");
      return;
    }

    setIsDeletingTicket(true);
    try {
      await AgendaService.deleteAppointment(ticketToDelete.id);
      toast.success("Ticket eliminado.");
      setTicketToDelete(null);
      setDeleteConfirmationCode("");
      void loadTickets();
    } catch (error) {
      console.error("Error eliminando ticket:", error);
      toast.error(getApiErrorMessage(error, "No se pudo eliminar el ticket."));
    } finally {
      setIsDeletingTicket(false);
    }
  };

  const getRemainingLabel = (endTime: string) => {
    const remainingMs = new Date(endTime).getTime() - now;
    if (!Number.isFinite(remainingMs)) return "";
    const minutes = Math.max(0, Math.ceil(remainingMs / 60000));
    return minutes <= 0 ? "Finalizando" : `≈ ${minutes} min`;
  };

  // Mapa ticketId → minutos de espera calculados por operaria
  const waitingAccumulatedMinutes = useMemo(() => {
    const map = new Map<number, number>();

    // Cursor inicial por operaria: cuándo termina su ticket en servicio actual
    // Key: professional_id (o 0 = sin asignar)
    const cursors = new Map<number, number>();
    for (const t of inServiceTickets) {
      const proId = t.professional_id ?? 0;
      const end = new Date(t.end_time).getTime();
      if (Number.isFinite(end)) {
        cursors.set(proId, Math.max(cursors.get(proId) ?? now, end));
      }
    }

    // Cursor fallback global (para tickets sin operaria o sin cursor previo)
    const globalFree = cursors.size > 0
      ? Math.max(...Array.from(cursors.values()))
      : now;

    // Ordenar por start_time para que el cálculo respete el orden real de la agenda
    const sorted = [...waitingTickets].sort(
      (a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
    );

    for (const ticket of sorted) {
      const proId = ticket.professional_id ?? 0;
      const cursor = Math.max(now, cursors.get(proId) ?? globalFree);

      const durationMs = (() => {
        const start = new Date(ticket.start_time).getTime();
        const end = new Date(ticket.end_time).getTime();
        if (Number.isFinite(start) && Number.isFinite(end) && end > start) return end - start;
        return 60 * 60_000;
      })();

      map.set(ticket.id, Math.max(0, Math.ceil((cursor - now) / 60_000)));
      cursors.set(proId, cursor + durationMs);
    }

    return map;
  }, [waitingTickets, inServiceTickets, now]);

  const getWaitLabel = (ticketId: number) => {
    const mins = waitingAccumulatedMinutes.get(ticketId);
    if (mins === undefined) return "";
    if (mins === 0) return "Próximo";
    return `≈ ${mins} min espera`;
  };

  const isRecentlyCreated = (ticket: TicketItem) => {
    const raw = (ticket as unknown as { created_at?: string }).created_at;
    if (!raw) return false;
    const createdAt = new Date(raw).getTime();
    if (!Number.isFinite(createdAt)) return false;
    return now - createdAt <= 30 * 60 * 1000;
  };

  const renderQuestion = (question: NonNullable<QuestionnaireItem["questions"]>[number]) => {
    const key = String(question.id);
    const value = questionnaireResponses[key];

    if (question.question_type === "bool") {
      return (
        <select
          value={value === true ? "true" : value === false ? "false" : ""}
          onChange={(event) =>
            setQuestionnaireResponses((prev) => ({
              ...prev,
              [key]: event.target.value ? event.target.value === "true" : undefined,
            }))
          }
          className={BC_FIELD}
        >
          <option value="">Selecciona</option>
          <option value="true">Si</option>
          <option value="false">No</option>
        </select>
      );
    }

    if (question.question_type === "number") {
      return (
        <input
          type="number"
          value={value != null ? String(value) : ""}
          onChange={(event) =>
            setQuestionnaireResponses((prev) => ({
              ...prev,
              [key]: event.target.value ? Number(event.target.value) : undefined,
            }))
          }
          className={BC_FIELD}
        />
      );
    }

    return (
      <input
        type="text"
        value={value != null ? String(value) : ""}
        onChange={(event) =>
          setQuestionnaireResponses((prev) => ({
            ...prev,
            [key]: event.target.value,
          }))
        }
        className={BC_FIELD}
      />
    );
  };

  const handleCallNext = async () => {
    if (!activeBranchId) { toast.warning("Selecciona una sucursal."); return; }
    try {
      await AgendaService.callNextAppointment({ branch_id: activeBranchId });
      toast.success("Siguiente turno llamado.");
      void loadTickets();
    } catch {
      toast.error("No hay turnos pendientes o la operaria ya está ocupada.");
    }
  };

  const boardRibbon = (
    <div className="flex items-stretch border-b border-[#edebe9] bg-[#f3f2f1]">

      {/* Toggle operarias */}
      <button
        type="button"
        onClick={() => setOperariasOpen((v) => !v)}
        title={operariasOpen ? "Ocultar operarias" : "Mostrar operarias"}
        className="flex items-center gap-1 border-r border-[#edebe9] px-2 py-1 text-[9px] font-semibold uppercase tracking-wide text-[#a19f9d] hover:bg-[#edebe9] hover:text-[#605e5c] transition-colors"
      >
        <Users className="h-3 w-3" />
        <ChevronDown className={`h-2.5 w-2.5 transition-transform duration-300 ${operariasOpen ? "rotate-0" : "-rotate-90"}`} />
      </button>

      {/* Contadores */}
      <div className="flex items-center gap-3 px-2 py-1">
        {[
          { label: "Espera", count: waitingTickets.length },
          { label: "Servicio", count: inServiceTickets.length },
          { label: "Finalizadas", count: completedTickets.length },
        ].map((s) => (
          <div key={s.label} className="flex flex-col items-center">
            <p className="text-sm font-semibold tabular-nums text-[#201f1e]">{s.count}</p>
            <p className="text-[8px] font-semibold uppercase tracking-wide text-[#605e5c]">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Llamar siguiente + refresh — empujado a la derecha */}
      <div className="ml-auto flex items-center gap-1.5 px-2 py-1">
        <button
          type="button"
          data-tour="queue-call-next"
          onClick={() => void handleCallNext()}
          disabled={waitingTickets.length === 0 || isLoading}
          className={`flex h-7 items-center gap-1.5 rounded-sm px-3 text-xs font-semibold transition-all ${
            waitingTickets.length === 0 || isLoading
              ? "cursor-not-allowed bg-[#edebe9] text-[#a19f9d]"
              : "bg-[#094732] text-white hover:bg-[#063324]"
          }`}
        >
          Llamar siguiente
          {waitingTickets.length > 0 && (
            <span className={`rounded-full px-1 py-0.5 text-[9px] font-bold ${
              waitingTickets.length === 0 || isLoading ? "bg-[#c8c6c4] text-white" : "bg-white/25 text-white"
            }`}>
              {waitingTickets.length}
            </span>
          )}
        </button>

        <div className="flex flex-col items-center gap-0">
          <button
            type="button"
            onClick={() => void loadTickets()}
            disabled={isLoading}
            title="Actualizar ahora"
            className="flex h-7 w-7 items-center justify-center rounded-sm border border-[#edebe9] bg-white text-[#605e5c] transition hover:border-[#094732] hover:text-[#094732] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
          </button>
          <span className="text-[8px] font-semibold tabular-nums text-[#a19f9d]">
            {isLoading ? "•" : `${countdown}s`}
          </span>
        </div>

        <button
          type="button"
          onClick={() => setTvMode(true)}
          title="Pantalla TV"
          className="flex h-7 w-7 items-center justify-center rounded-sm border border-[#edebe9] bg-white text-[#605e5c] transition hover:border-[#094732] hover:text-[#094732]"
        >
          <Tv2 className="h-3.5 w-3.5" />
        </button>

        <button
          type="button"
          onClick={() => setShowTutorial(true)}
          title="Ver guía rápida del tablero"
          className="flex h-7 w-7 items-center justify-center rounded-sm border border-[#edebe9] bg-white text-[#605e5c] transition hover:border-[#094732] hover:text-[#094732]"
        >
          <HelpCircle className="h-3.5 w-3.5" />
        </button>
      </div>

    </div>
  );

  const boardGrid = (
    <DndContext
      sensors={dndSensors}
      collisionDetection={collisionDetection}
      onDragStart={handleDragStart}
      onDragCancel={handleDragCancel}
      onDragEnd={handleDragEnd}
    >
      <div
        className={`grid h-full gap-3 lg:grid-cols-3 lg:grid-rows-1 ${isDraggingBoard ? "select-none" : ""}`}
      >
          <DroppableColumn
            id="waiting"
            dataTour="queue-col-waiting"
            title="En espera"
            subtitle="Tickets pendientes del día"
            tickets={waitingTickets}
            isEmptyLabel="Sin clientas en espera."
            highlightTicket={isRecentlyCreated}
            renderCard={(ticket) => (
              <DraggableTicketCard
                key={ticket.id}
                ticket={ticket}
                professionals={professionals}
                busyProfessionalIds={busyProfessionalIds}
                clients={clients}
                onChangeClient={(t, clientId) => void handleChangeTicketClient(t, clientId)}
                onOpenRegisterClient={(t) => setRegisterClientTarget(t)}
                onSaveEdits={(t, payload) => void handleSaveTicketEdits(t, payload)}
                isSavingEdit={editingTicketId === ticket.id}
                actions={
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); void handleStartService(ticket); }}
                      className="rounded-lg bg-[#094732] px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-[#063324] transition-colors"
                    >
                      Iniciar atención
                    </button>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); void handleCancelTicket(ticket); }}
                      className="rounded-lg border border-[#f1adba] bg-[#fde7e9] px-2.5 py-1.5 text-[11px] font-semibold text-[#a4262c] hover:bg-[#f9c0cb] transition-colors"
                    >
                      Cancelar
                    </button>
                  </div>
                }
                showRemaining
                statusColors={{}}
                getRemainingLabel={() => getWaitLabel(ticket.id)}
                onDelete={handleDeleteClick}
              />
            )}
          />

          <DroppableColumn
            id="in_service"
            dataTour="queue-col-inservice"
            title="En servicio"
            subtitle="Atenciones en curso"
            tickets={inServiceTickets}
            isEmptyLabel="Sin servicios activos."
            highlightTicket={isRecentlyCreated}
            renderCard={(ticket) => (
              <DraggableTicketCard
                key={ticket.id}
                ticket={ticket}
                professionals={professionals}
                busyProfessionalIds={busyProfessionalIds}
                clients={clients}
                onChangeClient={(t, clientId) => void handleChangeTicketClient(t, clientId)}
                onOpenRegisterClient={(t) => setRegisterClientTarget(t)}
                onSaveEdits={(t, payload) => void handleSaveTicketEdits(t, payload)}
                isSavingEdit={editingTicketId === ticket.id}
                actions={
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); handleOpenFinishModal(ticket); }}
                      className="rounded-lg bg-[#094732] px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-[#063324] transition-colors"
                    >
                      Finalizar
                    </button>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); void handleCancelTicket(ticket); }}
                      className="rounded-lg border border-[#f1adba] bg-[#fde7e9] px-2.5 py-1.5 text-[11px] font-semibold text-[#a4262c] hover:bg-[#f9c0cb] transition-colors"
                    >
                      Cancelar
                    </button>
                  </div>
                }
                showRemaining
                statusColors={{}}
                getRemainingLabel={getRemainingLabel}
                onDelete={handleDeleteClick}
              />
            )}
          />

          <DroppableColumn
            id="completed"
            dataTour="queue-col-completed"
            title="Finalizadas"
            subtitle="Atenciones completadas"
            tickets={completedTickets}
            isEmptyLabel="Sin finalizadas hoy."
            highlightTicket={isRecentlyCreated}
            renderCard={(ticket) => (
              <DraggableTicketCard
                key={ticket.id}
                ticket={ticket}
                professionals={professionals}
                busyProfessionalIds={busyProfessionalIds}
                clients={clients}
                onChangeClient={(t, clientId) => void handleChangeTicketClient(t, clientId)}
                onOpenRegisterClient={(t) => setRegisterClientTarget(t)}
                onSaveEdits={(t, payload) => void handleSaveTicketEdits(t, payload)}
                isSavingEdit={editingTicketId === ticket.id}
                actions={
                  ticket.sale_id ? (
                    <span className="inline-block rounded-lg border border-[#107c10]/30 bg-[#f1fbf1] px-3 py-1.5 text-center text-[11px] font-semibold text-[#107c10]">
                      Pagado — Venta #{ticket.sale_id}
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate("/admin/pos-tracking", { state: { fromAgendaReservation: { appointmentId: ticket.id } } });
                      }}
                      className="rounded-lg border border-[#0078d4]/30 bg-[#eef6ff] px-3 py-1.5 text-[11px] font-semibold text-[#0078d4] hover:bg-[#deecf9] transition-colors"
                    >
                      Completar pago
                    </button>
                  )
                }
                showRemaining={false}
                statusColors={{}}
                getRemainingLabel={getRemainingLabel}
                onDelete={handleDeleteClick}
              />
            )}
          />
        </div>

        <DragOverlay dropAnimation={{ duration: 200, easing: "cubic-bezier(0.18, 0.67, 0.6, 1.22)" }}>
          {activeDragTicket ? <TicketDragOverlay ticket={activeDragTicket} /> : null}
        </DragOverlay>
      </DndContext>
  );

  const dialogs = (
    <>
      <ConfirmDialog
          isOpen={Boolean(ticketToDelete)}
          title="Eliminar ticket"
          message={
            <div className="space-y-3">
              <p>
                ¿Seguro que deseas eliminar el ticket de <strong>{ticketToDelete?.client_name}</strong>? Esta accion no se puede deshacer.
              </p>
              <div className={BC_WARN_BOX}>
                Para confirmar, escribe el codigo del ticket:
                <strong className="ml-1">{ticketToDelete?.ticket_code?.trim() || String(ticketToDelete?.id ?? "")}</strong>
              </div>
              <input
                type="text"
                value={deleteConfirmationCode}
                onChange={(event) => setDeleteConfirmationCode(event.target.value)}
                placeholder="Ingresa el codigo para eliminar"
                className={BC_FIELD}
              />
            </div>
          }
          confirmText="Eliminar"
          cancelText="Cancelar"
          variant="danger"
          isProcessing={isDeletingTicket}
          onConfirm={() => void handleConfirmDelete()}
          onCancel={() => {
            if (!isDeletingTicket) {
              setTicketToDelete(null);
              setDeleteConfirmationCode("");
            }
          }}
        />

        <ConfirmDialog
          isOpen={queuePromptTicket !== null}
          title="Operaria libre"
          message={
            queuePromptTicket ? (
              <p>
                <strong>{professionals.find((p) => p.id === queuePromptTicket.professional_id)?.username ?? "La operaria"}</strong> quedó libre
                y tiene a <strong>{queuePromptTicket.client_name}</strong> esperándola (ticket {queuePromptTicket.ticket_code ?? `#${queuePromptTicket.id}`}).
                ¿Iniciar su atención ahora?
              </p>
            ) : ""
          }
          confirmText="Iniciar atención"
          cancelText="Todavía no"
          variant="success"
          onConfirm={() => void handleConfirmQueueStart()}
          onCancel={() => setQueuePromptTicket(null)}
        />

        <GenericModal isOpen={isFinishModalOpen} onClose={() => setIsFinishModalOpen(false)} title="Finalizar atencion" size="lg">
          <div className="space-y-4">
            <div className={BC_INFO_BOX}>
              Registra el tracking tecnico y el cuestionario antes de finalizar.
            </div>

            {finishPreview && (
              <div className="rounded-sm border border-[#d2d0ce] bg-[#faf9f8] px-4 py-3">
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <p className="text-sm font-semibold text-[#323130]">
                    {finishPreview.clientName}
                    <span className="ml-2 font-normal text-[#605e5c]">
                      · {finishPreview.serviceNames.join(" + ") || "Servicio"}
                    </span>
                  </p>
                  {finishPreview.totalPrice > 0 && (
                    <p className="text-sm font-semibold text-[#323130]">Bs {finishPreview.totalPrice.toFixed(2)}</p>
                  )}
                </div>

                {(finishPreview.maintenanceDate || finishPreview.removalDate) && (
                  <div className="mt-2 flex flex-wrap gap-2 border-t border-[#edebe9] pt-2">
                    {finishPreview.maintenanceDate && (
                      <span className="rounded-full bg-[#deecf9] px-2.5 py-1 text-xs font-semibold text-[#004578]">
                        Mantenimiento sugerido: {finishPreview.maintenanceDate}
                      </span>
                    )}
                    {finishPreview.removalDate && (
                      <span className="rounded-full bg-[#fde8f0] px-2.5 py-1 text-xs font-semibold text-[#861237]">
                        Retiro sugerido: {finishPreview.removalDate}
                      </span>
                    )}
                  </div>
                )}
              </div>
            )}

            {finishTarget && typeof finishTarget.client_age === "number" && finishTarget.client_age < 18 ? (
              <div className={BC_WARN_BOX}>
                &#9888; Clienta menor de edad ({finishTarget.client_age} años) — el cuestionario es obligatorio para finalizar el servicio.
              </div>
            ) : null}

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className={BC_LABEL}>Profesional</label>
                <select
                  value={finishProfessionalId}
                  onChange={(event) => setFinishProfessionalId(event.target.value)}
                  className={BC_FIELD}
                >
                  <option value="">Sin asignar</option>
                  {professionals.map((professional) => (
                    <option key={professional.id} value={professional.id}>
                      {professional.username}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className={BC_LABEL}>Servicio(s)</label>
                <p className="min-h-9 w-full rounded-sm border border-[#8a8886] bg-[#f3f2f1] px-2.5 py-1.5 text-sm leading-snug text-[#323130]">
                  {finishPreview?.serviceNames.join(" + ") || "—"}
                </p>
              </div>

              <div>
                <label className={BC_LABEL}>Clienta</label>
                <div className="flex gap-1.5">
                  <select
                    value={String(finishTarget?.client_id ?? "")}
                    onChange={(event) => {
                      if (!finishTarget) return;
                      const clientId = event.target.value;
                      const client = clients.find((c) => String(c.id) === clientId);
                      setFinishTarget({
                        ...finishTarget,
                        client_id: Number(clientId),
                        client_name: client ? `${client.nombre} ${client.apellido}`.trim() : finishTarget.client_name,
                      });
                      void handleChangeTicketClient(finishTarget, clientId);
                    }}
                    className={`${BC_FIELD} min-w-0 flex-1`}
                  >
                    {clients.map((c) => (
                      <option key={c.id} value={String(c.id)}>{`${c.nombre} ${c.apellido}`.trim()}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => finishTarget && setRegisterClientTarget(finishTarget)}
                    title="Registrar nueva clienta"
                    className="flex shrink-0 items-center gap-1 rounded-sm border border-[#094732] bg-[#094732] px-2.5 text-xs font-semibold text-white transition hover:bg-[#063324]"
                  >
                    <Plus size={13} /> Nueva
                  </button>
                </div>
              </div>

              <div>
                <label className={BC_LABEL}>
                  Cuestionario
                  {finishTarget && typeof finishTarget.client_age === "number" && finishTarget.client_age < 18
                    ? " (Obligatorio — menor de edad ⚠)"
                    : categoryRequiresQuestionnaire
                    ? " (Obligatorio — categoría ⚠)"
                    : ""}
                </label>
                <select
                  value={finishQuestionnaireId}
                  onChange={(event) => void handleQuestionnaireChange(event.target.value)}
                  className={BC_FIELD}
                  disabled={categoryRequiresQuestionnaire && Boolean(finishQuestionnaireId)}
                >
                  {!categoryRequiresQuestionnaire && <option value="">Sin cuestionario</option>}
                  {questionnaires.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.title}
                    </option>
                  ))}
                </select>

                {questionnaire ? (
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <Button type="button" variant="secondary" className={BC_BTN_SECONDARY} onClick={() => setIsQuestionnaireModalOpen(true)}>
                      Responder cuestionario
                    </Button>
                    <span className="text-xs text-[#605e5c]">{Object.keys(questionnaireResponses).length} respuestas guardadas</span>
                  </div>
                ) : null}
              </div>
            </div>

            <div className="border border-[#edebe9] bg-[#faf9f8] p-3">
              <div className="mb-2 flex items-center justify-between">
                <label htmlFor="finish-observations" className={BC_LABEL}>
                  Observaciones del servicio
                </label>
                <span className="text-[11px] text-[#605e5c]">
                  {finishTarget && typeof finishTarget.client_age === "number" && finishTarget.client_age < 18
                    ? "Cuestionario obligatorio · notas opcionales"
                    : "Opcional"}
                </span>
              </div>
              <textarea
                id="finish-observations"
                value={finishNotes}
                onChange={(event) => setFinishNotes(event.target.value)}
                rows={4}
                placeholder="Describe el proceso, incidencias, resultados y recomendaciones para la siguiente cita..."
                className={BC_TEXTAREA}
              />
            </div>

            <div className="flex justify-end gap-2 border-t border-[#edebe9] pt-3">
              <Button type="button" variant="secondary" className={BC_BTN_SECONDARY} onClick={() => setIsFinishModalOpen(false)}>
                Cancelar
              </Button>
              <Button type="button" className={BC_BTN_PRIMARY} onClick={() => void handleFinishService()} disabled={isSubmittingTracking}>
                {isSubmittingTracking ? "Guardando..." : "Finalizar"}
              </Button>
            </div>
          </div>
        </GenericModal>

        <GenericModal
          isOpen={isQuestionnaireModalOpen}
          onClose={() => setIsQuestionnaireModalOpen(false)}
          title={questionnaire?.title ?? "Cuestionario"}
          size="lg"
        >
          {questionnaire?.questions && questionnaire.questions.length > 0 ? (
            <div className="space-y-4">
              {questionnaire.questions
                .slice()
                .sort((a, b) => a.sort_order - b.sort_order)
                .map((question) => (
                  <div key={question.id}>
                    <label className={BC_LABEL}>{question.text}</label>
                    {renderQuestion(question)}
                  </div>
                ))}
            </div>
          ) : (
            <p className="text-sm text-[#605e5c]">Sin preguntas registradas.</p>
          )}

          <div className="mt-6 flex justify-end gap-2 border-t border-[#edebe9] pt-3">
            <Button type="button" variant="secondary" className={BC_BTN_SECONDARY} onClick={() => setIsQuestionnaireModalOpen(false)}>
              Cerrar
            </Button>
            <Button type="button" className={BC_BTN_PRIMARY} onClick={() => setIsQuestionnaireModalOpen(false)}>
              Guardar respuestas
            </Button>
          </div>
        </GenericModal>

        <RegisterClientModal
          isOpen={registerClientTarget !== null}
          onClose={() => setRegisterClientTarget(null)}
          onSubmit={(form) => void handleRegisterClientSubmit(form)}
          eyeTypes={eyeTypes}
          branches={branches}
          eyeTypesError={eyeTypesError}
          isLoadingEyeTypes={isLoadingEyeTypes}
          onRetryEyeTypes={() => {
            setIsLoadingEyeTypes(true);
            setEyeTypesError(null);
            ClientService.listEyeTypes({ limit: 100 })
              .then(setEyeTypes)
              .catch(() => setEyeTypesError("No se pudieron cargar. Intenta de nuevo."))
              .finally(() => setIsLoadingEyeTypes(false));
          }}
          defaultBranchId={activeBranchId}
        />
    </>
  );

  const topBar = (
    <>
      {boardRibbon}
      <OperariaStatusPanel operarias={operariaStatuses} collapsed={!operariasOpen} />
    </>
  );

  if (embedded) {
    return (
      <>
        <div className="flex h-full min-h-0 flex-col overflow-hidden bg-[#f3f2f1]">
          <div className="shrink-0">{topBar}</div>
          {/* Tablero — ocupa todo el espacio restante */}
          <div className={`min-h-0 flex-1 overflow-hidden p-1.5 ${isDraggingBoard ? "select-none" : ""}`}>
            {boardGrid}
          </div>
        </div>
        {dialogs}
        {tvMode && (
          <QueueTvDisplay
            waitingTickets={waitingTickets}
            inServiceTickets={inServiceTickets}
            onClose={() => setTvMode(false)}
          />
        )}
        {showTutorial && (
          <QueueTutorialModal onClose={() => setShowTutorial(false)} storageKey={tutorialStorageKey} />
        )}
      </>
    );
  }

  return (
    <>
      <Layout
        title={<span className="text-lg font-semibold text-[#201f1e]">Tablero de atención</span>}
        subtitle={<span className="text-sm text-[#605e5c]">Cola de servicios · {filterDate || todayDate()}</span>}
        variant="cards"
        pageClassName={BC_PAGE}
        containerClassName={`${BC_CONTAINER} !rounded-sm !shadow-[0_1px_2px_rgba(0,0,0,0.06)]`}
        topContent={topBar}
      >
        {boardGrid}
        {dialogs}
      </Layout>
      {tvMode && (
        <QueueTvDisplay
          waitingTickets={waitingTickets}
          inServiceTickets={inServiceTickets}
          onClose={() => setTvMode(false)}
        />
      )}
      {showTutorial && (
        <QueueTutorialModal onClose={() => setShowTutorial(false)} storageKey={tutorialStorageKey} />
      )}
    </>
  );
};

export default Main;
