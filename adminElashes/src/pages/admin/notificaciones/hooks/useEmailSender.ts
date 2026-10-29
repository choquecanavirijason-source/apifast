import { useEffect, useState } from "react";
import { AgendaService, type ReminderEmailSender } from "@/core/services/agenda/agenda.service";

/** Remitentes de correo del servidor y el elegido en el panel. Arranca en el
 *  por defecto del servidor; se pide una vez, cuando `enabled` pasa a true. */
export function useEmailSender(enabled: boolean) {
  const [emailSender, setEmailSender] = useState<ReminderEmailSender | null>(null);
  const [emailFrom, setEmailFrom] = useState("");
  const [addSenderOpen, setAddSenderOpen] = useState(false);

  useEffect(() => {
    if (!enabled || emailSender) return;
    AgendaService.getReminderEmailSender()
      .then((data) => {
        setEmailSender(data);
        setEmailFrom((current) => current || data.from_email || "");
      })
      .catch(() => setEmailSender(null));
  }, [enabled, emailSender]);

  /** Para AddEmailSenderModal: el recién agregado queda elegido. */
  const handleSenderSaved = (updated: ReminderEmailSender, addedEmail?: string) => {
    setEmailSender(updated);
    if (addedEmail) {
      setEmailFrom(addedEmail);
      setAddSenderOpen(false);
    }
  };

  return { emailSender, emailFrom, setEmailFrom, addSenderOpen, setAddSenderOpen, handleSenderSaved };
}

export type EmailSenderState = ReturnType<typeof useEmailSender>;
