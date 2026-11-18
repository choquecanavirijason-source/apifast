import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Banknote, CheckCircle2, Download, List, X } from "lucide-react";
import CommissionPaymentsTab from "./CommissionPaymentsTab";
import { AgendaService, type ProfessionalForSelect, type TicketItem } from "@/core/services/agenda/agenda.service";
import { TrackingService, type TrackingResponse } from "@/core/services/tracking/tracking.service";
import { fetchAllPages } from "@/core/utils/fetchAllPages";
import { BRANCH_STORAGE_KEY, getSelectedBranchId } from "@/core/utils/branch";
import useAuth from "@/core/hooks/useAuth";
import GuidedTour, { TourHelpButton, useGuidedTour } from "@/components/common/tour/GuidedTour";
import { buildCommissionsTour } from "@/components/common/tour/tours";
import Layout from "@/components/common/layout";
import FilterActionBar from "@/components/common/FilterActionBar";
import { Button, SectionCard, SegmentedTabs, StatCard } from "@/components/common/ui";
import DataTable, { type DataTableColumn } from "@/components/common/table/DataTable";
import { generateTablePdf } from "@/core/utils/generateTablePdf";
import {
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
  "w-full rounded-lg border border-[var(--ui-border-strong)] bg-white px-3 py-2 text-sm text-[var(--ui-text)] placeholder:text-[var(--ui-text-muted)] outline-none transition focus:border-brand-secondary focus:ring-1 focus:ring-brand-secondary/35 disabled:bg-[var(--ui-surface-muted)] disabled:text-[var(--ui-text-muted)]";


const STATUS_LABELS: Record<string, string> = {
  pending: "Pendiente",
  waiting: "En espera",
  in_service: "En servicio",
  completed: "Completado",
  cancelled: "Cancelado",
  confirmed: "Confirmado",
};

// Estados en grises: lo que cuenta es el texto de la etiqueta; el color solo distingue "terminado" (oscuro)
// de "en curso" (claro) y "cancelado" (apagado), para no saturar la tabla.
const STATUS_BADGE: Record<string, string> = {
  pending: "bg-slate-100 text-slate-700",
  waiting: "bg-slate-100 text-slate-700",
  in_service: "bg-slate-100 text-slate-700",
  completed: "bg-slate-800 text-white",
  cancelled: "bg-slate-100 text-slate-400 line-through",
  confirmed: "bg-slate-100 text-slate-700",
};

const moneyFormatter = new Intl.NumberFormat("es-BO", {
  style: "currency",
  currency: "BOB",
  maximumFractionDigits: 2,
});


// Fila con la comisión pagada: verde suave del tema (acento mezclado con la
// superficie, opaco) — el texto oscuro normal conserva buen contraste.
const PAID_ROW_CLASS = "bg-slate-50";

// Recorta microsegundos ("...12.345678+00:00") para que cualquier navegador lo parsee.
const parseIso = (iso: string) => new Date(iso.replace(/(\.\d{3})\d+/, "$1"));

const paidDateLabel = (iso?: string | null) =>
  iso
    ? parseIso(iso).toLocaleDateString("es-BO", { day: "2-digit", month: "2-digit", year: "numeric" })
    : "";

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
  const { user, isAdmin, hasRole, hasPermissionByName } = useAuth();
  const canSeeCards = isAdmin() || hasRole("Operaria");
  const isOperaria = hasRole("Operaria") && !isAdmin();
  const canPay = isAdmin() || hasPermissionByName("commissions:pay");
  const canVoid = isAdmin() || hasPermissionByName("commissions:void");

  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<"tickets" | "comisiones">(() => (searchParams.get("tab") === "comisiones" ? "comisiones" : "tickets"));
  // Orden de la tabla: lo más reciente primero (se puede cambiar tocando el encabezado).
  const [ticketSort, setTicketSort] = useState<{ key: string; direction: "asc" | "desc" }>({ key: "start_time", direction: "desc" });
  const tour = useGuidedTour("equipo-comisiones", user?.id);
  const tourSteps = useMemo(() => buildCommissionsTour(setActiveTab), []);
  const [tickets, setTickets] = useState<TicketItem[]>([]);
  const [trackings, setTrackings] = useState<TrackingResponse[]>([]);
  const [professionals, setProfessionals] = useState<ProfessionalForSelect[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [activeBranchId, setActiveBranchId] = useState<number | null>(() => getSelectedBranchId());
  const [selectedProfessionalId, setSelectedProfessionalId] = useState<number | null>(null);
  const isoDay = (value: string | null) => (value && /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(value) ? value : "");
  const [fromDate, setFromDate] = useState(() => isoDay(searchParams.get("desde")));
  const [toDate, setToDate] = useState(() => isoDay(searchParams.get("hasta")));
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

  // Atajos de período: hoy, ayer, esta semana (desde el lunes) y todo.
  const periodShortcuts = useMemo(() => {
    const fmt = (d: Date) => d.toLocaleDateString("en-CA");
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const monday = new Date(now);
    monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
    return [
      { label: "Hoy", from: fmt(now), to: fmt(now) },
      { label: "Ayer", from: fmt(yesterday), to: fmt(yesterday) },
      { label: "Esta semana", from: fmt(monday), to: fmt(now) },
      { label: "Todo", from: "", to: "" },
    ];
  }, []);

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
        // Todas las páginas: con un tope fijo, un rango largo cortaba tickets y cambiaba los totales de comisión.
        fetchAllPages((skip, limit) =>
          AgendaService.listTickets({
            skip,
            limit,
            branch_id: activeBranchId ?? undefined,
            start_date: fromDate || undefined,
            end_date: toDate || undefined,
          }), 500
        ),
        fetchAllPages((skip, limit) => TrackingService.list({ skip, limit }), 500),
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

  const totalPaidCommission = useMemo(
    () => filteredTickets.reduce((s, t) => s + (t.pagado ? (t.pagado_monto ?? getTicketCommission(t)) : 0), 0),
    [filteredTickets],
  );

  const columns = useMemo<DataTableColumn<TicketItem>[]>(() => [
    {
      key: "ticket_code",
      header: "Código",
      sortable: true,
      render: (t) => (
        <span className="font-mono text-xs font-semibold text-[var(--ui-accent)]">
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
        <span className="text-xs text-[var(--ui-text)]">
          {t.service_names?.length ? t.service_names.join(" · ") : (t.service_name ?? "Sin servicio")}
        </span>
      ),
    },
    {
      key: "professional_name",
      header: "Operaria",
      sortable: true,
      render: (t) => (
        <span className={`text-xs ${t.professional_name ? "font-medium text-[var(--ui-text)]" : "text-[var(--ui-text-muted)]"}`}>
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
            <p className="font-medium text-[var(--ui-text)]">
              {new Date(t.start_time).toLocaleDateString("es-BO", { day: "2-digit", month: "short", year: "numeric" })}
            </p>
            <p className="text-[var(--ui-text-muted)]">
              {new Date(t.start_time).toLocaleTimeString("es-BO", { hour: "2-digit", minute: "2-digit" })}
            </p>
          </div>
        ) : <span className="text-[var(--ui-text-muted)]">—</span>,
    },
    {
      key: "duration",
      header: "Duración",
      getValue: (t) => t.start_time,
      render: (t) => (
        <span className="text-xs text-[var(--ui-text-muted)]">{getDurationLabel(t.start_time, t.end_time)}</span>
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
          <span className={`text-xs font-semibold tabular-nums ${total > 0 ? "text-[var(--ui-text)]" : "text-[var(--ui-text-muted)]"}`}>
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
          return <span className="text-xs text-[var(--ui-text-muted)]">—</span>;
        }
        const commission = getTicketCommission(t);
        return (
          <span className={`text-xs font-semibold tabular-nums ${commission > 0 ? "text-[var(--ui-accent)]" : "text-[var(--ui-text-muted)]"}`}>
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
        <span className="text-xs text-[var(--ui-text-muted)]">{t.branch_name ?? "—"}</span>
      ),
    },
    {
      key: "notes",
      header: "Notas",
      getValue: (t) => trackingByAppointment.get(t.id)?.design_notes?.trim() ?? "",
      render: (t) => {
        const notes = trackingByAppointment.get(t.id)?.design_notes?.trim();
        return notes ? (
          <span className="line-clamp-2 max-w-45 text-xs text-[var(--ui-text)]" title={notes}>{notes}</span>
        ) : (
          <span className="text-xs text-[var(--ui-text-muted)]">—</span>
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
          <span className="text-xs text-[var(--ui-accent)]">{q}</span>
        ) : (
          <span className="text-xs text-[var(--ui-text-muted)]">—</span>
        );
      },
    },
    {
      key: "pago",
      header: "Pago",
      sortable: true,
      getValue: (t) => (t.pagado ? "Pagado" : t.status === "completed" ? "Pendiente" : ""),
      render: (t) => {
        if (t.pagado) {
          const detail = [
            t.pagado_en ? `Pagado el ${paidDateLabel(t.pagado_en)}` : "Pagado",
            t.pagado_por_nombre ? `por ${t.pagado_por_nombre}` : "",
          ].filter(Boolean).join(" ");
          return (
            <span
              className="inline-flex items-center gap-1 rounded-full bg-slate-800 px-2 py-0.5 text-[10px] font-bold text-white"
              title={detail}
            >
              <CheckCircle2 className="h-3 w-3" />
              Pagado
            </span>
          );
        }
        if (t.status === "completed") {
          return (
            <span className="text-[11px] text-[var(--ui-text-muted)]" title="La comisión de este servicio todavía no se paga. Se paga en Comisiones y pagos.">
              Pendiente
            </span>
          );
        }
        return <span className="text-[11px] text-[var(--ui-text-muted)]">—</span>;
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
        { label: "Comisiones pagadas", value: moneyFormatter.format(totalPaidCommission) },
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
        { header: "Pago", key: "pago" },
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
        pago: t.pagado
          ? `Pagado ${paidDateLabel(t.pagado_en)}`.trim()
          : t.status === "completed" && getTicketCommission(t) > 0
            ? "Pendiente"
            : "—",
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
          <TourHelpButton onClick={tour.start} className="!h-8" />
          <Button
            data-tour="cm-pdf"
            variant="secondary"
            size="sm"
            onClick={handleDownloadPdf}
            disabled={activeTab === "comisiones" ? commissionRows.length === 0 : filteredTickets.length === 0}
            leftIcon={<Download className="h-3.5 w-3.5" />}
          >
            PDF
          </Button>
          <Button data-tour="cm-refresh" variant="secondary" size="sm" onClick={() => void loadHistory()}>Actualizar</Button>
          <Button
            data-tour="cm-clear"
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
      <SegmentedTabs
        dataTour="cm-tabs"
        options={[
          { id: "tickets", label: "Historial de tickets", icon: <List className="h-3.5 w-3.5" /> },
          { id: "comisiones", label: "Comisiones y pagos", icon: <Banknote className="h-3.5 w-3.5" /> },
        ]}
        value={activeTab}
        onChange={setActiveTab}
      />

      {/* ── Filtros (compartidos entre las dos pestañas: operaria, estado,
           rango de fechas) ─────────────────────────────────────────────── */}
      <SectionCard bodyClassName="!p-4">
        <div data-tour="cm-filters" className="grid gap-3 rounded-lg border border-[var(--ui-border-strong)] bg-[var(--ui-surface-muted)] p-3 sm:grid-cols-3">
          {/* Operaria */}
          <div>
            <label className="text-xs font-semibold text-[var(--ui-text-muted)]">Operaria</label>
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
                    className="flex shrink-0 items-center rounded-md border border-[var(--ui-border-strong)] bg-white p-2 text-[var(--ui-text-muted)] hover:bg-[var(--ui-surface-hover)]"
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
            <label className="text-xs font-semibold text-[var(--ui-text-muted)]">Desde</label>
            <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className={`${fieldClass} mt-1`} />
          </div>

          {/* Hasta */}
          <div>
            <label className="text-xs font-semibold text-[var(--ui-text-muted)]">Hasta</label>
            <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className={`${fieldClass} mt-1`} />
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-1.5" data-tour="cm-periods">
          <span className="text-xs font-semibold text-[var(--ui-text-muted)]">Período:</span>
          {periodShortcuts.map(({ label, from, to }) => {
            const active = fromDate === from && toDate === to;
            return (
              <button
                key={label}
                type="button"
                aria-pressed={active}
                onClick={() => { setFromDate(from); setToDate(to); }}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                  active
                    ? "border-slate-800 bg-slate-800 text-white"
                    : "border-[var(--ui-border-strong)] bg-white text-[var(--ui-text-muted)] hover:bg-[var(--ui-surface-hover)]"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
        {fromDate && toDate && fromDate > toDate ? (
          <p role="alert" className="mt-2 text-xs font-medium text-slate-700">
            La fecha “Desde” es posterior a “Hasta”: no habrá resultados. Corrige el rango.
          </p>
        ) : null}
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
          canPay={canPay}
          canVoid={canVoid}
          onChanged={loadHistory}
        />
      )}

      {/* ── Contenido de pestaña tickets ─────────────────────────────────── */}
      {activeTab === "tickets" && (
        <>
      {/* ── Stats ────────────────────────────────────────────────────────── */}
      <div data-tour="cm-stats" className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <StatCard label="Total tickets" value={filteredTickets.length} tone="slate" />
        <StatCard label="Completados" value={completedTickets.length} tone="slate" />
        <StatCard
          label="En curso"
          value={filteredTickets.filter((t) => t.status === "in_service" || t.status === "pending").length}
          tone="slate"
        />
        <StatCard label="Ingresos (completados)" value={moneyFormatter.format(totalRevenue)} tone="slate" />
        <StatCard label="Comisiones" value={moneyFormatter.format(totalCommission)} tone="slate" />
      </div>

      {/* ── Tabla de tickets ─────────────────────────────────────────────── */}
      <SectionCard bodyClassName="!p-0">
        {error ? <div className="border-b border-[var(--ui-border)] p-4 text-sm text-rose-600">{error}</div> : null}

        <DataTable
          data={filteredTickets}
          columns={columns}
          loading={isLoading}
          enableGlobalSearch={false}
          enableColumnFilters={false}
          defaultLimit={25}
          tableMinWidth="min-w-[1280px]"
          rowClassName={(t) => (t.pagado ? PAID_ROW_CLASS : undefined)}
          sort={ticketSort}
          onSortChange={(key, direction) => setTicketSort({ key, direction })}
          resetPageKey={`${selectedProfessionalId ?? "all"}|${fromDate}|${toDate}`}
        />
      </SectionCard>
        </>
      )}

      {tour.open && <GuidedTour steps={tourSteps} storageKey={tour.storageKey} onClose={tour.close} />}

    </Layout>
  );
}
