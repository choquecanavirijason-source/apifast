import { useCallback, useEffect, useMemo, useState } from "react";
import { Banknote, Download, List, X } from "lucide-react";
import CommissionPaymentsTab from "./CommissionPaymentsTab";
import { AgendaService, type ProfessionalForSelect, type TicketItem } from "@/core/services/agenda/agenda.service";
import { TrackingService, type TrackingResponse } from "@/core/services/tracking/tracking.service";
import { BRANCH_STORAGE_KEY, getSelectedBranchId } from "@/core/utils/branch";
import useAuth from "@/core/hooks/useAuth";
import Layout from "@/components/common/layout";
import FilterActionBar from "@/components/common/FilterActionBar";
import { Button, SectionCard, StatCard } from "@/components/common/ui";
import DataTable, { type DataTableColumn } from "@/components/common/table/DataTable";
import { generateTablePdf } from "@/core/utils/generateTablePdf";
import {
  formatCommissionRatePercent,
  getTicketCommission,
  getTicketPriceTotal,
} from "./professionalCommission.utils";

// Una fila por cita (no un agregado por operaria) — el PDF de comisiones
// tiene que mostrar el detalle real (cliente, servicio, fecha), no solo
// cuántas hizo cada una.
export interface CommissionExportRow {
  professional_name: string;
  client_name: string;
  services: string;
  fecha: string;
  hora: string;
  status: string;
  caja: number;
  comision: number;
}

export interface CommissionExportTotals {
  caja: number;
  comision: number;
  pagado: number;
  pendiente: number;
}

const fieldClass =
  "w-full rounded-sm border border-[#8a8886] bg-white px-3 py-2 text-sm text-[#323130] placeholder:text-[#a19f9d] outline-none transition focus:border-[#0078d4] focus:ring-1 focus:ring-[#0078d4]/35 disabled:bg-[#f3f2f1] disabled:text-[#a19f9d]";

const CARD_COLORS = [
  { bg: "bg-violet-100", text: "text-violet-800" },
  { bg: "bg-pink-100", text: "text-pink-800" },
  { bg: "bg-sky-100", text: "text-sky-800" },
  { bg: "bg-amber-100", text: "text-amber-800" },
  { bg: "bg-emerald-100", text: "text-emerald-800" },
  { bg: "bg-rose-100", text: "text-rose-800" },
  { bg: "bg-indigo-100", text: "text-indigo-800" },
  { bg: "bg-teal-100", text: "text-teal-800" },
];

const STATUS_LABELS: Record<string, string> = {
  pending: "Pendiente",
  waiting: "En espera",
  in_service: "En servicio",
  completed: "Completado",
  cancelled: "Cancelado",
  confirmed: "Confirmado",
};

const STATUS_BADGE: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800",
  waiting: "bg-blue-100 text-blue-800",
  in_service: "bg-green-100 text-green-800",
  completed: "bg-emerald-100 text-emerald-800",
  cancelled: "bg-rose-100 text-rose-800",
  confirmed: "bg-violet-100 text-violet-800",
};

const moneyFormatter = new Intl.NumberFormat("es-BO", {
  style: "currency",
  currency: "BOB",
  maximumFractionDigits: 2,
});

function getInitials(name: string) {
  return name.split(" ").map((w) => w[0] ?? "").join("").toUpperCase().slice(0, 2);
}

function getDurationLabel(start: string, end: string) {
  const s = new Date(start);
  const e = new Date(end);
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return "—";
  const mins = Math.max(1, Math.round((e.getTime() - s.getTime()) / 60000));
  if (mins >= 60) {
    const h = Math.floor(mins / 60);
    const rest = mins % 60;
    return rest ? `${h}h ${rest}m` : `${h}h`;
  }
  return `${mins} min`;
}

export default function ProfessionalServiceHistory() {
  const { user, isAdmin, hasRole } = useAuth();
  const canSeeCards = isAdmin() || hasRole("Operaria");
  const isOperaria = hasRole("Operaria") && !isAdmin();

  const [activeTab, setActiveTab] = useState<"tickets" | "comisiones">("tickets");
  const [tickets, setTickets] = useState<TicketItem[]>([]);
  const [trackings, setTrackings] = useState<TrackingResponse[]>([]);
  const [professionals, setProfessionals] = useState<ProfessionalForSelect[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [activeBranchId, setActiveBranchId] = useState<number | null>(() => getSelectedBranchId());
  const [selectedProfessionalId, setSelectedProfessionalId] = useState<number | null>(null);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [commissionRows, setCommissionRows] = useState<CommissionExportRow[]>([]);
  const [commissionTotals, setCommissionTotals] = useState<CommissionExportTotals>({
    caja: 0,
    comision: 0,
    pagado: 0,
    pendiente: 0,
  });
  const handleCommissionStatsChange = useCallback(
    (rows: CommissionExportRow[], totals: CommissionExportTotals) => {
      setCommissionRows(rows);
      setCommissionTotals(totals);
    },
    []
  );

  const trackingByAppointment = useMemo(() => {
    const map = new Map<number, TrackingResponse>();
    trackings.forEach((t) => { if (t.appointment_id) map.set(t.appointment_id, t); });
    return map;
  }, [trackings]);

  const loadProfessionals = useCallback(async () => {
    try {
      const data = await AgendaService.listProfessionalsForSelect({
        limit: 200,
        role_name: "Operaria",
        branch_id: activeBranchId ?? undefined,
      });
      setProfessionals(data);
    } catch (err) {
      console.error("Error cargando profesionales:", err);
      setProfessionals([]);
    }
  }, [activeBranchId]);

  const loadHistory = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const settled = await Promise.allSettled([
        AgendaService.listTickets({
          limit: 500,
          branch_id: activeBranchId ?? undefined,
          start_date: fromDate || undefined,
          end_date: toDate || undefined,
        }),
        TrackingService.list({ limit: 500 }),
      ]);

      if (settled[0].status === "fulfilled") {
        setTickets(settled[0].value);
      } else {
        console.error("Error cargando tickets:", settled[0].reason);
        setTickets([]);
        setError("No se pudo cargar el listado de tickets.");
      }

      if (settled[1].status === "fulfilled") {
        setTrackings(settled[1].value);
      } else {
        console.error("Error cargando trackings:", settled[1].reason);
        setTrackings([]);
      }
    } catch (err) {
      console.error("Error cargando historial:", err);
      setError("No se pudo cargar el listado de tickets.");
      setTickets([]);
    } finally {
      setIsLoading(false);
    }
  }, [activeBranchId, fromDate, toDate]);

  useEffect(() => { void loadProfessionals(); }, [loadProfessionals]);
  useEffect(() => { void loadHistory(); }, [loadHistory]);

  useEffect(() => {
    if (!isOperaria || !user?.id || professionals.length === 0) return;
    const own = professionals.find((p) => p.id === user.id);
    if (own) setSelectedProfessionalId(own.id);
  }, [isOperaria, user?.id, professionals]);

  useEffect(() => {
    const handleChange = () => setActiveBranchId(getSelectedBranchId());
    const handleStorage = (e: StorageEvent) => { if (e.key === BRANCH_STORAGE_KEY) handleChange(); };
    window.addEventListener("storage", handleStorage);
    window.addEventListener("branchchange", handleChange);
    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("branchchange", handleChange);
    };
  }, []);

  const professionalStats = useMemo(() => {
    const map = new Map<number, { name: string; count: number; completedCount: number; commission: number }>();
    professionals.forEach((p) =>
      map.set(p.id, { name: p.username, count: 0, completedCount: 0, commission: 0 })
    );
    tickets.forEach((ticket) => {
      if (!ticket.professional_id) return;
      const commission = getTicketCommission(ticket);
      const existing = map.get(ticket.professional_id);
      if (existing) {
        existing.count++;
        if (ticket.status === "completed") {
          existing.completedCount++;
          existing.commission += commission;
        }
      } else {
        map.set(ticket.professional_id, {
          name: ticket.professional_name ?? `#${ticket.professional_id}`,
          count: 1,
          completedCount: ticket.status === "completed" ? 1 : 0,
          commission,
        });
      }
    });
    return Array.from(map.entries())
      .map(([id, data]) => ({ id, ...data }))
      .sort((a, b) => b.commission - a.commission || b.completedCount - a.completedCount);
  }, [professionals, tickets]);

  const filteredTickets = useMemo(() => {
    return tickets.filter((ticket) => {
      if (selectedProfessionalId !== null && ticket.professional_id !== selectedProfessionalId) return false;
      return true;
    });
  }, [tickets, selectedProfessionalId]);

  const selectedProfName = useMemo(
    () => selectedProfessionalId !== null
      ? (professionalStats.find((p) => p.id === selectedProfessionalId)?.name ?? null)
      : null,
    [selectedProfessionalId, professionalStats]
  );

  const completedTickets = useMemo(
    () => filteredTickets.filter((t) => t.status === "completed"),
    [filteredTickets]
  );

  const totalRevenue = useMemo(
    () => completedTickets.reduce((s, t) => s + getTicketPriceTotal(t), 0),
    [completedTickets]
  );

  const totalCommission = useMemo(
    () => completedTickets.reduce((s, t) => s + getTicketCommission(t), 0),
    [completedTickets]
  );

  const columns = useMemo<DataTableColumn<TicketItem>[]>(() => [
    {
      key: "ticket_code",
      header: "Código",
      sortable: true,
      render: (t) => (
        <span className="font-mono text-xs font-semibold text-[#0078d4]">
          {t.ticket_code ?? `#${t.id}`}
        </span>
      ),
    },
    {
      key: "client_name",
      header: "Cliente",
      sortable: true,
      render: (t) => <span className="font-semibold text-slate-800">{t.client_name || "Sin cliente"}</span>,
    },
    {
      key: "service_label",
      header: "Servicio(s)",
      sortable: true,
      getValue: (t) => t.service_names?.join(" · ") ?? (t.service_name ?? ""),
      render: (t) => (
        <span className="text-xs text-[#323130]">
          {t.service_names?.length ? t.service_names.join(" · ") : (t.service_name ?? "Sin servicio")}
        </span>
      ),
    },
    {
      key: "professional_name",
      header: "Operaria",
      sortable: true,
      render: (t) => (
        <span className={`text-xs ${t.professional_name ? "font-medium text-[#323130]" : "text-[#a19f9d]"}`}>
          {t.professional_name ?? "Sin asignar"}
        </span>
      ),
    },
    {
      key: "start_time",
      header: "Fecha",
      sortable: true,
      getValue: (t) => t.start_time ?? "",
      render: (t) =>
        t.start_time ? (
          <div className="text-xs">
            <p className="font-medium text-[#323130]">
              {new Date(t.start_time).toLocaleDateString("es-BO", { day: "2-digit", month: "short", year: "numeric" })}
            </p>
            <p className="text-[#605e5c]">
              {new Date(t.start_time).toLocaleTimeString("es-BO", { hour: "2-digit", minute: "2-digit" })}
            </p>
          </div>
        ) : <span className="text-[#a19f9d]">—</span>,
    },
    {
      key: "duration",
      header: "Duración",
      getValue: (t) => t.start_time,
      render: (t) => (
        <span className="text-xs text-[#605e5c]">{getDurationLabel(t.start_time, t.end_time)}</span>
      ),
    },
    {
      key: "status",
      header: "Estado",
      sortable: true,
      render: (t) => (
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold capitalize ${STATUS_BADGE[t.status] ?? "bg-slate-100 text-slate-600"}`}>
          {STATUS_LABELS[t.status] ?? t.status}
        </span>
      ),
    },
    {
      key: "price",
      header: "Precio",
      sortable: true,
      getValue: (t) => String(getTicketPriceTotal(t)),
      render: (t) => {
        const total = getTicketPriceTotal(t);
        return (
          <span className={`text-xs font-semibold tabular-nums ${total > 0 ? "text-emerald-700" : "text-[#a19f9d]"}`}>
            {total > 0 ? moneyFormatter.format(total) : "—"}
          </span>
        );
      },
    },
    {
      key: "commission",
      header: "Comisión",
      sortable: true,
      getValue: (t) => String(getTicketCommission(t)),
      render: (t) => {
        if (t.status !== "completed") {
          return <span className="text-xs text-[#a19f9d]">—</span>;
        }
        const commission = getTicketCommission(t);
        return (
          <span className={`text-xs font-semibold tabular-nums ${commission > 0 ? "text-[#0050a0]" : "text-[#a19f9d]"}`}>
            {commission > 0 ? moneyFormatter.format(commission) : "—"}
          </span>
        );
      },
    },
    {
      key: "branch_name",
      header: "Sucursal",
      sortable: true,
      render: (t) => (
        <span className="text-xs text-[#605e5c]">{t.branch_name ?? "—"}</span>
      ),
    },
    {
      key: "notes",
      header: "Notas",
      getValue: (t) => trackingByAppointment.get(t.id)?.design_notes?.trim() ?? "",
      render: (t) => {
        const notes = trackingByAppointment.get(t.id)?.design_notes?.trim();
        return notes ? (
          <span className="line-clamp-2 max-w-45 text-xs text-[#323130]" title={notes}>{notes}</span>
        ) : (
          <span className="text-xs text-[#a19f9d]">—</span>
        );
      },
    },
    {
      key: "questionnaire",
      header: "Cuestionario",
      getValue: (t) => trackingByAppointment.get(t.id)?.questionnaire?.title ?? "",
      render: (t) => {
        const q = trackingByAppointment.get(t.id)?.questionnaire?.title;
        return q ? (
          <span className="text-xs text-[#0078d4]">{q}</span>
        ) : (
          <span className="text-xs text-[#a19f9d]">—</span>
        );
      },
    },
  ], [trackingByAppointment]);

  // Rango de fechas en texto, para el subtítulo del PDF — igual en las dos
  // pestañas ya que ambas comparten los mismos filtros de arriba.
  const dateRangeLabel = fromDate || toDate
    ? ` · ${fromDate ? new Date(fromDate).toLocaleDateString("es-BO") : "inicio"} — ${toDate ? new Date(toDate).toLocaleDateString("es-BO") : "hoy"}`
    : "";

  const handleDownloadPdfTickets = () => {
    void generateTablePdf({
      title: "Historial de tickets",
      subtitle: (selectedProfName ? `Operaria: ${selectedProfName}` : "Todas las operarias") + dateRangeLabel,
      filename: "historial-tickets",
      orientation: "landscape",
      meta: [
        { label: "Tickets", value: String(filteredTickets.length) },
        { label: "Completados", value: String(completedTickets.length) },
        { label: "Ingresos", value: moneyFormatter.format(totalRevenue) },
        { label: "Comisiones", value: moneyFormatter.format(totalCommission) },
      ],
      columns: [
        { header: "Código", key: "ticket_code" },
        { header: "Cliente", key: "client_name" },
        { header: "Servicio(s)", key: "services" },
        { header: "Operaria", key: "professional_name" },
        { header: "Fecha", key: "fecha" },
        { header: "Hora", key: "hora" },
        { header: "Estado", key: "status" },
        { header: "Precio", key: "precio" },
        { header: "Comisión", key: "comision" },
        { header: "Sucursal", key: "branch_name" },
      ],
      rows: filteredTickets.map((t) => ({
        ticket_code: t.ticket_code ?? `#${t.id}`,
        client_name: t.client_name,
        services: t.service_names?.join(" · ") ?? t.service_name ?? "",
        professional_name: t.professional_name ?? "Sin asignar",
        fecha: t.start_time ? new Date(t.start_time).toLocaleDateString("es-BO") : "",
        hora: t.start_time
          ? new Date(t.start_time).toLocaleTimeString("es-BO", { hour: "2-digit", minute: "2-digit" })
          : "",
        status: STATUS_LABELS[t.status] ?? t.status,
        precio: getTicketPriceTotal(t) > 0 ? moneyFormatter.format(getTicketPriceTotal(t)) : "—",
        comision: t.status === "completed" && getTicketCommission(t) > 0
          ? moneyFormatter.format(getTicketCommission(t))
          : "—",
        branch_name: t.branch_name ?? "",
      })),
    });
  };

  const handleDownloadPdfComisiones = () => {
    void generateTablePdf({
      title: "Comisiones y pagos — detalle de citas",
      subtitle: (selectedProfName ? `Operaria: ${selectedProfName}` : "Todas las operarias") + dateRangeLabel,
      filename: "comisiones-y-pagos",
      orientation: "landscape",
      meta: [
        { label: "Citas", value: String(commissionRows.length) },
        { label: "Caja", value: moneyFormatter.format(commissionTotals.caja) },
        { label: "Comisiones", value: moneyFormatter.format(commissionTotals.comision) },
        { label: "Pagado", value: moneyFormatter.format(commissionTotals.pagado) },
        { label: "Pendiente", value: moneyFormatter.format(commissionTotals.pendiente) },
      ],
      columns: [
        { header: "Operaria", key: "professional_name" },
        { header: "Cliente", key: "client_name" },
        { header: "Servicio(s)", key: "services" },
        { header: "Fecha", key: "fecha" },
        { header: "Hora", key: "hora" },
        { header: "Estado", key: "status" },
        { header: "Caja", key: "caja" },
        { header: "Comisión", key: "comision" },
      ],
      rows: commissionRows.map((r) => ({
        professional_name: r.professional_name,
        client_name: r.client_name,
        services: r.services,
        fecha: r.fecha,
        hora: r.hora,
        status: r.status,
        caja: r.caja > 0 ? moneyFormatter.format(r.caja) : "—",
        comision: r.comision > 0 ? moneyFormatter.format(r.comision) : "—",
      })),
    });
  };

  const handleDownloadPdf = () => {
    if (activeTab === "comisiones") {
      handleDownloadPdfComisiones();
    } else {
      handleDownloadPdfTickets();
    }
  };

  const renderToolbar = () => (
    <FilterActionBar
      left={<h2 className="text-lg font-semibold text-slate-800">Comisiones por operaria</h2>}
      right={
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={handleDownloadPdf}
            disabled={activeTab === "comisiones" ? commissionRows.length === 0 : filteredTickets.length === 0}
            leftIcon={<Download className="h-3.5 w-3.5" />}
          >
            PDF
          </Button>
          <Button variant="secondary" size="sm" onClick={() => void loadHistory()}>Actualizar</Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => { setFromDate(""); setToDate(""); setSelectedProfessionalId(null); }}
          >
            Limpiar filtros
          </Button>
        </div>
      }
    />
  );

  return (
    <Layout
      title="Comisiones por operaria"
      subtitle="Rendimiento y comisiones por operaria. Incluye registro de pagos y liquidación de comisiones."
      variant="cards"
      toolbar={renderToolbar()}
    >
      {/* ── Tabs: Historial de tickets | Comisiones ───────────────────────── */}
      <div className="flex gap-1 rounded-xl border border-[#edebe9] bg-[#f3f2f1] p-1 w-fit">
        <button
          type="button"
          onClick={() => setActiveTab("tickets")}
          className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-semibold transition-all ${
            activeTab === "tickets"
              ? "bg-white text-[#323130] shadow-sm ring-1 ring-black/5"
              : "text-[#605e5c] hover:bg-white/50"
          }`}
        >
          <List className="h-3.5 w-3.5" />
          Historial de tickets
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("comisiones")}
          className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-semibold transition-all ${
            activeTab === "comisiones"
              ? "bg-white text-[#323130] shadow-sm ring-1 ring-black/5"
              : "text-[#605e5c] hover:bg-white/50"
          }`}
        >
          <Banknote className="h-3.5 w-3.5" />
          Comisiones y pagos
        </button>
      </div>

      {/* ── Filtros (compartidos entre las dos pestañas: operaria, estado,
           rango de fechas) ─────────────────────────────────────────────── */}
      <SectionCard bodyClassName="!p-4">
        <div className="grid gap-3 rounded-sm border border-[#d2d0ce] bg-[#faf9f8] p-3 sm:grid-cols-3">
          {/* Operaria */}
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-[#605e5c]">Operaria</label>
            {canSeeCards ? (
              <div className="mt-1 flex items-center gap-1.5">
                <select
                  value={selectedProfessionalId ?? ""}
                  onChange={(e) => setSelectedProfessionalId(e.target.value ? Number(e.target.value) : null)}
                  disabled={isLoading && professionalStats.length === 0}
                  className={`${fieldClass} flex-1 min-w-0`}
                >
                  <option value="">Todas las operarias</option>
                  {professionalStats.map(({ id, name, completedCount, commission }) => (
                    <option key={id} value={id}>
                      {name}
                      {completedCount > 0 ? ` — ${completedCount} completado${completedCount !== 1 ? "s" : ""}` : ""}
                      {commission > 0 ? `  (${moneyFormatter.format(commission)})` : ""}
                    </option>
                  ))}
                </select>
                {selectedProfessionalId !== null && (
                  <button
                    type="button"
                    onClick={() => setSelectedProfessionalId(null)}
                    title="Ver todas"
                    className="flex shrink-0 items-center rounded-md border border-[#d2d0ce] bg-white p-2 text-[#605e5c] hover:bg-[#f3f2f1]"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            ) : (
              <select
                value={selectedProfessionalId ?? ""}
                onChange={(e) => setSelectedProfessionalId(e.target.value ? Number(e.target.value) : null)}
                className={`${fieldClass} mt-1`}
              >
                <option value="">Todas</option>
                {professionals.map((p) => (
                  <option key={p.id} value={p.id}>{p.username}</option>
                ))}
              </select>
            )}
          </div>

          {/* Desde */}
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-[#605e5c]">Desde</label>
            <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className={`${fieldClass} mt-1`} />
          </div>

          {/* Hasta */}
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-[#605e5c]">Hasta</label>
            <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className={`${fieldClass} mt-1`} />
          </div>
        </div>
      </SectionCard>

      {/* ── Pestaña: Comisiones ─────────────────────────────────────────── */}
      {activeTab === "comisiones" && (
        <CommissionPaymentsTab
          professionals={professionals}
          tickets={filteredTickets}
          fromDate={fromDate}
          toDate={toDate}
          selectedProfessionalId={selectedProfessionalId}
          onStatsChange={handleCommissionStatsChange}
        />
      )}

      {/* ── Contenido de pestaña tickets ─────────────────────────────────── */}
      {activeTab === "tickets" && (
        <>
      {/* ── Stats ────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <StatCard label="Total tickets" value={filteredTickets.length} tone="slate" />
        <StatCard label="Completados" value={completedTickets.length} tone="emerald" />
        <StatCard
          label="En curso"
          value={filteredTickets.filter((t) => t.status === "in_service" || t.status === "pending").length}
          tone="amber"
        />
        <StatCard label="Ingresos (completados)" value={moneyFormatter.format(totalRevenue)} tone="emerald" />
        <StatCard label="Comisiones" value={moneyFormatter.format(totalCommission)} tone="blue" />
      </div>

      {/* ── Tabla de tickets ─────────────────────────────────────────────── */}
      <SectionCard bodyClassName="!p-0">
        {error ? <div className="border-b border-[#edebe9] p-4 text-sm text-rose-600">{error}</div> : null}

        <DataTable
          data={filteredTickets}
          columns={columns}
          loading={isLoading}
          enableGlobalSearch={false}
          enableColumnFilters={false}
          defaultLimit={25}
          tableMinWidth="min-w-[1200px]"
        />
      </SectionCard>
        </>
      )}
    </Layout>
  );
}
