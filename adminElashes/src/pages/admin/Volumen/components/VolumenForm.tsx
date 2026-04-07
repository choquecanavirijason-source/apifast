// src/pages/admin/Volumen/components/VolumenForm.tsx
import React from "react";
import { X, Image as ImageIcon, Trash2, Upload } from "lucide-react";
import type { VolumenFormState } from "../types";

interface Props {
  isOpen: boolean;
  isEditing: boolean;
  form: VolumenFormState;
  saving: boolean;
  onClose: () => void;
  onSave: (e: React.FormEvent) => void;
  onChange: (field: keyof VolumenFormState, value: string) => void;
}

export const VolumenForm = ({ isOpen, isEditing, form, saving, onClose, onSave, onChange }: Props) => {
  if (!isOpen) return null;

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => onChange("image", String(reader.result));
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <form 
        onSubmit={onSave} 
        className="bg-white rounded-[2rem] shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200"
      >
        
        {/* Header Clean */}
        <div className="px-8 py-6 border-b border-slate-50 flex justify-between items-center bg-white">
          <div>
            <span className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                {isEditing ? "Modo Edición" : "Crear Nuevo"}
            </span>
            <h2 className="text-2xl font-bold text-slate-900">
              {isEditing ? "Editar Volumen" : "Nuevo Estilo"}
            </h2>
          </div>
          <button 
            type="button" 
            onClick={onClose} 
            className="group bg-slate-50 hover:bg-slate-100 p-2 rounded-full transition-colors"
          >
            <X className="w-6 h-6 text-slate-400 group-hover:text-slate-700" />
          </button>
        </div>

        {/* Body (Scrollable) */}
        <div className="p-8 space-y-6 overflow-y-auto">
          {/* Nombre */}
          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700 ml-1">Nombre del Estilo</label>
            <input
              value={form.name}
              onChange={(e) => onChange("name", e.target.value)}
              className="w-full rounded-2xl bg-slate-50 border-0 px-5 py-3.5 text-slate-800 font-medium placeholder:text-slate-400 focus:bg-white focus:ring-2 focus:ring-slate-900 transition-all outline-none"
              placeholder="Ej. Volumen Ruso Soft"
              required
            />
          </div>

          {/* Descripción */}
          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700 ml-1">Descripción</label>
            <textarea
              value={form.description}
              onChange={(e) => onChange("description", e.target.value)}
              className="w-full rounded-2xl bg-slate-50 border-0 px-5 py-3.5 text-slate-800 font-medium placeholder:text-slate-400 focus:bg-white focus:ring-2 focus:ring-slate-900 transition-all outline-none resize-none h-28"
              placeholder="Describe la densidad, curvatura o efecto..."
            />
          </div>

          {/* Imagen Zona Grande */}
          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700 ml-1">Fotografía</label>
            
            {!form.image ? (
                <label className="flex flex-col items-center justify-center w-full h-40 border-2 border-dashed border-slate-200 rounded-2xl cursor-pointer hover:bg-slate-50 hover:border-slate-300 transition-all group">
                    <div className="p-4 bg-slate-100 rounded-full mb-3 group-hover:scale-110 transition-transform">
                        <Upload className="w-6 h-6 text-slate-400 group-hover:text-slate-600" />
                    </div>
                    <p className="text-sm font-semibold text-slate-500">Haz clic para subir imagen</p>
                    <p className="text-xs text-slate-400 mt-1">PNG, JPG hasta 5MB</p>
                    <input type="file" className="hidden" accept="image/*" onChange={handleFile} />
                </label>
            ) : (
                <div className="relative w-full h-48 rounded-2xl overflow-hidden group shadow-md">
                    <img src={form.image} alt="Preview" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-slate-900/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4 backdrop-blur-sm">
                         <button
                            type="button"
                            onClick={() => onChange("image", "")}
                            className="bg-white text-red-500 px-4 py-2 rounded-xl font-bold text-sm shadow-lg hover:bg-red-50 transition-colors flex items-center gap-2"
                          >
                            <Trash2 className="w-4 h-4" /> Eliminar
                          </button>
                    </div>
                </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-8 py-6 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-3 rounded-xl text-slate-600 font-bold hover:bg-slate-200 transition-colors text-sm"
            disabled={saving}
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-8 py-3 rounded-xl bg-slate-900 text-white font-bold hover:bg-black shadow-xl shadow-slate-900/20 transform active:scale-95 transition-all text-sm flex items-center gap-2 disabled:opacity-70 disabled:pointer-events-none"
          >
            {saving ? (
                <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Guardando...
                </>
            ) : "Guardar Cambios"}
          </button>
        </div>
      </form>
    </div>
  );
};