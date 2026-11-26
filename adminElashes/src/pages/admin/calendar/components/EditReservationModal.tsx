import { useEffect, useMemo, useState, type FormEvent } from "react";
import { CalendarDays, Clock, Scissors, User, X } from "lucide-react";
import { toast } from "react-toastify";
import GenericModal from "../../../../components/common/modal/GenericModal";
import { Button } from "../../../../components/common/ui";
import { ConfirmDialog } from "../../../../components/common/ConfirmDialog";
import {
  AgendaService,
  type ProfessionalForSelect,
  type ServiceOption,
  type TicketItem,
} from "../../../../core/services/agenda/agenda.service";
import { getApiErrorMessage } from "../../../../core/utils/apiError";
import { formatLocalDateTime, parseTicketDate, toIsoDate } from "../dailyAgenda.utils";

type EditReservationModalProps = {
  ticket: TicketItem | null;
  onClose: () => void;
  onSaved: (updated: TicketItem) => void;
  /** Texto del botón de guardar (p. ej. cuando guardar también pasa la reserva a servicio). */
  saveLabel?: string;
  /** Se abrió para asignar la operaria (p. ej. al pasar a servicio sin operaria): se resalta ese campo. */
  needsOperaria?: boolean;
  /** Cuántos otros tickets pendientes de la misma venta y clienta se pueden unir a este. */
  mergeableCount?: number;
  branchId: number | null;
  services: ServiceOption[];
  professionals: ProfessionalForSelect[];
};

const fieldClass =
  "h-9 w-full rounded-lg border border-[var(--ui-border-strong)] bg-[var(--ui-input)] px-2.5 text-xs text-[var(--ui-text)] outline-none transition focus:border-brand-secondary focus:ring-2 focus:ring-brand-secondary/20";
const labelClass = "mb-1 flex items-center gap-1.5 text-xs font-medium text-[var(--ui-text-muted)]";

const toHm = (date: Date) =>
  `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
const toMinutes = (hm: string) => {
  const [h, m] = hm.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
};

/** Edición rápida de una reserva (doble clic en la agenda), estilo detalle de evento de Apple Calendar. */
export default function EditReservationModal({
  ticket,
  onClose,
  onSaved,
  saveLabel,
  needsOperaria = false,
  mergeableCount = 0,
  branchId,
  services,
  professionals,
}: EditReservationModalProps) {
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("10:00");
  const [professionalId, setProfessionalId] = useState("");
  const [serviceIds, setServiceIds] = useState<number[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [confirmSplit, setConfirmSplit] = useState(false);
  const [confirmMerge, setConfirmMerge] = useState(false);
  // Campo que falta o está mal: se resalta en rojo, se lleva a la vista y se explica debajo.
  const [invalid, setInvalid] = useState<"operaria" | "services" | "time" | null>(null);
  const flag = (field: "operaria" | "services" | "time", id: string) => {
    setInvalid(field);
    window.setTimeout(() => {
      const el = document.getElementById(id);
      el?.scrollIntoView({ block: "center", behavior: "smooth" });
      el?.focus({ preventScroll: true });
    }, 30);
  };
  useEffect(() => {
    if (ticket && needsOperaria && !ticket.professional_id) flag("operaria", "edit-res-operaria");
    else setInvalid(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticket?.id, needsOperaria]);

  useEffect(() => {
    if (!ticket) return;
    const start = parseTicketDate(ticket.start_time);
    const end = parseTicketDate(ticket.end_time);
    setDate(toIsoDate(start));
    setStartTime(toHm(start));
    setEndTime(Number.isNaN(end.getTime()) ? toHm(new Date(start.getTime() + 60 * 60_000)) : toHm(end));
    setProfessionalId(ticket.professional_id != null ? String(ticket.professional_id) : "");
    setServiceIds(ticket.service_ids?.length ? ticket.service_ids : ticket.service_id != null ? [ticket.service_id] : []);
  }, [ticket]);

  const branchProfessionals = useMemo(() => {
    if (!branchId) return professionals;
    return professionals.filter((p) => p.branch_id == null || Number(p.branch_id) === branchId);
  }, [branchId, professionals]);

  const availableServices = useMemo(
    () => services.filter((s) => s.is_active !== false && !serviceIds.includes(s.id)),
    [serviceIds, services],
  );

  const durationLabel = useMemo(() => {
    const minutes = toMinutes(endTime) - toMinutes(startTime);
    if (minutes <= 0) return null;
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return h > 0 ? `${h} h${m ? ` ${m} min` : ""}` : `${m} min`;
  }, [startTime, endTime]);

  if (!ticket) return null;

  const canSplit =
    ticket != null &&
    (ticket.service_ids?.length ?? 0) > 1 &&
    ["pending", "confirmed", "waiting"].includes(ticket.status);
  const handleSplit = async () => {
    if (!ticket) return;
    setIsSaving(true);
    try {
      const parts = await AgendaService.splitAppointment(ticket.id);
      toast.success(`Separado en ${parts.length} tickets, uno por servicio.`);
      onSaved(parts[0]);
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, "No se pudo separar el ticket."));
    } finally {
      setIsSaving(false);
    }
  };

  const canMerge = ticket != null && mergeableCount > 0 && ["pending", "confirmed", "waiting"].includes(ticket.status);
  const handleMerge = async () => {
    if (!ticket) return;
    setIsSaving(true);
    try {
      const merged = await AgendaService.mergeAppointment(ticket.id);
      toast.success(`Unidos en un solo ticket con ${merged.service_ids?.length ?? 0} servicios.`);
      onSaved(merged);
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, "No se pudo unir los tickets."));
    } finally {
      setIsSaving(false);
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (toMinutes(endTime) - toMinutes(startTime) < 15) {
      flag("time", "edit-res-end");
      return;
    }
    if (serviceIds.length === 0) {
      flag("services", "edit-res-services");
      return;
    }
    const [year, month, day] = date.split("-").map(Number);
    const at = (hm: string) => {
      const minutes = toMinutes(hm);
      return formatLocalDateTime(new Date(year, (month || 1) - 1, day || 1, Math.floor(minutes / 60), minutes % 60, 0));
    };
    const originalServices = ticket.service_ids?.length ? ticket.service_ids : ticket.service_id != null ? [ticket.service_id] : [];
    const servicesChanged =
      originalServices.length !== serviceIds.length || originalServices.some((id, i) => id !== serviceIds[i]);

    setIsSaving(true);
    try {
      const updated = await AgendaService.updateAppointment(ticket.id, {
        start_time: at(startTime),
        end_time: at(endTime),
        professional_id: professionalId ? Number(professionalId) : null,
        ...(servicesChanged ? { service_ids: serviceIds, service_id: serviceIds[0] } : {}),
        ...(branchId != null ? { branch_id: branchId } : {}),
      });
      toast.success("Reserva actualizada.");
      onSaved(updated);
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, "No se pudo actualizar la reserva."));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <GenericModal
      isOpen
      onClose={onClose}
      title="Editar reserva"
      size="md"
      asForm
      onSubmit={handleSubmit}
      footer={
        <>
          {canSplit && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setConfirmSplit(true)}
              disabled={isSaving}
              className="mr-auto"
              title="Un ticket por servicio, uno detrás de otro, con la misma venta"
            >
              Separar en {ticket?.service_ids?.length} tickets
            </Button>
          )}
          {canMerge && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setConfirmMerge(true)}
              disabled={isSaving}
              className={canSplit ? "" : "mr-auto"}
              title="Junta en este ticket los demás tickets pendientes de la misma venta"
            >
              Unir {mergeableCount + 1} tickets
            </Button>
          )}
          <Button type="button" variant="ghost" size="sm" onClick={onClose} disabled={isSaving}>
            Cancelar
          </Button>
          <Button type="submit" size="sm" disabled={isSaving}>
            {isSaving ? "Guardando…" : (saveLabel ?? "Guardar cambios")}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-2 rounded-lg border border-[var(--ui-border)] bg-[var(--ui-surface-muted)] px-3 py-2">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 truncate text-sm font-semibold text-[var(--ui-text)]">
              <User className="h-3.5 w-3.5 shrink-0" /> {ticket.client_name}
            </p>
            <p className="mt-0.5 text-xs text-[var(--ui-text-muted)]">
              {ticket.ticket_code ?? `Reserva #${ticket.id}`}
              {ticket.client_phone ? ` · ${ticket.client_phone}` : ""}
            </p>
          </div>
          {ticket.sale_id ? (
            <span className="shrink-0 rounded-full bg-brand/10 px-2 py-0.5 text-[11px] font-medium text-brand">
              Venta #{ticket.sale_id}
            </span>
          ) : null}
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <label className="block">
            <span className={labelClass}>
              <CalendarDays className="h-3.5 w-3.5" /> Fecha
            </span>
            <input type="date" required value={date} onChange={(e) => setDate(e.target.value)} className={fieldClass} />
          </label>
          <label className="block">
            <span className={labelClass}>
              <Clock className="h-3.5 w-3.5" /> Inicio
            </span>
            <input
              type="time"
              required
              step={900}
              value={startTime}
              onChange={(e) => {
                // Al mover el inicio se conserva la duración, como en Apple Calendar.
                const duration = toMinutes(endTime) - toMinutes(startTime);
                const next = toMinutes(e.target.value) + Math.max(15, duration);
                setStartTime(e.target.value);
                if (next < 24 * 60) {
                  setEndTime(`${String(Math.floor(next / 60)).padStart(2, "0")}:${String(next % 60).padStart(2, "0")}`);
                }
              }}
              className={fieldClass}
            />
          </label>
          <label className="block">
            <span className={labelClass}>
              <Clock className="h-3.5 w-3.5" /> Fin {durationLabel ? <span className="font-normal">· {durationLabel}</span> : null}
            </span>
            <input
              id="edit-res-end"
              type="time"
              required
              step={900}
              value={endTime}
              onChange={(e) => { setEndTime(e.target.value); setInvalid(null); }}
              className={`${fieldClass} ${invalid === "time" ? "!border-rose-500 !ring-2 !ring-rose-200" : ""}`}
            />
            {invalid === "time" && <span className="mt-1 block text-[11px] font-medium text-rose-600">La hora de fin debe ser al menos 15 minutos después del inicio.</span>}
          </label>
        </div>

        <label className="block">
          <span className={labelClass}>
            <User className="h-3.5 w-3.5" /> Operaria
          </span>
          <select
            id="edit-res-operaria"
            value={professionalId}
            onChange={(e) => { setProfessionalId(e.target.value); setInvalid(null); }}
            aria-invalid={invalid === "operaria" && !professionalId}
            className={`${fieldClass} ${invalid === "operaria" && !professionalId ? "!border-rose-500 !ring-2 !ring-rose-200" : ""}`}
          >
            <option value="">Sin asignar</option>
            {branchProfessionals.map((p) => (
              <option key={p.id} value={p.id}>
                {p.username}
              </option>
            ))}
          </select>
          {invalid === "operaria" && !professionalId && (
            <span className="mt-1 block text-[11px] font-medium text-rose-600">Elige la operaria que atenderá para continuar.</span>
          )}
        </label>

        <div id="edit-res-services" tabIndex={-1} className={invalid === "services" && serviceIds.length === 0 ? "rounded-lg ring-2 ring-rose-200 outline-none" : "outline-none"}>
          <span className={labelClass}>
            <Scissors className="h-3.5 w-3.5" /> Servicios
          </span>
          <div className="flex flex-wrap gap-1.5">
            {serviceIds.map((id) => {
              const svc = services.find((s) => s.id === id);
              return (
                <span
                  key={id}
                  className="inline-flex items-center gap-1 rounded-full bg-[var(--ui-accent-soft)] py-0.5 pl-2 pr-1 text-[11px] font-medium text-[var(--ui-accent)]"
                >
                  {svc?.name ?? `Servicio #${id}`}
                  <button
                    type="button"
                    aria-label={`Quitar ${svc?.name ?? "servicio"}`}
                    onClick={() => setServiceIds((prev) => prev.filter((x) => x !== id))}
                    className="rounded-full p-0.5 hover:bg-black/10"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              );
            })}
          </div>
          <select
            value=""
            onChange={(e) => {
              const id = Number(e.target.value);
              if (id) { setServiceIds((prev) => [...prev, id]); setInvalid(null); }
            }}
            className={`${fieldClass} mt-2 ${invalid === "services" && serviceIds.length === 0 ? "!border-rose-500 !ring-2 !ring-rose-200" : ""}`}
          >
            <option value="">+ Agregar servicio…</option>
            {availableServices.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} · {s.duration_minutes} min
              </option>
            ))}
          </select>
        </div>
      </div>
      <ConfirmDialog
        isOpen={confirmMerge}
        title="Unir tickets"
        message={
          <p>
            Se juntan en este ticket los servicios de los otros <strong>{mergeableCount}</strong> ticket(s) de la misma
            venta, uno detrás de otro. Los otros tickets se eliminan; el monto de la venta no cambia.
          </p>
        }
        confirmText="Sí, unir"
        cancelText="No"
        isProcessing={isSaving}
        onConfirm={() => {
          setConfirmMerge(false);
          void handleMerge();
        }}
        onCancel={() => setConfirmMerge(false)}
      />

      <ConfirmDialog
        isOpen={confirmSplit}
        title="Separar en tickets"
        message={
          <p>
            Se crea un ticket por cada servicio ({ticket?.service_ids?.length}), uno detrás de otro desde las{" "}
            <strong>{startTime}</strong>. El monto de la venta no cambia.
          </p>
        }
        confirmText="Sí, separar"
        cancelText="No"
        isProcessing={isSaving}
        onConfirm={() => {
          setConfirmSplit(false);
          void handleSplit();
        }}
        onCancel={() => setConfirmSplit(false)}
      />
    </GenericModal>
  );
}
