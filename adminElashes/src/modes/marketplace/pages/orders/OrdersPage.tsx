import { useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import {
  ClipboardList, RefreshCw, Package, CheckCircle, XCircle, Truck, Clock, MapPin, MessageCircle, FileDown,
} from "lucide-react";

import Layout from "@/components/common/layout";
import FilterActionBar from "@/components/common/FilterActionBar";
import { Button, StatCard } from "@/components/common/ui";
import DataTable, { type DataTableColumn, type DataTableAction } from "@/components/common/table/DataTable";
import GenericModal from "@/components/common/modal/GenericModal";
import { generateTablePdf } from "@/core/utils/generateTablePdf";

import {
  fetchAdminOrders,
  updateOrderStatus,
  type MarketplaceOrder,
} from "@/core/services/marketplace/marketplace.service";

// ── Configuración de estados ───────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; classes: string; icon: React.ReactNode }> = {
  pending:    { label: "Pendiente",   classes: "bg-amber-100 text-amber-700",   icon: <Clock className="h-3 w-3" /> },
  confirmed:  { label: "Confirmado",  classes: "bg-blue-100 text-blue-700",     icon: <CheckCircle className="h-3 w-3" /> },
  processing: { label: "En proceso",  classes: "bg-purple-100 text-purple-700", icon: <Package className="h-3 w-3" /> },
  shipped:    { label: "Enviado",     classes: "bg-cyan-100 text-cyan-700",     icon: <Truck className="h-3 w-3" /> },
  delivered:  { label: "Entregado",   classes: "bg-emerald-100 text-emerald-700", icon: <CheckCircle className="h-3 w-3" /> },
  cancelled:  { label: "Cancelado",   classes: "bg-rose-100 text-rose-700",     icon: <XCircle className="h-3 w-3" /> },
};

const STATUS_FLOW = ["pending", "confirmed", "processing", "shipped", "delivered", "cancelled"] as const;

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? { label: status, classes: "bg-slate-100 text-slate-600", icon: null };
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${cfg.classes}`}>
      {cfg.icon} {cfg.label}
    </span>
  );
}

// ── Componente ─────────────────────────────────────────────────────────────────

export default function OrdersPage() {
  const [orders, setOrders] = useState<MarketplaceOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState("");
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [detailOrder, setDetailOrder] = useState<MarketplaceOrder | null>(null);

  // Se trae SIEMPRE la lista completa (sin filtrar por estado en el server):
  // el filtro de la pestaña se aplica en el cliente (filteredOrders más
  // abajo). Antes, cada cambio de pestaña volvía a pedir solo ese estado y
  // reemplazaba `orders` entero, así que "Todos" y las tarjetas de
  // Pendientes/Entregados terminaban reflejando el filtro activo en vez del
  // total real.
  const load = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await fetchAdminOrders({ limit: 200 });
      setOrders(res.items);
    } catch {
      if (!silent) toast.error("No se pudieron cargar los pedidos");
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    const id = window.setInterval(() => void load(true), 30_000);
    return () => window.clearInterval(id);
  }, []);

  const filteredOrders = useMemo(
    () => (filterStatus ? orders.filter((o) => o.status === filterStatus) : orders),
    [orders, filterStatus],
  );

  const handleStatusChange = async (order: MarketplaceOrder, newStatus: string) => {
    setUpdatingId(order.id);
    try {
      const updated = await updateOrderStatus(order.id, newStatus);
      setOrders((prev) => prev.map((o) => (o.id === order.id ? updated : o)));
      if (detailOrder?.id === order.id) setDetailOrder(updated);
      toast.success(`Pedido ${updated.order_code} → ${STATUS_CONFIG[newStatus]?.label ?? newStatus}`);
    } catch {
      toast.error("Error al actualizar el estado");
    } finally {
      setUpdatingId(null);
    }
  };

  // ── Stats ──────────────────────────────────────────────────────────────────
  const pendingCount  = orders.filter((o) => o.status === "pending").length;
  const deliveredCount = orders.filter((o) => o.status === "delivered").length;
  const totalRevenue  = orders
    .filter((o) => o.status !== "cancelled")
    .reduce((s, o) => s + o.total, 0);

  // ── Columns ────────────────────────────────────────────────────────────────
  const columns: DataTableColumn<MarketplaceOrder>[] = [
    {
      key: "order_code",
      header: "Pedido",
      sortable: true,
      render: (o) => (
        <div>
          <p className="font-semibold text-slate-800 font-mono tracking-wide">{o.order_code}</p>
          <p className="text-xs text-slate-500">{new Date(o.created_at).toLocaleDateString("es-ES")}</p>
        </div>
      ),
      getValue: (o) => o.order_code,
    },
    {
      key: "customer_name",
      header: "Cliente",
      sortable: true,
      render: (o) => (
        <div>
          <p className="font-semibold text-slate-800">{o.customer_name}</p>
          <p className="text-xs text-slate-500">{o.customer_phone}</p>
          {o.customer_email && <p className="text-xs text-slate-400">{o.customer_email}</p>}
        </div>
      ),
      getValue: (o) => o.customer_name,
    },
    {
      key: "total",
      header: "Total",
      sortable: true,
      render: (o) => <span className="font-semibold text-slate-800">${o.total.toFixed(2)}</span>,
      getValue: (o) => o.total,
    },
    {
      key: "items",
      header: "Productos",
      render: (o) => (
        <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700">
          {o.items?.length ?? 0} ítem{(o.items?.length ?? 0) !== 1 ? "s" : ""}
        </span>
      ),
    },
    {
      key: "status",
      header: "Estado",
      sortable: true,
      render: (o) => <StatusBadge status={o.status} />,
      getValue: (o) => STATUS_CONFIG[o.status]?.label ?? o.status,
    },
  ];

  const actions: DataTableAction<MarketplaceOrder>[] = [
    {
      label: "Ver detalle",
      icon: <ClipboardList className="h-4 w-4" />,
      onClick: (o) => setDetailOrder(o),
    },
  ];

  const handleExportPdf = () => {
    void generateTablePdf({
      title: "Pedidos del Marketplace",
      filename: "pedidos-marketplace",
      orientation: "landscape",
      meta: [{ label: "Pedidos", value: String(filteredOrders.length) }],
      columns: [
        { key: "order_code", header: "Pedido" },
        { key: "customer_name", header: "Cliente" },
        { key: "total", header: "Total" },
        { key: "items", header: "Productos" },
        { key: "status", header: "Estado" },
      ],
      rows: filteredOrders.map((o) => ({
        order_code: o.order_code,
        customer_name: o.customer_name,
        total: `$${o.total.toFixed(2)}`,
        items: `${o.items?.length ?? 0} ítem(s)`,
        status: STATUS_CONFIG[o.status]?.label ?? o.status,
      })),
    });
  };

  // ── Toolbar ────────────────────────────────────────────────────────────────
  const toolbar = (
    <FilterActionBar
      left={
        <div className="flex w-fit rounded-xl border border-slate-200 bg-slate-100/80 p-1 flex-wrap gap-0.5">
          <Button
            variant="ghost" size="md"
            onClick={() => setFilterStatus("")}
            className={!filterStatus ? "bg-white text-slate-900 shadow-sm ring-1 ring-black/5" : "text-slate-500 hover:bg-slate-200/50 hover:text-slate-700"}
          >
            Todos ({orders.length})
          </Button>
          {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
            <Button
              key={key} variant="ghost" size="md"
              onClick={() => setFilterStatus(filterStatus === key ? "" : key)}
              className={filterStatus === key ? "bg-white text-slate-900 shadow-sm ring-1 ring-black/5" : "text-slate-500 hover:bg-slate-200/50 hover:text-slate-700"}
            >
              {cfg.label} ({orders.filter((o) => o.status === key).length})
            </Button>
          ))}
        </div>
      }
      right={
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            onClick={load}
            disabled={loading}
            leftIcon={<RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />}
          >
            Actualizar
          </Button>
          <Button variant="secondary" onClick={handleExportPdf} leftIcon={<FileDown className="h-4 w-4" />}>
            PDF
          </Button>
        </div>
      }
    />
  );

  return (
    <>
      <Layout
        title="Pedidos"
        subtitle="Gestiona y actualiza el estado de los pedidos del marketplace."
        variant="table"
        toolbar={toolbar}
      >
        <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <StatCard label="Pendientes" value={pendingCount} icon={<Clock className="h-4 w-4" />} tone="amber" />
          <StatCard label="Entregados" value={deliveredCount} icon={<CheckCircle className="h-4 w-4" />} tone="primary" />
          <StatCard label="Ingresos (no cancelados)" value={`$${totalRevenue.toFixed(2)}`} icon={<Package className="h-4 w-4" />} tone="secondary" />
        </div>

        <DataTable
          data={filteredOrders}
          columns={columns}
          actions={actions}
          loading={loading}
          defaultLimit={10}
          availableLimits={[5, 10, 20, 50]}
          globalSearchPlaceholder="Buscar por código, cliente o teléfono…"
        />
      </Layout>

      {/* Modal detalle del pedido */}
      <GenericModal
        isOpen={!!detailOrder}
        onClose={() => setDetailOrder(null)}
        title={detailOrder ? `Pedido ${detailOrder.order_code}` : ""}
        size="lg"
      >
        {detailOrder && (
          <div className="space-y-5">
            {/* Info cliente */}
            <section className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-0.5">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Cliente</p>
                  <p className="font-semibold text-slate-800">{detailOrder.customer_name}</p>
                  <p className="text-sm text-slate-600">{detailOrder.customer_phone}</p>
                  {detailOrder.customer_email && <p className="text-sm text-slate-500">{detailOrder.customer_email}</p>}
                </div>
                <a
                  href={`https://wa.me/${detailOrder.customer_phone.replace(/\D/g, "")}?text=${encodeURIComponent(
                    `Hola ${detailOrder.customer_name}, te contactamos sobre tu pedido *${detailOrder.order_code}* 😊`
                  )}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#25D366] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#1ebe5a] transition shrink-0"
                >
                  <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
                </a>
              </div>
              {(detailOrder.delivery_address || detailOrder.delivery_district) && (
                <div className="flex items-start gap-2 rounded border border-blue-100 bg-blue-50 px-3 py-2 text-sm text-blue-800">
                  <MapPin className="h-4 w-4 mt-0.5 shrink-0 text-blue-500" />
                  <div>
                    {detailOrder.delivery_address && <p className="font-medium">{detailOrder.delivery_address}</p>}
                    {detailOrder.delivery_district && <p className="text-xs text-blue-600">{detailOrder.delivery_district}</p>}
                    {detailOrder.delivery_references && <p className="text-xs text-blue-500 mt-0.5">Ref: {detailOrder.delivery_references}</p>}
                  </div>
                </div>
              )}
              {detailOrder.notes && (
                <p className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  Nota: {detailOrder.notes}
                </p>
              )}
            </section>

            {/* Items */}
            <section>
              <p className="mb-2 text-xs font-semibold text-slate-500 uppercase tracking-wide">Productos</p>
              <div className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
                {detailOrder.items?.map((item) => (
                  <div key={item.id} className="flex items-center justify-between px-4 py-3">
                    <div>
                      <p className="font-medium text-slate-800">{item.product_name}</p>
                      <p className="text-xs text-slate-500">x{item.quantity} · ${item.unit_price?.toFixed(2)} c/u</p>
                    </div>
                    <p className="font-semibold text-slate-800">${item.subtotal?.toFixed(2)}</p>
                  </div>
                ))}
                <div className="flex items-center justify-between px-4 py-3 bg-slate-50">
                  <p className="font-semibold text-slate-700">Total</p>
                  <p className="text-lg font-bold text-slate-900">${detailOrder.total.toFixed(2)}</p>
                </div>
              </div>
            </section>

            {/* Estado actual + cambio */}
            <section>
              <p className="mb-2 text-xs font-semibold text-slate-500 uppercase tracking-wide">Estado del pedido</p>
              <div className="flex flex-wrap gap-2">
                {STATUS_FLOW.map((s) => {
                  const cfg = STATUS_CONFIG[s];
                  const isCurrent = detailOrder.status === s;
                  const isUpdating = updatingId === detailOrder.id;
                  return (
                    <button
                      key={s}
                      onClick={() => void handleStatusChange(detailOrder, s)}
                      disabled={isCurrent || isUpdating}
                      className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                        isCurrent
                          ? `${cfg.classes} ring-2 ring-offset-1 ring-current`
                          : "bg-slate-100 text-slate-600 hover:bg-slate-200 disabled:opacity-40"
                      }`}
                    >
                      {cfg.icon} {cfg.label}
                    </button>
                  );
                })}
              </div>
            </section>
          </div>
        )}
      </GenericModal>
    </>
  );
}
