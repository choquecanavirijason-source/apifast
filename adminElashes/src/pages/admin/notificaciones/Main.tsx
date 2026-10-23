import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "react-toastify";
import { BellRing, CalendarClock, RefreshCcw } from "lucide-react";
import { ClientService, type CitaProximaRow, type RetoqueRow } from "@/core/services/client/client.service";
import ReminderModal from "./ReminderModal";
import { STATUS_LABELS } from "@/pages/admin/calendar/calendar.constants";
import { BranchService } from "@/core/services/branch/branch.service";
import { BRANCH_STORAGE_KEY, getSelectedBranchId, setSelectedBranchId } from "@/core/utils/branch";
import { getApiErrorMessage } from "@/core/utils/apiError";
import useAuth from "@/core/hooks/useAuth";
import { Button, SectionCard, SegmentedTabs } from "@/components/common/ui";
import DataTable, { type DataTableColumn } from "@/components/common/table/DataTable";

const fieldClass =
  "h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100";

const RANGOS = [7, 15, 30, 60];

// DataTable necesita un id por fila; una clienta puede tener una por tipo.
type RetoqueTableRow = RetoqueRow & { id: string };
type CitaTableRow = CitaProximaRow & { id: number };

type Tab = "retoques" | "citas";

const TABS = [
  { id: "retoques", label: "Estado de retoques", icon: <RefreshCcw /> },
  { id: "citas", label: "Próximas citas", icon: <CalendarClock /> },
] as const;

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

// Las fechas llegan en hora de La Paz y sin zona: se formatean a mano, sin
// pasar por Date, para que el navegador no las corra de día.
const formatDay = (isoDate: string) => {
  const [year, month, day] = isoDate.slice(0, 10).split("-").map(Number);
  return `${day} ${MESES[month - 1]} ${year}`;
};

const formatAppointment = (isoDateTime: string) => `${formatDay(isoDateTime)} · ${isoDateTime.slice(11, 16)}`;

// El backend manda microsegundos ("...35.600533Z"); se recortan a milisegundos
// para que cualquier navegador lo parsee.
const parseUtc = (iso: string) => Date.parse(iso.replace(/(\.\d{3})\d+/, "$1"));

const haceLabel = (ms: number) => {
  const min = Math.floor(ms / 60_000);
  if (min < 1) return "hace un momento";
  if (min < 60) return `hace ${min} min`;
  const horas = Math.floor(min / 60);
  if (horas < 24) return `hace ${horas} h`;
  const dias = Math.floor(horas / 24);
  return `hace ${dias} ${dias === 1 ? "día" : "días"}`;
};

const diasLabel = (row: RetoqueRow) => {
  if (row.vencido) {
    const dias = Math.abs(row.dias_restantes);
    return `Vencido · hace ${dias} ${dias === 1 ? "día" : "días"}`;
  }
  if (row.dias_restantes === 0) return "Hoy";
  return `${row.dias_restantes} ${row.dias_restantes === 1 ? "día" : "días"}`;
};

export default function NotificacionesPage() {
  const { isAdmin, hasRole, hasPermissionByName } = useAuth();
  // Admin y Secretaria eligen sucursal; el resto queda en la suya (lo fuerza el backend).
  const canChooseBranch = isAdmin() || hasRole("Secretaria");
  const canManage = isAdmin() || hasPermissionByName("clients:manage");
  const canSendReminder = isAdmin() || hasPermissionByName("reminders:send");

  // En la URL (?tab=citas) para que la pestaña sobreviva a una recarga.
  const [searchParams, setSearchParams] = useSearchParams();
  const tab: Tab = searchParams.get("tab") === "citas" ? "citas" : "retoques";
  const setTab = (next: Tab) => setSearchParams(next === "citas" ? { tab: "citas" } : {}, { replace: true });

  const [rows, setRows] = useState<RetoqueRow[]>([]);
  const [citas, setCitas] = useState<CitaProximaRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dias, setDias] = useState(30);
  // Misma sucursal que el selector global de la cabecera, en ambos sentidos.
  const [branchId, setBranchIdState] = useState<number | null>(() => getSelectedBranchId());
  const setBranchId = (value: number | null) => {
    setSelectedBranchId(value);
    setBranchIdState(value);
  };
  const [branches, setBranches] = useState<{ id: number; name: string }[]>([]);
  const [pending, setPending] = useState<Set<number>>(new Set());
  const [reminderCita, setReminderCita] = useState<CitaProximaRow | null>(null);
  // Reloj para "Enviado hace X min" del último recordatorio.
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (tab !== "citas") return;
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, [tab]);

  useEffect(() => {
    const handleChange = () => setBranchIdState(getSelectedBranchId());
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

  useEffect(() => {
    if (!canChooseBranch) return;
    BranchService.list({ limit: 200 })
      .then((data) => setBranches(data))
      .catch(() => setBranches([]));
  }, [canChooseBranch]);

  // Las dos pestañas comparten sucursal y rango; solo se pide la activa.
  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    const params = { dias, branch_id: branchId ?? undefined };
    try {
      if (tab === "citas") {
        setCitas(await ClientService.listCitasProximas(params));
      } else {
        setRows(await ClientService.listRetoques(params));
      }
    } catch (err) {
      if (tab === "citas") {
        setCitas([]);
        setError(getApiErrorMessage(err, "No se pudo cargar las próximas citas."));
      } else {
        setRows([]);
        setError(getApiErrorMessage(err, "No se pudo cargar el estado de retoques."));
      }
    } finally {
      setIsLoading(false);
    }
  }, [dias, branchId, tab]);

  useEffect(() => {
    void load();
  }, [load]);

  const tableRows = useMemo<RetoqueTableRow[]>(
    () => rows.map((row) => ({ ...row, id: `${row.seguimiento_id}-${row.tipo}` })),
    [rows],
  );
  const citaRows = useMemo<CitaTableRow[]>(
    () => citas.map((row) => ({ ...row, id: row.appointment_id })),
    [citas],
  );

  // Una clienta puede tener dos filas (mantenimiento y retiro): el toggle es
  // de la clienta, así que cambia todas sus filas. Se aplica al instante y se
  // revierte si la API falla.
  const setClientValue = (clientId: number, value: boolean) =>
    setRows((current) =>
      current.map((row) => (row.client_id === clientId ? { ...row, notificaciones_activas: value } : row)),
    );

  const handleToggle = async (row: RetoqueRow) => {
    const next = !row.notificaciones_activas;
    setClientValue(row.client_id, next);
    setPending((current) => new Set(current).add(row.client_id));
    try {
      const result = await ClientService.setNotificaciones(row.client_id, next);
      setClientValue(row.client_id, result.notificaciones_activas);
      toast.success(
        result.notificaciones_activas
          ? `Notificaciones activadas para ${row.clienta}.`
          : `Notificaciones desactivadas para ${row.clienta}.`,
      );
    } catch (err) {
      setClientValue(row.client_id, !next);
      toast.error(getApiErrorMessage(err, "No se pudo cambiar las notificaciones."));
    } finally {
      setPending((current) => {
        const copy = new Set(current);
        copy.delete(row.client_id);
        return copy;
      });
    }
  };

  const handleReminderSent = (appointmentId: number, createdAt: string) => {
    setCitas((current) =>
      current.map((row) => (row.appointment_id === appointmentId ? { ...row, ultimo_recordatorio: createdAt } : row)),
    );
    setNow(Date.now());
    setReminderCita(null);
  };

  const columns: DataTableColumn<RetoqueTableRow>[] = [
    {
      key: "clienta",
      header: "Clienta",
      render: (row) => <span className="font-semibold text-slate-800">{row.clienta}</span>,
      sortable: true,
    },
    {
      key: "servicio",
      header: "Servicio",
      getValue: (row) => row.servicio ?? "",
      render: (row) => row.servicio ?? <span className="text-slate-400">—</span>,
      sortable: true,
    },
    {
      key: "tipo",
      header: "Tipo",
      getValue: (row) => (row.tipo === "mantenimiento" ? "Mantenimiento" : "Retiro"),
      render: (row) => (
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
            row.tipo === "mantenimiento" ? "bg-sky-50 text-sky-700" : "bg-violet-50 text-violet-700"
          }`}
        >
          {row.tipo === "mantenimiento" ? "Mantenimiento" : "Retiro"}
        </span>
      ),
      filterable: true,
    },
    {
      key: "fecha_objetivo",
      header: "Fecha objetivo",
      getValue: (row) => row.fecha_objetivo,
      render: (row) => formatDay(row.fecha_objetivo),
      sortable: true,
    },
    {
      key: "dias_restantes",
      header: "Días restantes",
      getValue: (row) => row.dias_restantes,
      render: (row) => (
        <span
          className={
            row.vencido
              ? "rounded-full bg-rose-50 px-2 py-0.5 text-xs font-medium text-rose-700"
              : row.dias_restantes <= 3
                ? "font-medium text-amber-700"
                : "text-slate-700"
          }
        >
          {diasLabel(row)}
        </span>
      ),
      sortable: true,
    },
    {
      key: "proxima_cita",
      header: "¿Tiene cita?",
      getValue: (row) => row.proxima_cita ?? "",
      render: (row) =>
        row.proxima_cita ? (
          <span className="text-emerald-700">Sí · {formatAppointment(row.proxima_cita)}</span>
        ) : (
          <span className="text-slate-500">No</span>
        ),
    },
    {
      key: "notificaciones_activas",
      header: "Notificaciones",
      getValue: (row) => (row.notificaciones_activas ? "Activas" : "Inactivas"),
      render: (row) => {
        const busy = pending.has(row.client_id);
        return (
          <div className="flex items-center gap-2">
            <button
              type="button"
              role="switch"
              aria-checked={row.notificaciones_activas}
              aria-label={`Notificaciones de ${row.clienta}`}
              disabled={!canManage || busy}
              title={canManage ? undefined : "No tienes permiso para cambiar las notificaciones"}
              onClick={() => void handleToggle(row)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                row.notificaciones_activas ? "bg-emerald-500" : "bg-slate-300"
              }`}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                  row.notificaciones_activas ? "translate-x-5" : "translate-x-1"
                }`}
              />
            </button>
            <span className="text-xs text-slate-500">{row.notificaciones_activas ? "Activas" : "Inactivas"}</span>
          </div>
        );
      },
    },
  ];

  const citaColumns: DataTableColumn<CitaTableRow>[] = [
    {
      key: "clienta",
      header: "Clienta",
      render: (row) => <span className="font-semibold text-slate-800">{row.clienta}</span>,
      sortable: true,
    },
    {
      key: "servicio",
      header: "Servicio",
      getValue: (row) => row.servicio ?? "",
      render: (row) => row.servicio ?? <span className="text-slate-400">—</span>,
      sortable: true,
    },
    {
      key: "fecha_hora",
      header: "Fecha y hora",
      getValue: (row) => row.fecha_hora,
      render: (row) => formatAppointment(row.fecha_hora),
      sortable: true,
    },
    {
      key: "sucursal",
      header: "Sucursal",
      getValue: (row) => row.sucursal ?? "",
      render: (row) => row.sucursal ?? <span className="text-slate-400">—</span>,
      filterable: true,
    },
    {
      key: "estado",
      header: "Estado",
      getValue: (row) => STATUS_LABELS[row.estado] ?? row.estado,
      render: (row) => (
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
          {STATUS_LABELS[row.estado] ?? row.estado}
        </span>
      ),
      filterable: true,
    },
    {
      // El estado es solo lectura: se cambia en "Estado de retoques". Debajo,
      // el último recordatorio manual de esta cita.
      key: "notificaciones_activas",
      header: "Notificaciones",
      getValue: (row) => (row.notificaciones_activas ? "Activas" : "Inactivas"),
      render: (row) => (
        <div className="flex flex-col items-start gap-1">
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-medium ${
              row.notificaciones_activas ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"
            }`}
          >
            {row.notificaciones_activas ? "Activas" : "Inactivas"}
          </span>
          {row.ultimo_recordatorio ? (
            <span className="text-xs text-slate-500">
              Enviado {haceLabel(Math.max(0, now - parseUtc(row.ultimo_recordatorio)))}
            </span>
          ) : null}
        </div>
      ),
    },
    ...(canSendReminder
      ? [
          {
            key: "recordatorio",
            header: "Recordatorio",
            render: (row: CitaTableRow) => {
              return (
                <Button
                  variant="outline"
                  size="sm"
                  leftIcon={<BellRing className="h-3.5 w-3.5" />}
                  onClick={() => setReminderCita(row)}
                >
                  Enviar recordatorio
                </Button>
              );
            },
          } satisfies DataTableColumn<CitaTableRow>,
        ]
      : []),
  ];

  const isEmpty = !isLoading && !error && (tab === "citas" ? citas.length === 0 : rows.length === 0);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <SectionCard bodyClassName="!p-5 flex flex-col gap-3">
        <SegmentedTabs options={TABS} value={tab} onChange={setTab} />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-800">
              {tab === "citas" ? "Próximas citas" : "Estado de retoques"}
            </h2>
            <p className="text-xs text-slate-500">
              {tab === "citas"
                ? `Citas no canceladas de los próximos ${dias} días.`
                : `Mantenimiento y retiro en los próximos ${dias} días, más los vencidos de la última semana.`}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {canChooseBranch && (
              <select
                value={branchId ?? ""}
                onChange={(event) => setBranchId(event.target.value ? Number(event.target.value) : null)}
                className={fieldClass}
                aria-label="Sucursal"
              >
                <option value="">Todas las sucursales</option>
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
                ))}
              </select>
            )}
            <select
              value={dias}
              onChange={(event) => setDias(Number(event.target.value))}
              className={fieldClass}
              aria-label="Rango de días"
            >
              {RANGOS.map((rango) => (
                <option key={rango} value={rango}>
                  Próximos {rango} días
                </option>
              ))}
            </select>
            <Button variant="secondary" size="sm" onClick={() => void load()}>
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

      {isEmpty ? (
        <SectionCard bodyClassName="!p-6">
          {tab === "citas" ? (
            <p className="text-sm font-medium text-slate-700">
              No hay citas en los próximos {dias} días.
            </p>
          ) : (
            <>
              <p className="text-sm font-medium text-slate-700">
                Ninguna clienta tiene retoque ni retiro en los próximos {dias} días.
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Las fechas salen al finalizar una atención. Para que se calculen, el servicio necesita sus días
                de retoque/retiro y su categoría debe tener activado "Tiene mantenimiento" o "Tiene retiro".
              </p>
            </>
          )}
        </SectionCard>
      ) : tab === "citas" ? (
        <DataTable
          key="citas"
          data={citaRows}
          columns={citaColumns}
          loading={isLoading}
          defaultLimit={25}
          availableLimits={[10, 25, 50, 100]}
          globalSearchPlaceholder="Buscar por clienta, servicio o sucursal..."
        />
      ) : (
        <DataTable
          key="retoques"
          data={tableRows}
          columns={columns}
          loading={isLoading}
          defaultLimit={25}
          availableLimits={[10, 25, 50, 100]}
          globalSearchPlaceholder="Buscar por clienta o servicio..."
        />
      )}

      <ReminderModal
        cita={reminderCita}
        fecha={reminderCita ? formatDay(reminderCita.fecha_hora) : ""}
        hora={reminderCita ? reminderCita.fecha_hora.slice(11, 16) : ""}
        onClose={() => setReminderCita(null)}
        onSent={(result) => handleReminderSent(result.appointment_id, result.created_at)}
      />
    </div>
  );
}
