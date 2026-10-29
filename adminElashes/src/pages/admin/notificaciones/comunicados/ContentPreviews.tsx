import { useEffect, useState } from "react";
import { Bell, Loader2 } from "lucide-react";
import {
  BroadcastService,
  type BroadcastKind,
  type EmailPreview as EmailPreviewData,
} from "@/core/services/broadcast/broadcast.service";
import { kindOption } from "./broadcast.constants";

const PLACEHOLDER_TITLE = "Título del comunicado";
const PLACEHOLDER_BODY = "Aquí va el mensaje que leerán tus clientas.";
const DEBOUNCE_MS = 400;

interface ContentProps {
  kind: BroadcastKind;
  title: string;
  body: string;
}

/** Notificación del sistema en el celular. */
export function PushPreview({ kind, title, body, imageSrc }: ContentProps & { imageSrc: string | null }) {
  return (
    <div className="rounded-2xl bg-slate-800 p-3">
      <div className="rounded-xl bg-white/95 p-3 shadow">
        <div className="mb-1 flex items-center gap-1.5 text-[11px] text-slate-500">
          <Bell className="h-3 w-3" aria-hidden />
          <span className="font-semibold">Elashes</span>
          <span>· ahora · {kindOption(kind).label}</span>
        </div>
        <p className="text-sm font-semibold text-slate-900">{title.trim() || PLACEHOLDER_TITLE}</p>
        <p className="line-clamp-3 whitespace-pre-line text-xs text-slate-600">{body.trim() || PLACEHOLDER_BODY}</p>
        {imageSrc ? <img src={imageSrc} alt="" className="mt-2 max-h-40 w-full rounded-lg object-cover" /> : null}
      </div>
    </div>
  );
}

/** El correo real: el backend lo arma con la misma plantilla del envío (con
 *  la imagen incrustada), así la vista previa nunca se desfasa. */
export function EmailPreview({ kind, title, body, imagePath }: ContentProps & { imagePath: string | null }) {
  const [email, setEmail] = useState<EmailPreviewData | null>(null);
  const [failed, setFailed] = useState(false);
  const shownTitle = title.trim() || PLACEHOLDER_TITLE;
  const shownBody = body.trim() || PLACEHOLDER_BODY;

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(() => {
      BroadcastService.previewEmail({ kind, title: shownTitle, body: shownBody, image_url: imagePath })
        .then((data) => {
          if (cancelled) return;
          setEmail(data);
          setFailed(false);
        })
        .catch(() => !cancelled && setFailed(true));
    }, DEBOUNCE_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [kind, shownTitle, shownBody, imagePath]);

  if (failed && !email) return <p className="text-xs text-rose-600">No se pudo armar la vista previa del correo.</p>;
  if (!email)
    return (
      <div className="flex h-24 items-center justify-center">
        <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
      </div>
    );
  return (
    <div className="flex flex-col gap-1.5">
      <p className="truncate text-xs text-slate-500">
        <span className="font-medium text-slate-600">Asunto:</span> {email.subject}
      </p>
      {/* sandbox vacío: el HTML se muestra sin ejecutar nada. */}
      <iframe
        title="Vista previa del correo"
        srcDoc={email.html}
        sandbox=""
        className="h-[360px] w-full rounded-lg border border-slate-200 bg-white"
      />
    </div>
  );
}
