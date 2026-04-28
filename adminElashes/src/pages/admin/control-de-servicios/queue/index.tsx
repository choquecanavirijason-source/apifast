import { useState, useRef, useMemo } from "react";
import GenericModal from "../../../components/common/modal/GenericModal";
import { Button } from "../../../components/common/ui";
import { AgendaService } from "../../../core/services/agenda/agenda.service";
import { toast } from "react-toastify";
import { AgendaService } from "../../../core/services/agenda/agenda.service";
import { DeleteTicketModal } from "./modals";
import { todayDate } from "../control.constants";
import { useQueueTickets } from "./useQueueTickets";
import QueueFilters from "./QueueFilters";
import QueueBoard from "./QueueBoard";

export default function QueuePage() {
  const [filterService, setFilterService] = useState("");
  const [isServiceFilterMenuOpen, setIsServiceFilterMenuOpen] = useState(false);
  const [filterClient, setFilterClient] = useState("");
  const [filterDate, setFilterDate] = useState(todayDate());
  const [filterTime, setFilterTime] = useState("");
  const [filterProfessionalId, setFilterProfessionalId] = useState("");
  const [activeBranchId] = useState<number | null>(null); // Puedes obtenerlo de contexto/global
  // Simulación: deberías cargar los profesionales reales
  const professionals = [
    { id: 1, username: "Operaria 1" },
    { id: 2, username: "Operaria 2" },
    { id: 3, username: "Operaria 3" },
  ];
  const [now, setNow] = useState(Date.now());
  // Actualiza el tiempo cada minuto para helpers
  useState(() => {
    const interval = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(interval);
  }, []);

  // Estado para eliminar ticket
  const [ticketToDelete, setTicketToDelete] = useState(null);
  const [deleteConfirmationCode, setDeleteConfirmationCode] = useState("");
  const [isDeletingTicket, setIsDeletingTicket] = useState(false);

  // Tickets hook
  const { tickets, isLoading, loadTickets } = useQueueTickets(activeBranchId, filterDate);

  // Opciones de filtro de servicio
  const serviceFilterOptions = useMemo(() => {
    const names = new Set<string>();
    tickets.forEach((ticket) => {
      if (ticket.service_name?.trim()) {
        names.add(ticket.service_name.trim());
      }
      (ticket.service_names ?? []).forEach((name) => {
        if (name?.trim()) {
          names.add(name.trim());
        }
      });
    });
    return Array.from(names).sort((a, b) => a.localeCompare(b, "es"));
  }, [tickets]);

  const filteredServiceFilterOptions = useMemo(() => {
    const term = filterService.trim().toLowerCase();
    if (!term) return serviceFilterOptions;
    return serviceFilterOptions.filter((option) => option.toLowerCase().includes(term));
  }, [serviceFilterOptions, filterService]);

  // Lógica de filtrado y helpers
  const filteredTickets = useMemo(() => {
    const serviceTerm = filterService.trim().toLowerCase();
    const clientTerm = filterClient.trim().toLowerCase();

    return tickets.filter((ticket) => {
      const servicesText = `${ticket.service_name ?? ""} ${(ticket.service_names ?? []).join(" ")}`.toLowerCase();
      const clientText = `${ticket.client_name ?? ""}`.toLowerCase();
      // Aquí puedes agregar más filtros según sea necesario
      return (
        (!serviceTerm || servicesText.includes(serviceTerm)) &&
        (!clientTerm || clientText.includes(clientTerm))
      );
    });
  }, [tickets, filterService, filterClient]);

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
  const iaTickets = useMemo(
    () => filteredTickets.filter((ticket) => Boolean(ticket.is_ia)),
    [filteredTickets]
  );

  // Handlers y helpers mínimos (mock)
  const [editingTicketId, setEditingTicketId] = useState(null);

  // Iniciar servicio
  const handleStartService = async (ticket) => {
    if (!ticket.professional_id) {
      toast.warning("Asigna una operaria antes de iniciar la atencion.");
      return;
    }
    try {
      await AgendaService.updateAppointment(ticket.id, { status: "in_service" });
      toast.success("Atencion iniciada.");
      loadTickets();
    } catch (error) {
      toast.error("No se pudo iniciar la atencion.");
    }
  };

  // Finalizar servicio
  const handleMarkCompleted = async (ticket) => {
    try {
      await AgendaService.updateAppointment(ticket.id, { status: "completed" });
      toast.success("Ticket finalizado.");
      loadTickets();
    } catch (error) {
      toast.error("No se pudo finalizar el ticket.");
    }
  };

  // Edición rápida de ticket (ejemplo: fecha/hora/profesional)
  const handleSaveTicketEdits = async (ticket, payload) => {
    setEditingTicketId(ticket.id);
    try {
      await AgendaService.updateAppointment(ticket.id, payload);
      toast.success("Ticket actualizado.");
      loadTickets();
    } catch (error) {
      toast.error("No se pudo actualizar el ticket.");
    } finally {
      setEditingTicketId(null);
    }
  };

  // Modal de finalizar atención (placeholder, puedes modularizarlo luego)
  const handleOpenFinishModal = () => {};
  // Handler para abrir modal de eliminar
  const handleDeleteClick = (ticket) => {
    setTicketToDelete(ticket);
    setDeleteConfirmationCode("");
  };
  // Handler para eliminar ticket
  const handleConfirmDelete = async () => {
    if (!ticketToDelete) return;
    setIsDeletingTicket(true);
    try {
      await AgendaService.deleteAppointment(ticketToDelete.id);
      toast.success("Ticket eliminado.");
      setTicketToDelete(null);
      setDeleteConfirmationCode("");
      loadTickets();
    } catch (error) {
      toast.error("No se pudo eliminar el ticket.");
    } finally {
      setIsDeletingTicket(false);
    }
  };
  const handleCancelDelete = () => {
    if (!isDeletingTicket) {
      setTicketToDelete(null);
      setDeleteConfirmationCode("");
    }
  };
  // Drag & drop (placeholder)
  const handleDragEnd = () => {};

  // Helper: ¿ticket creado recientemente?
  const isRecentlyCreated = (ticket) => {
    const createdAt = new Date(ticket.created_at ?? 0).getTime();
    return Number.isFinite(createdAt) && now - createdAt <= 30 * 60 * 1000;
  };

  // Helper: colores por estado
  const statusColors = {
    pending: "bg-amber-100 text-amber-700",
    in_service: "bg-emerald-100 text-emerald-700",
    completed: "bg-slate-200 text-slate-700",
    cancelled: "bg-red-100 text-red-700",
    confirmed: "bg-blue-100 text-blue-700",
  };

  // Helper: tiempo restante
  const getRemainingLabel = (endTime) => {
    const remainingMs = new Date(endTime).getTime() - now;
    if (!Number.isFinite(remainingMs)) return "";
    const minutes = Math.max(0, Math.ceil(remainingMs / 60000));
    return minutes <= 0 ? "Finalizando" : `≈ ${minutes} min`;
  };

  // Modal de finalizar atención (esqueleto)
  const [isFinishModalOpen, setIsFinishModalOpen] = useState(false);
  const [finishTarget, setFinishTarget] = useState(null);
  const [finishNotes, setFinishNotes] = useState("");
  const [finishProfessionalId, setFinishProfessionalId] = useState("");
  const [isSubmittingTracking, setIsSubmittingTracking] = useState(false);
  const handleOpenFinishModal = (ticket) => {
    setFinishTarget(ticket);
    setFinishNotes("");
    setFinishProfessionalId("");
    setIsFinishModalOpen(true);
  };
  const handleCloseFinishModal = () => {
    setIsFinishModalOpen(false);
    setFinishTarget(null);
    setFinishNotes("");
    setFinishProfessionalId("");
  };
  // Guardar finalización
  const handleFinishService = async () => {
    if (!finishTarget) return;
    if (!finishProfessionalId) {
      toast.warning("Selecciona una profesional antes de finalizar.");
      return;
    }
    if (!finishNotes.trim()) {
      toast.warning("Agrega observaciones del servicio antes de finalizar.");
      return;
    }
    setIsSubmittingTracking(true);
    try {
      await AgendaService.updateAppointment(finishTarget.id, { status: "completed", notes: finishNotes, professional_id: finishProfessionalId });
      toast.success("Atención finalizada.");
      setIsFinishModalOpen(false);
      setFinishTarget(null);
      setFinishNotes("");
      setFinishProfessionalId("");
      loadTickets();
    } catch (error) {
      toast.error("No se pudo finalizar la atención.");
    } finally {
      setIsSubmittingTracking(false);
    }
  };

  return (
    <div className="p-4">
      <QueueFilters
        filterService={filterService}
        setFilterService={setFilterService}
        isServiceFilterMenuOpen={isServiceFilterMenuOpen}
        setIsServiceFilterMenuOpen={setIsServiceFilterMenuOpen}
        filteredServiceFilterOptions={filteredServiceFilterOptions}
        filterClient={filterClient}
        setFilterClient={setFilterClient}
        filterDate={filterDate}
        setFilterDate={setFilterDate}
        filterTime={filterTime}
        setFilterTime={setFilterTime}
        filterProfessionalId={filterProfessionalId}
        setFilterProfessionalId={setFilterProfessionalId}
        professionals={professionals}
        loadTickets={loadTickets}
        isLoading={isLoading}
      />
      <QueueBoard
        waitingTickets={waitingTickets}
        inServiceTickets={inServiceTickets}
        completedTickets={completedTickets}
        iaTickets={iaTickets}
        professionals={professionals}
        editingTicketId={editingTicketId}
        handleStartService={handleStartService}
        handleMarkCompleted={handleMarkCompleted}
        handleOpenFinishModal={handleOpenFinishModal}
        handleSaveTicketEdits={handleSaveTicketEdits}
        handleDeleteClick={handleDeleteClick}
        handleDragEnd={handleDragEnd}
        isRecentlyCreated={isRecentlyCreated}
        statusColors={statusColors}
        getRemainingLabel={getRemainingLabel}
      />
      <GenericModal isOpen={isFinishModalOpen} onClose={handleCloseFinishModal} title="Finalizar atención">
        <div className="space-y-4 p-2 sm:p-4">
          <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-3 text-sm text-slate-600">
            Registra observaciones antes de finalizar la atención.
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Cliente</label>
            <div className="rounded border px-3 py-2 bg-white text-sm">{finishTarget?.client_name}</div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Profesional</label>
            <select
              value={finishProfessionalId}
              onChange={e => setFinishProfessionalId(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none"
            >
              <option value="">Selecciona profesional…</option>
              {professionals.map((p) => (
                <option key={p.id} value={p.id}>{p.username}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Observaciones del servicio</label>
            <textarea
              value={finishNotes}
              onChange={e => setFinishNotes(e.target.value)}
              rows={4}
              className="w-full resize-y rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
              placeholder="Describe el proceso, incidencias, resultados y recomendaciones para la siguiente cita..."
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={handleCloseFinishModal}>
              Cancelar
            </Button>
            <Button type="button" onClick={handleFinishService} disabled={isSubmittingTracking}>
              {isSubmittingTracking ? "Guardando..." : "Finalizar"}
            </Button>
          </div>
        </div>
      </GenericModal>
      <DeleteTicketModal
        isOpen={Boolean(ticketToDelete)}
        ticketToDelete={ticketToDelete}
        deleteConfirmationCode={deleteConfirmationCode}
        setDeleteConfirmationCode={setDeleteConfirmationCode}
        isDeletingTicket={isDeletingTicket}
        onConfirm={handleConfirmDelete}
        onCancel={handleCancelDelete}
      />
    </div>
  );
}
