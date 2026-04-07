import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { 
  Plus, Edit, Trash2, FileText, Users, Star, History, Wallet, BadgeCheck, Ban, ChevronUp
} from "lucide-react";
import { toast } from "react-toastify";
import type { IClient } from "../../../core/types/IClient";
import { AgendaService, type TicketItem } from "../../../core/services/agenda/agenda.service";
import { ClientService, type EyeTypeOption } from "../../../core/services/client/client.service";
import { BranchService } from "../../../core/services/branch/branch.service";
import { PaymentService, type PaymentItem } from "../../../core/services/payment/payment.service";
import DataTable, { type DataTableAction, type DataTableColumn } from "../../../components/common/table/DataTable.tsx";
import Layout from "../../../components/common/layout";
import GenericModal from "../../../components/common/modal/GenericModal";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import FilterActionBar from "../../../components/common/FilterActionBar";
import { Button, SectionCard, StatCard } from "../../../components/common/ui";
import RegisterClientModal from "./RegisterClientModal";
import AssignTicketModal from "./AssignTicketModal";
import ClientPaymentsModal from "./ClientPaymentsModal";
import { BRANCH_STORAGE_KEY, getSelectedBranchId } from "../../../core/utils/branch";

const SEEDED_EYE_TYPES_FALLBACK: EyeTypeOption[] = [
  { id: -1, name: "Almendrado" },
  { id: -2, name: "Encapotado" },
  { id: -3, name: "Redondo" },
  { id: -4, name: "Rasgado" },
  { id: -5, name: "Asimétricos" },
];

const PAYMENT_METHODS = [
  { value: "cash", label: "Efectivo" },
  { value: "card", label: "Tarjeta" },
  { value: "transfer", label: "Transferencia" },
  { value: "qr", label: "QR" },
];

const getLocalDateInputValue = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

// --- 3. Página Principal ---

export default function ClientListPage() {
  const navigate = useNavigate();

  const [items, setItems] = useState<IClient[]>([]);
  const [payments, setPayments] = useState<PaymentItem[]>([]);
  const [clientTickets, setClientTickets] = useState<TicketItem[]>([]);
  const [viewMode, setViewMode] = useState<"all" | "frequent">("all");
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [isLoadingClients, setIsLoadingClients] = useState(false);
  const [isLoadingPayments, setIsLoadingPayments] = useState(false);
  const [clientError, setClientError] = useState<string | null>(null);
  const [eyeTypes, setEyeTypes] = useState<EyeTypeOption[]>([]);
  const [branches, setBranches] = useState<Array<{ id: number; name: string }>>([]);
  const [activeBranchId, setActiveBranchId] = useState<number | null>(() => getSelectedBranchId());
  const [isLoadingEyeTypes, setIsLoadingEyeTypes] = useState(false);
  const [eyeTypesError, setEyeTypesError] = useState<string | null>(null);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [clientToDelete, setClientToDelete] = useState<IClient | null>(null);
  const [isDeletingClient, setIsDeletingClient] = useState(false);
  
  // Estados de Modales
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [clientToEdit, setClientToEdit] = useState<IClient | null>(null);
  const [clientToAssignTicket, setClientToAssignTicket] = useState<IClient | null>(null);
  const [isAssignTicketOpen, setIsAssignTicketOpen] = useState(false);
  const [currentClient, setCurrentClient] = useState<IClient | null>(null);
  const [isFileOpen, setIsFileOpen] = useState(false);
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [selectedTicketId, setSelectedTicketId] = useState<string>("");
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);

  const today = getLocalDateInputValue();

  const getEyeTypeLabel = (eyeType: unknown): string => {
    if (!eyeType) return "-";
    if (typeof eyeType === "string") return eyeType;
    if (typeof eyeType === "object" && eyeType !== null) {
      const candidate = eyeType as { name?: unknown; label?: unknown };
      if (typeof candidate.name === "string") return candidate.name;
      if (typeof candidate.label === "string") return candidate.label;
    }
    return String(eyeType);
  };

  const getTicketDurationMinutes = (ticket: TicketItem) => {
    const start = new Date(ticket.start_time).getTime();
    const end = new Date(ticket.end_time).getTime();
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return 60;
    return Math.max(1, Math.round((end - start) / 60000));
  };

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });

    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 260);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const loadClients = async () => {
    setIsLoadingClients(true);
    setClientError(null);
    try {
      const clients = await ClientService.list({ branch_id: activeBranchId ?? undefined });
      setItems(clients);
    } catch (error) {
      console.error("Error cargando clientes:", error);
      setClientError("No se pudieron cargar los clientes desde la API.");
    } finally {
      setIsLoadingClients(false);
    }
  };

  useEffect(() => {
    void loadClients();
  }, [activeBranchId]);

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
    BranchService.list({ limit: 200 })
      .then((data) => setBranches(data))
      .catch((error) => {
        console.error("Error cargando sucursales:", error);
        setBranches([]);
      });
  }, []);

  const loadPayments = async () => {
    setIsLoadingPayments(true);
    try {
      const data = await PaymentService.list({ limit: 500 });
      setPayments(data);
    } catch (error) {
      console.error("Error cargando pagos:", error);
      toast.error("No se pudieron cargar los pagos desde la API.");
      setPayments([]);
    } finally {
      setIsLoadingPayments(false);
    }
  };

  useEffect(() => {
    void loadPayments();
  }, []);

  const loadEyeTypes = async () => {
    setIsLoadingEyeTypes(true);
    setEyeTypesError(null);
    try {
      const data = await ClientService.listEyeTypes({ limit: 100 });
      if (data.length > 0) {
        setEyeTypes(data);
      } else {
        setEyeTypes(SEEDED_EYE_TYPES_FALLBACK);
      }
    } catch (error) {
      console.error("Error cargando tipos de ojos:", error);
      setEyeTypes(SEEDED_EYE_TYPES_FALLBACK);
      setEyeTypesError("No se pudieron cargar desde API. Se usan opciones base.");
    } finally {
      setIsLoadingEyeTypes(false);
    }
  };

  useEffect(() => {
    void loadEyeTypes();
  }, []);

  const handleScrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const getClientPayments = (clientId: number) =>
    payments
      .filter((payment) => payment.client_id === clientId)
      .sort((a, b) => b.paid_at.localeCompare(a.paid_at));

  const getLatestPayment = (clientId: number) => getClientPayments(clientId)[0];

  const isEnabledToday = (clientId: number) => {
    const todayPayment = payments.find(
      (payment) => payment.client_id === clientId && payment.paid_at.slice(0, 10) === today && payment.status === "paid"
    );
    return Boolean(todayPayment);
  };

  // Lógica de Filtrado
  const filteredItems = useMemo(() => {
    let result = items;

    // Filtro por Tab (Frecuentes)
    if (viewMode === "frequent") {
      result = result.filter(client => client.visitas > 5);
    }

    return result;
  }, [items, viewMode]);

  // Manejadores de Acción
  const handleCreate = () => {
    setClientToEdit(null);
    setIsRegisterOpen(true);
  };

  const handleEdit = (client: IClient) => {
    setClientToEdit(client);
    setIsRegisterOpen(true);
  };

  const handleDelete = (client: IClient) => {
    setClientToDelete(client);
    setIsDeleteConfirmOpen(true);
  };

  const confirmDeleteClient = async () => {
    if (!clientToDelete) return;

    setIsDeletingClient(true);
    try {
      await ClientService.remove(clientToDelete.id);
      setItems((prev) => prev.filter((c) => c.id !== clientToDelete.id));
      setIsDeleteConfirmOpen(false);
      setClientToDelete(null);
      toast.success("Cliente eliminado correctamente.");
    } catch (error) {
      const message = getErrorMessage(error, "No se pudo eliminar el cliente.");
      alert(message);
      toast.error(message);
    } finally {
      setIsDeletingClient(false);
    }
  };

  const getErrorMessage = (error: unknown, fallback: string) => {
    if (typeof error === "object" && error !== null && "response" in error) {
      const candidate = error as { response?: { data?: { detail?: string; message?: string } } };
      return candidate.response?.data?.detail ?? candidate.response?.data?.message ?? fallback;
    }
    return fallback;
  };

  const handleRegisterClient = async (form: HTMLFormElement) => {
    const formData = new FormData(form);

    const nombre = String(formData.get("nombre") ?? "").trim();
    const apellido = String(formData.get("apellido") ?? "").trim();
    const edadRaw = String(formData.get("edad") ?? "").trim();
    const phoneCountryCode = String(formData.get("phone_country_code") ?? "+591").trim();
    const phone = String(formData.get("phone") ?? "").trim();
    const sexo = String(formData.get("sexo") ?? "").trim();
    const eyeTypeRaw = String(formData.get("eye_type_id") ?? "").trim();
    const branchRaw = String(formData.get("branch_id") ?? "").trim();

    if (!nombre || !apellido) {
      alert("Nombre y apellido son obligatorios.");
      return;
    }

    const parsedEdad = Number(edadRaw);
    const edad = edadRaw && Number.isFinite(parsedEdad) ? parsedEdad : undefined;

    if (edad !== undefined && (edad < 1 || edad > 100)) {
      const message = edad < 1 ? "La edad no puede ser 0." : "La edad no puede ser mayor a 100.";
      alert(message);
      toast.warning(message);
      return;
    }

    const normalizedPhone = phone.replace(/\D/g, "");
    const formattedPhone = normalizedPhone ? `${phoneCountryCode}${normalizedPhone}` : undefined;

    const parsedEyeTypeId = Number(eyeTypeRaw);
    const eye_type_id = eyeTypeRaw && Number.isFinite(parsedEyeTypeId) && parsedEyeTypeId > 0 ? parsedEyeTypeId : undefined;

    const parsedBranchId = Number(branchRaw);
    const branch_id = branchRaw && Number.isFinite(parsedBranchId) && parsedBranchId > 0 ? parsedBranchId : undefined;

    try {
      if (clientToEdit) {
        const updated = await ClientService.update(clientToEdit.id, {
          name: nombre,
          last_name: apellido,
          age: edad,
          phone: formattedPhone,
          eye_type_id,
          branch_id,
        });

        const updatedWithUiFields: IClient = {
          ...updated,
          sexo: (sexo as IClient["sexo"]) || clientToEdit.sexo || "Otro",
        };

        setItems((prev) => prev.map((client) => (client.id === updatedWithUiFields.id ? updatedWithUiFields : client)));
        setIsRegisterOpen(false);
        setClientToEdit(null);
        form.reset();
        toast.success("Cliente actualizado correctamente.");
        return;
      }

      const created = await ClientService.create({
        name: nombre,
        last_name: apellido,
        age: edad,
        phone: formattedPhone,
        eye_type_id,
        branch_id,
      });

      const createdWithUiFields: IClient = {
        ...created,
        sexo: (sexo as IClient["sexo"]) || "Otro",
      };

      setItems((prev) => [createdWithUiFields, ...prev]);
      setIsRegisterOpen(false);
      form.reset();
      toast.success("Cliente registrado correctamente.");
      setClientToAssignTicket(createdWithUiFields);
      setIsAssignTicketOpen(true);
    } catch (error) {
      const message = getErrorMessage(
        error,
        clientToEdit ? "No se pudo actualizar el cliente." : "No se pudo registrar el cliente."
      );
      alert(message);
      toast.error(message);
    }
  };

  const handleOpenPayments = (client: IClient) => {
    void openPaymentsModal(client);
  };

  const getTicketTotalPrice = (ticket: { service_prices?: number[]; service_price?: number | null }): number => {
    if (ticket.service_prices && ticket.service_prices.length > 0) {
      return ticket.service_prices.reduce((sum, p) => sum + (Number(p) || 0), 0);
    }
    if (ticket.service_price != null && Number.isFinite(ticket.service_price)) {
      return ticket.service_price;
    }
    return 0;
  };

  const refreshPaymentsContext = async (
    client: IClient,
    ticketId?: number,
    ticketWithPrice?: { service_prices?: number[]; service_price?: number | null },
    initialAmount?: number
  ) => {
    try {
      const [clientPayments, tickets] = await Promise.all([
        PaymentService.listByClient(client.id),
        AgendaService.listTickets({ client_id: client.id, limit: 100 }),
      ]);
      const sortedPayments = [...clientPayments].sort((a, b) => b.paid_at.localeCompare(a.paid_at));
      const latestPayment = sortedPayments[0];

      // Si abrimos con un ticket recién asignado, autocompletar monto con su precio
      const selectedTicket = ticketId ? tickets.find((t) => t.id === ticketId) : null;
      const ticketTotal =
        initialAmount != null && initialAmount > 0
          ? initialAmount
          : ticketWithPrice
            ? getTicketTotalPrice(ticketWithPrice)
            : selectedTicket
              ? getTicketTotalPrice(selectedTicket)
              : 0;

      const amountToUse =
        ticketId && ticketTotal > 0
          ? String(ticketTotal)
          : latestPayment
            ? String(latestPayment.amount)
            : "";

      setPaymentAmount(amountToUse);
      setPaymentMethod(latestPayment?.method ?? "cash");
      setSelectedTicketId(
        ticketId
          ? String(ticketId)
          : latestPayment?.appointment_id
            ? String(latestPayment.appointment_id)
            : ""
      );

      setPayments((prev) => {
        const others = prev.filter((payment) => payment.client_id !== client.id);
        return [...clientPayments, ...others];
      });
      setClientTickets(tickets);
    } catch (error) {
      console.error("Error cargando contexto de pagos del cliente:", error);
      toast.error("No se pudieron cargar los tickets o pagos del cliente.");
      setClientTickets([]);
    }
  };

  const openPaymentsModal = async (
    client: IClient,
    ticketId?: number,
    ticketWithPrice?: { service_prices?: number[]; service_price?: number | null },
    initialAmount?: number
  ) => {
    setCurrentClient(client);
    setPaymentAmount(initialAmount != null && initialAmount > 0 ? String(initialAmount) : "");
    setPaymentMethod("cash");
    setSelectedTicketId(ticketId ? String(ticketId) : "");
    setIsPaymentOpen(true);

    await refreshPaymentsContext(client, ticketId, ticketWithPrice, initialAmount);
  };

  const handleRegisterPayment = async () => {
    if (!currentClient) return;

    const amount = Number(paymentAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.warning("Ingresa un monto válido.");
      return;
    }

    if (!selectedTicketId) {
      toast.warning("Selecciona un ticket para asignar el servicio.");
      return;
    }

    const selectedTicket = clientTickets.find((ticket) => String(ticket.id) === selectedTicketId);
    if (!selectedTicket) {
      toast.warning("No se encontro el ticket seleccionado.");
      return;
    }

    const appointmentId = selectedTicketId ? Number(selectedTicketId) : undefined;
    setIsSubmittingPayment(true);
    try {
      await PaymentService.create({
        client_id: currentClient.id,
        appointment_id: appointmentId,
        amount,
        method: paymentMethod,
        status: "paid",
      });
      toast.success("Pago registrado correctamente.");
      await Promise.all([refreshPaymentsContext(currentClient, appointmentId), loadPayments(), loadClients()]);
      setIsPaymentOpen(false);
      navigate("/admin/services/queue");
    } catch (error) {
      toast.error(getErrorMessage(error, "No se pudo registrar el pago."));
    } finally {
      setIsSubmittingPayment(false);
    }
  };

  const paymentsToday = useMemo(
    () => payments.filter((payment) => payment.paid_at.slice(0, 10) === today && payment.status === "paid").length,
    [payments, today]
  );

  // --- Columnas de la Tabla ---
  const columns: DataTableColumn<IClient>[] = [
    { 
      key: "nombre", 
      header: "Nombre", 
      render: (item: IClient) => <span className="font-bold text-slate-800">{item.nombre}</span> 
    },
    { 
      key: "apellido", 
      header: "Apellido", 
      render: (item: IClient) => <span className="font-semibold text-slate-700">{item.apellido}</span> 
    },
    { 
      key: "visitas", 
      header: "Frecuencia", 
      render: (item: IClient) => (
        <div className="flex items-center gap-1.5">
           {item.visitas > 5 && <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500"/>}
           <span className={`text-xs font-bold px-2 py-0.5 rounded-md border ${
               item.visitas > 5 
               ? 'bg-amber-50 text-amber-700 border-amber-100' 
               : 'bg-slate-100 text-slate-600 border-slate-200'
           }`}>
               {item.visitas} visitas
           </span>
        </div>
      ) 
    },
    { 
      key: "edad", 
      header: "Edad", 
      render: (item: IClient) => <span className="text-slate-600 text-sm font-medium">{item.edad} años</span>
    },
    { 
      key: "tipoOjos", 
      header: "Tipo de Ojos", 
      getValue: (item: IClient) => getEyeTypeLabel(item.tipoOjos),
      render: (item: IClient) => <span className="text-sm text-slate-500 italic">{getEyeTypeLabel(item.tipoOjos)}</span> 
    },
    {
      key: "status",
      header: "Estado",
      render: (item: IClient) => {
        const statusConfig: Record<string, { color: string; label: string }> = {
          en_servicio: { color: "bg-blue-100 text-blue-700", label: "En servicio" },
          en_espera: { color: "bg-amber-100 text-amber-700", label: "En espera" },
          pagado: { color: "bg-emerald-100 text-emerald-700", label: "Pagado" },
          reserva: { color: "bg-violet-100 text-violet-700", label: "Reserva" },
          finalizado: { color: "bg-green-100 text-green-700", label: "Finalizado" },
          sin_estado: { color: "bg-slate-200 text-slate-600", label: "Sin estado" },
          siendo_atendido: { color: "bg-blue-100 text-blue-700", label: "Siendo atendido" },
          atendido: { color: "bg-green-100 text-green-700", label: "Atendido" },
          cancelado: { color: "bg-red-100 text-red-700", label: "Cancelado" },
          no_se_presento: { color: "bg-orange-100 text-orange-700", label: "No se presentó" },
          reagendado: { color: "bg-yellow-100 text-yellow-700", label: "Reagendado" },
        };
        const { color, label } = statusConfig[item.status || ""] ?? {
          color: "bg-slate-200 text-slate-600",
          label: item.status || "Sin estado",
        };
        return <span className={`text-xs font-semibold px-2 py-1 rounded-full ${color}`}>{label}</span>;
      },
      filterable: true,
      getValue: (item: IClient) => item.status || "sin_estado",
    },
    {
      key: "ultimoPago",
      header: "Último Pago",
      getValue: (item: IClient) => {
        const payment = getLatestPayment(item.id);
        return payment ? `${payment.paid_at} ${payment.amount} ${payment.method}` : "sin pagos";
      },
      render: (item: IClient) => {
        const payment = getLatestPayment(item.id);
        if (!payment) return <span className="text-xs text-slate-400">Sin pagos</span>;
        return (
          <div className="text-xs">
            <p className="font-semibold text-slate-700">{payment.paid_at.slice(0, 10)}</p>
            <p className="text-slate-500">
              Bs {payment.amount} · {PAYMENT_METHODS.find((method) => method.value === payment.method)?.label ?? payment.method}
            </p>
          </div>
        );
      },
    },
    {
      key: "habilitadoHoy",
      header: "Tratamiento hoy",
      getValue: (item: IClient) => (isEnabledToday(item.id) ? "habilitado" : "pendiente de pago"),
      render: (item: IClient) => {
        const enabled = isEnabledToday(item.id);
        return enabled ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-1 text-xs font-bold text-emerald-700">
            <BadgeCheck className="w-3.5 h-3.5" /> Habilitado
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2 py-1 text-xs font-bold text-rose-700">
            <Ban className="w-3.5 h-3.5" /> Pendiente de pago
          </span>
        );
      },
    },
  ];

  // --- Acciones de la Tabla ---
  const actions: DataTableAction<IClient>[] = [
    {
      label: "Historial",
      icon: <History className="w-4 h-4" />,
      onClick: (item: IClient) => navigate(`/lash-tracking?clientId=${item.id}`),
    },
    {
      label: "Ficha",
      icon: <FileText className="w-4 h-4" />,
      onClick: (item: IClient) => { setCurrentClient(item); setIsFileOpen(true); },
    },
    {
      label: "Pagos",
      icon: <Wallet className="w-4 h-4" />,
      onClick: (item: IClient) => handleOpenPayments(item),
    },
    {
      label: "Asignar ticket",
      icon: <Plus className="w-4 h-4" />,
      onClick: (item: IClient) => {
        setClientToAssignTicket(item);
        setIsAssignTicketOpen(true);
      },
      variant: "primary",
    },
    {
      label: "Editar",
      icon: <Edit className="w-4 h-4" />,
      onClick: (item: IClient) => handleEdit(item),
    },
    {
      label: "Eliminar",
      icon: <Trash2 className="w-4 h-4" />,
      onClick: (item: IClient) => handleDelete(item),
      variant: "danger",
    },
  ];

  // --- Renderizado del Toolbar ---
  const renderToolbar = () => (
    <FilterActionBar
      left={
        <div className="flex w-fit rounded-xl border border-slate-200 bg-slate-100/80 p-1">
          <Button
            variant="ghost"
            size="md"
            leftIcon={<Users className="h-4 w-4" />}
            onClick={() => setViewMode("all")}
            className={
              viewMode === "all"
                ? "bg-white text-slate-900 shadow-sm ring-1 ring-black/5"
                : "text-slate-500 hover:bg-slate-200/50 hover:text-slate-700"
            }
          >
            Lista General
          </Button>

          <Button
            variant="ghost"
            size="md"
            leftIcon={<Star className={`h-4 w-4 ${viewMode === "frequent" ? "fill-[#094732]" : ""}`} />}
            onClick={() => setViewMode("frequent")}
            className={
              viewMode === "frequent"
                ? "bg-white text-[#094732] shadow-sm ring-1 ring-black/5"
                : "text-slate-500 hover:bg-slate-200/50 hover:text-slate-700"
            }
          >
            Clientes Frecuentes
          </Button>
        </div>
      }
      right={
        <Button onClick={handleCreate} leftIcon={<Plus className="h-5 w-5" />} className="whitespace-nowrap">
          Agregar Cliente
        </Button>
      }
    />
  );

  return (
    <>
      <Layout
        title="Gestión de Clientes"
        subtitle="Administra tu base de datos y expedientes"
        variant="table"
        topContent={(
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <StatCard
              label="Pagos validados hoy"
              value={paymentsToday}
              icon={<Wallet className="h-4 w-4" />}
              tone="emerald"
            />
            <StatCard
              label="Fecha de control"
              value={today}
              icon={<History className="h-4 w-4" />}
              tone="slate"
            />
          </div>
        )}
        toolbar={renderToolbar()}
      >
        {clientError ? (
          <SectionCard className="mb-4 border border-rose-200 bg-rose-50" bodyClassName="!p-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-medium text-rose-700">{clientError}</p>
              <Button type="button" size="sm" variant="secondary" onClick={() => void loadClients()}>
                Reintentar
              </Button>
            </div>
          </SectionCard>
        ) : null}

        <DataTable
          data={filteredItems}
          columns={columns}
          actions={actions}
          defaultLimit={10}
          availableLimits={[5, 10, 20, 50]}
          globalSearchPlaceholder={isLoadingClients ? "Cargando clientes..." : "Buscar clientes, pagos o estado..."}
          enableColumnFilters
        />
      </Layout>

      {/* --- Modales Simulados --- */}

      <ConfirmDialog
        isOpen={isDeleteConfirmOpen}
        title="Eliminar cliente"
        message={
          <p>
            ¿Seguro que deseas eliminar a <strong>{clientToDelete?.nombre} {clientToDelete?.apellido}</strong>? Esta acción no se puede deshacer.
          </p>
        }
        confirmText="Eliminar"
        cancelText="Cancelar"
        variant="danger"
        isProcessing={isDeletingClient}
        onConfirm={() => void confirmDeleteClient()}
        onCancel={() => {
          if (isDeletingClient) return;
          setIsDeleteConfirmOpen(false);
          setClientToDelete(null);
        }}
      />

      <RegisterClientModal
        isOpen={isRegisterOpen}
        onClose={() => {
          setIsRegisterOpen(false);
          setClientToEdit(null);
        }}
        onSubmit={handleRegisterClient}
        eyeTypes={eyeTypes}
        branches={branches}
        eyeTypesError={eyeTypesError}
        isLoadingEyeTypes={isLoadingEyeTypes}
        onRetryEyeTypes={() => void loadEyeTypes()}
        mode={clientToEdit ? "edit" : "create"}
        initialClient={clientToEdit}
      />

      <AssignTicketModal
        isOpen={isAssignTicketOpen}
        onClose={() => {
          setIsAssignTicketOpen(false);
          setClientToAssignTicket(null);
        }}
        client={clientToAssignTicket}
        onSuccess={(ticket, totalPrice) => {
          if (!clientToAssignTicket) return;
          setIsAssignTicketOpen(false);
          void openPaymentsModal(clientToAssignTicket, ticket.id, ticket, totalPrice);
        }}
        onSkip={() => setClientToAssignTicket(null)}
      />

      {/* Modal Ficha Técnica */}
      <GenericModal
        isOpen={isFileOpen} 
        onClose={() => setIsFileOpen(false)}
        title="Expediente Digital"
      >
        <div className="text-center py-8">
            <div className="bg-emerald-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <FileText className="w-8 h-8 text-[#094732]" />
            </div>
            <p className="text-slate-600 mb-2">Viendo expediente de: <strong>{currentClient?.nombre} {currentClient?.apellido}</strong></p>
            <p className="text-xs text-slate-400">Aquí iría el contenido médico y legal.</p>
            <div className="mt-6 flex justify-center">
              <Button variant="ghost" onClick={() => setIsFileOpen(false)}>Cerrar Expediente</Button>
            </div>
        </div>
      </GenericModal>

      <ClientPaymentsModal
        isOpen={isPaymentOpen}
        onClose={() => {
          setIsPaymentOpen(false);
          setClientTickets([]);
          setSelectedTicketId("");
        }}
        currentClient={currentClient}
        isEnabledToday={isEnabledToday}
        paymentAmount={paymentAmount}
        setPaymentAmount={setPaymentAmount}
        paymentMethod={paymentMethod}
        setPaymentMethod={setPaymentMethod}
        selectedTicketId={selectedTicketId}
        setSelectedTicketId={setSelectedTicketId}
        isSubmittingPayment={isSubmittingPayment}
        isLoadingPayments={isLoadingPayments}
        clientTickets={clientTickets}
        clientPayments={currentClient ? getClientPayments(currentClient.id) : []}
        onRegisterPayment={handleRegisterPayment}
      />

      <Button
        onClick={handleScrollToTop}
        aria-label="Volver arriba"
        className={`fixed bottom-6 right-6 z-40 !rounded-full !p-3 shadow-lg shadow-emerald-900/30 ${
          showScrollTop ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-3 opacity-0"
        }`}
      >
        <ChevronUp className="h-5 w-5" />
      </Button>

    </>
  );
}