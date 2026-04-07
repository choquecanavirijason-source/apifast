import { Trash2 } from "lucide-react";

import GenericModal from "../../../../components/common/modal/GenericModal";
import { Button } from "../../../../components/common/ui";

export type DeleteServiceModalProps = {
  isOpen: boolean;
  serviceName?: string;
  onClose: () => void;
  onConfirm: () => void;
};

export default function DeleteServiceModal({ isOpen, serviceName, onClose, onConfirm }: DeleteServiceModalProps) {
  return (
    <GenericModal isOpen={isOpen} onClose={onClose} title="Eliminar categoria" size="sm">
      <div className="space-y-4">
        <div className="flex items-center gap-3 rounded-xl border border-rose-100 bg-rose-50/60 p-3">
          <Trash2 className="h-5 w-5 text-rose-600" />
          <p className="text-sm text-slate-600">
            ¿Seguro que deseas eliminar la categoria <strong>{serviceName}</strong>?
          </p>
        </div>
        <div className="flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="button" variant="danger" onClick={onConfirm}>
            Eliminar
          </Button>
        </div>
      </div>
    </GenericModal>
  );
}
