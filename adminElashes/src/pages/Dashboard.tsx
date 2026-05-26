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
  CalendarClock,
  Download,
  RefreshCw,
  TrendingUp,
  Clock,
  CheckCircle2,
  Hourglass,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";

import Layout from "../components/common/layout";
import { Button, SectionCard, StatCard } from "../components/common/ui";
import DownloadActions from "../components/common/ui/DownloadActions";
import FilterField from "../components/common/ui/FilterField";
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

const CHART_COLORS = [
  "#3b82f6", "#10b981", "#f59e0b", "#8b5cf6",
  "#ec4899", "#06b6d4", "#f97316", "#6366f1",
];

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

const formatCurrencyShort = (value: number) =>
  new Intl.NumberFormat("es-BO", {
    style: "currency",
    currency: "BOB",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
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
  const [todayCards, setTodayCards] = useState<DashboardOverview["cards"] | null>(null);
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

  const loadTodayStats = async () => {
    const today = getLocalDateInputValue();
    try {
      const data = await DashboardService.getOverview({
        from: today,
        to: today,
        branch_id: branchFilter ? Number(branchFilter) : undefined,
      });
      setTodayCards(data.cards);
    } catch {
      setTodayCards(null);
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
    void loadTodayStats();
  }, [branchFilter]);

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
    { label: "Clientes", helper: "Ver base de clientes", path: "/clients", icon: Users },
    { label: "Tickets", helper: "Gestionar tickets y pagos", path: "/admin/tickets", icon: Ticket },
    { label: "Agenda del día", helper: "Planilla diaria de reservas", path: "/admin/calendar/agenda", icon: CalendarClock },
    { label: "Caja & Seguimiento", helper: "Ventas y seguimiento técnico", path: "/admin/pos-tracking", icon: ReceiptText },
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
    if (!rows.length) { toast.info("No hay datos para exportar en esta sección."); return; }
    const timestamp = new Date().toISOString().slice(0, 10);
    const safeTitle = title.toLowerCase().replace(/\s+/g, "-");
    if (format === "excel") {
      const worksheet = XLSX.utils.json_to_sheet(rows.map((row) => ({
        Seccion: title, Sucursal: branchName, Desde: fromDate || "-", Hasta: toDate || "-",
        Item: row.label, Valor: row.value,
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
      headStyles: { fillColor: [59, 130, 246] },
    });
    doc.save(`${safeTitle}-${timestamp}.pdf`);
  };

  const inputCls =
    "rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20";

  const todayLabel = new Date().toLocaleDateString("es-BO", {
    weekday: "long", day: "numeric", month: "long",
  });

  const completionRate = overview.cards.appointments_total > 0
    ? Math.round((overview.cards.appointments_completed / overview.cards.appointments_total) * 100)
    : 0;

  return (
    <Layout
      title="Centro de operaciones"
      subtitle="Panel principal · operaciones y finanzas"
      variant="cards"
      pageClassName="min-h-0 bg-[#f0f0f3]"
      containerClassName="!rounded-none !border-0 !bg-transparent !p-0 !shadow-none"
      toolbar={
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-end gap-5">
            <FilterField label="Desde">
              <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className={inputCls} />
            </FilterField>
            <FilterField label="Hasta">
              <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className={inputCls} />
            </FilterField>
            <FilterField label="Sucursal">
              <select value={branchFilter} onChange={(e) => setBranchFilter(e.target.value)} className={`min-w-44 ${inputCls}`}>
                <option value="">Todas las sucursales</option>
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>{branch.name}</option>
                ))}
              </select>
            </FilterField>
            <FilterField label="Servicio">
              <select value={serviceFilter} onChange={(e) => setServiceFilter(e.target.value)} className={`min-w-44 ${inputCls}`}>
                <option value="">Todos los servicios</option>
                {services.map((service) => (
                  <option key={service.id} value={service.id}>{service.name}</option>
                ))}
              </select>
            </FilterField>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 pt-3">
            <Button variant="secondary" size="sm" leftIcon={<RefreshCw className="h-4 w-4" />}
              onClick={() => { void loadDashboard(); void loadTodayStats(); }} disabled={isLoading}>
              {isLoading ? "Actualizando..." : "Actualizar"}
            </Button>
            <Button variant="secondary" size="sm" leftIcon={<Download className="h-4 w-4" />}
              onClick={() => void handleDownload("tickets")} disabled={isDownloading}>
              Tickets CSV
            </Button>
            <Button variant="secondary" size="sm" leftIcon={<Download className="h-4 w-4" />}
              onClick={() => void handleDownload("payments")} disabled={isDownloading}>
              Pagos CSV
            </Button>
            <Button size="sm" leftIcon={<Download className="h-4 w-4" />}
              onClick={() => void handleDownload("pos")} disabled={isDownloading}>
              Ventas POS CSV
            </Button>
          </div>
        </div>
      }
    >
      {error ? (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-600">
          {error}
        </div>
      ) : null}

      {/* ── Hoy en tiempo real ─────────────────────────────────────────────── */}
      {todayCards && (
        <div className="mb-4 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5">
            <div className="flex items-center gap-2">
              <Clock className="h-3.5 w-3.5 text-blue-500" />
              <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Hoy</span>
            </div>
            <span className="text-[11px] capitalize text-slate-400">{todayLabel}</span>
          </div>
          <div className="flex flex-wrap divide-x divide-slate-100">
            {[
              {
                label: "Tickets del día",
                value: todayCards.appointments_total,
                icon: <Ticket className="h-4 w-4" />,
                color: "text-blue-500",
                bg: "bg-blue-50",
              },
              {
                label: "Completados",
                value: todayCards.appointments_completed,
                icon: <CheckCircle2 className="h-4 w-4" />,
                color: "text-emerald-500",
                bg: "bg-emerald-50",
              },
              {
                label: "En espera",
                value: todayCards.appointments_pending + todayCards.appointments_confirmed,
                icon: <Hourglass className="h-4 w-4" />,
                color: "text-amber-500",
                bg: "bg-amber-50",
              },
              {
                label: "Ingresos hoy",
                value: formatCurrencyShort(todayCards.payments_paid_total),
                icon: <TrendingUp className="h-4 w-4" />,
                color: "text-violet-500",
                bg: "bg-violet-50",
              },
            ].map((stat) => (
              <div key={stat.label} className="flex min-w-32 flex-1 items-center gap-3 px-5 py-4">
                <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${stat.bg} ${stat.color}`}>
                  {stat.icon}
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{stat.label}</p>
                  <p className="text-lg font-bold tabular-nums text-slate-900">{stat.value}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── KPI cards ──────────────────────────────────────────────────────── */}
      <SectionCard
        variant="business"
        title="Indicadores del periodo"
        subtitle={`${fromDate || "–"} al ${toDate || "–"} · ${overview.scope.branch_name ?? "Todas las sucursales"}`}
        bodyClassName="!pt-3"
        className="mb-4"
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
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
            helperText={`${overview.cards.appointments_completed} completados · ${completionRate}% tasa`}
            icon={<Ticket className="h-4 w-4" />}
            tone="emerald"
          />
          <StatCard
            label="Ingresos"
            value={formatCurrency(overview.cards.payments_paid_total)}
            helperText={`${overview.cards.payments_count} pagos · promedio ${formatCurrency(overview.cards.avg_payment)}`}
            icon={<Wallet className="h-4 w-4" />}
            tone="amber"
          />
          <StatCard
            label="Ventas POS"
            value={overview.cards.pos_sales_count}
            helperText={`${overview.cards.active_employees} empleados activos`}
            icon={<ReceiptText className="h-4 w-4" />}
            tone="slate"
          />
        </div>
      </SectionCard>

      {/* ── Gráficas ────────────────────────────────────────────────────────── */}
      <div className="mb-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
        <SectionCard
          variant="business"
          title="Ingresos por periodo"
          subtitle="Pagos cobrados por día en el rango seleccionado."
          actions={<DownloadActions onExcel={() => downloadSectionReport("revenue", "excel")} onPdf={() => downloadSectionReport("revenue", "pdf")} />}
        >
          <div className="h-52">
            {revenueChartData.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-slate-400">
                No hay datos de ingresos para el rango seleccionado.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
                <BarChart data={revenueChartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fill: "#94a3b8", fontSize: 11 }} />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: "#94a3b8", fontSize: 11 }}
                    tickFormatter={(v) => `Bs ${v}`}
                  />
                  <Tooltip
                    formatter={(value, name) => {
                      const n = Number(value ?? 0);
                      return name === "total" ? [formatCurrency(n), "Ingresos"] : [n, "Pagos"];
                    }}
                    cursor={{ fill: "#f1f5f9" }}
                    contentStyle={{ borderRadius: 10, border: "1px solid #e2e8f0", fontSize: 12 }}
                  />
                  <Bar dataKey="total" radius={[4, 4, 0, 0]} barSize={28} fill="#3b82f6" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </SectionCard>

        <SectionCard
          variant="business"
          title="Servicios más solicitados"
          subtitle="Volumen de tickets e ingreso estimado por servicio."
          actions={<DownloadActions onExcel={() => downloadSectionReport("services", "excel")} onPdf={() => downloadSectionReport("services", "pdf")} />}
        >
          <div className="h-52">
            {serviceChartData.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-slate-400">
                No hay tickets para el filtro actual.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
                <BarChart data={serviceChartData} layout="vertical" margin={{ left: 4, right: 12, top: 4, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                  <XAxis type="number" tickLine={false} axisLine={false} tick={{ fill: "#94a3b8", fontSize: 11 }} />
                  <YAxis
                    dataKey="name" type="category" tickLine={false} axisLine={false}
                    width={118} tick={{ fill: "#64748b", fontSize: 11 }}
                  />
                  <Tooltip
                    formatter={(value, name) => {
                      const n = Number(value ?? 0);
                      return name === "tickets" ? [n, "Tickets"] : [formatCurrency(n), "Ingreso estimado"];
                    }}
                    contentStyle={{ borderRadius: 10, border: "1px solid #e2e8f0", fontSize: 12 }}
                  />
                  <Bar dataKey="tickets" radius={[0, 4, 4, 0]} barSize={20}>
                    {serviceChartData.map((entry, index) => (
                      <Cell key={`${entry.name}-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </SectionCard>
      </div>

      {/* ── Resumen operativo + Inventario ─────────────────────────────────── */}
      <div className="mb-4 grid grid-cols-1 gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <SectionCard
          variant="business"
          title="Resumen operativo"
          subtitle="Estados de ticket y actividad de caja en el periodo."
          actions={<DownloadActions onExcel={() => downloadSectionReport("overview", "excel")} onPdf={() => downloadSectionReport("overview", "pdf")} />}
        >
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {/* Tickets */}
            <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
              <p className="mb-3 text-[10px] font-bold uppercase tracking-wide text-slate-400">Estados de ticket</p>
              <div className="space-y-2 text-sm">
                {[
                  { label: "Pendientes", value: overview.cards.appointments_pending, dot: "bg-amber-400" },
                  { label: "Confirmados", value: overview.cards.appointments_confirmed, dot: "bg-blue-400" },
                  { label: "Completados", value: overview.cards.appointments_completed, dot: "bg-emerald-400" },
                  { label: "Cancelados",  value: overview.cards.appointments_cancelled, dot: "bg-red-400" },
                ].map((row) => (
                  <div key={row.label} className="flex items-center justify-between border-b border-dashed border-slate-200 pb-1.5 last:border-0 last:pb-0">
                    <div className="flex items-center gap-2">
                      <span className={`h-2 w-2 rounded-full ${row.dot}`} />
                      <span className="text-slate-500">{row.label}</span>
                    </div>
                    <strong className="tabular-nums text-slate-800">{row.value}</strong>
                  </div>
                ))}
                <div className="mt-2 flex items-center justify-between rounded-lg bg-blue-50 px-2.5 py-1.5">
                  <span className="text-[11px] font-semibold text-blue-600">Tasa de completado</span>
                  <span className="text-[11px] font-bold text-blue-700">{completionRate}%</span>
                </div>
              </div>
            </div>

            {/* Caja */}
            <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
              <p className="mb-3 text-[10px] font-bold uppercase tracking-wide text-slate-400">Caja y ventas</p>
              <div className="space-y-2 text-sm">
                {[
                  { label: "Pagos registrados", value: String(overview.cards.payments_count) },
                  { label: "Promedio por pago",  value: formatCurrency(overview.cards.avg_payment) },
                  { label: "Ventas POS",         value: String(overview.cards.pos_sales_count) },
                  { label: "Clientes activos",   value: String(overview.cards.clients_with_activity) },
                ].map((row) => (
                  <div key={row.label} className="flex items-center justify-between border-b border-dashed border-slate-200 pb-1.5 last:border-0 last:pb-0">
                    <span className="text-slate-500">{row.label}</span>
                    <strong className="tabular-nums text-slate-800">{row.value}</strong>
                  </div>
                ))}
                <div className="mt-2 flex items-center justify-between rounded-lg bg-emerald-50 px-2.5 py-1.5">
                  <span className="text-[11px] font-semibold text-emerald-600">Total ingresos</span>
                  <span className="text-[11px] font-bold text-emerald-700">{formatCurrency(overview.cards.payments_paid_total)}</span>
                </div>
              </div>
            </div>
          </div>
        </SectionCard>

        <SectionCard
          variant="business"
          title="Inventario relevante"
          subtitle="Stock disponible por producto."
          actions={<DownloadActions onExcel={() => downloadSectionReport("inventory", "excel")} onPdf={() => downloadSectionReport("inventory", "pdf")} />}
        >
          <div className="h-64">
            {inventoryChartData.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-slate-400">
                No hay datos de inventario para mostrar.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
                <PieChart>
                  <Pie
                    data={inventoryChartData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={52}
                    outerRadius={86}
                    paddingAngle={3}
                    stroke="#fff"
                    strokeWidth={2}
                  >
                    {inventoryChartData.map((entry, index) => (
                      <Cell key={`${entry.name}-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value) => [`${Number(value ?? 0)}`, "Stock"]}
                    contentStyle={{ borderRadius: 10, border: "1px solid #e2e8f0", fontSize: 12 }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
          {overview.cards.low_stock_items > 0 && (
            <div className="mt-2 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
              <Package className="h-3.5 w-3.5 text-amber-500 shrink-0" />
              <span className="text-xs font-semibold text-amber-700">
                {overview.cards.low_stock_items} producto{overview.cards.low_stock_items !== 1 ? "s" : ""} con stock bajo
              </span>
            </div>
          )}
        </SectionCard>
      </div>

      {/* ── Accesos directos ───────────────────────────────────────────────── */}
      <SectionCard
        variant="business"
        title="Accesos directos"
        subtitle="Secciones frecuentes del sistema."
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {quickLinks.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.path}
                type="button"
                onClick={() => navigate(item.path)}
                className="group flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-left outline-none transition hover:border-blue-300 hover:bg-white hover:shadow-sm focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-600 transition group-hover:bg-blue-500 group-hover:text-white">
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-800">{item.label}</p>
                  <p className="truncate text-xs text-slate-400">{item.helper}</p>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-slate-300 transition group-hover:text-blue-500" />
              </button>
            );
          })}
        </div>

        <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
          <Button variant="secondary" size="sm" leftIcon={<Ticket className="h-4 w-4" />} onClick={() => navigate("/admin/tickets")}>
            Gestionar tickets
          </Button>
          <Button variant="secondary" size="sm" leftIcon={<CalendarDays className="h-4 w-4" />} onClick={() => navigate("/admin/calendar")}>
            Ver calendario
          </Button>
          <Button variant="secondary" size="sm" leftIcon={<CalendarClock className="h-4 w-4" />} onClick={() => navigate("/admin/calendar/agenda")}>
            Agenda del día
          </Button>
          <Button size="sm" leftIcon={<ClipboardList className="h-4 w-4" />} onClick={() => navigate("/admin/pos-tracking")}>
            Abrir Caja POS
          </Button>
        </div>
      </SectionCard>
    </Layout>
  );
}
