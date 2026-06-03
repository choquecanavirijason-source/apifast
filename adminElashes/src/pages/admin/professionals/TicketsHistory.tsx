import { useCallback, useEffect, useMemo, useState } from "react";
import { BarChart2, ClipboardList, Download, List, Package, Search } from "lucide-react";
import { AgendaService, type ProfessionalForSelect, type TicketItem } from "@/core/services/agenda/agenda.service";
import { TrackingService, type TrackingResponse } from "@/core/services/tracking/tracking.service";
import { BRANCH_STORAGE_KEY, getSelectedBranchId } from "@/core/utils/branch";
import Layout from "@/components/common/layout";
import FilterActionBar from "@/components/common/FilterActionBar";
import { Button, SectionCard, StatCard } from "@/components/common/ui";
import DataTable, { type DataTableColumn } from "@/components/common/table/DataTable";
import { generateTablePdf } from "@/core/utils/generateTablePdf";

const fieldClass =
  "w-full rounded-sm border border-[#8a8886] bg-white px-3 py-2 text-sm text-[#323130] placeholder:text-[#a19f9d] outline-none transition focus:border-[#0078d4] focus:ring-1 focus:ring-[#0078d4]/35 disabled:bg-[#f3f2f1] disabled:text-[#a19f9d]";

const STATUS_LABELS: Record<string, string> = {
  pending: "Pendiente",
  waiting: "En espera",
  in_service: "En servicio",
  completed: "Completado",
  cancelled: "Cancelado",
  confirmed: "Confirmado",
};

const STATUS_BADGE: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800 border-amber-200",
  waiting: "bg-blue-100 text-blue-800 border-blue-200",
  in_service: "bg-green-100 text-green-800 border-green-200",
  completed: "bg-emerald-100 text-emerald-800 border-emerald-200",
  cancelled: "bg-rose-100 text-rose-800 border-rose-200",
  confirmed: "bg-violet-100 text-violet-800 border-violet-200",
};

const STATUS_STAT: Record<string, { label: string; tone: string }> = {
  completed: { label: "Completados", tone: "emerald" },
  in_service: { label: "En servicio", tone: "amber" },
  pending: { label: "Pendientes", tone: "amber" },
  cancelled: { label: "Cancelados", tone: "slate" },
};

const moneyFormatter = new Intl.NumberFormat("es-BO", {
  style: "currency",
  currency: "BOB",
  maximumFractionDigits: 2,
});

function getDuration(start: string, end: string) {
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

function getPrice(ticket: TicketItem): number {
  if (ticket.service_prices?.length)
    return ticket.service_prices.reduce((s, p) => s + (Number.isFinite(p) ? p : 0), 0);
  if (typeof ticket.service_price === "number" && Number.isFinite(ticket.service_price))
    return ticket.service_price;
  return 0;
}

export default function TicketsHistoryPage() {
  const [tickets, setTickets] = useState<TicketItem[]>([]);
  const [trackings, setTrackings] = useState<TrackingResponse[]>([]);
  const [professionals, setProfessionals] = useState<ProfessionalForSelect[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [activeBranchId, setActiveBranchId] = useState<number | null>(() => getSelectedBranchId());
  const [activeTab, setActiveTab] = useState<"tickets" | "servicios">("tickets");
  const [search, setSearch] = useState("");
  const [professionalFilter, setProfessionalFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const trackingByAppointment = useMemo(() => {
    const map = new Map<number, TrackingResponse>();
    trackings.forEach((t) => { if (t.appointment_id) map.set(t.appointment_id, t); });
    return map;
  }, [trackings]);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [ticketsResult, trackingsResult] = await Promise.allSettled([
        AgendaService.listTickets({
          limit: 500,
          branch_id: activeBranchId ?? undefined,
          start_date: fromDate || undefined,
          end_date: toDate || undefined,
        }),
        TrackingService.list({ limit: 500 }),
      ]);
      setTickets(ticketsResult.status === "fulfilled" ? ticketsResult.value : []);
      setTrackings(trackingsResult.status === "fulfilled" ? trackingsResult.value : []);
      if (ticketsResult.status === "rejected") {
        console.error("Error cargando tickets:", ticketsResult.reason);
        setError("No se pudo cargar el historial de tickets.");
      }
    } catch (err) {
      console.error("Error:", err);
      setError("No se pudo cargar el historial de tickets.");
    } finally {
      setIsLoading(false);
    }
  }, [activeBranchId, fromDate, toDate]);

  useEffect(() => {
    void AgendaService.listProfessionalsForSelect({ limit: 200, role_name: "Operaria" })
      .then(setProfessionals)
      .catch(() => setProfessionals([]));
  }, []);

  useEffect(() => { void loadData(); }, [loadData]);

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

  const filteredTickets = useMemo(() => {
    const term = search.trim().toLowerCase();
    const profId = professionalFilter ? Number(professionalFilter) : null;
    return tickets.filter((t) => {
      if (profId !== null && t.professional_id !== profId) return false;
      if (statusFilter && t.status !== statusFilter) return false;
      if (!term) return true;
      const services = (t.service_names?.join(" ") ?? t.service_name ?? "").toLowerCase();
      return (
        t.client_name?.toLowerCase().includes(term) ||
        services.includes(term) ||
        t.professional_name?.toLowerCase().includes(term) ||
        t.ticket_code?.toLowerCase().includes(term) ||
        t.branch_name?.toLowerCase().includes(term) ||
        (STATUS_LABELS[t.status] ?? t.status).toLowerCase().includes(term)
      );
    });
  }, [tickets, search, professionalFilter, statusFilter]);

  const totalRevenue = useMemo(
    () => filteredTickets.reduce((s, t) => s + getPrice(t), 0),
    [filteredTickets]
  );

  // Resumen de uso por servicio: nombre → { tickets, completados, ingresoTotal }
  const serviceStats = useMemo(() => {
    const map = new Map<string, { count: number; completed: number; revenue: number }>();
    for (const t of filteredTickets) {
      const names = t.service_names?.length ? t.service_names : (t.service_name ? [t.service_name] : []);
      const prices = t.service_prices?.length ? t.service_prices : (t.service_price != null ? [t.service_price] : []);
      names.forEach((name, i) => {
        const prev = map.get(name) ?? { count: 0, completed: 0, revenue: 0 };
        map.set(name, {
          count: prev.count + 1,
          completed: prev.completed + (t.status === "completed" ? 1 : 0),
          revenue: prev.revenue + (t.status === "completed" ? (prices[i] ?? 0) : 0),
        });
      });
    }
    return Array.from(map.entries())
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.count - a.count);
  }, [filteredTickets]);

  // Consumo estimado de inventario por tipo de servicio
  const INVENTORY_ESTIMATE: Record<string, { adhesivo: string; pestañas: string; otros: string }> = {
    "extensiones clásicas":   { adhesivo: "~2 ml",  pestañas: "1 set (0.07mm)",  otros: "—" },
    "extensiones volumen 3d": { adhesivo: "~2 ml",  pestañas: "2 sets (0.07mm)", otros: "—" },
    "extensiones volumen 5d": { adhesivo: "~3 ml",  pestañas: "3 sets (0.07mm)", otros: "—" },
    "retoque de extensiones": { adhesivo: "~1 ml",  pestañas: "0.5 set",         otros: "—" },
    "remoción de extensiones":{ adhesivo: "—",      pestañas: "—",               otros: "~5 ml removedor" },
    "lifting de pestañas":    { adhesivo: "—",      pestañas: "—",               otros: "1 kit lifting" },
    "permanente de pestañas": { adhesivo: "—",      pestañas: "—",               otros: "1 kit permanente" },
    "tratamiento de queratina":{ adhesivo: "—",     pestañas: "—",               otros: "~3 ml queratina" },
  };

  const getInventoryEstimate = (serviceName: string) =>
    INVENTORY_ESTIMATE[serviceName.toLowerCase()] ?? null;

  const availableStatuses = useMemo(
    () => Array.from(new Set(tickets.map((t) => t.status).filter(Boolean))).sort(),
    [tickets]
  );

  const columns = useMemo<DataTableColumn<TicketItem>[]>(() => [
    {
      key: "ticket_code",
      header: "Código",
      sortable: true,
      render: (t) => (
        <span className="font-mono text-xs font-bold text-[#0078d4]">
          {t.ticket_code ?? `#${t.id}`}
        </span>
      ),
    },
    {
      key: "client_name",
      header: "Cliente",
      sortable: true,
      render: (t) => (
        <div>
          <p className="font-semibold text-slate-800">{t.client_name || "Sin cliente"}</p>
          {t.branch_name && <p className="text-[10px] text-[#a19f9d]">{t.branch_name}</p>}
        </div>
      ),
    },
    {
      key: "service_label",
      header: "Servicio(s)",
      sortable: true,
      getValue: (t) => t.service_names?.join(" · ") ?? (t.service_name ?? ""),
      render: (t) => (
        <span className="text-xs text-[#323130]">
          {t.service_names?.length ? t.service_names.join(" · ") : (t.service_name ?? <span className="text-[#a19f9d]">Sin servicio</span>)}
        </span>
      ),
    },
    {
      key: "professional_name",
      header: "Operaria",
      sortable: true,
      render: (t) =>
        t.professional_name ? (
          <span className="rounded-full bg-[#f3f2f1] px-2 py-0.5 text-xs font-medium text-[#323130]">
            {t.professional_name}
          </span>
        ) : (
          <span className="text-xs text-[#a19f9d]">Sin asignar</span>
        ),
    },
    {
      key: "start_time",
      header: "Fecha / Hora",
      sortable: true,
      getValue: (t) => t.start_time ?? "",
      render: (t) =>
        t.start_time ? (
          <div className="text-xs">
            <p className="font-semibold text-[#323130]">
              {new Date(t.start_time).toLocaleDateString("es-BO", { day: "2-digit", month: "short", year: "numeric" })}
            </p>
            <p className="text-[#605e5c]">
              {new Date(t.start_time).toLocaleTimeString("es-BO", { hour: "2-digit", minute: "2-digit" })}
            </p>
          </div>
        ) : <span className="text-xs text-[#a19f9d]">—</span>,
    },
    {
      key: "duration",
      header: "Duración",
      getValue: (t) => t.start_time,
      render: (t) => <span className="text-xs text-[#605e5c]">{getDuration(t.start_time, t.end_time)}</span>,
    },
    {
      key: "status",
      header: "Estado",
      sortable: true,
      render: (t) => (
        <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${STATUS_BADGE[t.status] ?? "bg-slate-100 text-slate-600 border-slate-200"}`}>
          {STATUS_LABELS[t.status] ?? t.status}
        </span>
      ),
    },
    {
      key: "price",
      header: "Precio",
      sortable: true,
      getValue: (t) => String(getPrice(t)),
      render: (t) => {
        const total = getPrice(t);
        return (
          <span className={`text-xs font-bold tabular-nums ${total > 0 ? "text-emerald-700" : "text-[#a19f9d]"}`}>
            {total > 0 ? moneyFormatter.format(total) : "—"}
          </span>
        );
      },
    },
    {
      key: "notes",
      header: "Notas seguimiento",
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
          <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-medium text-blue-700">{q}</span>
        ) : (
          <span className="text-xs text-[#a19f9d]">—</span>
        );
      },
    },
  ], [trackingByAppointment]);

  const clearFilters = () => {
    setSearch("");
    setProfessionalFilter("");
    setStatusFilter("");
    setFromDate("");
    setToDate("");
  };

  const handleDownloadPdf = () => {
    void generateTablePdf({
      title: "Seguimiento de Servicios",
      subtitle: "Control de calidad: notas de diseño y cuestionarios por ticket",
      filename: "seguimiento-servicios",
      orientation: "landscape",
      meta: [
        { label: "Tickets", value: String(filteredTickets.length) },
        { label: "Completados", value: String(filteredTickets.filter((t) => t.status === "completed").length) },
        { label: "Ingresos totales", value: moneyFormatter.format(totalRevenue) },
      ],
      columns: [
        { header: "Código", key: "ticket_code" },
        { header: "Cliente", key: "client_name" },
        { header: "Servicio(s)", key: "services" },
        { header: "Operaria", key: "professional_name" },
        { header: "Fecha / Hora", key: "fecha" },
        { header: "Duración", key: "duration" },
        { header: "Estado", key: "status" },
        { header: "Precio", key: "precio" },
        { header: "Notas seguimiento", key: "notes" },
        { header: "Cuestionario", key: "questionnaire" },
      ],
      rows: filteredTickets.map((t) => {
        const tracking = trackingByAppointment.get(t.id);
        return {
          ticket_code: t.ticket_code ?? `#${t.id}`,
          client_name: t.client_name,
          services: t.service_names?.join(" · ") ?? t.service_name ?? "",
          professional_name: t.professional_name ?? "Sin asignar",
          fecha: t.start_time ? new Date(t.start_time).toLocaleString("es-BO") : "",
          duration: getDuration(t.start_time, t.end_time),
          status: STATUS_LABELS[t.status] ?? t.status,
          precio: getPrice(t) > 0 ? moneyFormatter.format(getPrice(t)) : "—",
          notes: tracking?.design_notes?.trim() ?? "",
          questionnaire: tracking?.questionnaire?.title ?? "",
        };
      }),
    });
  };

  return (
    <Layout
      title="Seguimiento de servicios"
      subtitle="Control de calidad: notas de diseño, cuestionarios y estado de cada ticket. Vista operativa sin comisiones."
      variant="table"
      topContent={
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="Total" value={filteredTickets.length} tone="slate" />
          <StatCard
            label="Completados"
            value={filteredTickets.filter((t) => t.status === "completed").length}
            tone="emerald"
          />
          <StatCard
            label="Pendientes / En curso"
            value={filteredTickets.filter((t) => t.status === "pending" || t.status === "in_service" || t.status === "waiting").length}
            tone="amber" as any
          />
          <StatCard label="Ingresos" value={moneyFormatter.format(totalRevenue)} tone="emerald" />
        </div>
      }
      toolbar={
        <FilterActionBar
          left={
            <div className="flex items-center gap-2 text-xs text-slate-600">
              <ClipboardList className="h-3.5 w-3.5" />
              <span className="font-semibold">{filteredTickets.length} tickets</span>
              {(search || professionalFilter || statusFilter || fromDate || toDate) && (
                <span className="rounded-full bg-[#0078d4]/10 px-2 py-0.5 text-[10px] font-bold text-[#0078d4]">
                  Filtros activos
                </span>
              )}
            </div>
          }
          right={
            <div className="flex items-center gap-2">
              <Button variant="secondary" size="sm" onClick={handleDownloadPdf} disabled={filteredTickets.length === 0}>
                <Download className="h-3.5 w-3.5" />
                PDF
              </Button>
              <Button variant="secondary" size="sm" onClick={() => void loadData()}>Actualizar</Button>
              <Button variant="secondary" size="sm" onClick={clearFilters}>Limpiar filtros</Button>
            </div>
          }
        />
      }
    >
      {/* ── Pestañas ─────────────────────────────────────────────────────── */}
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
          onClick={() => setActiveTab("servicios")}
          className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-semibold transition-all ${
            activeTab === "servicios"
              ? "bg-white text-[#323130] shadow-sm ring-1 ring-black/5"
              : "text-[#605e5c] hover:bg-white/50"
          }`}
        >
          <BarChart2 className="h-3.5 w-3.5" />
          Uso por servicio
        </button>
      </div>

      {/* ── Sección: Uso por servicio ─────────────────────────────────────── */}
      {activeTab === "servicios" && (
        <SectionCard bodyClassName="!p-4">
          <div className="mb-3 flex items-center gap-2">
            <BarChart2 className="h-4 w-4 text-[#0078d4]" />
            <p className="text-sm font-bold text-[#323130]">Uso por servicio</p>
            <span className="text-xs text-[#605e5c]">— {filteredTickets.length} tickets en el período</span>
          </div>

          {serviceStats.length === 0 ? (
            <p className="py-6 text-center text-sm text-[#a19f9d]">No hay tickets para el período seleccionado.</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {serviceStats.map(({ name, count, completed, revenue }) => {
                const inv = getInventoryEstimate(name);
                const pct = count > 0 ? Math.round((completed / count) * 100) : 0;
                return (
                  <div key={name} className="rounded-lg border border-[#edebe9] bg-[#faf9f8] p-3">
                    {/* Nombre + badge tickets */}
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <p className="font-semibold text-sm text-[#323130] leading-tight">{name}</p>
                      <span className="shrink-0 rounded-full bg-[#0078d4]/10 px-2 py-0.5 text-[11px] font-bold text-[#0078d4]">
                        {count} ticket{count !== 1 ? "s" : ""}
                      </span>
                    </div>

                    {/* Barra progreso completados */}
                    <div className="mb-1.5">
                      <div className="flex justify-between text-[10px] text-[#605e5c] mb-0.5">
                        <span>{completed} completados</span>
                        <span className="font-semibold">{pct}%</span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-[#edebe9] overflow-hidden">
                        <div className="h-full rounded-full bg-emerald-500" style={{ width: `${pct}%` }} />
                      </div>
                    </div>

                    {revenue > 0 && (
                      <p className="text-[11px] font-bold text-emerald-700 mb-2">
                        {moneyFormatter.format(revenue)} en ingresos
                      </p>
                    )}

                    {/* Inventario estimado */}
                    {inv && (
                      <div className="border-t border-[#edebe9] pt-2 mt-1">
                        <div className="flex items-center gap-1 mb-1.5">
                          <Package className="h-3 w-3 text-[#a19f9d]" />
                          <span className="text-[10px] font-semibold uppercase tracking-wide text-[#a19f9d]">Estimado por sesión</span>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {inv.adhesivo !== "—" && (
                            <span className="rounded bg-amber-50 border border-amber-200 px-1.5 py-0.5 text-[10px] text-amber-700 font-medium">
                              Adhesivo {inv.adhesivo}
                            </span>
                          )}
                          {inv.pestañas !== "—" && (
                            <span className="rounded bg-blue-50 border border-blue-200 px-1.5 py-0.5 text-[10px] text-blue-700 font-medium">
                              Pestañas {inv.pestañas}
                            </span>
                          )}
                          {inv.otros !== "—" && (
                            <span className="rounded bg-slate-100 border border-slate-200 px-1.5 py-0.5 text-[10px] text-slate-600 font-medium">
                              {inv.otros}
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </SectionCard>
      )}

      {/* ── Filtros (solo en pestaña tickets) ────────────────────────────── */}
      {activeTab === "tickets" && <>
      {/* ── Filtros ──────────────────────────────────────────────────────── */}
      <SectionCard bodyClassName="!p-4">
        <div className="grid gap-3 rounded-sm border border-[#d2d0ce] bg-[#faf9f8] p-3 sm:grid-cols-2 lg:grid-cols-5">
          {/* Búsqueda */}
          <div className="sm:col-span-2">
            <label className="text-xs font-semibold uppercase tracking-wide text-[#605e5c]">Buscar</label>
            <div className="relative mt-1">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#605e5c]" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cliente, código, servicio, operaria..."
                className={`${fieldClass} pl-9`}
              />
            </div>
          </div>

          {/* Operaria */}
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-[#605e5c]">Operaria</label>
            <select value={professionalFilter} onChange={(e) => setProfessionalFilter(e.target.value)} className={`${fieldClass} mt-1`}>
              <option value="">Todas</option>
              {professionals.map((p) => (
                <option key={p.id} value={p.id}>{p.username}</option>
              ))}
            </select>
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

        {/* Chips de estado */}
        {availableStatuses.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setStatusFilter("")}
              className={`rounded-full border px-3 py-0.5 text-[11px] font-semibold transition ${
                !statusFilter
                  ? "border-[#0078d4] bg-[#deecf9] text-[#0050a0]"
                  : "border-[#edebe9] bg-white text-[#605e5c] hover:bg-[#f3f2f1]"
              }`}
            >
              Todos ({tickets.length})
            </button>
            {availableStatuses.map((s) => {
              const count = filteredTickets.filter((t) => t.status === s).length;
              const total = tickets.filter((t) => t.status === s).length;
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStatusFilter(statusFilter === s ? "" : s)}
                  className={`flex items-center gap-1 rounded-full border px-3 py-0.5 text-[11px] font-semibold transition ${
                    statusFilter === s
                      ? (STATUS_BADGE[s] ?? "bg-slate-100 text-slate-600 border-slate-200") + " ring-1 ring-current"
                      : "border-[#edebe9] bg-white text-[#605e5c] hover:bg-[#f3f2f1]"
                  }`}
                >
                  {STATUS_LABELS[s] ?? s}
                  <span className="rounded-full bg-black/10 px-1.5">{statusFilter === s ? count : total}</span>
                </button>
              );
            })}
          </div>
        )}
      </SectionCard>

      {/* ── Tabla ────────────────────────────────────────────────────────── */}
      <SectionCard bodyClassName="!p-0">
        {error && <div className="border-b border-[#edebe9] p-4 text-sm text-rose-600">{error}</div>}

        {/* Resumen del filtro activo */}
        {(professionalFilter || statusFilter) && !isLoading && (
          <div className="flex items-center justify-between border-b border-[#edebe9] bg-[#faf9f8] px-4 py-2">
            <div className="flex flex-wrap items-center gap-2 text-xs text-[#605e5c]">
              {professionalFilter && (
                <span className="flex items-center gap-1 rounded-full bg-[#deecf9] px-2.5 py-0.5 font-semibold text-[#0050a0]">
                  Operaria: {professionals.find((p) => String(p.id) === professionalFilter)?.username ?? professionalFilter}
                  <button type="button" onClick={() => setProfessionalFilter("")} className="ml-0.5 opacity-60 hover:opacity-100">×</button>
                </span>
              )}
              {statusFilter && (
                <span className={`flex items-center gap-1 rounded-full px-2.5 py-0.5 font-semibold ${STATUS_BADGE[statusFilter] ?? "bg-slate-100 text-slate-600"}`}>
                  Estado: {STATUS_LABELS[statusFilter] ?? statusFilter}
                  <button type="button" onClick={() => setStatusFilter("")} className="ml-0.5 opacity-60 hover:opacity-100">×</button>
                </span>
              )}
            </div>
            <span className="text-xs font-bold text-emerald-700">{moneyFormatter.format(totalRevenue)}</span>
          </div>
        )}

        <DataTable
          data={filteredTickets}
          columns={columns}
          loading={isLoading}
          enableGlobalSearch={false}
          enableColumnFilters={false}
          defaultLimit={25}
          tableMinWidth="min-w-[1100px]"
        />
      </SectionCard>
      </>}
    </Layout>
  );
}
