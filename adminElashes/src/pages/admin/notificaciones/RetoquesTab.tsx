import { useCallback, useMemo, useState, type ReactNode } from "react";
import { toast } from "react-toastify";
import { ClientService, type RetoqueRow } from "@/core/services/client/client.service";
import { getApiErrorMessage } from "@/core/utils/apiError";
import { Button } from "@/components/common/ui";
import DataTable, { type DataTableColumn } from "@/components/common/table/DataTable";
import TabLayout, { BranchSelect, EmptyCard, RangeSelect } from "./TabLayout";
import type { BranchSelection } from "./hooks/useBranchSelection";
import { useAsyncList } from "./hooks/useAsyncList";
import { diasLabel, formatAppointment, formatDay } from "./notificaciones.utils";

// DataTable necesita un id por fila; una clienta puede tener una por tipo.
type RetoqueTableRow = RetoqueRow & { id: string };

interface RetoquesTabProps {
  tabs: ReactNode;
  branch: BranchSelection;
  canChooseBranch: boolean;
  canManage: boolean;
  dias: number;
  onDiasChange: (value: number) => void;
}

const tipoLabel = (row: RetoqueRow) => (row.tipo === "mantenimiento" ? "Mantenimiento" : "Retiro");

export default function RetoquesTab({ tabs, branch, canChooseBranch, canManage, dias, onDiasChange }: RetoquesTabProps) {
  const fetchRows = useCallback(
    () => ClientService.listRetoques({ dias, branch_id: branch.branchId ?? undefined }),
    [dias, branch.branchId],
  );
  const { data: rows, setData: setRows, isLoading, error, reload } = useAsyncList(
    fetchRows,
    "No se pudo cargar el estado de retoques.",
  );
  const [pending, setPending] = useState<Set<number>>(new Set());

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
        `Notificaciones ${result.notificaciones_activas ? "activadas" : "desactivadas"} para ${row.clienta}.`,
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
      getValue: tipoLabel,
      render: (row) => (
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
            row.tipo === "mantenimiento" ? "bg-sky-50 text-sky-700" : "bg-violet-50 text-violet-700"
          }`}
        >
          {tipoLabel(row)}
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
      render: (row) => (
        <div className="flex items-center gap-2">
          <button
            type="button"
            role="switch"
            aria-checked={row.notificaciones_activas}
            aria-label={`Notificaciones de ${row.clienta}`}
            disabled={!canManage || pending.has(row.client_id)}
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
      ),
    },
  ];

  return (
    <TabLayout
      tabs={tabs}
      title="Estado de retoques"
      subtitle={`Mantenimiento y retiro en los próximos ${dias} días, más los vencidos de la última semana.`}
      error={error}
      actions={
        <>
          {canChooseBranch && <BranchSelect branch={branch} />}
          <RangeSelect value={dias} onChange={onDiasChange} />
          <Button variant="secondary" size="sm" disabled={isLoading} onClick={() => void reload()}>
            Actualizar
          </Button>
        </>
      }
    >
      {!isLoading && !error && rows.length === 0 ? (
        <EmptyCard>
          <p className="text-sm font-medium text-slate-700">
            Ninguna clienta tiene retoque ni retiro en los próximos {dias} días.
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Las fechas salen al finalizar una atención. Para que se calculen, el servicio necesita sus días de
            retoque/retiro y su categoría debe tener activado "Tiene mantenimiento" o "Tiene retiro".
          </p>
        </EmptyCard>
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
    </TabLayout>
  );
}
