import { useCallback, useEffect, useState } from "react";
import { toast } from "react-toastify";
import { Download, Eye, History } from "lucide-react";
import Layout from "@/components/common/layout";
import { Button, SectionCard } from "@/components/common/ui";
import DataTable, { type DataTableAction, type DataTableColumn } from "@/components/common/table/DataTable";
import GenericModal from "@/components/common/modal/GenericModal";
import { AuditLogService, type AuditLogOut } from "@/core/services/audit-log/audit-log.service";
import { generateTablePdf } from "@/core/utils/generateTablePdf";

const fieldClass =
  "w-full rounded-sm border border-[#8a8886] bg-white px-3 py-2 text-sm text-[#323130] outline-none transition focus:border-[#0078d4] focus:ring-1 focus:ring-[#0078d4]/35";

const dateTimeFmt = (iso: string) =>
  iso ? new Date(iso).toLocaleString("es-BO", { dateStyle: "medium", timeStyle: "short" }) : "—";

const ACTION_LABELS: Record<string, string> = {
  create: "Creó",
  update: "Editó",
  delete: "Eliminó",
  cancel: "Canceló",
};

const ACTION_COLORS: Record<string, string> = {
  create: "bg-emerald-100 text-emerald-800",
  update: "bg-sky-100 text-sky-800",
  delete: "bg-rose-100 text-rose-800",
  cancel: "bg-amber-100 text-amber-800",
};

const ENTITY_LABELS: Record<string, string> = {
  service: "Servicio",
  appointment: "Cita / Ticket",
  pos_sale: "Venta",
  user: "Usuario",
  expense: "Gasto",
  cash_session: "Caja",
};

// ─── Modal: detalle de un movimiento ─────────────────────────────────────────

function AuditLogDetailModal({ log, onClose }: { log: AuditLogOut; onClose: () => void }) {
  const rows: { label: string; value: string }[] = [
    { label: "Fecha y hora", value: dateTimeFmt(log.created_at) },
    { label: "Usuario", value: log.user_name ?? "—" },
    { label: "Acción", value: ACTION_LABELS[log.action] ?? log.action },
    { label: "Módulo", value: ENTITY_LABELS[log.entity_type] ?? log.entity_type },
    { label: "ID del registro afectado", value: log.entity_id != null ? `#${log.entity_id}` : "—" },
    { label: "Sucursal", value: log.branch_name ?? "—" },
  ];

  return (
    <GenericModal isOpen onClose={onClose} title="Detalle del movimiento" size="sm">
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          {rows.map((r) => (
            <div key={r.label}>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[#605e5c]">{r.label}</p>
              <p className="text-sm font-medium text-[#323130]">{r.value}</p>
            </div>
          ))}
        </div>
        <div className="border-t border-[#edebe9] pt-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[#605e5c]">Descripción</p>
          <p className="mt-1 text-sm text-[#323130]">{log.description}</p>
        </div>
      </div>
    </GenericModal>
  );
}

export default function AuditLog() {
  const [logs, setLogs] = useState<AuditLogOut[]>([]);
  const [loading, setLoading] = useState(false);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [action, setAction] = useState("");
  const [entityType, setEntityType] = useState("");
  const [detailLog, setDetailLog] = useState<AuditLogOut | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await AuditLogService.list({
        from_date: fromDate || undefined,
        to_date: toDate || undefined,
        action: action || undefined,
        entity_type: entityType || undefined,
        limit: 200,
      });
      setLogs(data);
    } catch {
      toast.error("No se pudo cargar el registro de auditoría.");
    } finally {
      setLoading(false);
    }
  }, [fromDate, toDate, action, entityType]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleDownloadPdf = () => {
    void generateTablePdf({
      title: "Registro de auditoría",
      subtitle: `${logs.length} acción${logs.length !== 1 ? "es" : ""}`,
      filename: "registro-de-auditoria",
      orientation: "landscape",
      columns: [
        { header: "Fecha", key: "created_at" },
        { header: "Usuario", key: "user_name" },
        { header: "Sucursal", key: "branch_name" },
        { header: "Acción", key: "action" },
        { header: "Módulo", key: "entity_type" },
        { header: "Detalle", key: "description" },
      ],
      rows: logs.map((l) => ({
        created_at: dateTimeFmt(l.created_at),
        user_name: l.user_name ?? "—",
        branch_name: l.branch_name ?? "—",
        action: ACTION_LABELS[l.action] ?? l.action,
        entity_type: ENTITY_LABELS[l.entity_type] ?? l.entity_type,
        description: l.description,
      })),
    });
  };

  const columns: DataTableColumn<AuditLogOut>[] = [
    {
      key: "created_at",
      header: "Fecha",
      sortable: true,
      getValue: (l) => l.created_at,
      render: (l) => <span className="text-xs text-[#605e5c]">{dateTimeFmt(l.created_at)}</span>,
    },
    {
      key: "user_name",
      header: "Usuario",
      sortable: true,
      render: (l) => <span className="text-xs font-medium text-[#323130]">{l.user_name ?? "—"}</span>,
    },
    {
      key: "action",
      header: "Acción",
      sortable: true,
      render: (l) => (
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${ACTION_COLORS[l.action] ?? "bg-slate-100 text-slate-600"}`}>
          {ACTION_LABELS[l.action] ?? l.action}
        </span>
      ),
    },
    {
      key: "entity_type",
      header: "Módulo",
      sortable: true,
      render: (l) => <span className="text-xs text-[#605e5c]">{ENTITY_LABELS[l.entity_type] ?? l.entity_type}</span>,
    },
    {
      key: "description",
      header: "Detalle",
      render: (l) => <span className="text-xs text-[#323130]">{l.description}</span>,
    },
    {
      key: "branch_name",
      header: "Sucursal",
      sortable: true,
      render: (l) => <span className="text-xs text-[#605e5c]">{l.branch_name ?? "—"}</span>,
    },
  ];

  const actions: DataTableAction<AuditLogOut>[] = [
    {
      label: "Ver detalle",
      icon: <Eye className="h-4 w-4" />,
      onClick: (l) => setDetailLog(l),
    },
  ];

  return (
    <Layout title="Auditoría" subtitle="Quién editó, eliminó o canceló qué, y cuándo." variant="cards">
      <SectionCard bodyClassName="!p-4">
        <div className="grid gap-3 rounded-sm border border-[#d2d0ce] bg-[#faf9f8] p-3 sm:grid-cols-5">
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-[#605e5c]">Desde</label>
            <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className={`${fieldClass} mt-1`} />
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-[#605e5c]">Hasta</label>
            <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className={`${fieldClass} mt-1`} />
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-[#605e5c]">Acción</label>
            <select value={action} onChange={(e) => setAction(e.target.value)} className={`${fieldClass} mt-1`}>
              <option value="">Todas</option>
              {Object.entries(ACTION_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-[#605e5c]">Módulo</label>
            <select value={entityType} onChange={(e) => setEntityType(e.target.value)} className={`${fieldClass} mt-1`}>
              <option value="">Todos</option>
              {Object.entries(ENTITY_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
          <div className="flex items-end gap-2">
            <Button onClick={() => void load()} className="w-full">Filtrar</Button>
            <Button onClick={handleDownloadPdf} disabled={logs.length === 0} leftIcon={<Download className="h-3.5 w-3.5" />}>
              PDF
            </Button>
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title="Registro de acciones"
        subtitle={`${logs.length} acción${logs.length !== 1 ? "es" : ""}`}
        bodyClassName="!p-0"
      >
        {logs.length === 0 && !loading ? (
          <div className="flex flex-col items-center gap-2 py-10 text-center text-sm text-[#605e5c]">
            <History className="h-8 w-8 text-[#a19f9d]" />
            Sin acciones registradas en este rango.
          </div>
        ) : (
          <DataTable
            data={logs}
            columns={columns}
            actions={actions}
            loading={loading}
            enableGlobalSearch={false}
            enableColumnFilters={false}
            defaultLimit={20}
          />
        )}
      </SectionCard>
      {detailLog && <AuditLogDetailModal log={detailLog} onClose={() => setDetailLog(null)} />}
    </Layout>
  );
}
