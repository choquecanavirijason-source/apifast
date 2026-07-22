import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Ticket,
  Wallet,
  Filter,
  Eye,
  User,
  FileDown,
} from "lucide-react";
import { generateTablePdf } from "../../../core/utils/generateTablePdf";
import { toast } from "react-toastify";
import type { TicketItem } from "../../../core/services/agenda/agenda.service";
import {
  AgendaService,
  type ServiceOption,
} from "../../../core/services/agenda/agenda.service";
import { PaymentService, type PaymentItem } from "../../../core/services/payment/payment.service";
import DataTable, { type DataTableColumn } from "../../../components/common/table/DataTable";
import Layout from "../../../components/common/layout";
import FilterActionBar from "../../../components/common/FilterActionBar";
import { Button, InputField } from "../../../components/common/ui";
import GenericModal from "../../../components/common/modal/GenericModal";
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

export default function TicketsPage() {
  const [tickets, setTickets] = useState<TicketItem[]>([]);
  const [services, setServices] = useState<ServiceOption[]>([]);
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

  const selectedTicketTotal = Number(selectedTicket?.service_price ?? 0);
  const selectedTicketPaid = useMemo(
    () => ticketPayments.reduce((acc, payment) => acc + Number(payment.amount || 0), 0),
    [ticketPayments]
  );
  const selectedTicketRemaining = useMemo(
    () => Math.max(0, selectedTicketTotal - selectedTicketPaid),
    [selectedTicketPaid, selectedTicketTotal]
  );

  const loadServices = useCallback(async () => {
    try {
      const data = await AgendaService.listServices({ limit: 100, branch_id: activeBranchId ?? undefined });
      setServices(data);
    } catch (err) {
      console.error("Error cargando servicios:", err);
    }
  }, [activeBranchId]);

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
  }, [loadServices]);

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

  const handleExportPdf = () => {
    void generateTablePdf({
      title: "Listado de Tickets",
      subtitle: "Tickets registrados en el sistema",
      filename: "tickets",
      orientation: "landscape",
      meta: [
        { label: "Total", value: String(filteredTickets.length) },
        ...(ticketDateFilter ? [{ label: "Fecha", value: ticketDateFilter }] : []),
      ],
      columns: [
        { key: "ticket_code", header: "Código" },
        { key: "client_name", header: "Cliente" },
        { key: "service", header: "Servicio" },
        { key: "professional_name", header: "Operaria" },
        { key: "fecha", header: "Fecha" },
        { key: "horario", header: "Horario" },
        { key: "status", header: "Estado" },
      ],
      rows: filteredTickets.map((t) => ({
        ticket_code: t.ticket_code ?? `#${t.id}`,
        client_name: t.client_name,
        service: t.service_names?.join(" · ") ?? t.service_name ?? "—",
        professional_name: t.professional_name ?? "Sin asignar",
        fecha: t.start_time ? new Date(t.start_time).toLocaleDateString("es-BO") : "—",
        horario: t.start_time
          ? `${new Date(t.start_time).toLocaleTimeString("es-BO", { hour: "2-digit", minute: "2-digit" })} - ${new Date(t.end_time).toLocaleTimeString("es-BO", { hour: "2-digit", minute: "2-digit" })}`
          : "—",
        status: STATUS_LABELS[t.status] ?? t.status,
      })),
    });
  };

  const renderToolbar = () => (
    <FilterActionBar
      left={
        <div className="flex flex-wrap items-center gap-3">
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
                ✕
              </button>
            ) : null}
          </div>
        </div>
      }
      right={
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={() => void loadTickets()}>
            Actualizar
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={handleExportPdf}
            title="Descargar reporte PDF"
            leftIcon={<FileDown className="h-4 w-4" />}
          >
            PDF
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
