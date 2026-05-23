import { useEffect, useMemo, useState } from "react";
import { FileDown, Search, Ticket } from "lucide-react";
import { toast } from "react-toastify";
import type { IClient } from "../../../core/types/IClient";
import { AgendaService, type TicketItem } from "../../../core/services/agenda/agenda.service";
import { PaymentService, type PaymentItem } from "../../../core/services/payment/payment.service";
import { PosSaleService, type PosSaleItem } from "../../../core/services/pos-sale/pos-sale.service";
import { generateTablePdf } from "../../../core/utils/generateTablePdf";
import GenericModal from "../../../components/common/modal/GenericModal";
import DataTable, { type DataTableColumn } from "../../../components/common/table/DataTable";
import { Button, SectionCard } from "../../../components/common/ui";
import StatusBadge from "../pos/components/StatusBadge";
import {
  formatDateTime,
  formatMoney,
  matchesDateRange,
  PAYMENT_METHOD_LABELS,
  SALE_STATUS_LABELS,
  TICKET_STATUS_LABELS,
} from "./clientHistory.utils";

type HistoryTab = "sales" | "tickets" | "payments";

type ClientSalesHistoryModalProps = {
  isOpen: boolean;
  onClose: () => void;
  client: IClient | null;
};

function SaleStateBadge({ status }: { status: string }) {
  const paid = status === "paid";
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
        paid ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"
      }`}
    >
      {SALE_STATUS_LABELS[status] ?? status}
    </span>
  );
}

function TicketStateBadge({ status }: { status: string }) {
  const tones: Record<string, string> = {
    completed: "bg-emerald-100 text-emerald-800",
    cancelled: "bg-rose-100 text-rose-800",
    in_service: "bg-amber-100 text-amber-800",
    pending: "bg-slate-100 text-slate-700",
    confirmed: "bg-blue-100 text-blue-800",
    waiting: "bg-violet-100 text-violet-800",
  };
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${tones[status] ?? "bg-slate-100 text-slate-700"}`}>
      {TICKET_STATUS_LABELS[status] ?? status}
    </span>
  );
}

const defaultSalesFilters = () => ({
  search: "",
  status: "all",
  payment: "all",
  dateFrom: "",
  dateTo: "",
});

const defaultTicketFilters = () => ({
  search: "",
  status: "all",
  linkedSale: "all",
  dateFrom: "",
  dateTo: "",
});

const defaultPaymentFilters = () => ({
  search: "",
  status: "all",
  method: "all",
  dateFrom: "",
  dateTo: "",
});

export default function ClientSalesHistoryModal({
  isOpen,
  onClose,
  client,
}: ClientSalesHistoryModalProps) {
  const [activeTab, setActiveTab] = useState<HistoryTab>("sales");
  const [sales, setSales] = useState<PosSaleItem[]>([]);
  const [tickets, setTickets] = useState<TicketItem[]>([]);
  const [payments, setPayments] = useState<PaymentItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const [salesFilters, setSalesFilters] = useState(defaultSalesFilters);
  const [ticketFilters, setTicketFilters] = useState(defaultTicketFilters);
  const [paymentFilters, setPaymentFilters] = useState(defaultPaymentFilters);

  useEffect(() => {
    if (!isOpen || !client) return;

    setActiveTab("sales");
    setSalesFilters(defaultSalesFilters());
    setTicketFilters(defaultTicketFilters());
    setPaymentFilters(defaultPaymentFilters());

    const loadHistory = async () => {
      setIsLoading(true);
      try {
        const [salesData, ticketsData, paymentsData] = await Promise.all([
          PosSaleService.list({ client_id: client.id, limit: 300 }),
          AgendaService.listTickets({ client_id: client.id, limit: 300 }),
          PaymentService.listByClient(client.id),
        ]);
        setSales(salesData);
        setTickets(ticketsData);
        setPayments(paymentsData);
      } catch {
        toast.error("No se pudo cargar el historial del cliente.");
        setSales([]);
        setTickets([]);
        setPayments([]);
      } finally {
        setIsLoading(false);
      }
    };

    void loadHistory();
  }, [isOpen, client]);

  const filteredSales = useMemo(() => {
    const term = salesFilters.search.trim().toLowerCase();
    return sales.filter((sale) => {
      if (salesFilters.status !== "all" && sale.status !== salesFilters.status) return false;
      if (salesFilters.payment !== "all" && sale.payment_method !== salesFilters.payment) return false;
      if (!matchesDateRange(sale.created_at, salesFilters.dateFrom, salesFilters.dateTo)) return false;
      if (!term) return true;

      const ticketCodes = (sale.appointments ?? [])
        .map((a) => a.ticket_code ?? "")
        .join(" ")
        .toLowerCase();
      const haystack = [
        sale.sale_code,
        sale.notes ?? "",
        sale.payment_method,
        ticketCodes,
        String(sale.total),
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(term);
    });
  }, [sales, salesFilters]);

  const filteredTickets = useMemo(() => {
    const term = ticketFilters.search.trim().toLowerCase();
    return tickets.filter((ticket) => {
      if (ticketFilters.status !== "all" && ticket.status !== ticketFilters.status) return false;
      if (ticketFilters.linkedSale === "with" && !ticket.sale_id) return false;
      if (ticketFilters.linkedSale === "without" && ticket.sale_id) return false;
      if (!matchesDateRange(ticket.start_time, ticketFilters.dateFrom, ticketFilters.dateTo)) return false;
      if (!term) return true;

      const services = (ticket.service_names ?? (ticket.service_name ? [ticket.service_name] : [])).join(" ");
      const haystack = [
        ticket.ticket_code ?? "",
        services,
        ticket.professional_name ?? "",
        ticket.branch_name ?? "",
        ticket.sale_id ? String(ticket.sale_id) : "",
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(term);
    });
  }, [tickets, ticketFilters]);

  const filteredPayments = useMemo(() => {
    const term = paymentFilters.search.trim().toLowerCase();
    return payments.filter((payment) => {
      if (paymentFilters.status !== "all" && payment.status !== paymentFilters.status) return false;
      if (paymentFilters.method !== "all" && payment.method !== paymentFilters.method) return false;
      if (!matchesDateRange(payment.paid_at, paymentFilters.dateFrom, paymentFilters.dateTo)) return false;
      if (!term) return true;

      const haystack = [
        String(payment.id),
        String(payment.amount),
        payment.method,
        payment.reference ?? "",
        payment.notes ?? "",
        payment.appointment_id ? String(payment.appointment_id) : "",
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(term);
    });
  }, [payments, paymentFilters]);

  const summary = useMemo(() => {
    const paidTotal = filteredPayments
      .filter((p) => p.status === "paid")
      .reduce((sum, p) => sum + Number(p.amount || 0), 0);
    const salesTotal = filteredSales
      .filter((s) => s.status === "paid")
      .reduce((sum, s) => sum + Number(s.total || 0), 0);
    return {
      salesCount: filteredSales.length,
      ticketsCount: filteredTickets.length,
      paymentsCount: filteredPayments.length,
      paidTotal,
      salesTotal,
    };
  }, [filteredSales, filteredTickets, filteredPayments]);

  const salesColumns = useMemo<DataTableColumn<PosSaleItem>[]>(
    () => [
      {
        key: "sale_code",
        header: "Código venta",
        sortable: true,
        searchable: true,
        getValue: (sale) => sale.sale_code,
        render: (sale) => <span className="font-mono text-xs font-bold text-emerald-700">{sale.sale_code}</span>,
      },
      {
        key: "created_at",
        header: "Fecha",
        sortable: true,
        getValue: (sale) => sale.created_at,
        render: (sale) => <span className="text-sm text-slate-700">{formatDateTime(sale.created_at)}</span>,
      },
      {
        key: "tickets",
        header: "Tickets",
        render: (sale) => {
          const list = sale.appointments ?? [];
          if (list.length === 0) return <span className="text-xs text-slate-400">—</span>;
          return (
            <div className="max-w-xs space-y-0.5">
              {list.map((a) => (
                <p key={a.id} className="truncate text-xs text-slate-600">
                  <span className="font-semibold text-slate-800">{a.ticket_code || `#${a.id}`}</span>
                  {" · "}
                  {a.service?.name ?? "Servicio"}
                </p>
              ))}
            </div>
          );
        },
      },
      {
        key: "subtotal",
        header: "Subtotal",
        sortable: true,
        getValue: (sale) => sale.subtotal,
        render: (sale) => <span className="text-sm text-slate-600">{formatMoney(sale.subtotal)}</span>,
      },
      {
        key: "total",
        header: "Total",
        sortable: true,
        getValue: (sale) => sale.total,
        render: (sale) => <span className="text-sm font-bold text-[#094732]">{formatMoney(sale.total)}</span>,
      },
      {
        key: "payment_method",
        header: "Pago",
        sortable: true,
        getValue: (sale) => sale.payment_method,
        render: (sale) => <StatusBadge status={sale.payment_method} />,
      },
      {
        key: "status",
        header: "Estado",
        sortable: true,
        getValue: (sale) => sale.status,
        render: (sale) => <SaleStateBadge status={sale.status} />,
      },
      {
        key: "notes",
        header: "Notas",
        render: (sale) => (
          <span className="line-clamp-2 max-w-[200px] text-xs text-slate-500">{sale.notes || "—"}</span>
        ),
      },
    ],
    []
  );

  const ticketColumns = useMemo<DataTableColumn<TicketItem>[]>(
    () => [
      {
        key: "ticket_code",
        header: "Código ticket",
        sortable: true,
        searchable: true,
        getValue: (t) => t.ticket_code ?? String(t.id),
        render: (t) => (
          <span className="font-mono text-xs font-bold text-slate-800">{t.ticket_code || `Ticket #${t.id}`}</span>
        ),
      },
      {
        key: "services",
        header: "Servicios",
        searchable: true,
        getValue: (t) => (t.service_names ?? []).join(", ") || t.service_name || "",
        render: (t) => {
          const label = t.service_names?.length
            ? t.service_names.join(", ")
            : (t.service_name ?? "Sin servicio");
          return <span className="text-sm text-slate-700">{label}</span>;
        },
      },
      {
        key: "start_time",
        header: "Inicio",
        sortable: true,
        getValue: (t) => t.start_time,
        render: (t) => <span className="text-sm text-slate-600">{formatDateTime(t.start_time)}</span>,
      },
      {
        key: "end_time",
        header: "Fin",
        sortable: true,
        getValue: (t) => t.end_time,
        render: (t) => <span className="text-sm text-slate-600">{formatDateTime(t.end_time)}</span>,
      },
      {
        key: "professional",
        header: "Operaria",
        getValue: (t) => t.professional_name ?? "",
        render: (t) => <span className="text-sm text-slate-600">{t.professional_name || "—"}</span>,
      },
      {
        key: "branch",
        header: "Sucursal",
        getValue: (t) => t.branch_name ?? "",
        render: (t) => <span className="text-sm text-slate-600">{t.branch_name || "—"}</span>,
      },
      {
        key: "sale_id",
        header: "Venta",
        sortable: true,
        getValue: (t) => t.sale_id ?? 0,
        render: (t) =>
          t.sale_id ? (
            <span className="text-xs font-semibold text-emerald-700">#{t.sale_id}</span>
          ) : (
            <span className="text-xs text-slate-400">Sin venta</span>
          ),
      },
      {
        key: "status",
        header: "Estado",
        sortable: true,
        getValue: (t) => t.status,
        render: (t) => <TicketStateBadge status={t.status} />,
      },
    ],
    []
  );

  const paymentColumns = useMemo<DataTableColumn<PaymentItem>[]>(
    () => [
      {
        key: "id",
        header: "ID",
        sortable: true,
        getValue: (p) => p.id,
        render: (p) => <span className="font-mono text-xs text-slate-600">#{p.id}</span>,
      },
      {
        key: "paid_at",
        header: "Fecha",
        sortable: true,
        getValue: (p) => p.paid_at,
        render: (p) => <span className="text-sm text-slate-700">{formatDateTime(p.paid_at)}</span>,
      },
      {
        key: "amount",
        header: "Monto",
        sortable: true,
        getValue: (p) => p.amount,
        render: (p) => <span className="text-sm font-bold text-slate-900">{formatMoney(p.amount)}</span>,
      },
      {
        key: "method",
        header: "Método",
        sortable: true,
        getValue: (p) => p.method,
        render: (p) => <StatusBadge status={p.method} />,
      },
      {
        key: "status",
        header: "Estado",
        sortable: true,
        getValue: (p) => p.status,
        render: (p) => (
          <span
            className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${
              p.status === "paid" ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-700"
            }`}
          >
            {p.status === "paid" ? "Pagado" : p.status}
          </span>
        ),
      },
      {
        key: "appointment_id",
        header: "Ticket / cita",
        render: (p) => (
          <span className="text-sm text-slate-600">{p.appointment_id ? `#${p.appointment_id}` : "—"}</span>
        ),
      },
      {
        key: "notes",
        header: "Notas",
        render: (p) => <span className="line-clamp-2 max-w-[180px] text-xs text-slate-500">{p.notes || "—"}</span>,
      },
    ],
    []
  );

  const clientName = client ? `${client.nombre} ${client.apellido}`.trim() : "Cliente";

  const exportSalesPdf = () => {
    generateTablePdf({
      title: `Ventas — ${clientName}`,
      subtitle: "Historial de ventas del cliente",
      filename: `ventas-cliente-${client?.id ?? "x"}`,
      orientation: "landscape",
      meta: [
        { label: "Registros", value: String(filteredSales.length) },
        { label: "Total filtrado", value: formatMoney(summary.salesTotal) },
      ],
      columns: [
        { key: "sale_code", header: "Código" },
        { key: "fecha", header: "Fecha" },
        { key: "total", header: "Total" },
        { key: "pago", header: "Método" },
        { key: "estado", header: "Estado" },
      ],
      rows: filteredSales.map((s) => ({
        sale_code: s.sale_code,
        fecha: formatDateTime(s.created_at),
        total: formatMoney(s.total),
        pago: PAYMENT_METHOD_LABELS[s.payment_method] ?? s.payment_method,
        estado: SALE_STATUS_LABELS[s.status] ?? s.status,
      })),
    });
  };

  const exportTicketsPdf = () => {
    generateTablePdf({
      title: `Tickets — ${clientName}`,
      subtitle: "Historial de tickets en agenda",
      filename: `tickets-cliente-${client?.id ?? "x"}`,
      orientation: "landscape",
      columns: [
        { key: "ticket_code", header: "Código" },
        { key: "servicios", header: "Servicios" },
        { key: "inicio", header: "Inicio" },
        { key: "estado", header: "Estado" },
        { key: "venta", header: "Venta" },
      ],
      rows: filteredTickets.map((t) => ({
        ticket_code: t.ticket_code || String(t.id),
        servicios: t.service_names?.join(", ") || t.service_name || "—",
        inicio: formatDateTime(t.start_time),
        estado: TICKET_STATUS_LABELS[t.status] ?? t.status,
        venta: t.sale_id ? String(t.sale_id) : "—",
      })),
    });
  };

  const renderFilterInput = (
    value: string,
    onChange: (v: string) => void,
    placeholder: string,
    className = ""
  ) => (
    <div className={`relative ${className}`}>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-10 pr-3 text-sm text-slate-700 outline-none focus:border-slate-300 focus:ring-2 focus:ring-slate-100"
      />
    </div>
  );

  const tabBtn = (tab: HistoryTab, label: string) => (
    <button
      type="button"
      onClick={() => setActiveTab(tab)}
      className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
        activeTab === tab
          ? "bg-[#094732] text-white shadow-sm"
          : "text-slate-600 hover:bg-slate-100"
      }`}
    >
      {label}
      {tab === "sales" ? ` (${sales.length})` : tab === "tickets" ? ` (${tickets.length})` : ` (${payments.length})`}
    </button>
  );

  return (
    <GenericModal
      isOpen={isOpen}
      onClose={onClose}
      title={`Historial comercial — ${clientName}`}
      size="xl"
      contentClassName="w-[98vw] max-w-[1500px] max-h-[94vh] overflow-hidden flex flex-col"
      bodyClassName="flex-1 overflow-auto pr-1"
      footer={(
        <Button type="button" variant="secondary" onClick={onClose}>
          Cerrar
        </Button>
      )}
    >
      {isLoading ? (
        <p className="py-16 text-center text-sm text-slate-500">Cargando historial...</p>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Ventas (filtro)</p>
              <p className="mt-1 text-lg font-bold text-slate-900">{summary.salesCount}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Tickets (filtro)</p>
              <p className="mt-1 text-lg font-bold text-slate-900">{summary.ticketsCount}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Pagos (filtro)</p>
              <p className="mt-1 text-lg font-bold text-slate-900">{summary.paymentsCount}</p>
            </div>
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700">Total pagado</p>
              <p className="mt-1 text-lg font-bold text-emerald-900">{formatMoney(summary.paidTotal)}</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 rounded-xl border border-slate-200 bg-slate-50/80 p-1.5">
            {tabBtn("sales", "Tabla ventas")}
            {tabBtn("tickets", "Tabla tickets")}
            {tabBtn("payments", "Tabla pagos")}
          </div>

          {activeTab === "sales" ? (
            <SectionCard className="!rounded-xl" bodyClassName="!p-4 space-y-4">
              <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-5">
                {renderFilterInput(
                  salesFilters.search,
                  (v) => setSalesFilters((f) => ({ ...f, search: v })),
                  "Buscar código, notas, tickets...",
                  "xl:col-span-2"
                )}
                <select
                  value={salesFilters.status}
                  onChange={(e) => setSalesFilters((f) => ({ ...f, status: e.target.value }))}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                >
                  <option value="all">Todos los estados</option>
                  <option value="paid">Pagada</option>
                  <option value="cancelled">Cancelada</option>
                </select>
                <select
                  value={salesFilters.payment}
                  onChange={(e) => setSalesFilters((f) => ({ ...f, payment: e.target.value }))}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                >
                  <option value="all">Todos los métodos</option>
                  <option value="cash">Efectivo</option>
                  <option value="card">Tarjeta</option>
                  <option value="transfer">Transferencia</option>
                  <option value="qr">QR</option>
                </select>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="date"
                    value={salesFilters.dateFrom}
                    onChange={(e) => setSalesFilters((f) => ({ ...f, dateFrom: e.target.value }))}
                    className="rounded-lg border border-slate-200 px-2 py-2 text-sm"
                    title="Desde"
                  />
                  <input
                    type="date"
                    value={salesFilters.dateTo}
                    onChange={(e) => setSalesFilters((f) => ({ ...f, dateTo: e.target.value }))}
                    className="rounded-lg border border-slate-200 px-2 py-2 text-sm"
                    title="Hasta"
                  />
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-slate-600">
                <span>
                  Total filtrado: <strong className="text-emerald-700">{formatMoney(summary.salesTotal)}</strong>
                  {" · "}
                  {filteredSales.length} de {sales.length} ventas
                </span>
                <Button type="button" variant="secondary" size="sm" leftIcon={<FileDown className="h-4 w-4" />} onClick={exportSalesPdf}>
                  Exportar PDF
                </Button>
              </div>
              <DataTable
                data={filteredSales}
                columns={salesColumns}
                loading={isLoading}
                defaultLimit={10}
                availableLimits={[5, 10, 20, 50]}
                enableGlobalSearch={false}
                globalSearchPlaceholder="Buscar en tabla..."
                enableColumnFilters
                tableMinWidth="900px"
              />
            </SectionCard>
          ) : null}

          {activeTab === "tickets" ? (
            <SectionCard className="!rounded-xl" bodyClassName="!p-4 space-y-4">
              <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-5">
                {renderFilterInput(
                  ticketFilters.search,
                  (v) => setTicketFilters((f) => ({ ...f, search: v })),
                  "Buscar código, servicio, operaria...",
                  "xl:col-span-2"
                )}
                <select
                  value={ticketFilters.status}
                  onChange={(e) => setTicketFilters((f) => ({ ...f, status: e.target.value }))}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                >
                  <option value="all">Todos los estados</option>
                  {Object.entries(TICKET_STATUS_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
                <select
                  value={ticketFilters.linkedSale}
                  onChange={(e) => setTicketFilters((f) => ({ ...f, linkedSale: e.target.value }))}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                >
                  <option value="all">Todas las ventas</option>
                  <option value="with">Con venta POS</option>
                  <option value="without">Sin venta</option>
                </select>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="date"
                    value={ticketFilters.dateFrom}
                    onChange={(e) => setTicketFilters((f) => ({ ...f, dateFrom: e.target.value }))}
                    className="rounded-lg border border-slate-200 px-2 py-2 text-sm"
                  />
                  <input
                    type="date"
                    value={ticketFilters.dateTo}
                    onChange={(e) => setTicketFilters((f) => ({ ...f, dateTo: e.target.value }))}
                    className="rounded-lg border border-slate-200 px-2 py-2 text-sm"
                  />
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-slate-600">
                <span className="flex items-center gap-1.5">
                  <Ticket className="h-4 w-4 text-[#094732]" />
                  {filteredTickets.length} de {tickets.length} tickets
                </span>
                <Button type="button" variant="secondary" size="sm" leftIcon={<FileDown className="h-4 w-4" />} onClick={exportTicketsPdf}>
                  Exportar PDF
                </Button>
              </div>
              <DataTable
                data={filteredTickets}
                columns={ticketColumns}
                loading={isLoading}
                defaultLimit={10}
                availableLimits={[5, 10, 20, 50]}
                enableGlobalSearch={false}
                enableColumnFilters
                tableMinWidth="1000px"
              />
            </SectionCard>
          ) : null}

          {activeTab === "payments" ? (
            <SectionCard className="!rounded-xl" bodyClassName="!p-4 space-y-4">
              <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-5">
                {renderFilterInput(
                  paymentFilters.search,
                  (v) => setPaymentFilters((f) => ({ ...f, search: v })),
                  "Buscar monto, referencia, notas...",
                  "xl:col-span-2"
                )}
                <select
                  value={paymentFilters.status}
                  onChange={(e) => setPaymentFilters((f) => ({ ...f, status: e.target.value }))}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                >
                  <option value="all">Todos los estados</option>
                  <option value="paid">Pagado</option>
                  <option value="pending">Pendiente</option>
                  <option value="cancelled">Cancelado</option>
                </select>
                <select
                  value={paymentFilters.method}
                  onChange={(e) => setPaymentFilters((f) => ({ ...f, method: e.target.value }))}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                >
                  <option value="all">Todos los métodos</option>
                  <option value="cash">Efectivo</option>
                  <option value="card">Tarjeta</option>
                  <option value="transfer">Transferencia</option>
                  <option value="qr">QR</option>
                </select>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="date"
                    value={paymentFilters.dateFrom}
                    onChange={(e) => setPaymentFilters((f) => ({ ...f, dateFrom: e.target.value }))}
                    className="rounded-lg border border-slate-200 px-2 py-2 text-sm"
                  />
                  <input
                    type="date"
                    value={paymentFilters.dateTo}
                    onChange={(e) => setPaymentFilters((f) => ({ ...f, dateTo: e.target.value }))}
                    className="rounded-lg border border-slate-200 px-2 py-2 text-sm"
                  />
                </div>
              </div>
              <p className="text-sm text-slate-600">
                Total filtrado: <strong className="text-emerald-700">{formatMoney(summary.paidTotal)}</strong>
                {" · "}
                {filteredPayments.length} de {payments.length} pagos
              </p>
              <DataTable
                data={filteredPayments}
                columns={paymentColumns}
                loading={isLoading}
                defaultLimit={10}
                availableLimits={[5, 10, 20, 50]}
                enableGlobalSearch={false}
                enableColumnFilters
                tableMinWidth="800px"
              />
            </SectionCard>
          ) : null}
        </div>
      )}
    </GenericModal>
  );
}
