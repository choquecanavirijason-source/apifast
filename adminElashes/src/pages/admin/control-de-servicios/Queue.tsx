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
import { toast } from "react-toastify";

import Layout from "../../../components/common/layout";
import { Button } from "../../../components/common/ui";
import GenericModal from "../../../components/common/modal/GenericModal";
import { ConfirmDialog } from "../../../components/common/ConfirmDialog";
import { AgendaService, type ProfessionalForSelect, type TicketItem } from "../../../core/services/agenda/agenda.service";
import { CatalogService, type CatalogItem, type QuestionnaireItem } from "../../../core/services/catalog/catalog.service";
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

const Main = () => {
  const [tickets, setTickets] = useState<TicketItem[]>([]);
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

  const loadTickets = useCallback(async () => {
    setIsLoading(true);
    try {
      const today = todayDate();
      const data = await AgendaService.listTickets({
        limit: 500,
        branch_id: activeBranchId ?? undefined,
        start_date: filterDate || today,
        end_date: filterDate || today,
      });
      setTickets(data);
    } catch (error) {
      console.error("Error cargando tickets:", error);
      toast.error("No se pudo cargar el tablero de atencion.");
      setTickets([]);
    } finally {
      setIsLoading(false);
    }
  }, [activeBranchId, filterDate]);

  useEffect(() => {
    void loadTickets();
  }, [loadTickets]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      void loadTickets();
    }, 30000);
    return () => window.clearInterval(interval);
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

  useEffect(() => {
    AgendaService.listProfessionalsForSelect({ limit: 200 })
      .then(setProfessionals)
      .catch((error) => {
        console.error("Error cargando profesionales:", error);
        setProfessionals([]);
      });

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
    () => filteredTickets.filter((ticket) => !ticket.is_ia && ["pending", "waiting", "confirmed"].includes(ticket.status)),
    [filteredTickets]
  );

  const inServiceTickets = useMemo(
    () => filteredTickets.filter((ticket) => !ticket.is_ia && ticket.status === "in_service"),
    [filteredTickets]
  );

  const completedTickets = useMemo(
    () => filteredTickets.filter((ticket) => !ticket.is_ia && ticket.status === "completed"),
    [filteredTickets]
  );

  const handleStartService = async (ticket: TicketItem) => {
    if (!ticket.professional_id) {
      toast.warning("Asigna una operaria antes de iniciar la atencion.");
      return;
    }
    try {
      await AgendaService.updateAppointment(ticket.id, { status: "in_service" });
      toast.success("Atencion iniciada.");
      void loadTickets();
    } catch (error) {
      console.error("Error iniciando atencion:", error);
      toast.error(getApiErrorMessage(error, "No se pudo iniciar la atencion."));
    }
  };

  const handleOpenFinishModal = (ticket: TicketItem) => {
    setFinishTarget(ticket);
    setFinishNotes("");
    setFinishProfessionalId("");
    setFinishEyeTypeId("");
    setFinishEffectId("");
    setFinishVolumeId("");
    setFinishLashDesignId("");
    setFinishQuestionnaireId("");
    setQuestionnaire(null);
    setQuestionnaireResponses({});
    setIsQuestionnaireModalOpen(false);
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

    const hasNotes = Boolean(finishNotes.trim());
    const hasQuestionnaire = Boolean(finishQuestionnaireId) || Object.keys(questionnaireResponses).length > 0;
    if (!hasNotes && !hasQuestionnaire) {
      toast.warning("Agrega observaciones del servicio o completa un cuestionario antes de finalizar.");
      return;
    }

    setIsSubmittingTracking(true);

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
      toast.success("Atencion finalizada y tracking registrado.");
      setIsFinishModalOpen(false);
      setFinishTarget(null);

      if (activeBranchId) {
        try {
          await AgendaService.callNextAppointment({ branch_id: activeBranchId });
        } catch {
          // Si no hay tickets disponibles, solo refrescar el tablero.
        }
      }

      void loadTickets();
    } catch (error) {
      console.error("Error finalizando atencion:", error);
      toast.error(getApiErrorMessage(error, "No se pudo finalizar la atencion."));
    } finally {
      setIsSubmittingTracking(false);
    }
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

    if (targetColumn === "ia") {
      if (ticket.is_ia) return;

      const snapshot = tickets;
      applyTicketMoveLocally(ticketId, { is_ia: true });
      try {
        await AgendaService.updateAppointment(ticketId, { is_ia: true });
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

    const snapshot = tickets;
    applyTicketMoveLocally(ticketId, { status: newStatus, is_ia: false });

    try {
      await AgendaService.updateAppointment(ticketId, {
        status: newStatus,
        is_ia: false,
      });
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
    try {
      await AgendaService.updateAppointment(ticket.id, { status: "completed" });
      toast.success("Ticket finalizado.");
      void loadTickets();
    } catch (error) {
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

  const boardRibbon = (
    <div className="flex flex-wrap items-stretch gap-0 divide-x divide-[#edebe9] border-b border-[#edebe9] bg-[#f3f2f1]">
      {[
        { label: "En espera", count: waitingTickets.length, color: "#D83B01" },
        { label: "En servicio", count: inServiceTickets.length, color: "#0078D4" },
        { label: "Finalizadas", count: completedTickets.length, color: "#107C10" },
      ].map((stat) => (
        <div key={stat.label} className="flex min-w-[120px] flex-1 items-center gap-2 px-4 py-2">
          <span className="h-8 w-1 shrink-0" style={{ backgroundColor: stat.color }} />
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-[#605e5c]">{stat.label}</p>
            <p className="text-lg font-semibold tabular-nums text-[#201f1e]">{stat.count}</p>
          </div>
        </div>
      ))}
      <div className="flex flex-1 items-center justify-end gap-2 px-4 py-2">
        <span className="text-[11px] text-[#605e5c]">
          {filterDate || todayDate()} · actualización cada 30 s
        </span>
        {isLoading ? (
          <span className="border border-[#9dc4e6] bg-[#eff6fc] px-2 py-0.5 text-[10px] font-semibold text-[#005a9e]">
            Cargando…
          </span>
        ) : null}
      </div>
    </div>
  );

  return (
    <Layout
      title={<span className="text-lg font-semibold text-[#201f1e]">Tablero de atención</span>}
      subtitle={<span className="text-sm text-[#605e5c]">Cola de servicios · {filterDate || todayDate()}</span>}
      variant="cards"
      pageClassName={BC_PAGE}
      containerClassName={`${BC_CONTAINER} !rounded-sm !shadow-[0_1px_2px_rgba(0,0,0,0.06)]`}
      topContent={boardRibbon}
    >
      <DndContext
        sensors={dndSensors}
        collisionDetection={collisionDetection}
        onDragStart={handleDragStart}
        onDragCancel={handleDragCancel}
        onDragEnd={handleDragEnd}
      >
        <div
          className={`grid gap-3 lg:grid-cols-3 lg:items-stretch ${isDraggingBoard ? "select-none" : ""}`}
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
                  <Button
                    size="sm"
                    variant="secondary"
                    className={`${BC_BTN_SECONDARY} w-full`}
                    onClick={(e) => { e.stopPropagation(); void handleStartService(ticket); }}
                  >
                    Iniciar atención
                  </Button>
                }
                showRemaining={false}
                statusColors={{}}
                getRemainingLabel={getRemainingLabel}
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
                  <Button
                    size="sm"
                    variant="primary"
                    className={`${BC_BTN_PRIMARY} w-full`}
                    onClick={(e) => { e.stopPropagation(); void handleMarkCompleted(ticket); }}
                  >
                    Finalizar
                  </Button>
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
                  <Button
                    size="sm"
                    variant="secondary"
                    className={`${BC_BTN_SECONDARY} w-full`}
                    onClick={(e) => { e.stopPropagation(); handleOpenFinishModal(ticket); }}
                  >
                    Completar
                  </Button>
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
                <label className={BC_LABEL}>Cuestionario</label>
                <select
                  value={finishQuestionnaireId}
                  onChange={(event) => void handleQuestionnaireChange(event.target.value)}
                  className={BC_FIELD}
                >
                  <option value="">Sin cuestionario</option>
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
                <span className="text-[11px] text-[#605e5c]">Obligatorio: cuestionario o notas</span>
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
    </Layout>
  );
};

export default Main;
