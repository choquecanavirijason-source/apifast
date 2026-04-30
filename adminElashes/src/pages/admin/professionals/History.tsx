import { useCallback, useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { AgendaService, type ProfessionalForSelect, type TicketItem } from "@/core/services/agenda/agenda.service";
import { TrackingService, type TrackingResponse } from "@/core/services/tracking/tracking.service";
import { BRANCH_STORAGE_KEY, getSelectedBranchId } from "@/core/utils/branch";
import Layout from "@/components/common/layout";
import FilterActionBar from "@/components/common/FilterActionBar";
import { Button, SectionCard, StatCard } from "@/components/common/ui";
import DataTable, { type DataTableColumn } from "@/components/common/table/DataTable";

const fieldClass =
  "w-full rounded-sm border border-[#8a8886] bg-white px-3 py-2 text-sm text-[#323130] placeholder:text-[#a19f9d] outline-none transition focus:border-[#0078d4] focus:ring-1 focus:ring-[#0078d4]/35 disabled:bg-[#f3f2f1] disabled:text-[#a19f9d]";

export default function ProfessionalServiceHistory() {
  const [tickets, setTickets] = useState<TicketItem[]>([]);
  const [trackings, setTrackings] = useState<TrackingResponse[]>([]);
  const [professionals, setProfessionals] = useState<ProfessionalForSelect[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [activeBranchId, setActiveBranchId] = useState<number | null>(() => getSelectedBranchId());
  const [search, setSearch] = useState("");
  const [professionalFilter, setProfessionalFilter] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const trackingByAppointment = useMemo(() => {
    const map = new Map<number, TrackingResponse>();
    trackings.forEach((tracking) => {
      if (tracking.appointment_id) {
        map.set(tracking.appointment_id, tracking);
      }
    });
    return map;
  }, [trackings]);

  const loadProfessionals = useCallback(async () => {
    try {
      const data = await AgendaService.listProfessionalsForSelect({ limit: 200 });
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
      const branchFilter = activeBranchId ?? undefined;
      const professionalId = professionalFilter ? Number(professionalFilter) : undefined;
      const settled = await Promise.allSettled([
        AgendaService.listTickets({
          limit: 500,
          status_filter: "completed",
          branch_id: branchFilter,
          professional_id: professionalId,
          start_date: fromDate || undefined,
          end_date: toDate || undefined,
        }),
        TrackingService.list({ limit: 500 }),
      ]);

      if (settled[0].status === "fulfilled") {
        setTickets(settled[0].value);
      } else {
        console.error("Error cargando tickets finalizados:", settled[0].reason);
        setTickets([]);
        setError("No se pudo cargar el historial de servicios por operaria.");
      }

      if (settled[1].status === "fulfilled") {
        setTrackings(settled[1].value);
      } else {
        console.error("Error cargando trackings:", settled[1].reason);
        setTrackings([]);
      }
    } catch (err) {
      console.error("Error cargando historial:", err);
      setError("No se pudo cargar el historial de servicios por operaria.");
      setTickets([]);
      setTrackings([]);
    } finally {
      setIsLoading(false);
    }
  }, [activeBranchId, fromDate, toDate, professionalFilter]);

  useEffect(() => {
    void loadProfessionals();
  }, [loadProfessionals]);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  useEffect(() => {
    const handleChange = () => setActiveBranchId(getSelectedBranchId());
    const handleStorage = (event: StorageEvent) => {
      if (event.key === BRANCH_STORAGE_KEY) handleChange();
    };

    window.addEventListener("storage", handleStorage);
    window.addEventListener("branchchange", handleChange);
    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("branchchange", handleChange);
    };
  }, []);

  const filteredTickets = useMemo(() => {
    const term = search.trim().toLowerCase();

    return tickets.filter((ticket) => {
      const serviceNames = ticket.service_names?.length
        ? ticket.service_names.join(" ")
        : ticket.service_name ?? "";
      const serviceText = serviceNames.toLowerCase();
      const professionalText = ticket.professional_name?.toLowerCase() ?? "";
      const clientText = ticket.client_name?.toLowerCase() ?? "";
      const codeText = ticket.ticket_code?.toLowerCase() ?? "";
      const statusText = ticket.status?.toLowerCase() ?? "";

      return (
        !term ||
        clientText.includes(term) ||
        serviceText.includes(term) ||
        professionalText.includes(term) ||
        codeText.includes(term) ||
        statusText.includes(term)
      );
    });
  }, [tickets, search]);

  const columns = useMemo<DataTableColumn<TicketItem>[]>(() => {
    return [
      {
        key: "client_name",
        header: "Cliente",
        sortable: true,
        render: (ticket) => (
          <span className="font-semibold text-slate-800">{ticket.client_name || "Sin cliente"}</span>
        ),
      },
      {
        key: "service_label",
        header: "Servicio",
        sortable: true,
        getValue: (ticket) =>
          ticket.service_names?.length ? ticket.service_names.join(" · ") : (ticket.service_name ?? "Servicio"),
        render: (ticket) =>
          ticket.service_names?.length ? ticket.service_names.join(" · ") : (ticket.service_name ?? "Servicio"),
      },
      {
        key: "professional_name",
        header: "Operaria",
        sortable: true,
        render: (ticket) => ticket.professional_name ?? "Sin asignar",
      },
      {
        key: "start_time",
        header: "Fecha",
        sortable: true,
        getValue: (ticket) => ticket.start_time ?? "",
        render: (ticket) =>
          ticket.start_time
            ? new Date(ticket.start_time).toLocaleString("es-BO", {
                day: "2-digit",
                month: "short",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })
            : "—",
      },
      {
        key: "status",
        header: "Estado",
        sortable: true,
        render: (ticket) => ticket.status ?? "—",
      },
      {
        key: "notes",
        header: "Comentarios",
        getValue: (ticket) => trackingByAppointment.get(ticket.id)?.design_notes?.trim() || "Sin comentarios",
        render: (ticket) => trackingByAppointment.get(ticket.id)?.design_notes?.trim() || "Sin comentarios",
      },
      {
        key: "questionnaire",
        header: "Cuestionario",
        getValue: (ticket) => trackingByAppointment.get(ticket.id)?.questionnaire?.title || "Sin cuestionario",
        render: (ticket) => trackingByAppointment.get(ticket.id)?.questionnaire?.title || "Sin cuestionario",
      },
    ];
  }, [trackingByAppointment]);

  const renderToolbar = () => (
    <FilterActionBar
      left={
        <div className="text-xs font-semibold text-slate-600">
          Historial por operaria
        </div>
      }
      right={
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={() => void loadHistory()}>
            Actualizar
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              setFromDate("");
              setToDate("");
              setSearch("");
              setProfessionalFilter("");
            }}
          >
            Limpiar filtros
          </Button>
        </div>
      }
    />
  );

  return (
    <Layout
      title="Historial de servicios por operaria"
      subtitle="Servicios finalizados con detalle de seguimiento."
      variant="table"
      topContent={
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <StatCard label="Tickets finalizados" value={filteredTickets.length} tone="emerald" />
          <StatCard label="Operarias disponibles" value={professionals.length} tone="slate" />
        </div>
      }
      toolbar={renderToolbar()}
    >
      <SectionCard bodyClassName="!p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-[#323130]">Historial de servicios por operaria</h2>
            <p className="text-xs text-[#605e5c]">Servicios finalizados con detalle de seguimiento.</p>
          </div>
        </div>

        <div className="mt-4 grid gap-3 rounded-sm border border-[#d2d0ce] bg-[#faf9f8] p-3 lg:grid-cols-4">
          <div className="lg:col-span-2">
            <label className="text-xs font-semibold uppercase tracking-wide text-[#605e5c]">Buscar</label>
            <div className="relative mt-1">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#605e5c]" />
              <input
                type="text"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Cliente, servicio, estado o codigo"
                className={`${fieldClass} pl-9`}
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-[#605e5c]">Operaria</label>
            <select
              value={professionalFilter}
              onChange={(event) => setProfessionalFilter(event.target.value)}
              className={`${fieldClass} mt-1`}
            >
              <option value="">Todas</option>
              {professionals.map((professional) => (
                <option key={professional.id} value={String(professional.id)}>
                  {professional.username}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-[#605e5c]">Desde</label>
            <input
              type="date"
              value={fromDate}
              onChange={(event) => setFromDate(event.target.value)}
              className={`${fieldClass} mt-1`}
            />
          </div>

          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-[#605e5c]">Hasta</label>
            <input
              type="date"
              value={toDate}
              onChange={(event) => setToDate(event.target.value)}
              className={`${fieldClass} mt-1`}
            />
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-[#605e5c]">
          <span>{filteredTickets.length} resultados</span>
        </div>
      </SectionCard>

      <SectionCard bodyClassName="!p-0">
        {error ? <div className="border-b border-[#edebe9] p-4 text-sm text-rose-600">{error}</div> : null}
        <DataTable
          data={filteredTickets}
          columns={columns}
          loading={isLoading}
          enableGlobalSearch={false}
          enableColumnFilters={false}
          defaultLimit={20}
          tableMinWidth="min-w-[980px]"
        />
      </SectionCard>
    </Layout>
  );
}
