import { useEffect, useMemo, useState, type FormEvent } from "react";
import { CalendarDays, Clock, Scissors, User, X } from "lucide-react";
import { toast } from "react-toastify";
import GenericModal from "../../../../components/common/modal/GenericModal";
import { Button } from "../../../../components/common/ui";
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

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (toMinutes(endTime) - toMinutes(startTime) < 15) {
      toast.warning("La hora de fin debe ser al menos 15 minutos después del inicio.");
      return;
    }
    if (serviceIds.length === 0) {
      toast.warning("La reserva debe tener al menos un servicio.");
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
          <Button type="button" variant="ghost" size="sm" onClick={onClose} disabled={isSaving}>
            Cancelar
          </Button>
          <Button type="submit" size="sm" disabled={isSaving}>
            {isSaving ? "Guardando…" : "Guardar cambios"}
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
            <input type="time" required step={900} value={endTime} onChange={(e) => setEndTime(e.target.value)} className={fieldClass} />
          </label>
        </div>

        <label className="block">
          <span className={labelClass}>
            <User className="h-3.5 w-3.5" /> Operaria
          </span>
          <select value={professionalId} onChange={(e) => setProfessionalId(e.target.value)} className={fieldClass}>
            <option value="">Sin asignar</option>
            {branchProfessionals.map((p) => (
              <option key={p.id} value={p.id}>
                {p.username}
              </option>
            ))}
          </select>
        </label>

        <div>
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
              if (id) setServiceIds((prev) => [...prev, id]);
            }}
            className={`${fieldClass} mt-2`}
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
    </GenericModal>
  );
}
