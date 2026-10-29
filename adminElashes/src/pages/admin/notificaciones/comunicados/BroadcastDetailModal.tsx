import { useCallback, useEffect } from "react";
import { Mail, Smartphone, Users } from "lucide-react";
import GenericModal from "@/components/common/modal/GenericModal";
import DataTable, { type DataTableColumn } from "@/components/common/table/DataTable";
import {
  BroadcastService,
  type Broadcast,
  type BroadcastRecipient,
  type EmailDelivery,
  type PushDelivery,
} from "@/core/services/broadcast/broadcast.service";
import { toAbsoluteMediaUrl } from "@/core/services/app-settings/app-settings.service";
import { useAsyncList } from "../hooks/useAsyncList";
import { DELIVERY_META, STATUS_META, audienceSummary, kindOption } from "./broadcast.constants";
import { formatBroadcastDate } from "./broadcast.format";

const POLL_MS = 3000;

type RecipientRow = BroadcastRecipient & { id: number };

type Delivery = PushDelivery | EmailDelivery | null;

// Sin resultado: falta procesarla, o el envío se cortó antes de llegar a ella.
const emptyLabel = (sending: boolean) => (sending ? "Pendiente" : "No se envió");

function DeliveryBadge({ status, sending }: { status: Delivery; sending: boolean }) {
  if (!status) return <span className="text-xs text-slate-400">{emptyLabel(sending)}</span>;
  const meta = DELIVERY_META[status];
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${meta.className}`}>{meta.label}</span>;
}

function ChannelStat({ icon: Icon, label, value }: { icon: typeof Mail; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2">
      <Icon className="h-4 w-4 shrink-0 text-slate-500" aria-hidden />
      <span className="text-xs text-slate-500">{label}</span>
      <span className="ml-auto text-sm font-semibold text-slate-800">{value}</span>
    </div>
  );
}

function recipientColumns(broadcast: Broadcast): DataTableColumn<RecipientRow>[] {
  const sending = broadcast.status === "sending";
  const deliveryLabel = (status: Delivery) => (status ? DELIVERY_META[status].label : emptyLabel(sending));
  const columns: DataTableColumn<RecipientRow>[] = [
    {
      key: "name",
      header: "Clienta",
      render: (row) => (
        <div className="flex flex-col">
          <span className="font-semibold text-slate-800">{row.name}</span>
          <span className="text-xs text-slate-500">{[row.phone, row.email].filter(Boolean).join(" · ") || "—"}</span>
        </div>
      ),
      getValue: (row) => `${row.name} ${row.phone ?? ""} ${row.email ?? ""}`,
      sortable: true,
    },
    {
      key: "branch_name",
      header: "Sucursal",
      getValue: (row) => row.branch_name ?? "",
      render: (row) => row.branch_name ?? <span className="text-slate-400">—</span>,
      filterable: true,
    },
  ];
  if (broadcast.send_push)
    columns.push({
      key: "push_status",
      header: "Push",
      getValue: (row) => deliveryLabel(row.push_status),
      render: (row) => <DeliveryBadge status={row.push_status} sending={sending} />,
      filterable: true,
    });
  if (broadcast.send_email)
    columns.push({
      key: "email_status",
      header: "Correo",
      getValue: (row) => deliveryLabel(row.email_status),
      render: (row) => <DeliveryBadge status={row.email_status} sending={sending} />,
      filterable: true,
    });
  return columns;
}

interface BroadcastDetailModalProps {
  /** El del historial (se actualiza solo mientras se envía). */
  broadcast: Broadcast | null;
  onClose: () => void;
}

export default function BroadcastDetailModal({ broadcast, onClose }: BroadcastDetailModalProps) {
  const broadcastId = broadcast?.id;
  const fetchRecipients = useCallback(
    () => (broadcastId ? BroadcastService.listRecipients(broadcastId) : Promise.resolve([])),
    [broadcastId],
  );
  const { data, isLoading, error, reload } = useAsyncList(fetchRecipients, "No se pudo cargar las destinatarias.");
  const isSending = broadcast?.status === "sending";

  useEffect(() => {
    if (!isSending) return;
    const id = window.setInterval(() => void reload({ silent: true }), POLL_MS);
    return () => window.clearInterval(id);
  }, [isSending, reload]);

  if (!broadcast) return null;
  const image = toAbsoluteMediaUrl(broadcast.image_url);
  const kind = kindOption(broadcast.kind);
  const status = STATUS_META[broadcast.status];
  const rows: RecipientRow[] = data.map((row) => ({ ...row, id: row.client_id }));

  return (
    <GenericModal isOpen onClose={onClose} title="Detalle del comunicado" size="xl">
      <div className="flex flex-col gap-5">
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
          <span className={`rounded-full px-2 py-0.5 font-medium ${kind.badgeClass}`}>{kind.label}</span>
          <span className={`rounded-full px-2 py-0.5 font-medium ${status.className}`}>{status.label}</span>
          <span>{formatBroadcastDate(broadcast.created_at)}</span>
          {broadcast.created_by_name ? <span>· por {broadcast.created_by_name}</span> : null}
          <span>· {audienceSummary(broadcast)}</span>
        </div>

        <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_260px]">
          <div className="flex flex-col gap-3">
            <h3 className="text-lg font-semibold text-slate-800">{broadcast.title}</h3>
            <p className="whitespace-pre-line text-sm leading-relaxed text-slate-600">{broadcast.body}</p>
            {image ? (
              <a href={image} target="_blank" rel="noreferrer" title="Abrir la imagen en otra pestaña">
                <img src={image} alt="Imagen del comunicado" className="max-h-72 rounded-lg border border-slate-200 object-contain" />
              </a>
            ) : (
              <p className="text-xs text-slate-400">Sin imagen.</p>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <ChannelStat icon={Users} label="Clientas" value={String(broadcast.recipients_count)} />
            {broadcast.send_push ? (
              <ChannelStat
                icon={Smartphone}
                label="Push"
                value={`${broadcast.push_sent} enviados${broadcast.push_failed ? ` · ${broadcast.push_failed} fallidos` : ""}`}
              />
            ) : null}
            {broadcast.send_email ? (
              <ChannelStat
                icon={Mail}
                label="Correo"
                value={`${broadcast.email_sent} enviados${broadcast.email_failed ? ` · ${broadcast.email_failed} fallidos` : ""}`}
              />
            ) : null}
            {broadcast.send_email && broadcast.email_from ? (
              <p className="text-xs text-slate-500">Desde {broadcast.email_from}</p>
            ) : null}
            <p className="text-xs text-slate-400">El push se cuenta por celular: una clienta puede tener más de uno.</p>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <h4 className="text-sm font-semibold text-slate-700">Destinatarias</h4>
          {error ? <p className="text-sm text-rose-600">{error}</p> : null}
          <DataTable
            data={rows}
            columns={recipientColumns(broadcast)}
            loading={isLoading}
            defaultLimit={10}
            availableLimits={[10, 25, 50, 100]}
            globalSearchPlaceholder="Buscar por nombre, teléfono o correo..."
          />
        </div>
      </div>
    </GenericModal>
  );
}
