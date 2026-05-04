import { useCallback, useEffect, useMemo, useState } from "react";
import { DndContext, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
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
import DraggableTicketCard from "./components/DraggableTicketCard";
import DroppableColumn from "./components/DroppableColumn";

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
  const dndSensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  );

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

  const handleDragEnd = async (event: DragEndEvent) => {
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

      try {
        await AgendaService.updateAppointment(ticketId, { is_ia: true });
        toast.success("Ticket movido a Tickets con IA.");
        void loadTickets();
      } catch (error) {
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

    try {
      await AgendaService.updateAppointment(ticketId, {
        status: newStatus,
        is_ia: false,
      });
      toast.success(`Ticket movido a ${STATUS_LABELS[newStatus] ?? targetColumn}.`);
      void loadTickets();
    } catch (error) {
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
          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none"
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
          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none"
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
        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none"
      />
    );
  };

  return (
    <Layout
      title="Tablero de atención"
      subtitle="Vista operativa del día"
      variant="cards"
    >
      {isLoading ? (
        <p className="text-sm text-slate-400">Cargando tablero...</p>
      ) : null}

      <DndContext sensors={dndSensors} onDragEnd={handleDragEnd}>
        <div className="grid gap-5 lg:grid-cols-3 lg:items-stretch">
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
      </DndContext>

      <ConfirmDialog
          isOpen={Boolean(ticketToDelete)}
          title="Eliminar ticket"
          message={
            <div className="space-y-3">
              <p>
                ¿Seguro que deseas eliminar el ticket de <strong>{ticketToDelete?.client_name}</strong>? Esta accion no se puede deshacer.
              </p>
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                Para confirmar, escribe el codigo del ticket:
                <strong className="ml-1">{ticketToDelete?.ticket_code?.trim() || String(ticketToDelete?.id ?? "")}</strong>
              </div>
              <input
                type="text"
                value={deleteConfirmationCode}
                onChange={(event) => setDeleteConfirmationCode(event.target.value)}
                placeholder="Ingresa el codigo para eliminar"
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none"
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
            <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-3 text-sm text-slate-600">
              Registra el tracking tecnico y el cuestionario antes de finalizar.
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="text-xs font-semibold text-slate-500">Profesional</label>
                <select
                  value={finishProfessionalId}
                  onChange={(event) => setFinishProfessionalId(event.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none"
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
                <label className="text-xs font-semibold text-slate-500">Tipo de ojo</label>
                <select
                  value={finishEyeTypeId}
                  onChange={(event) => setFinishEyeTypeId(event.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none"
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
                <label className="text-xs font-semibold text-slate-500">Efecto</label>
                <select
                  value={finishEffectId}
                  onChange={(event) => setFinishEffectId(event.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none"
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
                <label className="text-xs font-semibold text-slate-500">Volumen</label>
                <select
                  value={finishVolumeId}
                  onChange={(event) => setFinishVolumeId(event.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none"
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
                <label className="text-xs font-semibold text-slate-500">Diseno de pestanas</label>
                <select
                  value={finishLashDesignId}
                  onChange={(event) => setFinishLashDesignId(event.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none"
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
                <label className="text-xs font-semibold text-slate-500">Cuestionario</label>
                <select
                  value={finishQuestionnaireId}
                  onChange={(event) => void handleQuestionnaireChange(event.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none"
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
                    <Button type="button" variant="secondary" onClick={() => setIsQuestionnaireModalOpen(true)}>
                      Responder cuestionario
                    </Button>
                    <span className="text-xs text-slate-500">{Object.keys(questionnaireResponses).length} respuestas guardadas</span>
                  </div>
                ) : null}
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
              <div className="mb-2 flex items-center justify-between">
                <label htmlFor="finish-observations" className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                  Observaciones del servicio
                </label>
                <span className="text-[11px] text-slate-500">Obligatorio: cuestionario o notas</span>
              </div>
              <textarea
                id="finish-observations"
                value={finishNotes}
                onChange={(event) => setFinishNotes(event.target.value)}
                rows={4}
                placeholder="Describe el proceso, incidencias, resultados y recomendaciones para la siguiente cita..."
                className="w-full resize-y rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
              />
            </div>

            <div className="flex justify-end gap-3">
              <Button type="button" variant="secondary" onClick={() => setIsFinishModalOpen(false)}>
                Cancelar
              </Button>
              <Button type="button" onClick={() => void handleFinishService()} disabled={isSubmittingTracking}>
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
                    <label className="text-xs font-semibold text-slate-600">{question.text}</label>
                    {renderQuestion(question)}
                  </div>
                ))}
            </div>
          ) : (
            <p className="text-sm text-slate-500">Sin preguntas registradas.</p>
          )}

          <div className="mt-6 flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={() => setIsQuestionnaireModalOpen(false)}>
              Cerrar
            </Button>
            <Button type="button" onClick={() => setIsQuestionnaireModalOpen(false)}>
              Guardar respuestas
            </Button>
          </div>
        </GenericModal>
    </Layout>
  );
};

export default Main;
