import { useEffect, useMemo, useState } from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
} from "recharts";
import {
  Users,
  Store,
  UserCheck,
  Package,
  ClipboardList,
  ChevronRight,
  Wallet,
  Ticket,
  ReceiptText,
  CalendarDays,
  Download,
  RefreshCw,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";

import Layout from "../components/common/layout";
import FilterActionBar from "../components/common/FilterActionBar";
import { Button, SectionCard, StatCard } from "../components/common/ui";
import { DashboardService, type DashboardOverview } from "../core/services/dashboard/dashboard.service";
import { BranchService } from "../core/services/branch/branch.service";
import { AgendaService, type ServiceOption } from "../core/services/agenda/agenda.service";
import { BRANCH_STORAGE_KEY, getSelectedBranchId, setSelectedBranchId } from "../core/utils/branch";

interface BranchOption {
  id: number;
  name: string;
}

type ExportFormat = "excel" | "pdf";
type ExportSection = "overview" | "revenue" | "services" | "inventory" | "quicklinks";

const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ec4899", "#8b5cf6", "#14b8a6", "#f97316", "#6366f1"];

const getLocalDateInputValue = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const getMonthStart = () => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("es-BO", {
    style: "currency",
    currency: "BOB",
    minimumFractionDigits: 2,
  }).format(value || 0);

const downloadBlob = (blob: Blob, filename: string) => {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};

const emptyOverview: DashboardOverview = {
  period: { from: null, to: null },
  scope: { branch_id: null, branch_name: null, service_id: null },
  cards: {
    clients_total: 0,
    clients_with_activity: 0,
    appointments_total: 0,
    appointments_pending: 0,
    appointments_confirmed: 0,
    appointments_completed: 0,
    appointments_cancelled: 0,
    payments_paid_total: 0,
    payments_count: 0,
    avg_payment: 0,
    pos_sales_count: 0,
    active_employees: 0,
    services_count: 0,
    products_active_count: 0,
    low_stock_items: 0,
  },
};

export default function Dashboard() {
  const navigate = useNavigate();
  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [services, setServices] = useState<ServiceOption[]>([]);
  const [overview, setOverview] = useState<DashboardOverview>(emptyOverview);
  const [revenueSeries, setRevenueSeries] = useState<Array<{ bucket: string; paid_amount: number; payments_count: number }>>([]);
  const [serviceDistribution, setServiceDistribution] = useState<
    Array<{ service_id: number | null; service_name: string; tickets_count: number; completed_count: number; estimated_revenue: number }>
  >([]);
  const [inventoryDistribution, setInventoryDistribution] = useState<
    Array<{ product_id: number; product_name: string; total_stock: number }>
  >([]);
  const [fromDate, setFromDate] = useState(getLocalDateInputValue(getMonthStart()));
  const [toDate, setToDate] = useState(getLocalDateInputValue());
  const [branchFilter, setBranchFilter] = useState(() => {
    const selected = getSelectedBranchId();
    return selected ? String(selected) : "";
  });
  const [serviceFilter, setServiceFilter] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dashboardFilters = useMemo(
    () => ({
      from: fromDate || undefined,
      to: toDate || undefined,
      branch_id: branchFilter ? Number(branchFilter) : undefined,
      service_id: serviceFilter ? Number(serviceFilter) : undefined,
    }),
    [branchFilter, fromDate, serviceFilter, toDate]
  );

  const loadDashboard = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [overviewData, revenueData, serviceData, inventoryData] = await Promise.all([
        DashboardService.getOverview(dashboardFilters),
        DashboardService.getRevenueSeries({ ...dashboardFilters, group_by: "day" }),
        DashboardService.getServiceDistribution({ ...dashboardFilters, limit: 8 }),
        DashboardService.getInventoryDistribution({
          branch_id: dashboardFilters.branch_id,
          limit: 8,
        }),
      ]);

      setOverview(overviewData);
      setRevenueSeries(revenueData.series);
      setServiceDistribution(serviceData.rows);
      setInventoryDistribution(inventoryData.rows);
    } catch (err) {
      console.error("Error cargando dashboard:", err);
      setError("No se pudieron cargar las métricas del dashboard.");
      toast.error("No se pudieron cargar las métricas del dashboard.");
      setOverview(emptyOverview);
      setRevenueSeries([]);
      setServiceDistribution([]);
      setInventoryDistribution([]);
    } finally {
      setIsLoading(false);
    }
  };

  const loadContext = async () => {
    try {
      const [branchesData, servicesData] = await Promise.all([
        BranchService.list({ limit: 200 }),
        AgendaService.listServices({ limit: 200 }),
      ]);
      setBranches(branchesData);
      setServices(servicesData);
    } catch (err) {
      console.error("Error cargando filtros del dashboard:", err);
      setBranches([]);
      setServices([]);
    }
  };

  useEffect(() => {
    void loadContext();
  }, []);

  useEffect(() => {
    const syncBranchFromGlobal = () => {
      const selected = getSelectedBranchId();
      setBranchFilter(selected ? String(selected) : "");
    };

    const onStorage = (event: StorageEvent) => {
      if (event.key === BRANCH_STORAGE_KEY) syncBranchFromGlobal();
    };

    window.addEventListener("branchchange", syncBranchFromGlobal);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("branchchange", syncBranchFromGlobal);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  useEffect(() => {
    void loadDashboard();
  }, [dashboardFilters]);

  useEffect(() => {
    if (!branchFilter) {
      setSelectedBranchId(null);
      return;
    }

    const nextBranch = Number(branchFilter);
    setSelectedBranchId(Number.isFinite(nextBranch) && nextBranch > 0 ? nextBranch : null);
  }, [branchFilter]);

  const handleDownload = async (kind: "tickets" | "payments" | "pos") => {
    setIsDownloading(true);
    try {
      if (kind === "tickets") {
        const blob = await DashboardService.downloadTicketsReport(dashboardFilters);
        downloadBlob(blob, `tickets-report-${fromDate || "all"}-${toDate || "all"}.csv`);
      } else if (kind === "payments") {
        const blob = await DashboardService.downloadPaymentsReport(dashboardFilters);
        downloadBlob(blob, `payments-report-${fromDate || "all"}-${toDate || "all"}.csv`);
      } else {
        const blob = await DashboardService.downloadPosSalesReport(dashboardFilters);
        downloadBlob(blob, `pos-sales-report-${fromDate || "all"}-${toDate || "all"}.csv`);
      }
    } catch (err) {
      console.error("Error descargando reporte:", err);
      toast.error("No se pudo descargar el reporte.");
    } finally {
      setIsDownloading(false);
    }
  };

  const revenueChartData = useMemo(
    () =>
      revenueSeries.map((item) => ({
        name: item.bucket,
        total: item.paid_amount,
        pagos: item.payments_count,
      })),
    [revenueSeries]
  );

  const serviceChartData = useMemo(
    () =>
      serviceDistribution.map((item) => ({
        name: item.service_name || "Sin servicio",
        tickets: item.tickets_count,
        completados: item.completed_count,
        total: item.estimated_revenue,
      })),
    [serviceDistribution]
  );

  const inventoryChartData = useMemo(
    () =>
      inventoryDistribution.map((item) => ({
        name: item.product_name,
        value: item.total_stock,
      })),
    [inventoryDistribution]
  );

  const quickLinks = [
    { label: "Clientes", helper: "Ver base de clientes", path: "/clients" },
    { label: "Tickets", helper: "Gestionar tickets y pagos", path: "/admin/tickets" },
    { label: "Calendario", helper: "Revisar agenda diaria", path: "/admin/calendar" },
    { label: "Caja & Seguimiento", helper: "Ventas y seguimiento técnico", path: "/admin/pos-tracking" },
  ];

  const downloadSectionReport = (section: ExportSection, format: ExportFormat) => {
    const branchName = branchFilter
      ? branches.find((branch) => String(branch.id) === branchFilter)?.name ?? `Sucursal ${branchFilter}`
      : "Todas";

    const titleMap: Record<ExportSection, string> = {
      overview: "Resumen operativo",
      revenue: "Ingresos por periodo",
      services: "Servicios mas solicitados",
      inventory: "Inventario relevante",
      quicklinks: "Accesos directos",
    };

    const title = titleMap[section];

    const rowsBySection: Record<ExportSection, Array<{ label: string; value: string | number }>> = {
      overview: [
        { label: "Clientes", value: overview.cards.clients_total },
        { label: "Clientes con actividad", value: overview.cards.clients_with_activity },
        { label: "Tickets pendientes", value: overview.cards.appointments_pending },
        { label: "Tickets confirmados", value: overview.cards.appointments_confirmed },
        { label: "Tickets completados", value: overview.cards.appointments_completed },
        { label: "Tickets cancelados", value: overview.cards.appointments_cancelled },
        { label: "Pagos registrados", value: overview.cards.payments_count },
        { label: "Ingresos", value: formatCurrency(overview.cards.payments_paid_total) },
        { label: "Ventas POS", value: overview.cards.pos_sales_count },
      ],
      revenue: revenueChartData.map((item) => ({
        label: item.name,
        value: `${formatCurrency(item.total)} | pagos: ${item.pagos}`,
      })),
      services: serviceChartData.map((item) => ({
        label: item.name,
        value: `tickets: ${item.tickets} | completados: ${item.completados} | ingreso: ${formatCurrency(item.total)}`,
      })),
      inventory: inventoryChartData.map((item) => ({
        label: item.name,
        value: item.value,
      })),
      quicklinks: quickLinks.map((item) => ({
        label: item.label,
        value: `${item.helper} | ${item.path}`,
      })),
    };

    const rows = rowsBySection[section];
    if (!rows.length) {
      toast.info("No hay datos para exportar en esta sección.");
      return;
    }

    const timestamp = new Date().toISOString().slice(0, 10);
    const safeTitle = title.toLowerCase().replace(/\s+/g, "-");

    if (format === "excel") {
      const worksheet = XLSX.utils.json_to_sheet(rows.map((row) => ({
        Seccion: title,
        Sucursal: branchName,
        Desde: fromDate || "-",
        Hasta: toDate || "-",
        Item: row.label,
        Valor: row.value,
      })));
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Dashboard");
      XLSX.writeFile(workbook, `${safeTitle}-${timestamp}.xlsx`);
      return;
    }

    const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
    doc.setFontSize(14);
    doc.text(title, 40, 48);
    doc.setFontSize(10);
    doc.text(`Sucursal: ${branchName}`, 40, 66);
    doc.text(`Rango: ${fromDate || "-"} a ${toDate || "-"}`, 40, 82);

    autoTable(doc, {
      startY: 96,
      head: [["Item", "Valor"]],
      body: rows.map((row) => [row.label, String(row.value)]),
      styles: { fontSize: 9 },
      headStyles: { fillColor: [22, 45, 38] },
    });

    doc.save(`${safeTitle}-${timestamp}.pdf`);
  };

  return (
    <Layout
      title="Panel Administrativo"
      subtitle="Dashboard operativo con métricas reales, filtros globales y reportes descargables."
      variant="table"
      toolbar={
        <FilterActionBar
          left={
            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-1">
                <label className="text-xs font-bold uppercase tracking-wide text-slate-500">Desde</label>
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-[#094732] focus:ring-2 focus:ring-[#094732]/20"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold uppercase tracking-wide text-slate-500">Hasta</label>
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-[#094732] focus:ring-2 focus:ring-[#094732]/20"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold uppercase tracking-wide text-slate-500">Sucursal</label>
                <select
                  value={branchFilter}
                  onChange={(e) => setBranchFilter(e.target.value)}
                  className="min-w-[180px] rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-[#094732] focus:ring-2 focus:ring-[#094732]/20"
                >
                  <option value="">Todas las sucursales</option>
                  {branches.map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {branch.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold uppercase tracking-wide text-slate-500">Servicio</label>
                <select
                  value={serviceFilter}
                  onChange={(e) => setServiceFilter(e.target.value)}
                  className="min-w-[180px] rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-[#094732] focus:ring-2 focus:ring-[#094732]/20"
                >
                  <option value="">Todos los servicios</option>
                  {services.map((service) => (
                    <option key={service.id} value={service.id}>
                      {service.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          }
          right={
            <>
              <Button
                variant="secondary"
                size="sm"
                leftIcon={<RefreshCw className="h-4 w-4" />}
                onClick={() => void loadDashboard()}
                disabled={isLoading}
              >
                {isLoading ? "Actualizando..." : "Actualizar"}
              </Button>
              <Button
                variant="secondary"
                size="sm"
                leftIcon={<Download className="h-4 w-4" />}
                onClick={() => void handleDownload("tickets")}
                disabled={isDownloading}
              >
                Tickets CSV
              </Button>
              <Button
                variant="secondary"
                size="sm"
                leftIcon={<Download className="h-4 w-4" />}
                onClick={() => void handleDownload("payments")}
                disabled={isDownloading}
              >
                Pagos CSV
              </Button>
              <Button
                size="sm"
                leftIcon={<Download className="h-4 w-4" />}
                onClick={() => void handleDownload("pos")}
                disabled={isDownloading}
              >
                Ventas POS CSV
              </Button>
            </>
          }
        />
      }
    >
      {error ? (
        <SectionCard className="mb-5 border border-rose-200 bg-rose-50" bodyClassName="!p-4">
          <p className="text-sm font-medium text-rose-700">{error}</p>
        </SectionCard>
      ) : null}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Clientes"
          value={overview.cards.clients_total}
          helperText={`${overview.cards.clients_with_activity} con actividad en el periodo`}
          icon={<Users className="h-4 w-4" />}
          tone="blue"
        />
        <StatCard
          label="Tickets"
          value={overview.cards.appointments_total}
          helperText={`${overview.cards.appointments_completed} completados / ${overview.cards.appointments_pending} pendientes`}
          icon={<Ticket className="h-4 w-4" />}
          tone="emerald"
        />
        <StatCard
          label="Ingresos"
          value={formatCurrency(overview.cards.payments_paid_total)}
          helperText={`${overview.cards.payments_count} pagos registrados`}
          icon={<Wallet className="h-4 w-4" />}
          tone="amber"
        />
        <StatCard
          label="Ventas POS"
          value={overview.cards.pos_sales_count}
          helperText={`Promedio por pago: ${formatCurrency(overview.cards.avg_payment)}`}
          icon={<ReceiptText className="h-4 w-4" />}
          tone="slate"
        />
        <StatCard
          label="Empleados Activos"
          value={overview.cards.active_employees}
          helperText="Usuarios habilitados para operar"
          icon={<UserCheck className="h-4 w-4" />}
          tone="blue"
        />
        <StatCard
          label="Servicios"
          value={overview.cards.services_count}
          helperText="Catálogo de servicios disponible"
          icon={<Store className="h-4 w-4" />}
          tone="slate"
        />
        <StatCard
          label="Productos"
          value={overview.cards.products_active_count}
          helperText={`${overview.cards.low_stock_items} con stock bajo`}
          icon={<Package className="h-4 w-4" />}
          tone="amber"
        />
        <StatCard
          label="Estado de Tickets"
          value={overview.cards.appointments_confirmed}
          helperText={`${overview.cards.appointments_cancelled} cancelados en el rango`}
          icon={<CalendarDays className="h-4 w-4" />}
          tone="emerald"
        />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-5 xl:grid-cols-2">
        <SectionCard
          title="Ingresos por periodo"
          subtitle="Pagos cobrados agrupados por día según los filtros activos."
          actions={
            <div className="flex gap-2">
              <Button size="sm" variant="secondary" leftIcon={<Download className="h-4 w-4" />} onClick={() => downloadSectionReport("revenue", "excel")}>Excel</Button>
              <Button size="sm" variant="secondary" leftIcon={<Download className="h-4 w-4" />} onClick={() => downloadSectionReport("revenue", "pdf")}>PDF</Button>
            </div>
          }
        >
          <div className="h-72">
            {revenueChartData.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-slate-500">
                No hay datos de ingresos para el rango seleccionado.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
                <BarChart data={revenueChartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fill: "#64748b", fontSize: 12 }} />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: "#64748b", fontSize: 12 }}
                    tickFormatter={(value) => `Bs ${value}`}
                  />
                  <Tooltip
                    formatter={(value, name) => {
                      const numericValue = Number(value ?? 0);
                      return name === "total"
                        ? [formatCurrency(numericValue), "Ingresos"]
                        : [numericValue, "Pagos"];
                    }}
                    cursor={{ fill: "#f8fafc" }}
                  />
                  <Bar dataKey="total" radius={[10, 10, 0, 0]} barSize={34}>
                    {revenueChartData.map((entry, index) => (
                      <Cell key={`${entry.name}-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </SectionCard>

        <SectionCard
          title="Servicios Más Solicitados"
          subtitle="Tickets generados por servicio y su ingreso estimado."
          actions={
            <div className="flex gap-2">
              <Button size="sm" variant="secondary" leftIcon={<Download className="h-4 w-4" />} onClick={() => downloadSectionReport("services", "excel")}>Excel</Button>
              <Button size="sm" variant="secondary" leftIcon={<Download className="h-4 w-4" />} onClick={() => downloadSectionReport("services", "pdf")}>PDF</Button>
            </div>
          }
        >
          <div className="h-72">
            {serviceChartData.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-slate-500">
                No hay tickets para el filtro actual.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
                <BarChart data={serviceChartData} layout="vertical" margin={{ left: 10, right: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                  <XAxis type="number" tickLine={false} axisLine={false} />
                  <YAxis
                    dataKey="name"
                    type="category"
                    tickLine={false}
                    axisLine={false}
                    width={110}
                    tick={{ fill: "#64748b", fontSize: 12 }}
                  />
                  <Tooltip
                    formatter={(value, name) => {
                      const numericValue = Number(value ?? 0);
                      return name === "tickets"
                        ? [numericValue, "Tickets"]
                        : [formatCurrency(numericValue), "Ingreso estimado"];
                    }}
                  />
                  <Bar dataKey="tickets" radius={[0, 10, 10, 0]}>
                    {serviceChartData.map((entry, index) => (
                      <Cell key={`${entry.name}-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </SectionCard>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-[1.2fr_0.8fr]">
        <SectionCard
          title="Resumen Operativo"
          subtitle="Una vista rápida del flujo de tickets, caja y atención."
          actions={
            <div className="flex gap-2">
              <Button size="sm" variant="secondary" leftIcon={<Download className="h-4 w-4" />} onClick={() => downloadSectionReport("overview", "excel")}>Excel</Button>
              <Button size="sm" variant="secondary" leftIcon={<Download className="h-4 w-4" />} onClick={() => downloadSectionReport("overview", "pdf")}>PDF</Button>
            </div>
          }
        >
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Estados de ticket</p>
              <div className="mt-3 space-y-2 text-sm text-slate-700">
                <div className="flex items-center justify-between">
                  <span>Pendientes</span>
                  <strong>{overview.cards.appointments_pending}</strong>
                </div>
                <div className="flex items-center justify-between">
                  <span>Confirmados</span>
                  <strong>{overview.cards.appointments_confirmed}</strong>
                </div>
                <div className="flex items-center justify-between">
                  <span>Completados</span>
                  <strong>{overview.cards.appointments_completed}</strong>
                </div>
                <div className="flex items-center justify-between">
                  <span>Cancelados</span>
                  <strong>{overview.cards.appointments_cancelled}</strong>
                </div>
              </div>
            </div>
            <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">Caja y ventas</p>
              <div className="mt-3 space-y-2 text-sm text-slate-700">
                <div className="flex items-center justify-between">
                  <span>Pagos registrados</span>
                  <strong>{overview.cards.payments_count}</strong>
                </div>
                <div className="flex items-center justify-between">
                  <span>Promedio por pago</span>
                  <strong>{formatCurrency(overview.cards.avg_payment)}</strong>
                </div>
                <div className="flex items-center justify-between">
                  <span>Ventas POS</span>
                  <strong>{overview.cards.pos_sales_count}</strong>
                </div>
                <div className="flex items-center justify-between">
                  <span>Clientes activos</span>
                  <strong>{overview.cards.clients_with_activity}</strong>
                </div>
              </div>
            </div>
          </div>
        </SectionCard>

        <SectionCard
          title="Inventario Relevante"
          subtitle="Productos con más unidades disponibles según la sucursal filtrada."
          actions={
            <div className="flex gap-2">
              <Button size="sm" variant="secondary" leftIcon={<Download className="h-4 w-4" />} onClick={() => downloadSectionReport("inventory", "excel")}>Excel</Button>
              <Button size="sm" variant="secondary" leftIcon={<Download className="h-4 w-4" />} onClick={() => downloadSectionReport("inventory", "pdf")}>PDF</Button>
            </div>
          }
        >
          <div className="h-72">
            {inventoryChartData.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-slate-500">
                No hay datos de inventario para mostrar.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
                <PieChart>
                  <Pie
                    data={inventoryChartData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={55}
                    outerRadius={88}
                    paddingAngle={4}
                  >
                    {inventoryChartData.map((entry, index) => (
                      <Cell key={`${entry.name}-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => [`${Number(value ?? 0)}`, "Stock"]} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </SectionCard>
      </div>

      <div className="mt-5">
        <SectionCard
          title="Accesos Directos"
          subtitle="Flujos rápidos para operar tickets, agenda, caja y clientes."
          actions={
            <div className="flex gap-2">
              <Button size="sm" variant="secondary" leftIcon={<Download className="h-4 w-4" />} onClick={() => downloadSectionReport("quicklinks", "excel")}>Excel</Button>
              <Button size="sm" variant="secondary" leftIcon={<Download className="h-4 w-4" />} onClick={() => downloadSectionReport("quicklinks", "pdf")}>PDF</Button>
            </div>
          }
        >
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
            {quickLinks.map((item) => (
              <button
                key={item.path}
                type="button"
                onClick={() => navigate(item.path)}
                className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-left transition hover:border-emerald-200 hover:bg-emerald-50/50"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold text-slate-800">{item.label}</p>
                    <p className="mt-1 text-xs text-slate-500">{item.helper}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-slate-400" />
                </div>
              </button>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" leftIcon={<Ticket className="h-4 w-4" />} onClick={() => navigate("/admin/tickets")}>
              Gestionar tickets
            </Button>
            <Button variant="secondary" size="sm" leftIcon={<CalendarDays className="h-4 w-4" />} onClick={() => navigate("/admin/calendar")}>
              Ver calendario
            </Button>
            <Button size="sm" leftIcon={<ClipboardList className="h-4 w-4" />} onClick={() => navigate("/admin/pos-tracking")}>
              Abrir Caja POS
            </Button>
          </div>
        </SectionCard>
      </div>
    </Layout>
  );
}