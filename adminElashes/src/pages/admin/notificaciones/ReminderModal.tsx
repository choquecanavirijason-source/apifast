import { useEffect, useState, type FormEvent } from "react";
import { toast } from "react-toastify";
import GenericModal from "@/components/common/modal/GenericModal";
import { Button } from "@/components/common/ui";
import {
  AgendaService,
  MANUAL_REMINDER_MAX_LENGTH,
  type ManualReminderResult,
  type ReminderChannels,
  type ReminderEmailStatus,
} from "@/core/services/agenda/agenda.service";
import type { CitaProximaRow } from "@/core/services/client/client.service";
import { getApiErrorMessage } from "@/core/utils/apiError";

interface ReminderModalProps {
  cita: CitaProximaRow | null;
  /** Texto de fecha ya formateado ("21 oct 2026") y hora ("10:00"), en hora de La Paz. */
  fecha: string;
  hora: string;
  /** Canales con los que abre (los de la barra de la tabla); se pueden cambiar aquí. */
  defaultChannels: ReminderChannels;
  onClose: () => void;
  onSent: (result: ManualReminderResult) => void;
}

/** Aviso para el panel cuando el correo pedido no salió; null si salió o no se pidió. */
export function emailStatusWarning(status: ReminderEmailStatus | null): string | null {
  switch (status) {
    case "no_email":
      return "la clienta no tiene correo registrado";
    case "not_configured":
      return "el envío de correos no está configurado en el servidor";
    case "failed":
      return "el servidor de correo no lo aceptó";
    default:
      return null;
  }
}

interface ReminderChannelPickerProps {
  value: ReminderChannels;
  onChange: (value: ReminderChannels) => void;
  disabled?: boolean;
}

/** Casillas Push / Correo. No deja desmarcar las dos: siempre queda un canal. */
export function ReminderChannelPicker({ value, onChange, disabled }: ReminderChannelPickerProps) {
  const toggle = (key: keyof ReminderChannels) => {
    const next = { ...value, [key]: !value[key] };
    if (next.push || next.email) onChange(next);
  };
  const options: { key: keyof ReminderChannels; label: string; title: string }[] = [
    { key: "push", label: "Push", title: "Notificación en la app de la clienta" },
    { key: "email", label: "Correo", title: "Correo al email registrado de la clienta" },
  ];
  return (
    <div className="flex items-center gap-3" role="group" aria-label="Canales del recordatorio">
      {options.map((option) => (
        <label
          key={option.key}
          title={option.title}
          className="inline-flex items-center gap-1.5 whitespace-nowrap text-xs font-medium text-slate-600"
        >
          <input
            type="checkbox"
            checked={value[option.key]}
            disabled={disabled || (value[option.key] && !(option.key === "push" ? value.email : value.push))}
            onChange={() => toggle(option.key)}
            className="h-4 w-4 accent-brand"
          />
          {option.label}
        </label>
      ))}
    </div>
  );
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

export default function ReminderModal({ cita, fecha, hora, defaultChannels, onClose, onSent }: ReminderModalProps) {
  const [message, setMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [channels, setChannels] = useState<ReminderChannels>(defaultChannels);

  useEffect(() => {
    if (cita) setMessage(buildReminderTemplate(cita, fecha, hora));
  }, [cita, fecha, hora]);

  // Al abrir para otra cita, vuelve a los canales de la barra.
  useEffect(() => {
    if (cita) setChannels(defaultChannels);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cita]);

  if (!cita) return null;

  const trimmed = message.trim();
  // Solo correo y sin correo registrado: no hay a dónde enviarlo.
  const emailOnlyWithoutAddress = channels.email && !channels.push && !cita.tiene_email;
  const canSend =
    trimmed.length > 0 && message.length <= MANUAL_REMINDER_MAX_LENGTH && !isSending && !emailOnlyWithoutAddress;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSend) return;
    setIsSending(true);
    try {
      const result = await AgendaService.sendReminder(cita.appointment_id, trimmed, channels);
      const warning = emailStatusWarning(result.email_status);
      if (warning && result.send_push) {
        toast.warning(`Recordatorio enviado a ${cita.clienta} por push, pero no por correo: ${warning}.`);
      } else if (warning) {
        toast.error(`No se pudo enviar el correo a ${cita.clienta}: ${warning}.`);
      } else {
        toast.success(`Recordatorio enviado a ${cita.clienta}.`);
      }
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
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-slate-600">Enviar por</span>
          <ReminderChannelPicker value={channels} onChange={setChannels} disabled={isSending} />
        </div>
        <ul className="flex flex-col gap-1 text-xs text-slate-500">
          {channels.push ? (
            <li>Push: le llega como notificación a la app (si la tiene instalada y la sesión iniciada).</li>
          ) : null}
          {channels.email ? (
            cita.tiene_email ? (
              <li>Correo: se envía a su email registrado con los datos de la cita.</li>
            ) : (
              <li className="font-medium text-amber-700">
                Correo: la clienta no tiene email registrado
                {channels.push ? "; solo se enviará el push." : ". Agrégalo en su ficha para enviarlo."}
              </li>
            )
          ) : null}
        </ul>
      </div>
    </GenericModal>
  );
}
