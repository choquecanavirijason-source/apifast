import React from "react";
import { X, Save, Eye, Ruler, Layers, PenTool, User, Calendar, Search } from "lucide-react";
import type { FollowUpFormState } from "../types";

interface Props {
  isOpen: boolean;
  form: FollowUpFormState;
  saving: boolean;
  onClose: () => void;
  onSave: (e: React.FormEvent) => void;
  onChange: (field: keyof FollowUpFormState, value: any) => void;
  onToggle: (field: keyof FollowUpFormState, value: string) => void;
  clients: { id: number; nombre: string; apellido: string }[]; // Lista de clientes
}

const CURVAS = ["C", "B", "D", "L", "N"];
const TAMANOS = ["7", "8", "9", "10", "11", "12", "13", "14", "15", "16", "17"];
const GROSORES = ["0.03", "0.05", "0.07", "0.10", "0.12", "0.15", "0.18", "0.20"];
const DENSIDADES = ["Natural", "Semitupido", "Tupido"];
const DISENOS = ["Natural", "Ojo de Gato", "Mixta al Costado", "Mixta"];
const FORMAS = ["Almendrados", "Hundidos", "Saltones", "Estrechos", "Asiáticos", "Caídos", "Apartados"];

export const FollowUpForm = ({ isOpen, form, saving, onClose, onSave, onChange, onToggle, clients }: Props) => {
  if (!isOpen) return null;

  const CheckboxGroup = ({ label, options, field, color = "blue" }: { label: string; options: string[]; field: keyof FollowUpFormState; color?: string }) => (
    <div className="mb-4">
      <h4 className="text-xs font-bold text-slate-500 uppercase mb-2">{label}</h4>
      <div className="flex flex-wrap gap-2">
        {options.map((opt: string) => {
          const isSelected = (form[field] as any).includes(opt);
          let activeClass = "bg-slate-800 text-white border-slate-800";
          if(color === "pink") activeClass = "bg-pink-500 text-white border-pink-500";
          
          return (
            <button key={opt} type="button" onClick={() => onToggle(field, opt)} className={`min-w-[40px] px-2 py-1.5 rounded-lg text-xs font-bold border transition-all ${isSelected ? activeClass : "bg-white text-slate-600 border-slate-200 hover:border-slate-400"}`}>
              {opt}
            </button>
          )
        })}
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in">
      <form onSubmit={onSave} className="bg-slate-50 rounded-[2rem] shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95">
        <div className="bg-[#094732] p-6 flex justify-between items-center">
            <div>
                <h2 className="text-white text-xl font-bold flex items-center gap-2"><Eye className="w-5 h-5 opacity-80"/> SEGUIMIENTO DE CLIENTE</h2>
                <p className="text-emerald-100/60 text-xs mt-1 uppercase tracking-widest">Extensión de Pestañas</p>
            </div>
            <button type="button" onClick={onClose} className="bg-white/10 hover:bg-white/20 text-white p-2 rounded-full transition-colors"><X className="w-5 h-5" /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-8">
            <div className="flex flex-col md:flex-row gap-6 mb-8 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                <div className="flex-1 space-y-2">
                    <label className="text-xs font-bold text-slate-500 ml-1 flex items-center gap-2"><User className="w-3.5 h-3.5"/> CLIENTE</label>
                    <div className="relative">
                        <select 
                            value={form.clientId} 
                            onChange={(e) => {
                                const id = Number(e.target.value);
                                const client = clients.find(c => c.id === id);
                                onChange("clientId", id);
                                onChange("clientName", client ? `${client.nombre} ${client.apellido}` : "");
                            }}
                            className="w-full appearance-none bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-slate-800 focus:ring-2 focus:ring-[#094732] outline-none font-bold text-sm cursor-pointer"
                        >
                            <option value={0}>-- Seleccionar Cliente --</option>
                            {clients.map(c => <option key={c.id} value={c.id}>{c.nombre} {c.apellido}</option>)}
                        </select>
                        <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none"/>
                    </div>
                </div>
                <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 ml-1 flex items-center gap-2"><Calendar className="w-3.5 h-3.5"/> FECHA APLICACIÓN</label>
                    <input type="date" value={form.applicationDate} onChange={(e) => onChange("applicationDate", e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-slate-800 focus:ring-2 focus:ring-[#094732] outline-none font-medium text-sm" />
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
                <div className="md:col-span-5 bg-white p-6 rounded-2xl border-2 border-slate-200 shadow-sm relative">
                    <div className="absolute -top-3 left-4 bg-slate-50 px-3 text-xs font-black text-slate-400 uppercase tracking-widest border border-slate-200 rounded-full">Detalles del Tratamiento</div>
                    <CheckboxGroup label="Curva" options={CURVAS} field="curva" color="pink" />
                    <CheckboxGroup label="Tamaño (mm)" options={TAMANOS} field="tamano" color="pink" />
                    <CheckboxGroup label="Grosor (mm)" options={GROSORES} field="grosor" color="pink" />
                </div>

                <div className="md:col-span-7 space-y-6">
                    <div className="bg-blue-50/50 p-5 rounded-2xl border border-blue-100">
                        <h3 className="text-xs font-black text-blue-900 uppercase mb-3 flex items-center gap-2"><PenTool className="w-3 h-3"/> Efecto / Material</h3>
                        <input value={form.efectoMaterial} onChange={(e) => onChange("efectoMaterial", e.target.value)} className="w-full mb-4 px-3 py-2 bg-white rounded-lg border border-blue-200 text-sm focus:outline-none" placeholder="Descripción del material..." />
                        <div className="flex gap-2">
                            {DENSIDADES.map(d => (
                                <button key={d} type="button" onClick={() => onChange("densidad", d)} className={`flex-1 py-1.5 rounded-md text-xs font-bold border ${form.densidad === d ? "bg-blue-600 text-white border-blue-600" : "bg-white text-blue-400 border-blue-200"}`}>{d}</button>
                            ))}
                        </div>
                    </div>
                    <div>
                        <h3 className="text-xs font-black text-slate-400 uppercase mb-3 flex items-center gap-2"><Ruler className="w-3 h-3"/> Diseños (Mapping)</h3>
                        <div className="grid grid-cols-2 gap-3">
                            {DISENOS.map(d => (
                                <button key={d} type="button" onClick={() => onChange("diseno", d)} className={`p-3 rounded-xl border flex flex-col items-center gap-2 transition-all ${form.diseno === d ? "bg-emerald-50 border-[#094732] text-[#094732]" : "bg-white border-slate-200 hover:bg-slate-50 text-slate-500"}`}>
                                    <Layers className="w-6 h-6 opacity-50"/> <span className="text-xs font-bold">{d}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                    <div>
                        <h3 className="text-xs font-black text-slate-400 uppercase mb-3">Forma de los Ojos</h3>
                        <div className="flex flex-wrap gap-2">
                             {FORMAS.map(f => {
                                 const isSelected = form.formaOjos.includes(f);
                                 return <button key={f} type="button" onClick={() => onToggle("formaOjos", f)} className={`px-3 py-1 rounded-full text-xs font-medium border ${isSelected ? "bg-pink-100 text-pink-700 border-pink-200" : "bg-white text-slate-500 border-slate-200"}`}>{isSelected && "✓ "} {f}</button>
                             })}
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <div className="px-8 py-5 bg-white border-t border-slate-100 flex justify-end gap-3">
            <button type="button" onClick={onClose} className="px-6 py-2.5 rounded-xl text-slate-600 font-bold hover:bg-slate-100">Cancelar</button>
            <button type="submit" disabled={saving} className="px-8 py-2.5 rounded-xl bg-[#094732] text-white font-bold hover:bg-[#063324] shadow-lg flex items-center gap-2">{saving ? "Guardando..." : <><Save className="w-4 h-4"/> Guardar Ficha</>}</button>
        </div>
      </form>
    </div>
  );
};