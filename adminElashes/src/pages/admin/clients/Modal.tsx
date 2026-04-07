// src/features/clients/components/ClientFileModal.tsx
import React, { useState, useEffect } from "react";
import { X, FileText, CheckCircle2, XCircle, Save, AlertCircle } from "lucide-react";
import type { IClient, IClientAssessment, IClientConsent } from "../../../core/types/IClient";

interface Props {
  isOpen: boolean;
  client: IClient | null;
  onClose: () => void; 
  onSave: (clientId: number, data: { valoracion?: IClientAssessment; expediente?: IClientConsent; }) => void;
  saving: boolean;
}

// Valoración por defecto vacía para evitar errores
const defaultAssessment: IClientAssessment = {
  trastornoParpados: false, sensibilidadLuz: false, alergiasEstacionales: false,
  irritacionPiel: false, ojoSeco: false, xerosis: false, alergiaAlimentos: false,
  conjuntivitis: false, trastornoCutaneo: false, observaciones: ""
};

export const ClientFileModal = ({ isOpen, client, onClose, onSave, saving }: Props) => {
  const [form, setForm] = useState<IClientAssessment>(defaultAssessment);
  const [hasChanges, setHasChanges] = useState(false);

  // Cargar datos cuando se abre el modal
  useEffect(() => {
    if (isOpen && client) {
      setForm(client.valoracion || defaultAssessment);
      setHasChanges(false);
    }
  }, [isOpen, client]);

  if (!isOpen || !client) return null;

  // Handler para cambiar los toggles (Sí/No)
  const toggle = (key: keyof IClientAssessment) => {
    setForm((prev: IClientAssessment) => ({ ...prev, [key]: !prev[key] }));
    setHasChanges(true);
  };

  // Componente de Fila Interactiva
  const ToggleRow = ({ label, field }: { label: string; field: keyof IClientAssessment }) => {
    const value = form[field] as boolean;
    return (
      <div 
        onClick={() => toggle(field)}
        className={`cursor-pointer flex items-center justify-between py-3 px-4 mb-2 rounded-xl border transition-all duration-200 group
          ${value 
            ? "bg-emerald-50 border-emerald-200 hover:bg-emerald-100" 
            : "bg-white border-slate-100 hover:border-slate-300 hover:bg-slate-50"
          }`}
      >
        <span className={`font-medium text-sm flex items-center gap-2 ${value ? "text-emerald-900" : "text-slate-600"}`}>
          <div className={`w-2 h-2 rounded-full transition-colors ${value ? "bg-emerald-600" : "bg-slate-300"}`} />
          {label}
        </span>
        
        <div className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg transition-all
            ${value 
              ? "bg-emerald-500 text-white shadow-md shadow-emerald-200" 
              : "bg-slate-200 text-slate-500 group-hover:bg-slate-300"
            }`}>
           {value ? (
             <>SÍ <CheckCircle2 className="w-3.5 h-3.5" /></>
           ) : (
             <>NO <XCircle className="w-3.5 h-3.5" /></>
           )}
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-[1.5rem] shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200 relative">
        
        {/* Header */}
        <div className="bg-[#094732] p-6 relative">
           <div className="absolute top-0 right-0 w-40 h-40 bg-white/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
           <div className="flex justify-between items-start relative z-10">
              <div>
                <h2 className="text-white text-xl font-bold">FICHA TÉCNICA</h2>
                <p className="text-emerald-100/70 text-xs mt-0.5">Editando valoración de {client.nombre}</p>
              </div>
              <button onClick={onClose} className="bg-white/10 hover:bg-white/20 text-white p-2 rounded-full transition-colors backdrop-blur-md">
                <X className="w-5 h-5" />
              </button>
           </div>
        </div>

        {/* Body Scrollable */}
        <div className="p-6 overflow-y-auto bg-slate-50/50 flex-1">
          
          <div className="space-y-1">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 ml-1">Evaluación Clínica</h3>
              
              <ToggleRow label="Trastorno Párpados" field="trastornoParpados" />
              <ToggleRow label="Sensibilidad a la luz" field="sensibilidadLuz" />
              <ToggleRow label="Alergias estacionales" field="alergiasEstacionales" />
              <ToggleRow label="Irritación en la piel" field="irritacionPiel" />
              <ToggleRow label="Síndrome de ojo seco" field="ojoSeco" />
              <ToggleRow label="Xerosis o piel seca" field="xerosis" />
              <ToggleRow label="Alergia en alimentos" field="alergiaAlimentos" />
              <ToggleRow label="Conjuntivitis" field="conjuntivitis" />
              <ToggleRow label="Trastorno cutáneo" field="trastornoCutaneo" />
          </div>

          <div className="mt-6">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block ml-1">Observaciones</label>
            <textarea 
              value={form.observaciones || ""}
              onChange={(e) => {
                  setForm((prev: IClientAssessment) => ({...prev, observaciones: e.target.value}));
                  setHasChanges(true);
              }}
              className="w-full bg-white border border-slate-200 rounded-xl p-3 text-sm text-slate-700 focus:ring-2 focus:ring-[#094732] focus:border-transparent outline-none resize-none h-24 shadow-sm"
              placeholder="Notas adicionales sobre la clienta..."
            />
          </div>

        </div>

        {/* Footer Actions */}
        <div className="p-5 border-t border-slate-100 bg-white flex justify-end gap-3 z-10">
            <button 
                onClick={onClose}
                className="px-5 py-2.5 text-slate-600 font-bold hover:bg-slate-100 rounded-xl transition-colors text-sm"
            >
                Cancelar
            </button>
            <button 
                onClick={() => onSave(client.id, { valoracion: form })}
                disabled={saving || !hasChanges}
                className="px-6 py-2.5 bg-[#094732] hover:bg-[#063324] text-white font-bold rounded-xl shadow-lg shadow-emerald-900/20 transform active:scale-95 transition-all text-sm flex items-center gap-2 disabled:opacity-50 disabled:transform-none disabled:shadow-none"
            >
                {saving ? "Guardando..." : <><Save className="w-4 h-4" /> Guardar Ficha</>}
            </button>
        </div>

      </div>
    </div>
  );
};