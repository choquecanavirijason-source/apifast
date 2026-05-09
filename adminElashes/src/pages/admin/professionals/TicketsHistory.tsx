import { useCallback, useEffect, useMemo, useState } from "react";
import { ClipboardList, Search } from "lucide-react";
import { AgendaService, type ProfessionalForSelect, type TicketItem } from "@/core/services/agenda/agenda.service";
import { TrackingService, type TrackingResponse } from "@/core/services/tracking/tracking.service";
import { BRANCH_STORAGE_KEY, getSelectedBranchId } from "@/core/utils/branch";
import Layout from "@/components/common/layout";
import FilterActionBar from "@/components/common/FilterActionBar";
import { Button, SectionCard, StatCard } from "@/components/common/ui";
import DataTable, { type DataTableColumn } from "@/components/common/table/DataTable";

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

  return (
    <Layout
      title="Historial de tickets"
      subtitle="Todos los tickets registrados con detalle completo."
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
              <Button variant="secondary" size="sm" onClick={() => void loadData()}>Actualizar</Button>
              <Button variant="secondary" size="sm" onClick={clearFilters}>Limpiar filtros</Button>
            </div>
          }
        />
      }
    >
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
    </Layout>
  );
}
