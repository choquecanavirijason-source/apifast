// Aquí puedes ir moviendo los modales de confirmación y finalización, por claridad modular.
// Ejemplo de esqueleto:

import { ConfirmDialog } from "../../../components/common/ConfirmDialog";
import GenericModal from "../../../components/common/modal/GenericModal";
import { Button } from "../../../components/common/ui";

export function DeleteTicketModal({ isOpen, ticketToDelete, deleteConfirmationCode, setDeleteConfirmationCode, isDeletingTicket, onConfirm, onCancel }) {
  return (
    <ConfirmDialog
      isOpen={isOpen}
      title="Eliminar ticket"
      message={
        <div className="space-y-3">
          <p>
            ¿Seguro que deseas eliminar el ticket de <strong>{ticketToDelete?.client_name}</strong>? Esta accion no se puede deshacer.
          </p>
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
            Para confirmar, escribe el codigo del ticket:
            <strong className="ml-1">{ticketToDelete?.ticket_code?.trim() || String(ticketToDelete?.id ?? "")}</strong>
          </div>
          <input
            type="text"
            value={deleteConfirmationCode}
            onChange={(event) => setDeleteConfirmationCode(event.target.value)}
            placeholder="Ingresa el codigo para eliminar"
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none"
          />
        </div>
      }
      confirmText="Eliminar"
      cancelText="Cancelar"
      variant="danger"
      isProcessing={isDeletingTicket}
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  );
}

// Agrega aquí otros modales como el de finalizar atención, cuestionario, etc.
