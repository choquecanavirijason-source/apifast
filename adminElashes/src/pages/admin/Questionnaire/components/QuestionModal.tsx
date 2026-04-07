import React, { useState, useEffect } from "react";
import { X } from "lucide-react";
import { SECTIONS } from "../types";
import type { Question } from "../types";
import type { TargetAudience } from "../types";
import type { QuestionType } from "../types";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: Partial<Question>) => void;
  initialData: Partial<Question> | null;
  activeSection: TargetAudience;
  isSaving: boolean;
}

export const QuestionModal: React.FC<Props> = ({ 
  isOpen, onClose, onSubmit, initialData, activeSection, isSaving 
}) => {
  const [form, setForm] = useState<Partial<Question>>({
    text: "",
    type: "text",
    required: false,
    target: activeSection
  });

  useEffect(() => {
    if (isOpen) {
      setForm(initialData || { text: "", type: "text", required: false, target: activeSection });
    }
  }, [isOpen, initialData, activeSection]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm p-4">
      <form 
        onSubmit={(e) => { e.preventDefault(); onSubmit(form); }}
        className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200"
      >
        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
          <h2 className="text-lg font-bold text-gray-900">
            {initialData ? "Editar Pregunta" : "Nueva Pregunta"}
          </h2>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-900 transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Target Selector */}
          <div className="flex gap-2 p-1 bg-gray-50 rounded-lg">
            {SECTIONS.map(s => (
              <button
                key={s.id}
                type="button"
                onClick={() => setForm(prev => ({ ...prev, target: s.id as TargetAudience }))}
                className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${
                  form.target === s.id 
                    ? "bg-white text-gray-900 shadow-sm" 
                    : "text-gray-400 hover:text-gray-600"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-gray-500 uppercase">Pregunta</label>
            <textarea
              value={form.text}
              onChange={(e) => setForm(prev => ({ ...prev, text: e.target.value }))}
              className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm focus:bg-white focus:border-gray-900 focus:ring-1 focus:ring-gray-900 outline-none transition-all resize-none h-24"
              placeholder="Escribe la pregunta aquí..."
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-500 uppercase">Tipo</label>
              <select
                value={form.type}
                onChange={(e) => setForm(prev => ({ ...prev, type: e.target.value as QuestionType }))}
                className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm focus:bg-white focus:border-gray-900 focus:ring-1 focus:ring-gray-900 outline-none"
              >
                <option value="text">Texto Libre</option>
                <option value="yes_no">Sí / No</option>
                <option value="selection">Selección</option>
              </select>
            </div>
            
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-500 uppercase">Configuración</label>
              <div 
                onClick={() => setForm(prev => ({ ...prev, required: !prev.required }))}
                className={`cursor-pointer w-full rounded-lg border px-3 py-2 flex items-center justify-between transition-colors h-[38px] ${
                    form.required ? "bg-gray-900 border-gray-900 text-white" : "bg-white border-gray-200 text-gray-600"
                }`}
              >
                <span className="text-xs font-bold">Obligatorio</span>
                <div className={`w-2 h-2 rounded-full ${form.required ? "bg-white" : "bg-gray-300"}`} />
              </div>
            </div>
          </div>
        </div>

        <div className="px-6 py-4 bg-gray-50 flex justify-end gap-3 border-t border-gray-100">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900">
            Cancelar
          </button>
          <button 
            type="submit" 
            disabled={isSaving}
            className="px-6 py-2 rounded-lg bg-gray-900 text-white text-sm font-bold shadow-md hover:bg-black transition-all"
          >
            {isSaving ? "Guardando..." : "Guardar"}
          </button>
        </div>
      </form>
    </div>
  );
};