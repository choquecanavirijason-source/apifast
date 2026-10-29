import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { BellRing, Mail, Smartphone } from "lucide-react";
import { ClientService, type CitaProximaRow } from "@/core/services/client/client.service";
import type { ReminderChannels } from "@/core/services/agenda/agenda.service";
import { STATUS_LABELS } from "@/pages/admin/calendar/calendar.constants";
import { Button } from "@/components/common/ui";
import DataTable, { type DataTableColumn } from "@/components/common/table/DataTable";
import ReminderModal, { ReminderChannelPicker } from "./ReminderModal";
import { AddEmailSenderModal, EmailSenderSelect, effectiveSender } from "./EmailSenderControls";
import TabLayout, { BranchSelect, EmptyCard, RangeSelect } from "./TabLayout";
import type { BranchSelection } from "./hooks/useBranchSelection";
import { useAsyncList } from "./hooks/useAsyncList";
import { useEmailSender } from "./hooks/useEmailSender";
import { notifyBatchOutcome, sendReminderBatch } from "./reminderBatch";
import { formatAppointment, formatDay, formatTime, haceLabel, parseUtc } from "./notificaciones.utils";

type CitaTableRow = CitaProximaRow & { id: number };

interface CitasTabProps {
  tabs: ReactNode;
  branch: BranchSelection;
  canChooseBranch: boolean;
  canSendReminder: boolean;
  dias: number;
  onDiasChange: (value: number) => void;
}

const channelsTitle = (channels: ReminderChannels) =>
  [channels.push && "Push", channels.email && "Correo"].filter(Boolean).join(" + ");

export default function CitasTab({ tabs, branch, canChooseBranch, canSendReminder, dias, onDiasChange }: CitasTabProps) {
  const fetchCitas = useCallback(
    () => ClientService.listCitasProximas({ dias, branch_id: branch.branchId ?? undefined }),
    [dias, branch.branchId],
  );
  const { data: citas, setData: setCitas, isLoading, error, reload } = useAsyncList(
    fetchCitas,
    "No se pudo cargar las próximas citas.",
  );
  const [reminderCita, setReminderCita] = useState<CitaProximaRow | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [isSendingBatch, setIsSendingBatch] = useState(false);
  const sendingBatch = useRef(false);
  // Canales de "Enviar a seleccionados" y con los que abre el modal de cada cita.
  const [channels, setChannels] = useState<ReminderChannels>({ push: true, email: false });
  // El remitente elegido en el modal se reusa en los siguientes envíos.
  const sender = useEmailSender(canSendReminder);
  // Reloj para "Enviado hace X min" del último recordatorio.
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);
  useEffect(() => setSelected(new Set()), [dias, branch.branchId]);
  useEffect(() => {
    const ids = new Set(citas.map((row) => row.appointment_id));
    setSelected((current) => new Set([...current].filter((id) => ids.has(id))));
  }, [citas]);

  const citaRows = useMemo<CitaTableRow[]>(() => citas.map((row) => ({ ...row, id: row.appointment_id })), [citas]);
  const selectedRows = citas.filter((row) => selected.has(row.appointment_id));
  const allSelected = citas.length > 0 && selectedRows.length === citas.length;
  const busy = isLoading || isSendingBatch;

  const markSent = (appointmentId: number, createdAt: string) => {
    setCitas((current) =>
      current.map((row) => (row.appointment_id === appointmentId ? { ...row, ultimo_recordatorio: createdAt } : row)),
    );
    setNow(Date.now());
  };

  const toggleSelected = (appointmentId: number, checked: boolean) =>
    setSelected((current) => {
      const next = new Set(current);
      if (checked) next.add(appointmentId);
      else next.delete(appointmentId);
      return next;
    });

  const handleSendSelected = async () => {
    if (sendingBatch.current || isLoading || !canSendReminder || !selectedRows.length) return;
    sendingBatch.current = true;
    setIsSendingBatch(true);
    try {
      const from = channels.email ? effectiveSender(sender.emailSender, sender.emailFrom) : null;
      const outcome = await sendReminderBatch([...selectedRows], channels, from, (cita, result) => {
        markSent(result.appointment_id, result.created_at);
        toggleSelected(cita.appointment_id, false);
      });
      notifyBatchOutcome(outcome);
    } finally {
      sendingBatch.current = false;
      setIsSendingBatch(false);
    }
  };

  const columns: DataTableColumn<CitaTableRow>[] = [
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
          {channels.email && !row.tiene_email ? (
            <span className="text-xs font-medium text-amber-700" title="No se le puede enviar el recordatorio por correo">
              Sin correo
            </span>
          ) : null}
          {row.ultimo_recordatorio ? (
            <span className="text-xs text-slate-500">
              Enviado {haceLabel(Math.max(0, now - parseUtc(row.ultimo_recordatorio)))}
            </span>
          ) : null}
        </div>
      ),
    },
  ];

  if (canSendReminder) {
    columns.push(
      {
        key: "seleccion",
        header: "Seleccionar",
        searchable: false,
        filterable: false,
        renderHeader: () => (
          <label className="inline-flex items-center gap-1.5 whitespace-nowrap text-xs font-medium">
            <input
              type="checkbox"
              aria-label="Marcar todas las citas del rango y sucursal seleccionados"
              title="Selecciona todas las citas cargadas, incluidas las de otras páginas"
              checked={allSelected}
              ref={(input) => {
                if (input) input.indeterminate = selectedRows.length > 0 && !allSelected;
              }}
              disabled={busy || !citas.length}
              onChange={(event) =>
                setSelected(event.target.checked ? new Set(citas.map((row) => row.appointment_id)) : new Set())
              }
              className="h-4 w-4 accent-brand"
            />
            Todos
          </label>
        ),
        render: (row) => (
          <input
            type="checkbox"
            aria-label={`Seleccionar cita de ${row.clienta} del ${formatAppointment(row.fecha_hora)}`}
            checked={selected.has(row.appointment_id)}
            disabled={busy}
            onChange={(event) => toggleSelected(row.appointment_id, event.target.checked)}
            className="h-4 w-4 accent-brand"
          />
        ),
      },
      {
        key: "recordatorio",
        header: "Recordatorio",
        render: (row) => (
          <Button
            variant="outline"
            size="sm"
            leftIcon={<BellRing className="h-3.5 w-3.5" />}
            disabled={isSendingBatch}
            onClick={() => setReminderCita(row)}
            title={`Abre el envío con: ${channelsTitle(channels)}`}
          >
            Enviar recordatorio
            <span className="ml-1 inline-flex items-center gap-1 text-slate-400" aria-hidden>
              {channels.push ? <Smartphone className="h-3.5 w-3.5" /> : null}
              {channels.email ? <Mail className="h-3.5 w-3.5" /> : null}
            </span>
          </Button>
        ),
      },
    );
  }

  return (
    <TabLayout
      tabs={tabs}
      title="Próximas citas"
      subtitle={`Citas no canceladas de los próximos ${dias} días.`}
      error={error}
      actions={
        <>
          {canChooseBranch && <BranchSelect branch={branch} disabled={isSendingBatch} />}
          <RangeSelect value={dias} onChange={onDiasChange} disabled={isSendingBatch} />
          {canSendReminder && (
            <>
              <ReminderChannelPicker value={channels} onChange={setChannels} disabled={isSendingBatch} />
              {channels.email && sender.emailSender?.configured && (
                <label
                  className="inline-flex h-9 min-w-0 max-w-full items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 pl-2.5 pr-1"
                  title="Correo emisor de los recordatorios"
                >
                  <Mail className="h-3.5 w-3.5 shrink-0 text-slate-500" aria-hidden />
                  <span className="whitespace-nowrap text-xs font-semibold text-slate-600">Desde:</span>
                  <EmailSenderSelect
                    sender={sender.emailSender}
                    value={sender.emailFrom}
                    onChange={sender.setEmailFrom}
                    onAddRequest={() => sender.setAddSenderOpen(true)}
                    disabled={isSendingBatch}
                    className="!h-7 !text-xs"
                  />
                </label>
              )}
              <Button
                variant="secondary"
                size="sm"
                leftIcon={<BellRing className="h-3.5 w-3.5" />}
                disabled={busy || !selectedRows.length}
                onClick={() => void handleSendSelected()}
              >
                {isSendingBatch ? "Enviando..." : `Enviar a seleccionados (${selectedRows.length})`}
              </Button>
            </>
          )}
          <Button variant="secondary" size="sm" disabled={busy} onClick={() => void reload()}>
            Actualizar
          </Button>
        </>
      }
    >
      {!isLoading && !error && citas.length === 0 ? (
        <EmptyCard>
          <p className="text-sm font-medium text-slate-700">No hay citas en los próximos {dias} días.</p>
        </EmptyCard>
      ) : (
        <DataTable
          data={citaRows}
          columns={columns}
          loading={isLoading}
          defaultLimit={25}
          availableLimits={[10, 25, 50, 100]}
          globalSearchPlaceholder="Buscar por clienta, servicio o sucursal..."
        />
      )}

      <ReminderModal
        cita={reminderCita}
        fecha={reminderCita ? formatDay(reminderCita.fecha_hora) : ""}
        hora={reminderCita ? formatTime(reminderCita.fecha_hora) : ""}
        defaultChannels={channels}
        emailSender={sender.emailSender}
        emailFrom={sender.emailFrom}
        onEmailFromChange={sender.setEmailFrom}
        onAddSender={() => sender.setAddSenderOpen(true)}
        onClose={() => setReminderCita(null)}
        onSent={(result) => {
          markSent(result.appointment_id, result.created_at);
          setReminderCita(null);
        }}
      />

      {/* Después del modal de envío para quedar encima de él. */}
      <AddEmailSenderModal
        isOpen={sender.addSenderOpen}
        sender={sender.emailSender}
        onClose={() => sender.setAddSenderOpen(false)}
        onSaved={sender.handleSenderSaved}
      />
    </TabLayout>
  );
}
