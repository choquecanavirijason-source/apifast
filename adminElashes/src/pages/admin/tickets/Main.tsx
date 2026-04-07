import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Ticket,
  Wallet,
  Search,
  Filter,
  Eye,
  User,
  Plus,
} from "lucide-react";
import { toast } from "react-toastify";
import type { TicketItem } from "../../../core/services/agenda/agenda.service";
import {
  AgendaService,
  type ProfessionalForSelect,
  type ServiceOption,
} from "../../../core/services/agenda/agenda.service";
import { PaymentService, type PaymentItem } from "../../../core/services/payment/payment.service";
import DataTable, { type DataTableColumn } from "../../../components/common/table/DataTable";
import Layout from "../../../components/common/layout";
import FilterActionBar from "../../../components/common/FilterActionBar";
import { Button, InputField, SectionCard } from "../../../components/common/ui";
import GenericModal from "../../../components/common/modal/GenericModal";
import useAuth from "../../../core/hooks/useAuth";
import { BRANCH_STORAGE_KEY, getSelectedBranchId } from "../../../core/utils/branch";

const STATUS_LABELS: Record<string, string> = {
  pending: "Pendiente",
  confirmed: "Confirmado",
  in_service: "En servicio",
  completed: "Completado",
  cancelled: "Cancelado",
};

const PAYMENT_METHODS = [
  { value: "cash", label: "Efectivo" },
  { value: "card", label: "Tarjeta" },
  { value: "transfer", label: "Transferencia" },
  { value: "qr", label: "QR" },
];

interface ClientOption {
  id: number;
  nombre: string;
  apellido: string;
}

const getLocalDateInputValue = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const buildLocalDateTime = (dateValue: string, timeValue: string) => {
  if (!dateValue) return null;
  return `${dateValue}T${timeValue || "09:00"}:00`;
};

const formatLocalDateTime = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
};

const getErrorMessage = (err: unknown, fallback: string) => {
  if (typeof err === "object" && err !== null && "response" in err) {
    const response = (err as { response?: { status?: number; data?: { detail?: unknown } } }).response;
    if (response?.status === 401) return "Tu sesión expiró. Inicia sesión nuevamente.";
    if (response?.status === 403) return "No tienes permisos para crear tickets.";

    const detail = response?.data?.detail;
    if (typeof detail === "string" && detail.trim()) {
      return detail;
    }

    if (Array.isArray(detail)) {
      const validationMessage = detail
        .map((item) => (item && typeof item === "object" && "msg" in item ? String(item.msg ?? "") : ""))
        .filter(Boolean)
        .join("; ");

      if (validationMessage) {
        return validationMessage;
      }
    }
  }

  return fallback;
};

export default function TicketsPage() {
  const { hasPermissionByName, isAdmin } = useAuth();
  const [tickets, setTickets] = useState<TicketItem[]>([]);
  const [services, setServices] = useState<ServiceOption[]>([]);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [professionals, setProfessionals] = useState<ProfessionalForSelect[]>([]);
  const [activeBranchId, setActiveBranchId] = useState<number | null>(() => getSelectedBranchId());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [serviceFilter, setServiceFilter] = useState<string>("");
  const [ticketDateFilter, setTicketDateFilter] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState(""); // Código o nombre de cliente
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isPaymentsListModalOpen, setIsPaymentsListModalOpen] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<TicketItem | null>(null);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);
  const [ticketPayments, setTicketPayments] = useState<PaymentItem[]>([]);
  const [isLoadingPayments, setIsLoadingPayments] = useState(false);
  const [isCreateTicketOpen, setIsCreateTicketOpen] = useState(false);
  const [createClientId, setCreateClientId] = useState<string>("");
  const [createServiceIds, setCreateServiceIds] = useState<string[]>([]);
  const [createProfessionalId, setCreateProfessionalId] = useState<string>("");
  const [createDate, setCreateDate] = useState("");
  const [createStartTime, setCreateStartTime] = useState("09:00");
  const [createDurationMinutes, setCreateDurationMinutes] = useState(60);
  const [isCreatingTicket, setIsCreatingTicket] = useState(false);
  const [isLoadingClients, setIsLoadingClients] = useState(false);
  const [isLoadingProfessionals, setIsLoadingProfessionals] = useState(false);
  const canCreateTicket = isAdmin() || hasPermissionByName("appointments:manage");

  const selectedTicketTotal = Number(selectedTicket?.service_price ?? 0);
  const selectedTicketPaid = useMemo(
    () => ticketPayments.reduce((acc, payment) => acc + Number(payment.amount || 0), 0),
    [ticketPayments]
  );
  const selectedTicketRemaining = useMemo(
    () => Math.max(0, selectedTicketTotal - selectedTicketPaid),
    [selectedTicketPaid, selectedTicketTotal]
  );

  const loadClients = useCallback(async () => {
    setIsLoadingClients(true);
    try {
      const data = await AgendaService.listClientsForSelect({ limit: 100, branch_id: activeBranchId ?? undefined });
      setClients(data);
    } catch (err) {
      console.error("Error cargando clientes:", err);
      toast.error("No se pudieron cargar los clientes. Verifica tu conexión y permisos.");
      setClients([]);
    } finally {
      setIsLoadingClients(false);
    }
  }, [activeBranchId]);

  const loadServices = useCallback(async () => {
    try {
      const data = await AgendaService.listServices({ limit: 100, branch_id: activeBranchId ?? undefined });
      setServices(data);
    } catch (err) {
      console.error("Error cargando servicios:", err);
    }
  }, [activeBranchId]);

  const loadProfessionals = useCallback(async () => {
    setIsLoadingProfessionals(true);
    try {
      const data = await AgendaService.listProfessionalsForSelect({ limit: 100 });
      setProfessionals(data);
    } catch (err) {
      console.error("Error cargando usuarios asignables:", err);
      setProfessionals([]);
    } finally {
      setIsLoadingProfessionals(false);
    }
  }, []);

  const loadTickets = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await AgendaService.listTickets({
        limit: 200,
        service_id: serviceFilter ? Number(serviceFilter) : undefined,
        search: searchTerm.trim() || undefined,
        branch_id: activeBranchId ?? undefined,
      });
      setTickets(data);
    } catch (err) {
      console.error("Error cargando tickets:", err);
      setError("No se pudieron cargar los tickets.");
      setTickets([]);
    } finally {
      setIsLoading(false);
    }
  }, [serviceFilter, searchTerm, activeBranchId]);

  useEffect(() => {
    void loadServices();
    void loadClients();
    void loadProfessionals();
  }, [loadServices, loadClients, loadProfessionals]);

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
    const t = setTimeout(() => void loadTickets(), searchTerm.trim() ? 400 : 0);
    return () => clearTimeout(t);
  }, [loadTickets, serviceFilter, searchTerm]);

  const formatDate = (iso: string) => {
    try {
      const d = new Date(iso);
      return d.toLocaleDateString("es-BO", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return iso;
    }
  };

  const formatHour = (iso: string) => {
    try {
      return new Date(iso).toLocaleTimeString("es-BO", { hour: "2-digit", minute: "2-digit" });
    } catch {
      return iso;
    }
  };

  const handleOpenCreateTicket = () => {
    if (!canCreateTicket) {
      toast.warning("No tienes permisos para crear tickets.");
      return;
    }
    setCreateClientId("");
    setCreateServiceIds([]);
    setCreateProfessionalId("");
    setCreateDate(getLocalDateInputValue());
    setCreateStartTime("09:00");
    setCreateDurationMinutes(60);
    setIsCreateTicketOpen(true);
    void loadClients(); // Recargar clientes al abrir el modal
    void loadProfessionals();
  };

  const handleCreateServiceChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const values = Array.from(e.target.selectedOptions)
      .map((option) => option.value)
      .filter((value) => value);
    setCreateServiceIds(values);
    if (values.length > 0) {
      const duration = values
        .map((value) => services.find((s) => s.id === Number(value))?.duration_minutes ?? 0)
        .reduce((acc, value) => acc + value, 0);
      setCreateDurationMinutes(duration > 0 ? duration : 60);
    }
  };

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canCreateTicket) {
      toast.warning("No tienes permisos para crear tickets.");
      return;
    }
    const clientId = Number(createClientId);
    const serviceIds = createServiceIds
      .map((value) => Number(value))
      .filter((value) => Number.isFinite(value) && value > 0);
    if (!Number.isFinite(clientId) || clientId <= 0) {
      toast.warning("Selecciona un cliente.");
      return;
    }
    if (serviceIds.length === 0) {
      toast.warning("Selecciona al menos un servicio.");
      return;
    }
    if (!activeBranchId) {
      toast.warning("Selecciona una sucursal para crear el ticket.");
      return;
    }
    const parsedDuration = Number(createDurationMinutes);
    const duration = Number.isFinite(parsedDuration) && parsedDuration > 0 ? parsedDuration : 60;
    const professionalId =
      createProfessionalId && Number.isFinite(Number(createProfessionalId)) && Number(createProfessionalId) > 0
        ? Number(createProfessionalId)
        : null;
    const startDateTimeValue = buildLocalDateTime(createDate, createStartTime);
    if (!startDateTimeValue) {
      toast.warning("Selecciona una fecha válida.");
      return;
    }
    const startDateTime = new Date(startDateTimeValue);
    const endDateTime = new Date(startDateTime.getTime() + duration * 60 * 1000);
    if (Number.isNaN(startDateTime.getTime()) || Number.isNaN(endDateTime.getTime())) {
      toast.warning("La fecha u hora ingresada no es válida.");
      return;
    }
    if (endDateTime <= startDateTime) {
      toast.warning("La duración debe ser mayor a 0.");
      return;
    }
    setIsCreatingTicket(true);
    try {
      await AgendaService.createAppointment({
        client_id: clientId,
        service_ids: serviceIds,
        branch_id: activeBranchId,
        professional_id: professionalId,
        start_time: formatLocalDateTime(startDateTime),
        end_time: formatLocalDateTime(endDateTime),
        status: "pending",
      });
      toast.success("Ticket creado correctamente. El código se generó según el servicio.");
      setIsCreateTicketOpen(false);
      void loadTickets();
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "No se pudo crear el ticket."));
    } finally {
      setIsCreatingTicket(false);
    }
  };

  const loadPaymentsByTicket = async (ticket: TicketItem) => {
    setIsLoadingPayments(true);
    try {
      const data = await PaymentService.listByAppointment(ticket.id);
      setTicketPayments(data);
      return data;
    } catch (err) {
      console.error("Error cargando pagos:", err);
      setTicketPayments([]);
      toast.error("No se pudieron cargar los pagos.");
      return [];
    } finally {
      setIsLoadingPayments(false);
    }
  };

  const handleOpenPaymentModal = (ticket: TicketItem) => {
    setSelectedTicket(ticket);
    setTicketPayments([]);
    setPaymentAmount("");
    setPaymentMethod("cash");
    void loadPaymentsByTicket(ticket).then((payments) => {
      const total = Number(ticket.service_price ?? 0);
      const paid = payments.reduce((acc, payment) => acc + Number(payment.amount || 0), 0);
      const remaining = Math.max(0, total - paid);
      setPaymentAmount(remaining > 0 ? String(remaining.toFixed(2)) : "");
    });
    setIsPaymentModalOpen(true);
  };

  const handleOpenPaymentsList = async (ticket: TicketItem) => {
    setSelectedTicket(ticket);
    setIsPaymentsListModalOpen(true);
    await loadPaymentsByTicket(ticket);
  };

  const handleRegisterPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicket) return;

    const amount = Number(paymentAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.warning("Ingresa un monto válido.");
      return;
    }
    if (selectedTicketTotal > 0 && amount > selectedTicketRemaining) {
      toast.warning(`El pago supera el saldo pendiente del ticket (Bs ${selectedTicketRemaining.toFixed(2)}).`);
      return;
    }

    setIsSubmittingPayment(true);
    try {
      await PaymentService.create({
        client_id: selectedTicket.client_id,
        appointment_id: selectedTicket.id,
        amount,
        method: paymentMethod,
        status: "paid",
      });
      toast.success("Pago registrado correctamente.");
      const refreshed = await loadPaymentsByTicket(selectedTicket);
      const refreshedPaid = refreshed.reduce((acc, payment) => acc + Number(payment.amount || 0), 0);
      const refreshedRemaining = Math.max(0, selectedTicketTotal - refreshedPaid);
      setPaymentAmount(refreshedRemaining > 0 ? String(refreshedRemaining) : "");
      void loadTickets();
    } catch (err: unknown) {
      const msg =
        typeof err === "object" && err !== null && "response" in err
          ? String(
              (err as { response?: { data?: { detail?: string } } }).response?.data?.detail ??
                "No se pudo registrar el pago."
            )
          : "No se pudo registrar el pago.";
      toast.error(msg);
    } finally {
      setIsSubmittingPayment(false);
    }
  };

  const filteredTickets = useMemo(() => {
    if (!ticketDateFilter) return tickets;
    return tickets.filter((ticket) => ticket.start_time.slice(0, 10) === ticketDateFilter);
  }, [ticketDateFilter, tickets]);

  const columns: DataTableColumn<TicketItem>[] = useMemo(
    () => [
      {
        key: "ticket_code",
        header: "Código",
        getValue: (item) => item.ticket_code ?? `#${item.id}`,
        render: (item) => (
          <span className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 font-mono text-sm font-bold text-[#094732]">
            <Ticket className="h-3.5 w-3.5" />
            {item.ticket_code ?? `#${item.id}`}
          </span>
        ),
      },
      {
        key: "client_name",
        header: "Cliente",
        render: (item) => <span className="font-semibold text-slate-800">{item.client_name}</span>,
      },
      {
        key: "service_name",
        header: "Servicio",
        render: (item) => (
          <span className="text-sm text-slate-600">
            {item.service_names?.length
              ? item.service_names.join(" · ")
              : item.service_name ?? "Sin servicio"}
          </span>
        ),
      },
      {
        key: "start_time",
        header: "Fecha",
        render: (item) => (
          <span className="text-sm text-slate-500">{formatDate(item.start_time)}</span>
        ),
      },
      {
        key: "schedule",
        header: "Horario",
        getValue: (item) => `${item.start_time} ${item.end_time}`,
        render: (item) => (
          <span className="text-sm font-semibold text-slate-700">
            {formatHour(item.start_time)} - {formatHour(item.end_time)}
          </span>
        ),
      },
      {
        key: "status",
        header: "Estado",
        render: (item) => (
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-bold ${
              item.status === "completed"
                ? "bg-emerald-100 text-emerald-700"
                : item.status === "cancelled"
                  ? "bg-slate-100 text-slate-500"
                  : item.status === "confirmed"
                    ? "bg-amber-100 text-amber-700"
                    : "bg-slate-100 text-slate-600"
            }`}
          >
            {STATUS_LABELS[item.status] ?? item.status}
          </span>
        ),
      },
    ],
    []
  );

  const renderToolbar = () => (
    <FilterActionBar
      left={
        <div className="flex flex-wrap items-center gap-2">
          {canCreateTicket ? (
            <Button variant="primary" size="sm" onClick={handleOpenCreateTicket}>
              <Plus className="h-4 w-4" />
              Crear ticket
            </Button>
          ) : null}
          <div className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5">
            <Filter className="h-4 w-4 text-slate-400" />
            <select
              value={serviceFilter}
              onChange={(e) => setServiceFilter(e.target.value)}
              className="border-0 bg-transparent text-sm font-medium text-slate-700 outline-none focus:ring-0"
            >
              <option value="">Todos los servicios</option>
              {services.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Código o nombre de cliente..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-56 rounded-xl border border-slate-200 bg-white py-1.5 pl-9 pr-3 text-sm outline-none focus:border-[#094732] focus:ring-2 focus:ring-[#094732]/20"
            />
          </div>
          <div className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5">
            <span className="text-xs font-medium text-slate-500">Fecha</span>
            <input
              type="date"
              value={ticketDateFilter}
              onChange={(e) => setTicketDateFilter(e.target.value)}
              className="border-0 bg-transparent text-sm text-slate-700 outline-none focus:ring-0"
            />
            {ticketDateFilter ? (
              <button
                type="button"
                onClick={() => setTicketDateFilter("")}
                className="rounded px-1 text-xs text-slate-500 hover:bg-slate-100"
              >
                Limpiar
              </button>
            ) : null}
          </div>
          <Button variant="secondary" size="sm" onClick={() => void loadTickets()}>
            Actualizar
          </Button>
        </div>
      }
    />
  );

  return (
    <>
      <Layout
        title="Tickets"
        subtitle="Busca y gestiona tickets por servicio. Asigna pagos a clientes."
        variant="table"
        topContent={
          <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-4">
            <p className="text-sm text-slate-700">
              Cada ticket se asigna a un cliente según el servicio. Registra pagos vinculados al ticket para llevar el control.
            </p>
          </div>
        }
        toolbar={renderToolbar()}
      >
        {error ? (
          <SectionCard className="mb-4 border border-rose-200 bg-rose-50" bodyClassName="!p-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-medium text-rose-700">{error}</p>
              <Button type="button" size="sm" variant="secondary" onClick={() => void loadTickets()}>
                Reintentar
              </Button>
            </div>
          </SectionCard>
        ) : null}

        <DataTable
          data={filteredTickets}
          columns={columns}
          defaultLimit={15}
          availableLimits={[10, 15, 25, 50]}
          loading={isLoading}
          globalSearchPlaceholder={isLoading ? "Cargando tickets..." : "Buscar tickets..."}
          enableColumnFilters={false}
          actions={[
            {
              label: "Ver pagos",
              icon: <Eye className="h-4 w-4" />,
              onClick: (item) => handleOpenPaymentsList(item),
            },
            {
              label: "Registrar pago",
              icon: <Wallet className="h-4 w-4" />,
              onClick: (item) => handleOpenPaymentModal(item),
              variant: "primary",
            },
          ]}
        />
      </Layout>

      <GenericModal
        isOpen={isCreateTicketOpen}
        onClose={() => setIsCreateTicketOpen(false)}
        title="Crear ticket"
        size="md"
      >
        <form onSubmit={handleCreateTicket} className="space-y-4">
          <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-3">
            <p className="text-xs text-slate-600">
              Selecciona cliente y servicio. El código del ticket se generará según el servicio (ej: S1-20250310-0001).
            </p>
          </div>
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-slate-700">Cliente *</label>
            <select
              name="client_id"
              required
              value={createClientId}
              onChange={(e) => setCreateClientId(e.target.value)}
              disabled={isLoadingClients}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-[#094732] focus:ring-2 focus:ring-[#094732]/20 disabled:opacity-70"
            >
              <option value="">
                {isLoadingClients ? "Cargando clientes..." : clients.length === 0 ? "No hay clientes" : "Seleccionar cliente"}
              </option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre} {c.apellido}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-slate-700">Servicio *</label>
            <select
              name="service_id"
              required
              value={createServiceIds}
              onChange={handleCreateServiceChange}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-[#094732] focus:ring-2 focus:ring-[#094732]/20"
              multiple
            >
              <option value="">Seleccionar servicios</option>
              {services.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.duration_minutes} min · Bs {s.price})
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-slate-700">Usuario asignado (opcional)</label>
            <select
              name="professional_id"
              value={createProfessionalId}
              onChange={(e) => setCreateProfessionalId(e.target.value)}
              disabled={isLoadingProfessionals}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-[#094732] focus:ring-2 focus:ring-[#094732]/20 disabled:opacity-70"
            >
              <option value="">
                {isLoadingProfessionals
                  ? "Cargando usuarios..."
                  : professionals.length === 0
                    ? "Sin usuarios disponibles"
                    : "Sin asignar"}
              </option>
              {professionals.map((professional) => (
                <option key={professional.id} value={professional.id}>
                  {professional.username} ({professional.email})
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <InputField
              name="date"
              type="date"
              label="Fecha"
              value={createDate}
              onChange={(e) => setCreateDate(e.target.value)}
              required
            />
            <InputField
              name="start_time"
              type="time"
              label="Hora inicio"
              value={createStartTime}
              onChange={(e) => setCreateStartTime(e.target.value)}
              required
            />
          </div>
          <InputField
            name="duration"
            type="number"
            label="Duración (minutos)"
            min={5}
            max={480}
            value={String(createDurationMinutes)}
            onChange={(e) => setCreateDurationMinutes(Number(e.target.value) || 60)}
          />
          <div className="mt-6 flex justify-end gap-3">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsCreateTicketOpen(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isCreatingTicket}>
              {isCreatingTicket ? "Creando…" : "Crear ticket"}
            </Button>
          </div>
        </form>
      </GenericModal>

      <GenericModal
        isOpen={isPaymentModalOpen}
        onClose={() => {
          setIsPaymentModalOpen(false);
          setSelectedTicket(null);
        }}
        title="Registrar pago"
      >
        {selectedTicket && (
          <form onSubmit={handleRegisterPayment} className="space-y-4">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs font-medium text-slate-500">Ticket</p>
              <p className="font-mono font-bold text-[#094732]">
                {selectedTicket.ticket_code ?? `#${selectedTicket.id}`}
              </p>
              <p className="text-sm text-slate-700">
                Cliente: <strong>{selectedTicket.client_name}</strong>
              </p>
              {(selectedTicket.service_names?.length || selectedTicket.service_name) && (
                <p className="text-xs text-slate-500">
                  Servicio: {selectedTicket.service_names?.length ? selectedTicket.service_names.join(" · ") : selectedTicket.service_name}
                </p>
              )}
              <p className="text-xs text-slate-500">
                Horario: {formatDate(selectedTicket.start_time)} ({formatHour(selectedTicket.start_time)} -{" "}
                {formatHour(selectedTicket.end_time)})
              </p>
            </div>
            <div className="grid grid-cols-1 gap-3 rounded-xl border border-emerald-100 bg-emerald-50/60 p-3 sm:grid-cols-3">
              <div>
                <p className="text-[11px] uppercase tracking-wide text-slate-500">Precio ticket</p>
                <p className="text-sm font-bold text-slate-800">Bs {selectedTicketTotal.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wide text-slate-500">Pagado</p>
                <p className="text-sm font-bold text-emerald-700">Bs {selectedTicketPaid.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wide text-slate-500">Saldo</p>
                <p className="text-sm font-bold text-amber-700">Bs {selectedTicketRemaining.toFixed(2)}</p>
              </div>
            </div>
            <InputField
              name="amount"
              type="number"
              label="Monto (Bs)"
              placeholder="0"
              min="0.01"
              step="0.01"
              required
              value={paymentAmount}
              onChange={(e) => setPaymentAmount(e.target.value)}
            />
            {selectedTicketRemaining > 0 ? (
              <div className="-mt-2 flex justify-end">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setPaymentAmount(String(selectedTicketRemaining.toFixed(2)))}
                >
                  Usar saldo pendiente
                </Button>
              </div>
            ) : null}
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-slate-700">Método de pago</label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-[#094732] focus:ring-2 focus:ring-[#094732]/20"
              >
                {PAYMENT_METHODS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setIsPaymentModalOpen(false);
                  setSelectedTicket(null);
                }}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmittingPayment}>
                {isSubmittingPayment ? "Registrando…" : "Registrar pago"}
              </Button>
            </div>
          </form>
        )}
      </GenericModal>

      <GenericModal
        isOpen={isPaymentsListModalOpen}
        onClose={() => {
          setIsPaymentsListModalOpen(false);
          setSelectedTicket(null);
          setTicketPayments([]);
        }}
        title={`Pagos del ticket ${selectedTicket?.ticket_code ?? selectedTicket?.id ?? ""}`}
      >
        {selectedTicket && (
          <div className="space-y-3">
            <p className="text-sm text-slate-600">
              Cliente: <strong>{selectedTicket.client_name}</strong>
              {(selectedTicket.service_names?.length ? ` · ${selectedTicket.service_names.join(" · ")}` : selectedTicket.service_name ? ` · ${selectedTicket.service_name}` : "")}
            </p>
            {isLoadingPayments ? (
              <p className="py-6 text-center text-slate-500">Cargando pagos...</p>
            ) : ticketPayments.length === 0 ? (
              <p className="py-6 text-center text-slate-500">No hay pagos registrados para este ticket.</p>
            ) : (
              <div className="max-h-72 overflow-auto rounded-xl border border-slate-200">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-slate-50 text-slate-500">
                    <tr>
                      <th className="px-3 py-2 text-left">Monto</th>
                      <th className="px-3 py-2 text-left">Método</th>
                      <th className="px-3 py-2 text-left">Fecha</th>
                      <th className="px-3 py-2 text-left">Registrado por</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ticketPayments.map((p) => (
                      <tr key={p.id} className="border-t border-slate-100">
                        <td className="px-3 py-2 font-semibold">Bs {p.amount}</td>
                        <td className="px-3 py-2">
                          {PAYMENT_METHODS.find((m) => m.value === p.method)?.label ?? p.method}
                        </td>
                        <td className="px-3 py-2 text-slate-600">
                          {new Date(p.paid_at).toLocaleString("es-BO")}
                        </td>
                        <td className="px-3 py-2">
                          {p.registered_by ? (
                            <span className="inline-flex items-center gap-1 text-emerald-700">
                              <User className="h-3.5 w-3.5" />
                              {p.registered_by.username}
                            </span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="flex justify-end pt-2">
              <Button
                variant="secondary"
                onClick={() => {
                  setIsPaymentsListModalOpen(false);
                  handleOpenPaymentModal(selectedTicket);
                }}
              >
                Registrar otro pago
              </Button>
            </div>
          </div>
        )}
      </GenericModal>
    </>
  );
}
