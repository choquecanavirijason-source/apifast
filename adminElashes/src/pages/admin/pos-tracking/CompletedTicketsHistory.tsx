import { useCallback, useEffect, useMemo, useState } from "react";
import { AgendaService, type ProfessionalForSelect, type TicketItem } from "@/core/services/agenda/agenda.service";
import { TrackingService, type TrackingResponse } from "@/core/services/tracking/tracking.service";
import { BRANCH_STORAGE_KEY, getSelectedBranchId } from "@/core/utils/branch";
import { Button, SectionCard } from "@/components/common/ui";
import DataTable, { type DataTableColumn } from "@/components/common/table/DataTable";
import { useWebSocket } from "@/core/hooks/useWebSocket";

const fieldClass =
  "h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100";

export default function CompletedTicketsHistory() {
  const [tickets, setTickets] = useState<TicketItem[]>([]);
  const [trackings, setTrackings] = useState<TrackingResponse[]>([]);
  const [professionals, setProfessionals] = useState<ProfessionalForSelect[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [activeBranchId, setActiveBranchId] = useState<number | null>(() => getSelectedBranchId());
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

  useWebSocket(activeBranchId, () => { void loadHistory(); });

  const columns: DataTableColumn<TicketItem>[] = [
    {
      key: "client_name",
      header: "Cliente",
      render: (t) => <span className="font-semibold text-slate-800">{t.client_name}</span>,
      sortable: true,
    },
    {
      key: "service",
      header: "Servicio",
      getValue: (t) => (t.service_names?.length ? t.service_names.join(" · ") : t.service_name ?? ""),
      render: (t) => (t.service_names?.length ? t.service_names.join(" · ") : t.service_name ?? "Servicio"),
      sortable: true,
    },
    {
      key: "professional_name",
      header: "Operaria",
      render: (t) => t.professional_name ?? "Sin asignar",
      sortable: true,
      filterable: true,
    },
    {
      key: "start_time",
      header: "Fecha",
      getValue: (t) => t.start_time ?? "",
      render: (t) =>
        t.start_time
          ? new Date(t.start_time).toLocaleString("es-BO", {
              day: "2-digit",
              month: "short",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })
          : "",
      sortable: true,
    },
    {
      key: "notes",
      header: "Comentarios",
      getValue: (t) => trackingByAppointment.get(t.id)?.design_notes?.trim() ?? "",
      render: (t) => trackingByAppointment.get(t.id)?.design_notes?.trim() || "Sin comentarios",
    },
    {
      key: "questionnaire",
      header: "Cuestionario",
      getValue: (t) => trackingByAppointment.get(t.id)?.questionnaire?.title ?? "",
      render: (t) => trackingByAppointment.get(t.id)?.questionnaire?.title || "Sin cuestionario",
    },
  ];

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <SectionCard bodyClassName="!p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-slate-800">Historial de tickets finalizados</h2>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="date"
              value={fromDate}
              onChange={(event) => setFromDate(event.target.value)}
              className={fieldClass}
              title="Desde"
            />
            <span className="text-xs text-slate-400">a</span>
            <input
              type="date"
              value={toDate}
              onChange={(event) => setToDate(event.target.value)}
              className={fieldClass}
              title="Hasta"
            />
            {(fromDate || toDate) && (
              <button
                type="button"
                onClick={() => { setFromDate(""); setToDate(""); }}
                className="rounded-lg px-2 py-1 text-xs text-slate-500 hover:bg-slate-100"
              >
                Limpiar fechas
              </button>
            )}
            <Button variant="secondary" size="sm" onClick={() => void loadHistory()}>
              Actualizar
            </Button>
          </div>
        </div>
      </SectionCard>

      {error ? (
        <SectionCard bodyClassName="!p-4">
          <p className="text-sm text-rose-600">{error}</p>
        </SectionCard>
      ) : null}

      <DataTable
        data={tickets}
        columns={columns}
        loading={isLoading}
        defaultLimit={15}
        availableLimits={[10, 15, 25, 50]}
        globalSearchPlaceholder="Buscar por cliente, servicio u operaria..."
      />
    </div>
  );
}
