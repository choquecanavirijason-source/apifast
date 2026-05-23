import { useCallback, useEffect, useMemo, useState } from "react";
import { Search, UserCheck, X } from "lucide-react";
import { AgendaService, type ProfessionalForSelect, type TicketItem } from "@/core/services/agenda/agenda.service";
import { TrackingService, type TrackingResponse } from "@/core/services/tracking/tracking.service";
import { BRANCH_STORAGE_KEY, getSelectedBranchId } from "@/core/utils/branch";
import useAuth from "@/core/hooks/useAuth";
import Layout from "@/components/common/layout";
import FilterActionBar from "@/components/common/FilterActionBar";
import { Button, SectionCard, StatCard } from "@/components/common/ui";
import DataTable, { type DataTableColumn } from "@/components/common/table/DataTable";
import {
  formatCommissionRatePercent,
  getTicketCommission,
  getTicketPriceTotal,
} from "./professionalCommission.utils";

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

  const [tickets, setTickets] = useState<TicketItem[]>([]);
  const [trackings, setTrackings] = useState<TrackingResponse[]>([]);
  const [professionals, setProfessionals] = useState<ProfessionalForSelect[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [activeBranchId, setActiveBranchId] = useState<number | null>(() => getSelectedBranchId());
  const [search, setSearch] = useState("");
  const [selectedProfessionalId, setSelectedProfessionalId] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const trackingByAppointment = useMemo(() => {
    const map = new Map<number, TrackingResponse>();
    trackings.forEach((t) => { if (t.appointment_id) map.set(t.appointment_id, t); });
    return map;
  }, [trackings]);

  const loadProfessionals = useCallback(async () => {
    try {
      const data = await AgendaService.listProfessionalsForSelect({ limit: 200, role_name: "Operaria" });
      setProfessionals(data);
    } catch (err) {
      console.error("Error cargando profesionales:", err);
      setProfessionals([]);
    }
  }, []);

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
    const term = search.trim().toLowerCase();
    return tickets.filter((ticket) => {
      if (selectedProfessionalId !== null && ticket.professional_id !== selectedProfessionalId) return false;
      if (statusFilter && ticket.status !== statusFilter) return false;
      if (!term) return true;
      const services = (ticket.service_names?.join(" ") ?? ticket.service_name ?? "").toLowerCase();
      return (
        ticket.client_name?.toLowerCase().includes(term) ||
        services.includes(term) ||
        ticket.professional_name?.toLowerCase().includes(term) ||
        ticket.ticket_code?.toLowerCase().includes(term) ||
        ticket.status?.toLowerCase().includes(term) ||
        ticket.branch_name?.toLowerCase().includes(term)
      );
    });
  }, [tickets, search, selectedProfessionalId, statusFilter]);

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
      header: `Comisión (${formatCommissionRatePercent()})`,
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

  const renderToolbar = () => (
    <FilterActionBar
      left={
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
          {selectedProfName ? (
            <>
              <UserCheck className="h-3.5 w-3.5 text-[#0078d4]" />
              <span className="text-[#0078d4]">{selectedProfName}</span>
              <span className="text-slate-400">— {filteredTickets.length} tickets</span>
            </>
          ) : (
            <span>Todas las operarias — {filteredTickets.length} tickets</span>
          )}
        </div>
      }
      right={
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={() => void loadHistory()}>Actualizar</Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => { setFromDate(""); setToDate(""); setSearch(""); setStatusFilter(""); setSelectedProfessionalId(null); }}
          >
            Limpiar filtros
          </Button>
        </div>
      }
    />
  );

  return (
    <Layout
      title="Tickets por operaria"
      subtitle={`Tickets por operaria con comisión del ${formatCommissionRatePercent()} sobre trabajos completados.`}
      variant="table"
      topContent={
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
      }
      toolbar={renderToolbar()}
    >
      {/* ── Galería de operarias (solo admin y operaria) ─────────────────── */}
      {canSeeCards && (
        <SectionCard bodyClassName="!p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-sm font-bold text-[#323130]">Seleccionar operaria</h2>
            {selectedProfessionalId !== null && (
              <button
                type="button"
                onClick={() => setSelectedProfessionalId(null)}
                className="flex items-center gap-1 rounded-md border border-[#edebe9] px-2.5 py-1 text-xs text-[#605e5c] hover:bg-[#f3f2f1]"
              >
                <X className="h-3 w-3" />
                Ver todas
              </button>
            )}
          </div>

          {isLoading && professionalStats.length === 0 ? (
            <div className="flex h-24 items-center justify-center text-sm text-[#a19f9d]">Cargando operarias...</div>
          ) : professionalStats.length === 0 ? (
            <div className="flex h-24 items-center justify-center text-sm text-[#a19f9d]">No hay operarias registradas.</div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
              {professionalStats.map(({ id, name, count, completedCount, commission }, index) => {
                const isSelected = selectedProfessionalId === id;
                const color = CARD_COLORS[index % CARD_COLORS.length];
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setSelectedProfessionalId(isSelected ? null : id)}
                    className={`flex flex-col items-center gap-2 rounded-xl border p-3 text-center transition-all duration-150 ${
                      isSelected
                        ? "border-[#0078d4] bg-[#deecf9] shadow-md ring-2 ring-[#0078d4]/25"
                        : "border-[#edebe9] bg-white hover:border-[#0078d4]/40 hover:shadow-sm"
                    }`}
                  >
                    <div className={`flex h-12 w-12 items-center justify-center rounded-full text-base font-bold ${
                      isSelected ? "bg-[#0078d4] text-white shadow" : `${color.bg} ${color.text}`
                    }`}>
                      {getInitials(name)}
                    </div>
                    <p className={`w-full truncate text-xs font-semibold leading-tight ${isSelected ? "text-[#003a8c]" : "text-[#323130]"}`} title={name}>
                      {name}
                    </p>
                    <div className="flex w-full flex-col items-center gap-0.5">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        isSelected ? "bg-[#0078d4] text-white" : count > 0 ? `${color.bg} ${color.text}` : "bg-[#f3f2f1] text-[#a19f9d]"
                      }`}>
                        {completedCount} {completedCount === 1 ? "completado" : "completados"}
                      </span>
                      {commission > 0 ? (
                        <span className={`text-[10px] font-semibold tabular-nums ${isSelected ? "text-[#003a8c]" : "text-[#0050a0]"}`}>
                          {moneyFormatter.format(commission)}
                        </span>
                      ) : null}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </SectionCard>
      )}

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
                placeholder="Cliente, código, servicio, sucursal..."
                className={`${fieldClass} pl-9`}
              />
            </div>
          </div>

          {/* Operaria (dropdown para roles que no ven las tarjetas) */}
          {!canSeeCards && (
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-[#605e5c]">Operaria</label>
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
            </div>
          )}

          {/* Estado */}
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-[#605e5c]">Estado</label>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={`${fieldClass} mt-1`}>
              <option value="">Todos</option>
              {availableStatuses.map((s) => (
                <option key={s} value={s}>{STATUS_LABELS[s] ?? s}</option>
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

        {/* Resumen rápido de estados */}
        {filteredTickets.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {availableStatuses.map((s) => {
              const count = filteredTickets.filter((t) => t.status === s).length;
              if (count === 0) return null;
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStatusFilter(statusFilter === s ? "" : s)}
                  className={`flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold transition ${
                    statusFilter === s
                      ? (STATUS_BADGE[s] ?? "bg-slate-100 text-slate-600") + " ring-1 ring-current"
                      : "border-[#edebe9] bg-white text-[#605e5c] hover:bg-[#f3f2f1]"
                  }`}
                >
                  {STATUS_LABELS[s] ?? s}
                  <span className="rounded-full bg-black/10 px-1.5">{count}</span>
                </button>
              );
            })}
          </div>
        )}
      </SectionCard>

      {/* ── Tabla de tickets ─────────────────────────────────────────────── */}
      <SectionCard bodyClassName="!p-0">
        {error ? <div className="border-b border-[#edebe9] p-4 text-sm text-rose-600">{error}</div> : null}

        {selectedProfessionalId !== null && !isLoading && (
          <div className="flex items-center justify-between gap-2 border-b border-[#edebe9] bg-[#deecf9] px-4 py-2.5">
            <div className="flex items-center gap-2">
              <UserCheck className="h-4 w-4 text-[#0078d4]" />
              <span className="text-xs font-semibold text-[#0050a0]">
                Tickets de {selectedProfName} — {filteredTickets.length} resultado{filteredTickets.length !== 1 ? "s" : ""}
              </span>
            </div>
            <div className="flex flex-col items-end gap-0.5 text-xs">
              <span className="font-bold text-emerald-700">{moneyFormatter.format(totalRevenue)} ingresos</span>
              <span className="font-bold text-[#0050a0]">{moneyFormatter.format(totalCommission)} comisión</span>
            </div>
          </div>
        )}

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
    </Layout>
  );
}
