import { useState } from "react";
import { Mail, Smartphone, TriangleAlert, Users } from "lucide-react";
import type { AudiencePreview, BroadcastKind } from "@/core/services/broadcast/broadcast.service";
import type { ReminderChannels } from "@/core/services/agenda/agenda.service";
import { SegmentedTabs } from "@/components/common/ui";
import { EmailPreview, PushPreview } from "./ContentPreviews";

type PreviewView = "push" | "email";

const VIEW_OPTIONS = [
  { id: "push", label: "Push", icon: <Smartphone /> },
  { id: "email", label: "Correo", icon: <Mail /> },
] as const;

interface BroadcastPreviewProps {
  kind: BroadcastKind;
  title: string;
  body: string;
  /** Imagen tal como la ve el panel. */
  imageSrc: string | null;
  /** Ruta /media/... de la imagen, para armar el correo real. */
  imagePath: string | null;
  /** false = el push no la puede llevar (sin PUBLIC_BASE_URL); el correo sí, va incrustada. */
  imageIsPublic: boolean;
  channels: ReminderChannels;
  audience: { preview: AudiencePreview | null; isLoading: boolean; failed: boolean };
  /** Qué decir cuando el grupo queda vacío. */
  emptyMessage: string;
}

/** Avisos que conviene leer antes de enviar. */
function buildWarnings({ channels, audience, imageSrc, imageIsPublic, emptyMessage }: BroadcastPreviewProps): string[] {
  const { preview, failed } = audience;
  const warnings: string[] = [];
  if (failed) warnings.push("No se pudo calcular el grupo. Revisa la conexión e inténtalo de nuevo.");
  if (preview && preview.clients === 0) warnings.push(emptyMessage);
  if (preview?.clients && channels.push && preview.with_push === 0)
    warnings.push("Ninguna clienta de este grupo tiene la app con sesión iniciada: el push no le llegará a nadie.");
  if (preview && channels.email && preview.with_email > preview.email_daily_limit)
    warnings.push(
      `Son ${preview.with_email} correos y la cuenta de correo envía unos ${preview.email_daily_limit} al día: los que pasen el límite van a fallar.`,
    );
  if (imageSrc && !imageIsPublic && channels.push)
    warnings.push(
      `La imagen no saldrá en el push: falta configurar PUBLIC_BASE_URL en el servidor.${channels.email ? " En el correo sí, va incrustada." : ""}`,
    );
  return warnings;
}

function Stat({ icon: Icon, value, label }: { icon: typeof Users; value: number | string; label: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2">
      <Icon className="h-4 w-4 text-slate-500" aria-hidden />
      <span className="text-sm font-semibold text-slate-800">{value}</span>
      <span className="text-xs text-slate-500">{label}</span>
    </div>
  );
}

export default function BroadcastPreview(props: BroadcastPreviewProps) {
  const { kind, title, body, imageSrc, imagePath, channels, audience } = props;
  const [view, setView] = useState<PreviewView>("push");
  // Solo se puede ver lo que se va a enviar.
  const shown: PreviewView = !channels.push ? "email" : !channels.email ? "push" : view;
  const count = (value: number | undefined) => (audience.isLoading || value === undefined ? "…" : value);
  const warnings = buildWarnings(props);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-medium text-slate-600">Vista previa</p>
          {channels.push && channels.email ? (
            <SegmentedTabs options={VIEW_OPTIONS} value={view} onChange={setView} />
          ) : null}
        </div>
        {shown === "push" ? (
          <PushPreview kind={kind} title={title} body={body} imageSrc={imageSrc} />
        ) : (
          <EmailPreview kind={kind} title={title} body={body} imagePath={imagePath} />
        )}
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-xs font-medium text-slate-600">Le llegará a</p>
        <Stat icon={Users} value={count(audience.preview?.clients)} label="clientas del grupo" />
        {channels.push ? (
          <Stat icon={Smartphone} value={count(audience.preview?.with_push)} label="con la app (push)" />
        ) : null}
        {channels.email ? (
          <Stat icon={Mail} value={count(audience.preview?.with_email)} label="con correo registrado" />
        ) : null}
      </div>

      {warnings.length ? (
        <ul className="flex flex-col gap-1.5">
          {warnings.map((warning) => (
            <li key={warning} className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-800">
              <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
              {warning}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
