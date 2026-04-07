import { useCallback, useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { AgendaService, type ProfessionalForSelect, type TicketItem } from "@/core/services/agenda/agenda.service";
import { TrackingService, type TrackingResponse } from "@/core/services/tracking/tracking.service";
import { BRANCH_STORAGE_KEY, getSelectedBranchId } from "@/core/utils/branch";
import { Button, SectionCard } from "@/components/common/ui";

const fieldClass =
  "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 placeholder-slate-400 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100 disabled:bg-slate-50 disabled:text-slate-400";

export default function CompletedTicketsHistory() {
  const [tickets, setTickets] = useState<TicketItem[]>([]);
  const [trackings, setTrackings] = useState<TrackingResponse[]>([]);
  const [professionals, setProfessionals] = useState<ProfessionalForSelect[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [activeBranchId, setActiveBranchId] = useState<number | null>(() => getSelectedBranchId());
  const [search, setSearch] = useState("");
  const [serviceFilter, setServiceFilter] = useState("");
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
      const settled = await Promise.allSettled([
        AgendaService.listTickets({
          limit: 500,
          status_filter: "completed",
          branch_id: branchFilter,
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
        setError("No se pudo cargar el historial de tickets finalizados.");
      }

      if (settled[1].status === "fulfilled") {
        setTrackings(settled[1].value);
      } else {
        console.error("Error cargando trackings:", settled[1].reason);
        setTrackings([]);
      }
    } catch (err) {
      console.error("Error cargando historial de tickets:", err);
      setError("No se pudo cargar el historial de tickets finalizados.");
      setTickets([]);
      setTrackings([]);
    } finally {
      setIsLoading(false);
    }
  }, [activeBranchId, fromDate, toDate]);

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
    const serviceTerm = serviceFilter.trim().toLowerCase();

    return tickets.filter((ticket) => {
      const serviceNames = ticket.service_names?.length
        ? ticket.service_names.join(" ")
        : ticket.service_name ?? "";
      const serviceText = serviceNames.toLowerCase();
      const professionalText = ticket.professional_name?.toLowerCase() ?? "";
      const clientText = ticket.client_name?.toLowerCase() ?? "";
      const codeText = ticket.ticket_code?.toLowerCase() ?? "";

      const matchesSearch =
        !term ||
        clientText.includes(term) ||
        serviceText.includes(term) ||
        professionalText.includes(term) ||
        codeText.includes(term);

      const matchesService = !serviceTerm || serviceText.includes(serviceTerm);
      const matchesProfessional =
        !professionalFilter || String(ticket.professional_id ?? "") === professionalFilter;

      return matchesSearch && matchesService && matchesProfessional;
    });
  }, [tickets, search, serviceFilter, professionalFilter]);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <SectionCard bodyClassName="!p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Historial de tickets finalizados</h2>
            <p className="text-xs text-slate-500">Consulta servicios finalizados con notas y cuestionarios.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" onClick={() => void loadHistory()}>
              Actualizar
            </Button>
          </div>
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-4">
          <div className="lg:col-span-2">
            <label className="text-xs font-semibold text-slate-500">Buscar</label>
            <div className="relative mt-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Cliente, servicio, operaria o codigo"
                className={`${fieldClass} pl-10`}
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-500">Servicio</label>
            <input
              type="text"
              value={serviceFilter}
              onChange={(event) => setServiceFilter(event.target.value)}
              placeholder="Filtrar por servicio"
              className={`${fieldClass} mt-1`}
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-500">Operaria</label>
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
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="text-xs font-semibold text-slate-500">Desde</label>
            <input
              type="date"
              value={fromDate}
              onChange={(event) => setFromDate(event.target.value)}
              className={`${fieldClass} mt-1`}
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500">Hasta</label>
            <input
              type="date"
              value={toDate}
              onChange={(event) => setToDate(event.target.value)}
              className={`${fieldClass} mt-1`}
            />
          </div>
          <div className="flex items-end gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setFromDate("");
                setToDate("");
                setSearch("");
                setServiceFilter("");
                setProfessionalFilter("");
              }}
            >
              Limpiar filtros
            </Button>
          </div>
          <div className="flex items-end text-xs text-slate-500">
            {filteredTickets.length} resultados
          </div>
        </div>
      </SectionCard>

      <SectionCard bodyClassName="!p-0">
        {isLoading ? (
          <div className="p-6 text-sm text-slate-500">Cargando historial...</div>
        ) : error ? (
          <div className="p-6 text-sm text-rose-600">{error}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Cliente</th>
                  <th className="px-4 py-3">Servicio</th>
                  <th className="px-4 py-3">Operaria</th>
                  <th className="px-4 py-3">Fecha</th>
                  <th className="px-4 py-3">Comentarios</th>
                  <th className="px-4 py-3">Cuestionario</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredTickets.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-slate-400">
                      Sin tickets finalizados para los filtros actuales.
                    </td>
                  </tr>
                ) : (
                  filteredTickets.map((ticket) => {
                    const tracking = trackingByAppointment.get(ticket.id);
                    const serviceLabel = ticket.service_names?.length
                      ? ticket.service_names.join(" · ")
                      : ticket.service_name ?? "Servicio";
                    const notes = tracking?.design_notes?.trim() || "Sin comentarios";
                    const questionnaire = tracking?.questionnaire?.title || "Sin cuestionario";
                    const displayDate = ticket.start_time
                      ? new Date(ticket.start_time).toLocaleString("es-BO", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "";

                    return (
                      <tr key={ticket.id} className="hover:bg-slate-50/70">
                        <td className="px-4 py-3 font-semibold text-slate-800">{ticket.client_name}</td>
                        <td className="px-4 py-3 text-slate-600">{serviceLabel}</td>
                        <td className="px-4 py-3 text-slate-600">{ticket.professional_name ?? "Sin asignar"}</td>
                        <td className="px-4 py-3 text-slate-500">{displayDate}</td>
                        <td className="px-4 py-3 text-slate-500">{notes}</td>
                        <td className="px-4 py-3 text-slate-500">{questionnaire}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </div>
  );
}
