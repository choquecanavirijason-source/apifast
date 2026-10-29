import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { toast } from "react-toastify";
import GenericModal from "@/components/common/modal/GenericModal";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { Button, SegmentedTabs } from "@/components/common/ui";
import {
  BROADCAST_BODY_MAX_LENGTH,
  BROADCAST_TITLE_MAX_LENGTH,
  BroadcastService,
  type Broadcast,
  type BroadcastAudience,
  type BroadcastImage,
  type BroadcastKind,
} from "@/core/services/broadcast/broadcast.service";
import type { ReminderChannels } from "@/core/services/agenda/agenda.service";
import { toAbsoluteMediaUrl } from "@/core/services/app-settings/app-settings.service";
import { getApiErrorMessage } from "@/core/utils/apiError";
import { ReminderChannelPicker } from "../ReminderModal";
import { AddEmailSenderModal, EmailFromField, effectiveSender } from "../EmailSenderControls";
import { BranchSelect } from "../TabLayout";
import type { BranchOption } from "../hooks/useBranchSelection";
import { useEmailSender } from "../hooks/useEmailSender";
import { fieldClass } from "../notificaciones.utils";
import BroadcastImageField from "./BroadcastImageField";
import ClientPicker, { type PickedClient } from "./ClientPicker";
import BroadcastPreview from "./BroadcastPreview";
import { useAudiencePreview } from "./useAudiencePreview";
import { clientasLabel } from "./broadcast.format";
import {
  AUDIENCE_DAYS,
  AUDIENCE_OPTIONS,
  DEFAULT_AUDIENCE_DAYS,
  KIND_OPTIONS,
  MARKETING_KINDS,
  daysLabel,
  kindOption,
} from "./broadcast.constants";

interface Draft {
  kind: BroadcastKind;
  title: string;
  body: string;
  image: BroadcastImage | null;
  audience: BroadcastAudience;
  days: number;
  branchId: number | null;
  clients: PickedClient[];
  channels: ReminderChannels;
}

const newDraft = (branchId: number | null): Draft => ({
  kind: "aviso",
  title: "",
  body: "",
  image: null,
  audience: "all",
  days: DEFAULT_AUDIENCE_DAYS,
  branchId,
  clients: [],
  channels: { push: true, email: false },
});

interface BroadcastComposerProps {
  isOpen: boolean;
  onClose: () => void;
  onSent: (broadcast: Broadcast) => void;
  canChooseBranch: boolean;
  branches: BranchOption[];
  /** Sucursal con la que abre (la del selector de la página). */
  defaultBranchId: number | null;
}

function Field({ label, count, max, children }: { label: string; count?: number; max?: number; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium text-slate-600">{label}</span>
      {children}
      {max !== undefined && count !== undefined ? (
        <span className={`self-end text-xs ${count >= max ? "font-medium text-amber-700" : "text-slate-400"}`}>
          {count}/{max}
        </span>
      ) : null}
    </label>
  );
}

export default function BroadcastComposer(props: BroadcastComposerProps) {
  const { isOpen, onClose, onSent, canChooseBranch, branches, defaultBranchId } = props;
  const [draft, setDraft] = useState<Draft>(() => newDraft(defaultBranchId));
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const update = (patch: Partial<Draft>) => setDraft((current) => ({ ...current, ...patch }));
  const sender = useEmailSender(isOpen && draft.channels.email);

  useEffect(() => {
    if (isOpen) setDraft(newDraft(defaultBranchId));
  }, [isOpen, defaultBranchId]);

  const usesDays = AUDIENCE_OPTIONS.find((option) => option.id === draft.audience)!.window !== null;
  const isSelected = draft.audience === "selected";
  const audienceParams = {
    kind: draft.kind,
    audience: draft.audience,
    days: usesDays ? draft.days : null,
    // Elegidas una por una: la sucursal no filtra (el backend igual acota a los roles de una sola).
    branch_id: canChooseBranch && !isSelected ? draft.branchId : null,
    client_ids: isSelected ? draft.clients.map((client) => client.id) : [],
  };
  const audience = useAudiencePreview(audienceParams, isOpen);
  const recipients = audience.preview?.clients ?? 0;
  // Correo pedido pero el servidor no lo tiene configurado: el backend respondería 503.
  const emailUnavailable = draft.channels.email && sender.emailSender?.configured === false;
  const canSend =
    !!draft.title.trim() &&
    !!draft.body.trim() &&
    recipients > 0 &&
    !audience.isLoading &&
    !emailUnavailable &&
    !isSending;

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (canSend) setConfirmOpen(true);
  };

  const send = async () => {
    setIsSending(true);
    try {
      const broadcast = await BroadcastService.send({
        ...audienceParams,
        title: draft.title.trim(),
        body: draft.body.trim(),
        image_url: draft.image?.image_url ?? null,
        audience_days: audienceParams.days,
        send_push: draft.channels.push,
        send_email: draft.channels.email,
        email_from: draft.channels.email ? effectiveSender(sender.emailSender, sender.emailFrom) : null,
      });
      toast.success(`Enviando "${broadcast.title}" a ${clientasLabel(broadcast.recipients_count)}. El avance se ve en el historial.`);
      setConfirmOpen(false);
      onSent(broadcast);
    } catch (err) {
      // El formulario queda abierto para reintentar sin perder lo escrito.
      setConfirmOpen(false);
      toast.error(getApiErrorMessage(err, "No se pudo enviar el comunicado."));
    } finally {
      setIsSending(false);
    }
  };

  const branchSelection = { branchId: draft.branchId, setBranchId: (branchId: number | null) => update({ branchId }), branches };

  return (
    <>
      <GenericModal
        isOpen={isOpen}
        onClose={isSending ? () => undefined : onClose}
        title="Nuevo comunicado"
        size="xl"
        asForm
        onSubmit={handleSubmit}
        footer={
          <>
            <Button type="button" variant="ghost" size="sm" onClick={onClose} disabled={isSending}>
              Cancelar
            </Button>
            <Button type="submit" size="sm" disabled={!canSend}>
              {recipients ? `Enviar a ${clientasLabel(recipients)}` : "Enviar"}
            </Button>
          </>
        }
      >
        <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_280px]">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <SegmentedTabs options={KIND_OPTIONS} value={draft.kind} onChange={(kind) => update({ kind })} />
              <p className="text-xs text-slate-500">{kindOption(draft.kind).hint}</p>
            </div>

            <Field label="Título" count={draft.title.length} max={BROADCAST_TITLE_MAX_LENGTH}>
              <input
                value={draft.title}
                onChange={(event) => update({ title: event.target.value })}
                maxLength={BROADCAST_TITLE_MAX_LENGTH}
                placeholder="Ej.: 20% de descuento en lifting esta semana"
                autoFocus
                className={fieldClass}
              />
            </Field>

            <Field label="Mensaje" count={draft.body.length} max={BROADCAST_BODY_MAX_LENGTH}>
              <textarea
                value={draft.body}
                onChange={(event) => update({ body: event.target.value })}
                maxLength={BROADCAST_BODY_MAX_LENGTH}
                rows={4}
                placeholder="Cuéntales los detalles: fechas, condiciones, cómo reservar..."
                className={`${fieldClass} h-auto resize-none py-2`}
              />
            </Field>

            <BroadcastImageField value={draft.image} onChange={(image) => update({ image })} disabled={isSending} />

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="¿A quién?">
                <select
                  value={draft.audience}
                  onChange={(event) => update({ audience: event.target.value as BroadcastAudience })}
                  className={fieldClass}
                >
                  {AUDIENCE_OPTIONS.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </Field>
              {usesDays ? (
                <Field label="Ventana">
                  <select
                    value={draft.days}
                    onChange={(event) => update({ days: Number(event.target.value) })}
                    className={fieldClass}
                  >
                    {AUDIENCE_DAYS.map((days) => (
                      <option key={days} value={days}>
                        {daysLabel(draft.audience, days)}
                      </option>
                    ))}
                  </select>
                </Field>
              ) : null}
              {canChooseBranch && !isSelected ? (
                <Field label="Sucursal">
                  <BranchSelect branch={branchSelection} />
                </Field>
              ) : null}
            </div>

            {isSelected ? (
              <ClientPicker
                value={draft.clients}
                onChange={(clients) => update({ clients })}
                branchId={null}
                isMarketing={MARKETING_KINDS.includes(draft.kind)}
                disabled={isSending}
              />
            ) : null}

            <div>
              <ReminderChannelPicker
                value={draft.channels}
                onChange={(channels) => update({ channels })}
                disabled={isSending}
                ariaLabel="Canales del comunicado"
              />
            </div>
            {draft.channels.email ? (
              <EmailFromField
                sender={sender.emailSender}
                value={sender.emailFrom}
                onChange={sender.setEmailFrom}
                onAddRequest={() => sender.setAddSenderOpen(true)}
                disabled={isSending}
              />
            ) : null}
          </div>

          <BroadcastPreview
            kind={draft.kind}
            title={draft.title}
            body={draft.body}
            imageSrc={draft.image ? toAbsoluteMediaUrl(draft.image.image_url) : null}
            imagePath={draft.image?.image_url ?? null}
            imageIsPublic={!!draft.image?.public_url}
            channels={draft.channels}
            audience={audience}
            emptyMessage={isSelected ? "Elige al menos una clienta." : "No hay clientas en este grupo."}
          />
        </div>
      </GenericModal>

      <ConfirmDialog
        isOpen={confirmOpen}
        title="¿Enviar el comunicado?"
        message={`"${draft.title.trim()}" le llegará a ${clientasLabel(recipients)}. Una vez enviado no se puede deshacer.`}
        confirmText={isSending ? "Enviando..." : `Sí, enviar a ${recipients}`}
        onConfirm={() => void send()}
        onCancel={() => setConfirmOpen(false)}
        isProcessing={isSending}
      />

      <AddEmailSenderModal
        isOpen={sender.addSenderOpen}
        sender={sender.emailSender}
        onClose={() => sender.setAddSenderOpen(false)}
        onSaved={sender.handleSenderSaved}
      />
    </>
  );
}
