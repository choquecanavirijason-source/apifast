import { Image as ImageIcon, Box, X } from "lucide-react";
import GenericModal from "@/components/common/modal/GenericModal";
import { Button } from "@/components/common/ui";
import type { VolumenFormState } from "../types";

const MODEL_3D_EXTENSIONS = [".glb", ".gltf", ".obj", ".fbx", ".stl"];

type VolumenFormProps = {
  isOpen: boolean;
  isEditing: boolean;
  form: VolumenFormState;
  saving: boolean;
  uploadingModel: boolean;
  onClose: () => void;
  onSave: (e: React.FormEvent) => void;
  onChange: (field: keyof VolumenFormState, value: string) => void;
  onModelChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemoveModel: () => void;
};

export function VolumenForm({
  isOpen,
  isEditing,
  form,
  saving,
  uploadingModel,
  onClose,
  onSave,
  onChange,
  onModelChange,
  onRemoveModel,
}: VolumenFormProps) {
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

        <div className="border-t border-slate-100 pt-4">
          <p className="text-xs font-semibold uppercase text-slate-500">Duración recomendada</p>
          <p className="mt-1 text-[11px] text-slate-400">
            Días desde la aplicación hasta que la clienta necesita retoque o retiro. Déjalo vacío si aún no lo sabes.
          </p>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-500">Días para mantenimiento</label>
              <input
                type="number"
                min={0}
                value={form.maintenanceDays}
                onChange={(e) => onChange("maintenanceDays", e.target.value)}
                placeholder="Ej. 14"
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-500">Días para retiro</label>
              <input
                type="number"
                min={0}
                value={form.removalDays}
                onChange={(e) => onChange("removalDays", e.target.value)}
                placeholder="Ej. 25"
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none"
              />
            </div>
          </div>
        </div>

        <div className="border-t border-slate-100 pt-4">
          <p className="text-xs font-semibold uppercase text-slate-500">Archivos</p>
          <div className="mt-3 grid gap-4 md:grid-cols-2">
            <div>
              <label className="text-xs font-medium text-slate-500">Imagen</label>
              <div className="relative mt-2 cursor-pointer rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-center transition-colors hover:bg-slate-100">
                <input type="file" accept="image/*" onChange={handleFile} className="absolute inset-0 cursor-pointer opacity-0" />
                {form.image ? (
                  <img src={form.image} alt="Preview" className="mx-auto h-24 object-contain" />
                ) : (
                  <div className="py-3 text-slate-400">
                    <ImageIcon className="mx-auto mb-1 h-7 w-7" />
                    <p className="text-xs">Haz clic para cargar</p>
                  </div>
                )}
              </div>
              {form.image ? (
                <button
                  type="button"
                  className="mt-1 text-xs font-medium text-rose-600 hover:text-rose-700"
                  onClick={() => onChange("image", "")}
                >
                  Quitar imagen
                </button>
              ) : null}
            </div>

            <div>
              <label className="text-xs font-medium text-slate-500">Modelo 3D</label>
              <div className="relative mt-2 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-center transition-colors hover:bg-slate-100">
                <input
                  type="file"
                  accept={MODEL_3D_EXTENSIONS.join(",")}
                  onChange={onModelChange}
                  disabled={uploadingModel}
                  className="absolute inset-0 cursor-pointer opacity-0 disabled:cursor-wait"
                />
                {uploadingModel ? (
                  <div className="py-3 text-slate-400">
                    <Box className="mx-auto mb-1 h-7 w-7 animate-pulse" />
                    <p className="text-xs">Subiendo modelo 3D...</p>
                  </div>
                ) : form.modelFileName ? (
                  <div className="relative flex flex-col items-center gap-1 py-3">
                    <Box className="h-7 w-7 text-emerald-600" />
                    <p className="max-w-full truncate px-4 text-xs font-medium text-slate-600">{form.modelFileName}</p>
                    <button
                      type="button"
                      onClick={onRemoveModel}
                      className="absolute -right-1 -top-1 rounded-full bg-white p-1 text-slate-400 shadow hover:text-rose-600"
                      title="Quitar modelo 3D"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : (
                  <div className="py-3 text-slate-400">
                    <Box className="mx-auto mb-1 h-7 w-7" />
                    <p className="text-xs">Subir .glb, .gltf, .obj, .fbx o .stl</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button type="submit" disabled={saving || uploadingModel}>
            {saving ? "Guardando..." : isEditing ? "Actualizar" : "Crear"}
          </Button>
        </div>
      </form>
    </GenericModal>
  );
}
