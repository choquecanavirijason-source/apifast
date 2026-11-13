import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { AlertTriangle } from "lucide-react";
import GenericModal from "../../../../components/common/modal/GenericModal";
import { Button } from "../../../../components/common/ui";
import type { TicketItem } from "../../../../core/services/agenda/agenda.service";
import { AgendaService } from "../../../../core/services/agenda/agenda.service";
import { getApiErrorMessage } from "../../../../core/utils/apiError";

type AllergyConfirmModalProps = {
  /** Ticket de la clienta a la que aún no se le preguntó. null = cerrado. */
  ticket: TicketItem | null;
  /** Quedó confirmado ("Sin alergias" = null): continúa el inicio de la atención. */
  onConfirmed: (ticket: TicketItem, allergies: string | null) => void;
  onClose: () => void;
};

/** Pregunta las alergias antes de iniciar la atención, a una clienta a la que nunca se le han confirmado. */
export default function AllergyConfirmModal({ ticket, onConfirmed, onClose }: AllergyConfirmModalProps) {
  const [text, setText] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setText("");
  }, [ticket?.id]);

  const save = async (allergies: string | null) => {
    if (!ticket) return;
    setIsSaving(true);
    try {
      const saved = await AgendaService.confirmTicketAllergies(ticket.id, allergies);
      onConfirmed(ticket, saved.allergies ?? null);
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, "No se pudieron guardar las alergias."));
    } finally {
      setIsSaving(false);
    }
  };

  const trimmed = text.trim();

  return (
    <GenericModal
      isOpen={ticket !== null}
      onClose={() => {
        if (!isSaving) onClose();
      }}
      title="Confirmar alergias"
      size="md"
      footer={
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={onClose} disabled={isSaving}>
            Cancelar
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => void save(null)}
            disabled={isSaving || trimmed.length > 0}
            title={trimmed.length > 0 ? "Borra el texto para marcar que no tiene alergias" : undefined}
          >
            Sin alergias
          </Button>
          <Button type="button" size="sm" onClick={() => void save(trimmed)} disabled={isSaving || trimmed.length === 0}>
            {isSaving ? "Guardando…" : "Tiene alergia · guardar"}
          </Button>
        </div>
      }
    >
      {ticket && (
        <div className="space-y-3">
          <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-900">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <p>
              Antes de iniciar, pregunta a <strong>{ticket.client_name}</strong> si tiene alguna alergia a algún producto.
              Saldrá en su ticket y en la app de la operaria.
              {ticket.client?.is_generic
                ? " Es clienta de mostrador: solo se anota en este ticket, no se guarda en ninguna ficha."
                : " Se guarda en su ficha y no se le vuelve a preguntar."}
            </p>
          </div>

          <label className="block text-xs font-medium text-[var(--ui-text-muted)]">
            Alergia (si tiene)
            <textarea
              rows={3}
              maxLength={500}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Ej.: látex, pegamento con cianoacrilato…"
              className="mt-1 w-full resize-none rounded-lg border border-[var(--ui-border-strong)] bg-[var(--ui-input)] px-3 py-2 text-sm text-[var(--ui-text)] outline-none focus:border-brand-secondary focus:ring-2 focus:ring-brand-secondary/20"
            />
            <span className="mt-1 block text-right tabular-nums text-[11px]">{text.length}/500</span>
          </label>
        </div>
      )}
    </GenericModal>
  );
}
