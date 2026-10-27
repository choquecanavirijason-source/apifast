import { useEffect, useState, type FormEvent } from "react";
import { toast } from "react-toastify";
import GenericModal from "@/components/common/modal/GenericModal";
import { Button } from "@/components/common/ui";
import {
  AgendaService,
  MANUAL_REMINDER_MAX_LENGTH,
  type ManualReminderResult,
} from "@/core/services/agenda/agenda.service";
import type { CitaProximaRow } from "@/core/services/client/client.service";
import { getApiErrorMessage } from "@/core/utils/apiError";

interface ReminderModalProps {
  cita: CitaProximaRow | null;
  /** Texto de fecha ya formateado ("21 oct 2026") y hora ("10:00"), en hora de La Paz. */
  fecha: string;
  hora: string;
  onClose: () => void;
  onSent: (result: ManualReminderResult) => void;
}

/** Plantilla por defecto. Si con todos los datos pasa del límite, se van
 *  quitando las partes menos importantes (sucursal, luego servicio). */
export function buildReminderTemplate(cita: CitaProximaRow, fecha: string, hora: string): string {
  const nombre = cita.clienta.split(" ")[0] || cita.clienta;
  const servicio = cita.servicio ? ` de ${cita.servicio}` : "";
  const sucursal = cita.sucursal ? ` en ${cita.sucursal}` : "";
  const variants = [
    `Hola ${nombre}, te recordamos tu cita${servicio} el ${fecha} a las ${hora}${sucursal}. ¡Te esperamos!`,
    `Hola ${nombre}, te recordamos tu cita${servicio} el ${fecha} a las ${hora}. ¡Te esperamos!`,
    `Hola ${nombre}, te recordamos tu cita del ${fecha} a las ${hora}. ¡Te esperamos!`,
  ];
  const fits = variants.find((text) => text.length <= MANUAL_REMINDER_MAX_LENGTH);
  return fits ?? variants[variants.length - 1].slice(0, MANUAL_REMINDER_MAX_LENGTH);
}

export default function ReminderModal({ cita, fecha, hora, onClose, onSent }: ReminderModalProps) {
  const [message, setMessage] = useState("");
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    if (cita) setMessage(buildReminderTemplate(cita, fecha, hora));
  }, [cita, fecha, hora]);

  if (!cita) return null;

  const trimmed = message.trim();
  const canSend = trimmed.length > 0 && message.length <= MANUAL_REMINDER_MAX_LENGTH && !isSending;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSend) return;
    setIsSending(true);
    try {
      const result = await AgendaService.sendReminder(cita.appointment_id, trimmed);
      toast.success(`Recordatorio enviado a ${cita.clienta}.`);
      onSent(result);
    } catch (err) {
      // Se queda abierto para que pueda reintentar sin perder el texto.
      toast.error(getApiErrorMessage(err, "No se pudo enviar el recordatorio."));
    } finally {
      setIsSending(false);
    }
  };

  return (
    <GenericModal
      isOpen
      onClose={isSending ? () => undefined : onClose}
      title="Enviar recordatorio"
      size="md"
      asForm
      onSubmit={handleSubmit}
      footer={
        <>
          <Button type="button" variant="ghost" size="sm" onClick={onClose} disabled={isSending}>
            Cancelar
          </Button>
          <Button type="submit" size="sm" disabled={!canSend}>
            {isSending ? "Enviando..." : "Enviar"}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <p className="text-sm text-slate-600">
          <span className="font-semibold text-slate-800">{cita.clienta}</span> · {fecha} · {hora}
          {cita.sucursal ? ` · ${cita.sucursal}` : ""}
        </p>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-slate-600">Mensaje</span>
          <textarea
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            maxLength={MANUAL_REMINDER_MAX_LENGTH}
            rows={4}
            autoFocus
            className="w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
          />
          <span
            className={`self-end text-xs ${
              message.length >= MANUAL_REMINDER_MAX_LENGTH ? "font-medium text-amber-700" : "text-slate-400"
            }`}
          >
            {message.length}/{MANUAL_REMINDER_MAX_LENGTH}
          </span>
        </label>
        <p className="text-xs text-slate-500">
          Le llega como notificación a la app de la clienta (si tiene la app instalada y la sesión iniciada).
        </p>
      </div>
    </GenericModal>
  );
}
