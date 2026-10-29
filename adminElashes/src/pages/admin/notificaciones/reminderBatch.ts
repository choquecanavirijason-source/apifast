import { toast } from "react-toastify";
import {
  AgendaService,
  type ManualReminderResult,
  type ReminderChannels,
} from "@/core/services/agenda/agenda.service";
import type { CitaProximaRow } from "@/core/services/client/client.service";
import { getApiErrorMessage } from "@/core/utils/apiError";
import { buildReminderTemplate, emailStatusWarning } from "./ReminderModal";
import { formatDay, formatTime } from "./notificaciones.utils";

interface BatchOutcome {
  total: number;
  sent: number;
  /** Con push y correo: el push salió pero el correo no (sin email, SMTP...). */
  emailWarnings: string[];
  failures: string[];
}

/** Envía el recordatorio de cada cita, una tras otra. onSent se llama por
 *  cada una que le llegó a la clienta; las que fallan no (siguen seleccionadas). */
export async function sendReminderBatch(
  targets: CitaProximaRow[],
  channels: ReminderChannels,
  emailFrom: string | null,
  onSent: (cita: CitaProximaRow, result: ManualReminderResult) => void,
): Promise<BatchOutcome> {
  const outcome: BatchOutcome = { total: targets.length, sent: 0, emailWarnings: [], failures: [] };
  for (const cita of targets) {
    try {
      const message = buildReminderTemplate(cita, formatDay(cita.fecha_hora), formatTime(cita.fecha_hora));
      const result = await AgendaService.sendReminder(cita.appointment_id, message, channels, emailFrom);
      const warning = emailStatusWarning(result.email_status);
      if (warning && !result.send_push) {
        // Solo correo y no salió: no le llegó nada.
        outcome.failures.push(`${cita.clienta}: no se pudo enviar el correo (${warning}).`);
        continue;
      }
      if (warning) outcome.emailWarnings.push(`${cita.clienta}: ${warning}`);
      onSent(cita, result);
      outcome.sent++;
    } catch (err) {
      outcome.failures.push(`${cita.clienta}: ${getApiErrorMessage(err, "No se pudo enviar el recordatorio.")}`);
    }
  }
  return outcome;
}

export function notifyBatchOutcome({ total, sent, emailWarnings, failures }: BatchOutcome) {
  if (sent) toast.success(`Recordatorios enviados: ${sent} de ${total}.`);
  if (emailWarnings.length)
    toast.warning(`${emailWarnings.length} recibieron solo el push, sin correo. ${emailWarnings[0]}.`);
  if (failures.length) toast.error(`${failures.length} envío(s) fallaron y siguen seleccionados. ${failures[0]}`);
}
