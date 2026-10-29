import { useEffect, useState, type FormEvent } from "react";
import { toast } from "react-toastify";
import { CircleHelp, Trash2, TriangleAlert } from "lucide-react";
import GenericModal from "@/components/common/modal/GenericModal";
import { Button } from "@/components/common/ui";
import { AgendaService, type ReminderEmailSender } from "@/core/services/agenda/agenda.service";
import { getApiErrorMessage } from "@/core/utils/apiError";

const ADD_OPTION = "__add__";

/** El remitente elegido tal como está autorizado, o null si no está en la lista. */
export function matchAllowedSender(sender: ReminderEmailSender | null, value: string): string | null {
  const wanted = value.trim().toLowerCase();
  return sender?.allowed.find((address) => address.toLowerCase() === wanted) ?? null;
}

/** Remitente a usar: el elegido si sigue autorizado; si no (p. ej. lo quitaron), el por defecto. */
export function effectiveSender(sender: ReminderEmailSender | null, value: string): string | null {
  return matchAllowedSender(sender, value) ?? sender?.from_email ?? null;
}

interface EmailSenderSelectProps {
  sender: ReminderEmailSender;
  value: string;
  onChange: (value: string) => void;
  /** Abre el modal "Agregar remitente" (solo se ofrece si sender.can_manage). */
  onAddRequest: () => void;
  disabled?: boolean;
  className?: string;
}

/** Desplegable con los remitentes autorizados y, para admins, "+ Agregar nuevo
 *  correo remitente" al final. Solo ofrece direcciones válidas. */
export function EmailSenderSelect({ sender, value, onChange, onAddRequest, disabled, className = "" }: EmailSenderSelectProps) {
  const canOpen = sender.allowed.length > 1 || sender.can_manage;
  return (
    <select
      value={effectiveSender(sender, value) ?? ""}
      onChange={(event) => {
        if (event.target.value === ADD_OPTION) onAddRequest();
        else onChange(event.target.value);
      }}
      disabled={disabled || !canOpen}
      aria-label="Correo emisor"
      className={`h-8 min-w-0 max-w-full rounded-md border border-slate-300 bg-white px-2 text-sm font-medium text-slate-700 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100 disabled:cursor-default disabled:border-transparent disabled:bg-transparent disabled:opacity-100 ${className}`}
    >
      {sender.allowed.map((address) => (
        <option key={address} value={address}>
          {address}
        </option>
      ))}
      {sender.can_manage ? <option value={ADD_OPTION}>+ Agregar nuevo correo remitente</option> : null}
    </select>
  );
}

interface EmailFromFieldProps {
  sender: ReminderEmailSender | null;
  value: string;
  onChange: (value: string) => void;
  onAddRequest: () => void;
  disabled?: boolean;
}

/** "Enviando desde: [remitente]" en un formulario, o el aviso si el servidor
 *  no tiene correo (o aún no se sabe y se usará el por defecto). */
export function EmailFromField({ sender, value, onChange, onAddRequest, disabled }: EmailFromFieldProps) {
  if (!sender?.configured) {
    return (
      <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs font-medium text-amber-700">
        {sender
          ? "El envío de correos no está configurado en el servidor."
          : "Se usará el correo emisor configurado en el servidor."}
      </p>
    );
  }
  return (
    <label className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
      <span className="text-xs font-medium text-slate-600">Enviando desde:</span>
      <EmailSenderSelect
        sender={sender}
        value={value}
        onChange={onChange}
        onAddRequest={onAddRequest}
        disabled={disabled}
        className="flex-1"
      />
    </label>
  );
}

interface AddEmailSenderModalProps {
  isOpen: boolean;
  sender: ReminderEmailSender | null;
  onClose: () => void;
  /** Lista actualizada; addedEmail = el recién agregado (para seleccionarlo). */
  onSaved: (sender: ReminderEmailSender, addedEmail?: string) => void;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Alta (y baja de los agregados desde el panel) de remitentes; se guardan en la BD. */
export function AddEmailSenderModal({ isOpen, sender, onClose, onSaved }: AddEmailSenderModalProps) {
  const [email, setEmail] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setEmail("");
      setShowHelp(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const trimmed = email.trim();
  const isDuplicate = !!sender?.allowed.some((address) => address.toLowerCase() === trimmed.toLowerCase());
  const canSave = EMAIL_RE.test(trimmed) && !isDuplicate && !isSaving;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSave) return;
    setIsSaving(true);
    try {
      const updated = await AgendaService.addReminderEmailSender(trimmed);
      toast.success(`Remitente ${trimmed.toLowerCase()} agregado.`);
      onSaved(updated, trimmed.toLowerCase());
    } catch (err) {
      toast.error(getApiErrorMessage(err, "No se pudo agregar el remitente."));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: number, address: string) => {
    if (!window.confirm(`¿Quitar ${address} de los remitentes?`)) return;
    setDeletingId(id);
    try {
      onSaved(await AgendaService.deleteReminderEmailSender(id));
      toast.success(`Remitente ${address} quitado.`);
    } catch (err) {
      toast.error(getApiErrorMessage(err, "No se pudo quitar el remitente."));
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <GenericModal
      isOpen
      onClose={isSaving ? () => undefined : onClose}
      title="Agregar correo remitente"
      size="sm"
      asForm
      onSubmit={handleSubmit}
      footer={
        <>
          <Button type="button" variant="ghost" size="sm" onClick={onClose} disabled={isSaving}>
            Cancelar
          </Button>
          <Button type="submit" size="sm" disabled={!canSave}>
            {isSaving ? "Guardando..." : "Guardar"}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-slate-600">Correo remitente</span>
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="citas@elashes.com"
            autoFocus
            disabled={isSaving}
            className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
          />
          {isDuplicate ? (
            <span className="text-xs font-medium text-amber-700">Ese correo ya está en la lista.</span>
          ) : null}
        </label>
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          <p className="flex gap-1.5">
            <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
            <span>
              Con Gmail, el correo debe estar verificado en la cuenta principal; si no, Gmail lo reemplaza por esa
              cuenta.{" "}
              <button
                type="button"
                onClick={() => setShowHelp((current) => !current)}
                aria-expanded={showHelp}
                aria-controls="email-sender-help"
                className="inline-flex items-center gap-1 font-semibold text-amber-900 underline underline-offset-2 hover:text-amber-950"
              >
                <CircleHelp className="h-3.5 w-3.5" aria-hidden />
                {showHelp ? "Ocultar pasos" : "Ver pasos detallados"}
              </button>
            </span>
          </p>
          {showHelp ? (
            <ol id="email-sender-help" className="mt-2 flex flex-col gap-1.5 border-t border-amber-200 pt-2 text-slate-700">
              {[
                <>
                  Entra a la cuenta principal
                  {sender?.from_email ? (
                    <>
                      {" "}
                      (<span className="font-semibold break-all">{sender.from_email}</span>)
                    </>
                  ) : null}
                  .
                </>,
                <>
                  Ve a <span className="font-semibold">Configuración ⚙️ › Cuentas e importación › “Enviar correo como”</span>.
                </>,
                <>
                  Haz clic en <span className="font-semibold">“Añadir otra dirección de correo electrónico”</span> y
                  completa la verificación (Gmail envía un código o enlace a esa dirección).
                </>,
                <>Guarda el correo aquí, en esta plataforma.</>,
              ].map((step, index) => (
                <li key={index} className="flex gap-2">
                  <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-amber-200 text-[10px] font-bold text-amber-900">
                    {index + 1}
                  </span>
                  <span>
                    <span className="font-semibold">Paso {index + 1}:</span> {step}
                  </span>
                </li>
              ))}
            </ol>
          ) : null}
        </div>
        {sender?.registered.length ? (
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium text-slate-600">Agregados desde el panel</span>
            <ul className="flex flex-col divide-y divide-slate-100 rounded-lg border border-slate-200">
              {sender.registered.map((row) => (
                <li key={row.id} className="flex items-center justify-between gap-2 px-3 py-1.5 text-sm text-slate-700">
                  <span className="min-w-0 break-all">{row.email}</span>
                  <button
                    type="button"
                    onClick={() => void handleDelete(row.id, row.email)}
                    disabled={deletingId !== null || isSaving}
                    aria-label={`Quitar ${row.email}`}
                    title="Quitar"
                    className="rounded-md p-1 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </GenericModal>
  );
}
