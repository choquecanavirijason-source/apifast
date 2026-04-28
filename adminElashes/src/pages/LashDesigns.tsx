import React, { useState, useMemo, useEffect } from "react";
import { 
  Plus, Search, Edit, Trash2, Image as ImageIcon, X, Brush, AlertTriangle, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight 
} from "lucide-react";
import { toast } from "react-toastify";
import api from "../core/services/api";
import { Card, CardImage, CardTitle, CardActions } from "../components/common/card";
import PageLayout from "../components/common/PageLayout";

// --- 1. Tipos y Utilería ---
type LashDesign = {
  id: number;
  name: string;
  image: string;
};

const emptyForm = { name: "", image: "" };

// --- 2. Componentes UI Estilo Business Central ---

// Modal con estética de "Ventana de Aplicación"
const SimpleModal = ({ isOpen, onClose, title, children }: any) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="w-full max-w-xl bg-white border border-slate-300 shadow-xl flex flex-col">
        {/* Header Compacto BC */}
        <div className="flex items-center justify-between px-4 py-2 bg-slate-100 border-b border-slate-300">
          <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">{title}</h3>
          <button onClick={onClose} className="p-1 hover:bg-slate-200 text-slate-500 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-6">
          {children}
        </div>
      </div>
    </div>
  );
};

// Diálogo de Confirmación Estilo Enterprise
const ConfirmDialog = ({ isOpen, title, message, onConfirm, onCancel, isProcessing, variant = "primary" }: any) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/25">
      <div className="w-full max-w-md bg-white border border-slate-300 shadow-2xl">
        <div className="p-6 flex gap-4">
          <div className={`shrink-0 p-2 h-fit ${variant === 'danger' ? 'text-rose-600' : 'text-blue-600'}`}>
            <AlertTriangle className="w-8 h-8" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-slate-900 mb-2">{title}</h3>
            <p className="text-sm text-slate-600 leading-normal">{message}</p>
          </div>
        </div>
        {/* Botonera inferior alineada a la derecha */}
        <div className="bg-slate-50 px-4 py-3 border-t border-slate-200 flex justify-end gap-2">
          <button 
            onClick={onCancel}
            disabled={isProcessing}
            className="px-4 py-1.5 text-sm font-medium border border-slate-300 bg-white hover:bg-slate-50 text-slate-700"
          >
            Cancelar
          </button>
          <button 
            onClick={onConfirm}
            disabled={isProcessing}
            className={`px-6 py-1.5 text-sm font-medium text-white shadow-sm ${
              variant === 'danger' ? 'bg-rose-600 hover:bg-rose-700' : 'bg-blue-700 hover:bg-blue-800'
            }`}
          >
            {isProcessing ? "Procesando..." : "Aceptar"}
          </button>
        </div>
      </div>
    </div>
  );
};

// --- 3. Componente Principal ---

export default function LashDesignsPage() {
  const [designs, setDesigns] = useState<LashDesign[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentDesign, setCurrentDesign] = useState<LashDesign | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [dialogConfig, setDialogConfig] = useState<any>(null);

  // Paginación
  const PAGE_SIZE = 8;
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return designs.filter((d) => d.name.toLowerCase().includes(query));
  }, [designs, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, page]);

  useEffect(() => { loadDesigns(); }, []);

  const loadDesigns = async () => {
    setLoading(true);
    try {
      const response = await api.get("/catalogs/lash-designs");
      setDesigns(response.data);
    } catch (error) { toast.error("Error al cargar diseños"); }
    finally { setLoading(false); }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setForm(p => ({ ...p, image: String(reader.result) }));
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (currentDesign) {
        await api.put(`/catalogs/lash-designs/${currentDesign.id}`, { ...form });
      } else {
        await api.post("/catalogs/lash-designs", { ...form });
      }
      await loadDesigns();
      setIsModalOpen(false);
    } catch (error) { toast.error("Error al guardar"); }
    finally { setSaving(false); }
  };

  return (
    <PageLayout
      title="Tecnología"
      subtitle="Catálogo de estilos de mapeo (Mapping)"
      icon={<Brush className="w-5 h-5 text-slate-600" />}
      actions={
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => { setForm(emptyForm); setCurrentDesign(null); setIsModalOpen(true); }}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#0078d4] hover:bg-[#106ebe] text-white text-sm font-semibold shadow-sm transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Nuevo diseño</span>
          </button>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar..."
              className="pl-9 pr-4 py-2 text-sm border border-slate-300 focus:border-blue-500 outline-none w-64 transition-all"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
      }
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {paginated.map((item) => (
          <div key={item.id} className="bg-white border border-slate-200 hover:border-blue-400 group transition-all">
            <div className="aspect-video bg-slate-50 border-b border-slate-100 flex items-center justify-center overflow-hidden">
              {item.image ? (
                <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
              ) : (
                <Brush className="w-8 h-8 text-slate-300" />
              )}
            </div>
            <div className="p-3 flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-700 truncate">{item.name}</span>
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => { setCurrentDesign(item); setForm({name: item.name, image: item.image}); setIsModalOpen(true); }} className="p-1.5 hover:bg-slate-100 text-blue-600"><Edit className="w-4 h-4" /></button>
                <button onClick={() => setDialogConfig({ isOpen: true, title: "Eliminar", message: `¿Borrar ${item.name}?`, variant: "danger", onConfirm: async () => { try { await api.delete(`/catalogs/lash-designs/${item.id}`); loadDesigns(); setDialogConfig(null); } catch(e) { toast.error("Error"); } } })} className="p-1.5 hover:bg-rose-50 text-rose-600"><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Paginación Estilo Business Central */}
      {totalPages > 1 && (
        <div className="mt-8 flex items-center justify-between border-t border-slate-200 pt-4">
          <span className="text-xs text-slate-500">
            Mostrando <b>{(page - 1) * PAGE_SIZE + 1}</b> a <b>{Math.min(page * PAGE_SIZE, filtered.length)}</b> de <b>{filtered.length}</b> resultados
          </span>
          <div className="flex items-center gap-1">
            <button onClick={() => setPage(1)} disabled={page === 1} className="p-1 border border-slate-300 disabled:opacity-30"><ChevronsLeft className="w-4 h-4" /></button>
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="p-1 border border-slate-300 disabled:opacity-30"><ChevronLeft className="w-4 h-4" /></button>
            <span className="px-4 text-xs font-bold text-slate-700">Página {page} de {totalPages}</span>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="p-1 border border-slate-300 disabled:opacity-30"><ChevronRight className="w-4 h-4" /></button>
            <button onClick={() => setPage(totalPages)} disabled={page === totalPages} className="p-1 border border-slate-300 disabled:opacity-30"><ChevronsRight className="w-4 h-4" /></button>
          </div>
        </div>
      )}

      {/* Modal de Formulario */}
      <SimpleModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={currentDesign ? "Editar Diseño" : "Nuevo Diseño"}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Nombre</label>
            <input
              value={form.name}
              onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-300 focus:border-blue-500 outline-none text-sm"
              placeholder="Nombre del diseño..."
              required
            />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Imagen del Esquema</label>
            <div className="border border-dashed border-slate-300 bg-slate-50 p-4 relative text-center">
              <input type="file" accept="image/*" onChange={handleFileChange} className="absolute inset-0 opacity-0 cursor-pointer" />
              {form.image ? (
                <img src={form.image} alt="Preview" className="h-32 mx-auto object-contain" />
              ) : (
                <div className="py-4 text-slate-400">
                  <ImageIcon className="w-8 h-8 mx-auto mb-1" />
                  <p className="text-xs">Haga clic para cargar</p>
                </div>
              )}
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
            <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-1.5 text-sm border border-slate-300 hover:bg-slate-50">Cancelar</button>
            <button type="submit" disabled={saving} className="px-6 py-1.5 text-sm bg-blue-700 hover:bg-blue-800 text-white font-medium shadow-sm">
              {saving ? "Guardando..." : "Aceptar"}
            </button>
          </div>
        </form>
      </SimpleModal>

      {dialogConfig && (
        <ConfirmDialog
          {...dialogConfig}
          onCancel={() => setDialogConfig(null)}
          isProcessing={isProcessing}
        />
      )}
    </PageLayout>
  );
}