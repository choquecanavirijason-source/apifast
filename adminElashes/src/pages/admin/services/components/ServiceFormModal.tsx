import GenericModal from "../../../../components/common/modal/GenericModal";
import { Button } from "../../../../components/common/ui";

import type { ServiceFormState } from "../services.types";

export type ServiceFormModalProps = {
  isOpen: boolean;
  title: string;
  submitLabel: string;
  onClose: () => void;
  onSubmit: () => void;
  form: ServiceFormState;
  onFormChange: <K extends keyof ServiceFormState>(field: K, value: ServiceFormState[K]) => void;
  isUploadingImage: boolean;
  onImageSelected: (file?: File | null) => Promise<void> | void;
};

export default function ServiceFormModal({
  isOpen,
  title,
  submitLabel,
  onClose,
  onSubmit,
  form,
  onFormChange,
  isUploadingImage,
  onImageSelected,
}: ServiceFormModalProps) {
  return (
    <GenericModal isOpen={isOpen} onClose={onClose} title={title} size="md">
      <div className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-slate-700">Nombre *</label>
          <input
            value={form.name}
            onChange={(event) => onFormChange("name", event.target.value)}
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-slate-700">Descripcion</label>
          <textarea
            value={form.description}
            onChange={(event) => onFormChange("description", event.target.value)}
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none"
            rows={3}
          />
        </div>

        <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
          <div>
            <p className="text-sm font-medium text-slate-700">Servicio movil</p>
            <p className="text-xs text-slate-500">Activa si esta categoria corresponde a servicio movil.</p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={form.isMobile}
            onClick={() => onFormChange("isMobile", !form.isMobile)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              form.isMobile ? "bg-emerald-500" : "bg-slate-300"
            }`}
          >
            <span
              className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                form.isMobile ? "translate-x-5" : "translate-x-1"
              }`}
            />
          </button>
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-slate-700">Imagen de la categoria</label>
          <input
            type="file"
            accept="image/*"
            onChange={(event) => void onImageSelected(event.target.files?.[0] ?? null)}
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none"
          />
          {isUploadingImage ? <p className="text-xs text-slate-500">Subiendo imagen...</p> : null}
          {form.imageUrl ? (
            <div className="mt-2 flex items-center gap-3">
              <img
                src={form.imageUrl}
                alt="Preview"
                className="h-16 w-16 rounded-lg border border-slate-200 object-cover"
              />
              <Button type="button" variant="secondary" onClick={() => onFormChange("imageUrl", "")}
              >
                Quitar imagen
              </Button>
            </div>
          ) : null}
        </div>

        <div className="flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="button" onClick={onSubmit} disabled={isUploadingImage}>
            {submitLabel}
          </Button>
        </div>
      </div>
    </GenericModal>
  );
}
