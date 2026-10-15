import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import { ClientService, type RetoqueRow } from "@/core/services/client/client.service";
import { BranchService } from "@/core/services/branch/branch.service";
import { BRANCH_STORAGE_KEY, getSelectedBranchId, setSelectedBranchId } from "@/core/utils/branch";
import { getApiErrorMessage } from "@/core/utils/apiError";
import useAuth from "@/core/hooks/useAuth";
import { Button, SectionCard } from "@/components/common/ui";
import DataTable, { type DataTableColumn } from "@/components/common/table/DataTable";

const fieldClass =
  "h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100";

const RANGOS = [7, 15, 30, 60];

// DataTable necesita un id por fila; una clienta puede tener una por tipo.
type RetoqueTableRow = RetoqueRow & { id: string };

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

// Las fechas llegan en hora de La Paz y sin zona: se formatean a mano, sin
// pasar por Date, para que el navegador no las corra de día.
const formatDay = (isoDate: string) => {
  const [year, month, day] = isoDate.slice(0, 10).split("-").map(Number);
  return `${day} ${MESES[month - 1]} ${year}`;
};

const formatAppointment = (isoDateTime: string) => `${formatDay(isoDateTime)} · ${isoDateTime.slice(11, 16)}`;

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

  const [rows, setRows] = useState<RetoqueRow[]>([]);
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

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      setRows(await ClientService.listRetoques({ dias, branch_id: branchId ?? undefined }));
    } catch (err) {
      setRows([]);
      setError(getApiErrorMessage(err, "No se pudo cargar el estado de retoques."));
    } finally {
      setIsLoading(false);
    }
  }, [dias, branchId]);

  useEffect(() => {
    void load();
  }, [load]);

  const tableRows = useMemo<RetoqueTableRow[]>(
    () => rows.map((row) => ({ ...row, id: `${row.seguimiento_id}-${row.tipo}` })),
    [rows],
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

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <SectionCard bodyClassName="!p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-800">Estado de retoques</h2>
            <p className="text-xs text-slate-500">
              Mantenimiento y retiro en los próximos {dias} días, más los vencidos de la última semana.
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

      {!isLoading && !error && rows.length === 0 ? (
        <SectionCard bodyClassName="!p-6">
          <p className="text-sm font-medium text-slate-700">
            Ninguna clienta tiene retoque ni retiro en los próximos {dias} días.
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Las fechas salen al finalizar una atención. Para que se calculen, el servicio necesita sus días
            de retoque/retiro y su categoría debe tener activado "Tiene mantenimiento" o "Tiene retiro".
          </p>
        </SectionCard>
      ) : (
        <DataTable
          data={tableRows}
          columns={columns}
          loading={isLoading}
          defaultLimit={25}
          availableLimits={[10, 25, 50, 100]}
          globalSearchPlaceholder="Buscar por clienta o servicio..."
        />
      )}
    </div>
  );
}
