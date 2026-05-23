import { Image as ImageIcon } from "lucide-react";
import GenericModal from "@/components/common/modal/GenericModal";
import { Button } from "@/components/common/ui";
import type { VolumenFormState } from "../types";

type VolumenFormProps = {
  isOpen: boolean;
  isEditing: boolean;
  form: VolumenFormState;
  saving: boolean;
  onClose: () => void;
  onSave: (e: React.FormEvent) => void;
  onChange: (field: keyof VolumenFormState, value: string) => void;
};

export function VolumenForm({ isOpen, isEditing, form, saving, onClose, onSave, onChange }: VolumenFormProps) {
  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => onChange("image", String(reader.result ?? ""));
    reader.readAsDataURL(file);
  };

  return (
    <GenericModal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? "Editar volumen" : "Nuevo volumen"}
      size="md"
    >
      <form onSubmit={onSave} className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-slate-700">Nombre *</label>
          <input
            value={form.name}
            onChange={(e) => onChange("name", e.target.value)}
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none"
            placeholder="Ej. Volumen ruso soft"
            required
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-slate-700">Descripción</label>
          <textarea
            value={form.description}
            onChange={(e) => onChange("description", e.target.value)}
            className="h-24 w-full resize-none rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none"
            placeholder="Densidad, curvatura o efecto..."
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-slate-700">Imagen</label>
          <div className="relative cursor-pointer rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-center transition-colors hover:bg-slate-100">
            <input type="file" accept="image/*" onChange={handleFile} className="absolute inset-0 cursor-pointer opacity-0" />
            {form.image ? (
              <img src={form.image} alt="Preview" className="mx-auto h-32 object-contain" />
            ) : (
              <div className="py-4 text-slate-400">
                <ImageIcon className="mx-auto mb-1 h-8 w-8" />
                <p className="text-xs">Haz clic para cargar</p>
              </div>
            )}
          </div>
          {form.image ? (
            <button
              type="button"
              className="text-xs font-medium text-rose-600 hover:text-rose-700"
              onClick={() => onChange("image", "")}
            >
              Quitar imagen
            </button>
          ) : null}
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? "Guardando..." : isEditing ? "Actualizar" : "Crear"}
          </Button>
        </div>
      </form>
    </GenericModal>
  );
}
