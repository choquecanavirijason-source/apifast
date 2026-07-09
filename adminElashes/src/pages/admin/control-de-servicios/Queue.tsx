import { useCallback, useEffect, useMemo, useState } from "react";
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
import { ChevronDown, RefreshCw, Tv2, Users } from "lucide-react";
import { useWebSocket, type WsEvent } from "@/core/hooks/useWebSocket";
import { toast } from "react-toastify";

import Layout from "../../../components/common/layout";
import { Button } from "../../../components/common/ui";
import GenericModal from "../../../components/common/modal/GenericModal";
import { ConfirmDialog } from "../../../components/common/ConfirmDialog";
import { AgendaService, type ProfessionalForSelect, type ServiceCategoryOption, type ServiceOption, type TicketItem } from "../../../core/services/agenda/agenda.service";
import { CatalogService, type CatalogItem, type QuestionnaireItem } from "../../../core/services/catalog/catalog.service";
import { ClientService } from "../../../core/services/client/client.service";
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
import { useOperariaStatuses } from "./queue/useOperariaStatuses";

const Main = ({ embedded = false }: { embedded?: boolean }) => {
  const [tickets, setTickets] = useState<TicketItem[]>([]);
  const [trackedTicketIds, setTrackedTicketIds] = useState<Set<number>>(() => {
    try {
      const raw = sessionStorage.getItem("cds_tracked_ids");
      if (raw) return new Set(JSON.parse(raw) as number[]);
    } catch { /* ignore */ }
    return new Set<number>();
  });

  const addTrackedId = (id: number) => {
    setTrackedTicketIds((prev) => {
      const next = new Set([...prev, id]);
      try { sessionStorage.setItem("cds_tracked_ids", JSON.stringify([...next])); } catch { /* ignore */ }
      return next;
    });
  };
  const [isLoading, setIsLoading] = useState(false);
  const [activeBranchId, setActiveBranchId] = useState<number | null>(() => getSelectedBranchId());
  const [professionals, setProfessionals] = useState<ProfessionalForSelect[]>([]);
  const [eyeTypes, setEyeTypes] = useState<CatalogItem[]>([]);
  const [effects, setEffects] = useState<CatalogItem[]>([]);
  const [volumes, setVolumes] = useState<CatalogItem[]>([]);
  const [lashDesigns, setLashDesigns] = useState<CatalogItem[]>([]);
  const [questionnaires, setQuestionnaires] = useState<QuestionnaireItem[]>([]);
  const [isFinishModalOpen, setIsFinishModalOpen] = useState(false);
  const [finishTarget, setFinishTarget] = useState<TicketItem | null>(null);
  const [finishNotes, setFinishNotes] = useState("");
  const [finishProfessionalId, setFinishProfessionalId] = useState("");
  const [finishEyeTypeId, setFinishEyeTypeId] = useState("");
  const [finishEffectId, setFinishEffectId] = useState("");
  const [finishVolumeId, setFinishVolumeId] = useState("");
  const [finishLashDesignId, setFinishLashDesignId] = useState("");
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

  const loadTickets = useCallback(async (silent = false) => {
    if (!silent) setIsLoading(true);
    try {
      const today = todayDate();
      const data = await AgendaService.listTickets({
        limit: 500,
        branch_id: activeBranchId ?? undefined,
        start_date: filterDate || today,
        end_date: filterDate || today,
      });
      setTickets(data);
      setLastRefresh(new Date());
      setCountdown(REFRESH_INTERVAL);
    } catch (error) {
      console.error("Error cargando tickets:", error);
      if (!silent) toast.error("No se pudo cargar el tablero de atencion.");
      if (!silent) setTickets([]);
    } finally {
      if (!silent) setIsLoading(false);
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
      return prev.map((t) =>
        t.id === event.ticket_id
          ? { ...t, status: event.status, professional_id: event.professional_id ?? t.professional_id }
          : t
      );
    });
  }, [loadTickets]);

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

  useEffect(() => {
    CatalogService.listEyeTypes({ limit: 200 })
      .then(setEyeTypes)
      .catch(() => setEyeTypes([]));

    CatalogService.listEffects({ limit: 200 })
      .then(setEffects)
      .catch(() => setEffects([]));

    CatalogService.listVolumes({ limit: 200 })
      .then(setVolumes)
      .catch(() => setVolumes([]));

    CatalogService.listLashDesigns({ limit: 200 })
      .then(setLashDesigns)
      .catch(() => setLashDesigns([]));

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

  const mergeTicketsBySaleId = (ticketList: TicketItem[]): TicketItem[] => {
    const saleMap = new Map<number, TicketItem[]>();
    const noSale: TicketItem[] = [];
    for (const t of ticketList) {
      if (t.sale_id) {
        const group = saleMap.get(t.sale_id) ?? [];
        group.push(t);
        saleMap.set(t.sale_id, group);
      } else {
        noSale.push(t);
      }
    }
    const result: TicketItem[] = [...noSale];
    for (const group of saleMap.values()) {
      const primary = group[0];
      const allNames = [...new Set(
        group.flatMap((t) => t.service_names ?? (t.service_name ? [t.service_name] : []))
      )];
      result.push({ ...primary, service_names: allNames });
    }
    return result;
  };

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
      const matchesDate = !filterDate || ticketDate === filterDate;
      const matchesTime = !filterTime || ticketTime === filterTime;
      const matchesProfessional =
        !filterProfessionalId || String(ticket.professional_id ?? "") === filterProfessionalId;

      return matchesService && matchesClient && matchesDate && matchesTime && matchesProfessional;
    });
  }, [tickets, filterService, filterClient, filterDate, filterTime, filterProfessionalId]);

  const waitingTickets = useMemo(
    () => mergeTicketsBySaleId(
      filteredTickets.filter((ticket) => !ticket.is_ia && ["pending", "waiting", "confirmed"].includes(ticket.status))
    ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filteredTickets]
  );

  const inServiceTickets = useMemo(
    () => mergeTicketsBySaleId(
      filteredTickets.filter((ticket) => !ticket.is_ia && ticket.status === "in_service")
    ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filteredTickets]
  );

  const completedTickets = useMemo(
    () => mergeTicketsBySaleId(
      filteredTickets.filter((ticket) => !ticket.is_ia && ticket.status === "completed" && !trackedTicketIds.has(ticket.id))
    ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filteredTickets, trackedTicketIds]
  );

  const operariaStatuses = useOperariaStatuses(tickets, professionals);

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
    const snapshot = tickets;
    applyGroupMoveLocally(allIds, { status: "in_service" });
    try {
      await Promise.all(allIds.map((id) => AgendaService.updateAppointment(id, { status: "in_service" })));
      toast.success("Atención iniciada.");
      void loadTickets();
    } catch (error) {
      setTickets(snapshot);
      console.error("Error iniciando atención:", error);
      toast.error(getApiErrorMessage(error, "No se pudo iniciar la atención."));
    }
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
    setFinishProfessionalId("");
    setFinishEyeTypeId("");
    setFinishEffectId("");
    setFinishVolumeId("");
    setFinishLashDesignId("");
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

    const targetId = finishTarget.id;

    try {
      await TrackingService.create({
        client_id: finishTarget.client_id,
        appointment_id: finishTarget.id,
        branch_id: activeBranchId,
        professional_id: finishProfessionalId ? Number(finishProfessionalId) : undefined,
        eye_type_id: finishEyeTypeId ? Number(finishEyeTypeId) : undefined,
        effect_id: finishEffectId ? Number(finishEffectId) : undefined,
        volume_id: finishVolumeId ? Number(finishVolumeId) : undefined,
        lash_design_id: finishLashDesignId ? Number(finishLashDesignId) : undefined,
        questionnaire_id: finishQuestionnaireId ? Number(finishQuestionnaireId) : undefined,
        design_notes: finishNotes.trim() || undefined,
        last_application_date: new Date().toISOString(),
        questionnaire_responses: questionnaireResponses,
      });

      await AgendaService.updateAppointment(finishTarget.id, { status: "completed" });
      // Marcar como rastreado ANTES de recargar para que no reaparezca en el tablero
      addTrackedId(targetId);
      // Completar también los tickets hermanos del mismo sale (ticket "juntos")
      if (finishSiblingIds.length > 0) {
        applyGroupMoveLocally(finishSiblingIds, { status: "completed" });
        await Promise.all(finishSiblingIds.map((id) => AgendaService.updateAppointment(id, { status: "completed" })));
        finishSiblingIds.forEach(addTrackedId);
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

    // Estas llamadas van fuera del try principal para que el 409 de call-next
    // no cancele el flujo ni muestre error al usuario.
    if (activeBranchId) {
      AgendaService.callNextAppointment({ branch_id: activeBranchId }).catch(() => {});
    }
    AgendaService.listProfessionalsForSelect({
      limit: 200,
      ...(activeBranchId ? { branch_id: activeBranchId } : {}),
    })
      .then(setProfessionals)
      .catch(() => {});
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

  const applyTicketMoveLocally = (ticketId: number, patch: Partial<TicketItem>) => {
    setTickets((prev) => prev.map((t) => (t.id === ticketId ? { ...t, ...patch } : t)));
  };

  const applyGroupMoveLocally = (ids: number[], patch: Partial<TicketItem>) => {
    setTickets((prev) => prev.map((t) => (ids.includes(t.id) ? { ...t, ...patch } : t)));
  };

  // Returns IDs of other tickets in the same sale (sibling tickets created "juntos")
  const getSiblingIds = (ticket: TicketItem): number[] => {
    if (!ticket.sale_id) return [];
    return tickets.filter((t) => t.sale_id === ticket.sale_id && t.id !== ticket.id).map((t) => t.id);
  };

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
      const snapshot = tickets;
      applyGroupMoveLocally(allIds, { is_ia: true });
      try {
        await Promise.all(allIds.map((id) => AgendaService.updateAppointment(id, { is_ia: true })));
        toast.success("Ticket movido a Tickets con IA.");
      } catch (error) {
        setTickets(snapshot);
        console.error("Error moviendo ticket a IA:", error);
        toast.error(getApiErrorMessage(error, "No se pudo mover el ticket a IA."));
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
    const snapshot = tickets;
    applyGroupMoveLocally(allIds, { status: newStatus, is_ia: false });

    try {
      await Promise.all(allIds.map((id) => AgendaService.updateAppointment(id, {
        status: newStatus,
        is_ia: false,
        skip_availability_check: true,
      })));
      toast.success(`Ticket movido a ${STATUS_LABELS[newStatus] ?? targetColumn}.`);
    } catch (error) {
      setTickets(snapshot);
      console.error("Error moviendo ticket:", error);
      toast.error(getApiErrorMessage(error, "No se pudo mover el ticket."));
    }
  };

  const handleDeleteClick = (ticket: TicketItem) => {
    setTicketToDelete(ticket);
    setDeleteConfirmationCode("");
  };

  const handleMarkCompleted = async (ticket: TicketItem) => {
    const siblingIds = getSiblingIds(ticket);
    const allIds = [ticket.id, ...siblingIds];
    const snapshot = tickets;
    applyGroupMoveLocally(allIds, { status: "completed" });
    try {
      await Promise.all(allIds.map((id) => AgendaService.updateAppointment(id, { status: "completed" })));
      allIds.forEach(addTrackedId);
      toast.success("Ticket finalizado.");
      void loadTickets();
    } catch (error) {
      setTickets(snapshot);
      console.error("Error finalizando ticket:", error);
      toast.error(getApiErrorMessage(error, "No se pudo finalizar el ticket."));
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

    const snapshot = tickets;
    applyTicketMoveLocally(ticket.id, {
      professional_id: payload.professionalId ? Number(payload.professionalId) : null,
      is_ia: payload.isIa,
    });
    setEditingTicketId(ticket.id);
    try {
      await AgendaService.updateAppointment(ticket.id, {
        start_time: formatLocalDateTime(nextStart),
        end_time: formatLocalDateTime(nextEnd),
        professional_id: payload.professionalId ? Number(payload.professionalId) : null,
        is_ia: payload.isIa,
      });

      toast.success("Ticket actualizado.");
      void loadTickets();
    } catch (error) {
      setTickets(snapshot);
      console.error("Error actualizando ticket:", error);
      toast.error("No se pudo actualizar fecha, hora u operaria del ticket.");
    } finally {
      setEditingTicketId(null);
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
          { label: "Espera", count: waitingTickets.length, color: "#D83B01" },
          { label: "Servicio", count: inServiceTickets.length, color: "#094732" },
          { label: "Finalizadas", count: completedTickets.length, color: "#107C10" },
        ].map((s) => (
          <div key={s.label} className="flex flex-col items-center">
            <p className="text-sm font-semibold tabular-nums" style={{ color: s.color }}>{s.count}</p>
            <p className="text-[8px] font-semibold uppercase tracking-wide text-[#605e5c]">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Llamar siguiente + refresh — empujado a la derecha */}
      <div className="ml-auto flex items-center gap-1.5 px-2 py-1">
        <button
          type="button"
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
            title="En espera"
            subtitle="Tickets pendientes del día"
            tickets={waitingTickets}
            isEmptyLabel="Sin clientas en espera."
            highlightTicket={isRecentlyCreated}
            accentColor="orange"
            renderCard={(ticket) => (
              <DraggableTicketCard
                key={ticket.id}
                ticket={ticket}
                professionals={professionals}
                onSaveEdits={(t, payload) => void handleSaveTicketEdits(t, payload)}
                isSavingEdit={editingTicketId === ticket.id}
                actions={
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); void handleStartService(ticket); }}
                      className="flex-1 rounded-lg bg-[#094732] px-2 py-1.5 text-[11px] font-semibold text-white hover:bg-[#063324] transition-colors"
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
            title="En servicio"
            subtitle="Atenciones en curso"
            tickets={inServiceTickets}
            isEmptyLabel="Sin servicios activos."
            highlightTicket={isRecentlyCreated}
            accentColor="blue"
            renderCard={(ticket) => (
              <DraggableTicketCard
                key={ticket.id}
                ticket={ticket}
                professionals={professionals}
                onSaveEdits={(t, payload) => void handleSaveTicketEdits(t, payload)}
                isSavingEdit={editingTicketId === ticket.id}
                actions={
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); handleOpenFinishModal(ticket); }}
                      className="flex-1 rounded-lg bg-[#094732] px-2 py-1.5 text-[11px] font-semibold text-white hover:bg-[#063324] transition-colors"
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
            title="Finalizadas"
            subtitle="Atenciones completadas"
            tickets={completedTickets}
            isEmptyLabel="Sin finalizadas hoy."
            highlightTicket={isRecentlyCreated}
            accentColor="green"
            renderCard={(ticket) => (
              <DraggableTicketCard
                key={ticket.id}
                ticket={ticket}
                professionals={professionals}
                onSaveEdits={(t, payload) => void handleSaveTicketEdits(t, payload)}
                isSavingEdit={editingTicketId === ticket.id}
                actions={
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); handleOpenFinishModal(ticket); }}
                    className="w-full rounded-lg border border-[#107c10]/30 bg-[#f1fbf1] py-1.5 text-[11px] font-semibold text-[#107c10] hover:bg-[#dff6dd] transition-colors"
                  >
                    Completar pago
                  </button>
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

        <GenericModal isOpen={isFinishModalOpen} onClose={() => setIsFinishModalOpen(false)} title="Finalizar atencion" size="lg">
          <div className="space-y-4">
            <div className={BC_INFO_BOX}>
              Registra el tracking tecnico y el cuestionario antes de finalizar.
            </div>

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
                <label className={BC_LABEL}>Tipo de ojo</label>
                <select
                  value={finishEyeTypeId}
                  onChange={(event) => setFinishEyeTypeId(event.target.value)}
                  className={BC_FIELD}
                >
                  <option value="">Selecciona</option>
                  {eyeTypes.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className={BC_LABEL}>Efecto</label>
                <select
                  value={finishEffectId}
                  onChange={(event) => setFinishEffectId(event.target.value)}
                  className={BC_FIELD}
                >
                  <option value="">Selecciona</option>
                  {effects.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className={BC_LABEL}>Volumen</label>
                <select
                  value={finishVolumeId}
                  onChange={(event) => setFinishVolumeId(event.target.value)}
                  className={BC_FIELD}
                >
                  <option value="">Selecciona</option>
                  {volumes.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className={BC_LABEL}>Diseno de pestanas</label>
                <select
                  value={finishLashDesignId}
                  onChange={(event) => setFinishLashDesignId(event.target.value)}
                  className={BC_FIELD}
                >
                  <option value="">Selecciona</option>
                  {lashDesigns.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
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
    </>
  );
};

export default Main;
