import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Eye, Mail, Megaphone, Smartphone } from "lucide-react";
import { BroadcastService, type Broadcast } from "@/core/services/broadcast/broadcast.service";
import { Button } from "@/components/common/ui";
import DataTable, { type DataTableColumn } from "@/components/common/table/DataTable";
import TabLayout, { EmptyCard } from "../TabLayout";
import type { BranchSelection } from "../hooks/useBranchSelection";
import { useAsyncList } from "../hooks/useAsyncList";
import { toAbsoluteMediaUrl } from "@/core/services/app-settings/app-settings.service";
import BroadcastComposer from "./BroadcastComposer";
import BroadcastDetailModal from "./BroadcastDetailModal";
import { clientasLabel, formatBroadcastDate } from "./broadcast.format";
import { STATUS_META, audienceSummary, kindOption } from "./broadcast.constants";

// Mientras haya uno enviándose, el historial se refresca para mostrar el avance.
const POLL_MS = 3000;

interface ComunicadosTabProps {
  tabs: ReactNode;
  branch: BranchSelection;
  canChooseBranch: boolean;
}

function ChannelResult({ icon: Icon, sent, failed }: { icon: typeof Mail; sent: number; failed: number }) {
  return (
    <span className="inline-flex items-center gap-1 text-xs text-slate-600">
      <Icon className="h-3.5 w-3.5 text-slate-400" aria-hidden />
      {sent} enviados
      {failed ? <span className="text-rose-600">· {failed} fallidos</span> : null}
    </span>
  );
}

const historyColumns = (onOpenDetail: (broadcast: Broadcast) => void): DataTableColumn<Broadcast>[] => [
  {
    key: "created_at",
    header: "Fecha",
    getValue: (row) => row.created_at,
    render: (row) => <span className="whitespace-nowrap">{formatBroadcastDate(row.created_at)}</span>,
    sortable: true,
  },
  {
    key: "kind",
    header: "Tipo",
    getValue: (row) => kindOption(row.kind).label,
    render: (row) => (
      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${kindOption(row.kind).badgeClass}`}>
        {kindOption(row.kind).label}
      </span>
    ),
    filterable: true,
  },
  {
    key: "title",
    header: "Comunicado",
    getValue: (row) => `${row.title} ${row.body}`,
    render: (row) => (
      <div className="flex max-w-md items-center gap-3" title={row.body}>
        {row.image_url ? (
          <img
            src={toAbsoluteMediaUrl(row.image_url) ?? undefined}
            alt=""
            className="h-10 w-10 shrink-0 rounded-md border border-slate-200 object-cover"
          />
        ) : null}
        <div className="flex min-w-0 flex-col">
          <span className="font-semibold text-slate-800">{row.title}</span>
          <span className="truncate text-xs text-slate-500">{row.body}</span>
        </div>
      </div>
    ),
  },
  {
    key: "audience",
    header: "Grupo",
    getValue: audienceSummary,
    render: (row) => (
      <div className="flex flex-col text-xs">
        <span className="text-slate-700">{audienceSummary(row)}</span>
        <span className="text-slate-500">{clientasLabel(row.recipients_count)}</span>
      </div>
    ),
  },
  {
    key: "result",
    header: "Resultado",
    searchable: false,
    render: (row) => (
      <div className="flex flex-col gap-0.5">
        {row.send_push ? <ChannelResult icon={Smartphone} sent={row.push_sent} failed={row.push_failed} /> : null}
        {row.send_email ? <ChannelResult icon={Mail} sent={row.email_sent} failed={row.email_failed} /> : null}
      </div>
    ),
  },
  {
    key: "status",
    header: "Estado",
    getValue: (row) => STATUS_META[row.status].label,
    render: (row) => (
      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_META[row.status].className}`}>
        {STATUS_META[row.status].label}
      </span>
    ),
    filterable: true,
  },
  {
    key: "created_by_name",
    header: "Enviado por",
    getValue: (row) => row.created_by_name ?? "",
    render: (row) => row.created_by_name ?? <span className="text-slate-400">—</span>,
  },
  {
    key: "detail",
    header: "Detalle",
    searchable: false,
    render: (row) => (
      <Button variant="outline" size="sm" leftIcon={<Eye className="h-3.5 w-3.5" />} onClick={() => onOpenDetail(row)}>
        Ver detalle
      </Button>
    ),
  },
];

export default function ComunicadosTab({ tabs, branch, canChooseBranch }: ComunicadosTabProps) {
  const fetchHistory = useCallback(() => BroadcastService.list(), []);
  const { data, setData, isLoading, error, reload } = useAsyncList(fetchHistory, "No se pudo cargar el historial.");
  const [composerOpen, setComposerOpen] = useState(false);
  const [detailId, setDetailId] = useState<number | null>(null);
  // Se busca en la lista para que el detalle refleje el avance del sondeo.
  const detail = data.find((broadcast) => broadcast.id === detailId) ?? null;
  const columns = useMemo(() => historyColumns((broadcast) => setDetailId(broadcast.id)), []);
  const isSending = data.some((broadcast) => broadcast.status === "sending");

  useEffect(() => {
    if (!isSending) return;
    const id = window.setInterval(() => void reload({ silent: true }), POLL_MS);
    return () => window.clearInterval(id);
  }, [isSending, reload]);

  const handleSent = (broadcast: Broadcast) => {
    setComposerOpen(false);
    setData((current) => [broadcast, ...current]);
  };

  return (
    <TabLayout
      tabs={tabs}
      title="Comunicados"
      subtitle="Avisos, promociones y novedades para un grupo de clientas o para todas, por push y correo."
      error={error}
      actions={
        <>
          <Button
            size="sm"
            leftIcon={<Megaphone className="h-3.5 w-3.5" />}
            disabled={isSending}
            title={isSending ? "Espera a que termine el envío en curso" : undefined}
            onClick={() => setComposerOpen(true)}
          >
            Nuevo comunicado
          </Button>
          <Button variant="secondary" size="sm" disabled={isLoading} onClick={() => void reload()}>
            Actualizar
          </Button>
        </>
      }
    >
      {!isLoading && !error && data.length === 0 ? (
        <EmptyCard>
          <p className="text-sm font-medium text-slate-700">Todavía no enviaste ningún comunicado.</p>
          <p className="mt-1 text-xs text-slate-500">
            Usa "Nuevo comunicado" para avisar un cierre, lanzar una promoción o contar una novedad.
          </p>
        </EmptyCard>
      ) : (
        <DataTable
          data={data}
          columns={columns}
          loading={isLoading}
          defaultLimit={25}
          availableLimits={[10, 25, 50, 100]}
          globalSearchPlaceholder="Buscar por título o mensaje..."
        />
      )}

      <BroadcastDetailModal broadcast={detail} onClose={() => setDetailId(null)} />

      <BroadcastComposer
        isOpen={composerOpen}
        onClose={() => setComposerOpen(false)}
        onSent={handleSent}
        canChooseBranch={canChooseBranch}
        branches={branch.branches}
        defaultBranchId={branch.branchId}
      />
    </TabLayout>
  );
}
