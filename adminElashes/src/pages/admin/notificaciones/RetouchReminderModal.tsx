import { useEffect, useRef, useState } from "react";
import GenericModal from "@/components/common/modal/GenericModal";
import { Button } from "@/components/common/ui";
import type { RetoqueRow } from "@/core/services/client/client.service";
import { RetouchReminderService, type RetouchReminderPreview, type RetouchReminderResult } from "@/core/services/client/retouch-reminder.service";
import { getApiErrorMessage } from "@/core/utils/apiError";
import { formatDay } from "./notificaciones.utils";

function outcome(result: RetouchReminderResult) {
  const channel = (name: string, requested: boolean, status: string | null) => {
    if (!requested) return null;
    if (status === "sent") return `${name}: aceptado por el proveedor`;
    if (status === "failed") return `${name}: error de envío`;
    if (status === "no_app" || status === "no_email") return `${name}: canal no disponible`;
    return `${name}: ${result.status === "sending" ? "pendiente" : "sin confirmación"}`;
  };
  return [channel("Push", result.send_push, result.push_status), channel("Correo", result.send_email, result.email_status)]
    .filter(Boolean).join(". ");
}

export default function RetouchReminderModal({ row, onClose }: { row: RetoqueRow; onClose: () => void }) {
  const [preview, setPreview] = useState<RetouchReminderPreview | null>(null);
  const [push, setPush] = useState(false);
  const [email, setEmail] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const inFlight = useRef(false);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    let cancelled = false;
    RetouchReminderService.preview(row).then((data) => {
      if (cancelled) return;
      setPreview(data); setPush(data.push_available); setEmail(data.email_available);
    }).catch((err) => { if (!cancelled) setError(getApiErrorMessage(err, "No se pudo comprobar el recordatorio.")); });
    return () => { cancelled = true; alive.current = false; };
  }, [row]);

  const refresh = async () => {
    const data = await RetouchReminderService.preview(row);
    if (alive.current) setPreview(data);
    return data;
  };

  const submit = async () => {
    if (inFlight.current || !preview) return;
    inFlight.current = true; setBusy(true); setError("");
    try {
      if (!preview.result) {
        const result = await RetouchReminderService.send(row, {
          preview_version: preview.preview_version, send_push: push, send_email: email,
        });
        if (alive.current) setPreview((current) => current && { ...current, result });
      }
      await refresh();
    } catch (err) {
      // A timeout is ambiguous: query the persistent receipt before allowing a
      // retry. Even if this GET fails, POST will return the existing receipt.
      if (alive.current) setError(getApiErrorMessage(err, "Respuesta no confirmada. Comprueba el estado antes de reintentar."));
      try {
        const recovered = await refresh();
        if (alive.current && recovered.result) setError("");
      } catch { /* Keep the original error visible. */ }
    } finally {
      inFlight.current = false;
      if (alive.current) setBusy(false);
    }
  };

  const unavailable = preview && (!preview.delivery_enabled || !preview.consent || (!preview.push_available && !preview.email_available));
  return (
    <GenericModal isOpen title="Enviar recordatorio" onClose={busy ? () => {} : onClose}
      size="lg" closeOnBackdrop={!busy} showCloseButton={!busy}
      footer={<>
        <Button variant="secondary" size="sm" disabled={busy} onClick={onClose}>Cerrar</Button>
        <Button variant="secondary" size="sm" onClick={() => void submit()}
          disabled={busy || !preview || (!preview.result && (!!unavailable || (!push && !email)))}>
          {busy ? "Comprobando…" : preview?.result ? "Comprobar estado" : "Confirmar envío"}
        </Button>
      </>}>
      {error && <p role="alert" className="mb-3 text-sm text-red-700">{error}</p>}
      {!preview ? <p className="text-sm text-slate-600">Consultando destinataria y canales…</p> : (
        <div className="space-y-4 text-sm text-slate-700">
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
            <dt>Clienta</dt><dd className="font-semibold">{preview.clienta}</dd>
            <dt>Servicio</dt><dd>{preview.servicio}</dd>
            <dt>Fecha recomendada</dt><dd>{formatDay(preview.fecha_objetivo)}</dd>
            <dt>Estado</dt><dd>{preview.dias_restantes < 0 ? `Vencido hace ${-preview.dias_restantes} días` : preview.dias_restantes === 0 ? "Corresponde hoy" : `${preview.dias_restantes} días restantes`}</dd>
          </dl>
          <p className="border-l-2 border-amber-500 bg-amber-50 p-3">{preview.appointment_note}</p>
          {!preview.consent && <p role="alert" className="text-red-700">Notificaciones desactivadas para la clienta. No se permite enviar.</p>}
          {!preview.delivery_enabled && <p role="alert" className="text-amber-800">El envío de recordatorios está deshabilitado para esta release. Puedes revisar la vista previa.</p>}
          {!preview.push_available && !preview.email_available && <p role="alert" className="text-amber-800">No hay canales disponibles: se necesita una app con push habilitado o un correo y SMTP configurados.</p>}
          <fieldset disabled={busy || !!preview.result || !preview.consent} className="flex flex-wrap gap-4">
            <legend className="mb-2 font-semibold">Canales</legend>
            <label><input type="checkbox" checked={push} disabled={!preview.push_available}
              onChange={(e) => setPush(e.target.checked)} /> Push {preview.push_available ? "disponible" : "no disponible"}</label>
            <label><input type="checkbox" checked={email} disabled={!preview.email_available}
              onChange={(e) => setEmail(e.target.checked)} /> Correo {preview.email_available ? "disponible" : "no disponible"}</label>
          </fieldset>
          <div className="border border-[#edebe9] bg-[#faf9f8] p-3">
            <p className="mb-2 font-semibold">Vista previa del mensaje</p><p>{preview.message}</p>
          </div>
          {preview.result && <div role="status" className="border border-[#edebe9] p-3">
            <p className="font-semibold">{preview.result.status === "sending" ? "Solicitud registrada; envío pendiente." : "Resultado del envío registrado."}</p>
            <p>{outcome(preview.result)}</p>
            <p className="mt-2 text-xs">Este recordatorio ya está registrado. Repetir la solicitud no crea otro envío. Si sigue pendiente, comprueba el estado.</p>
          </div>}
        </div>
      )}
    </GenericModal>
  );
}
