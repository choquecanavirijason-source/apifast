import React, { useState, useMemo, useEffect } from "react";
import { 
  Plus, Search, Edit, Trash2, Image as ImageIcon, X, Eye, AlertTriangle 
} from "lucide-react";
import { toast } from "react-toastify";
import api from "../core/services/api";

// --- 1. Tipos y Datos Mock ---
type EyeType = {
  id: number;
  name: string;
  image: string; // Base64 o URL
};

const emptyForm = { name: "", image: "" };

const getErrorMessage = (error: unknown, fallback: string) => {
  if (
    typeof error === "object" &&
    error !== null &&
    "response" in error &&
    typeof (error as { response?: { data?: { detail?: unknown } } }).response?.data?.detail === "string"
  ) {
    return (error as { response?: { data?: { detail?: string } } }).response?.data?.detail ?? fallback;
  }

  return fallback;
};

// --- 2. Componentes UI Reutilizables (Internos) ---

// Modal Genérico
const SimpleModal = ({ isOpen, onClose, title, children }: any) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl ring-1 ring-black/5">
        <div className="flex items-center justify-between mb-6 border-b border-slate-100 pb-4">
          <h3 className="text-xl font-bold text-slate-800">{title}</h3>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
};

// Diálogo de Confirmación
const ConfirmDialog = ({ isOpen, title, message, onConfirm, onCancel, isProcessing, variant = "primary" }: any) => {
    if (!isOpen) return null;
    return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
        <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl scale-100">
          <div className="flex flex-col items-center text-center gap-4">
            <div className={`p-3 rounded-full ${variant === 'danger' ? 'bg-rose-100 text-rose-600' : 'bg-emerald-100 text-emerald-600'}`}>
              <AlertTriangle className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-800">{title}</h3>
              <p className="text-slate-500 mt-2 text-sm leading-relaxed">{message}</p>
            </div>
            <div className="flex gap-3 w-full mt-4">
              <button 
                onClick={onCancel}
                disabled={isProcessing}
                className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-600 font-bold rounded-xl hover:bg-slate-50 transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button 
                onClick={onConfirm}
                disabled={isProcessing}
                className={`flex-1 px-4 py-2.5 text-white font-bold rounded-xl shadow-lg transition-all transform active:scale-95 disabled:opacity-70 disabled:active:scale-100 ${
                  variant === 'danger' 
                    ? 'bg-rose-500 hover:bg-rose-600 shadow-rose-500/20' 
                    : 'bg-[#094732] hover:bg-[#063324] shadow-emerald-900/20'
                }`}
              >
                {isProcessing ? "Procesando..." : (variant === 'danger' ? "Eliminar" : "Confirmar")}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
};

// --- 3. Componente Principal ---

export default function EyeTypesPage() {
  // Estados Principales
  const [eyeTypes, setEyeTypes] = useState<EyeType[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  
  // Estados de Modal y Formulario
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentEyeType, setCurrentEyeType] = useState<EyeType | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  // Estados de Confirmación (Eliminar)
  const [isProcessing, setIsProcessing] = useState(false);
  const [dialogConfig, setDialogConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    variant: "primary" | "danger";
  } | null>(null);

  // Filtrado
  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return eyeTypes;
    return eyeTypes.filter((eyeType) => eyeType.name.toLowerCase().includes(query));
  }, [eyeTypes, search]);

  const loadEyeTypes = async () => {
    setLoading(true);
    try {
      const response = await api.get("/catalogs/eye-types");
      setEyeTypes(response.data);
    } catch (error) {
      toast.error("Error al cargar tipos de ojo");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEyeTypes();
  }, []);

  // Manejadores del Formulario
  const openCreate = () => {
    setCurrentEyeType(null);
    setForm(emptyForm);
    setIsModalOpen(true);
  };

  const openEdit = (eyeType: EyeType) => {
    setCurrentEyeType(eyeType);
    setForm({ name: eyeType.name, image: eyeType.image });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setCurrentEyeType(null);
    setForm(emptyForm);
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setForm((prev) => ({ ...prev, image: String(reader.result || "") }));
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const name = form.name.trim();
    if (!name) return;
    
    setSaving(true);
    try {
      if (currentEyeType) {
        await api.put(`/catalogs/eye-types/${currentEyeType.id}`, {
          name,
          image: form.image || null,
        });
      } else {
        await api.post("/catalogs/eye-types", {
          name,
          image: form.image || null,
        });
      }
      await loadEyeTypes();
      closeModal();
    } catch (error) {
      toast.error(getErrorMessage(error, "No se pudo guardar el tipo de ojo"));
    } finally {
      setSaving(false);
    }
  };

  // Manejadores de Eliminación
  const openDeleteDialog = (eyeType: EyeType) => {
    setDialogConfig({
      isOpen: true,
      title: "¿Eliminar tipo de ojo?",
      message: `Estás a punto de eliminar "${eyeType.name}". Esta acción no se puede deshacer.`,
      variant: "danger",
      onConfirm: () => handleDelete(eyeType),
    });
  };

  const handleDelete = async (eyeType: EyeType) => {
    setIsProcessing(true);
    try {
      await api.delete(`/catalogs/eye-types/${eyeType.id}`);
      await loadEyeTypes();
      setDialogConfig(null);
    } catch (error) {
      toast.error(getErrorMessage(error, "No se pudo eliminar el tipo de ojo"));
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="p-6 md:p-10 min-h-screen bg-slate-50/50 font-sans">
      
      {/* Encabezado con Icono de Ojo */}
      <div className="mb-8 flex items-center gap-3">
        <div className="p-2 bg-emerald-100 rounded-lg">
            <Eye className="w-6 h-6 text-[#094732]" />
        </div>
        <div>
            <h1 className="text-2xl font-bold text-slate-800">Tipos de Ojos</h1>
            <p className="text-slate-500 text-sm">Clasificación anatómica para diagnósticos</p>
        </div>
      </div>

      {/* Contenedor Principal (Estilo Esmeralda) */}
      <div className="bg-emerald-50/40 rounded-[1.5rem] border border-emerald-100 shadow-sm p-6 md:p-8">
        
        {/* Toolbar Superior */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
            <div className="relative w-full md:w-80">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Search className="h-5 w-5 text-slate-400" />
                </div>
                <input
                    type="text"
                    placeholder="Buscar tipo de ojo..."
                    className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#094732] focus:border-transparent transition-all text-slate-700 placeholder:text-slate-400 shadow-sm outline-none"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                />
            </div>

            <button
                onClick={openCreate}
                className="bg-[#094732] hover:bg-[#063324] text-white font-bold rounded-xl px-6 py-3 shadow-lg shadow-emerald-900/20 flex items-center justify-center gap-2 transform active:scale-95 transition-all"
            >
                <Plus className="w-5 h-5" />
                <span>Agregar Tipo</span>
            </button>
        </div>

        {/* Grid de Cards Responsive */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {loading && (
            <div className="col-span-full py-12 text-center text-slate-400 bg-white/50 rounded-2xl border border-dashed border-slate-300">
              Cargando tipos de ojo...
            </div>
          )}
          {!loading && filtered.length === 0 && (
                <div className="col-span-full py-12 text-center text-slate-400 bg-white/50 rounded-2xl border border-dashed border-slate-300">
                    No se encontraron tipos de ojos con ese nombre.
                </div>
            )}
            
            {filtered.map((item) => (
            <div 
                key={item.id} 
                className="group bg-white rounded-2xl p-4 border border-slate-200 shadow-sm hover:shadow-md hover:border-emerald-200 transition-all duration-300 flex flex-col gap-4"
            >
                {/* Imagen */}
                <div className="relative aspect-video w-full rounded-xl overflow-hidden bg-slate-50 border border-slate-100 flex items-center justify-center group-hover:scale-[1.02] transition-transform duration-500">
                    {item.image ? (
                        <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                    ) : (
                        <div className="flex flex-col items-center gap-2 text-slate-300">
                            <Eye className="w-10 h-10 opacity-50" />
                            <span className="text-xs font-medium">Sin imagen</span>
                        </div>
                    )}
                </div>

                {/* Info y Acciones */}
                <div className="flex items-center justify-between mt-auto">
                    <span className="font-bold text-slate-700 text-lg">{item.name}</span>
                    
                    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                        <button
                            onClick={() => openEdit(item)}
                            className="p-2 bg-slate-100 hover:bg-[#094732] hover:text-white text-slate-600 rounded-lg transition-colors"
                            title="Editar"
                        >
                            <Edit className="w-4 h-4" />
                        </button>
                        <button
                            onClick={() => openDeleteDialog(item)}
                            className="p-2 bg-rose-50 hover:bg-rose-500 hover:text-white text-rose-500 rounded-lg transition-colors"
                            title="Eliminar"
                        >
                            <Trash2 className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </div>
            ))}
        </div>
      </div>

      {/* --- Modales --- */}

      {/* Formulario Crear/Editar */}
      <SimpleModal
        isOpen={isModalOpen}
        onClose={closeModal}
        title={currentEyeType ? "Editar Tipo de Ojo" : "Nuevo Tipo de Ojo"}
      >
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">Nombre / Clasificación</label>
              <input
                name="name"
                value={form.name}
                onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-[#094732] focus:border-transparent outline-none transition-all"
                placeholder="Ej. Ojo Almendrado"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">Imagen de Referencia</label>
              <div className="border-2 border-dashed border-slate-300 rounded-xl p-4 bg-slate-50 hover:bg-slate-100 transition-colors text-center relative group">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                  />
                  
                  {form.image ? (
                     <div className="relative h-40 mx-auto rounded-lg overflow-hidden w-fit">
                        <img src={form.image} alt="Preview" className="h-full object-contain" />
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                             <span className="text-white text-xs font-bold bg-black/50 px-3 py-1 rounded-full">Cambiar imagen</span>
                        </div>
                     </div>
                  ) : (
                      <div className="py-8 flex flex-col items-center text-slate-400">
                          <ImageIcon className="w-10 h-10 mb-2" />
                          <span className="text-sm">Click para subir foto</span>
                      </div>
                  )}
              </div>
              {form.image && (
                <button
                  type="button"
                  className="text-xs font-bold text-rose-500 hover:text-rose-700 mt-2 flex items-center gap-1 ml-auto"
                  onClick={() => setForm((prev) => ({ ...prev, image: "" }))}
                >
                  <Trash2 className="w-3 h-3" /> Eliminar foto actual
                </button>
              )}
            </div>

            <div className="flex justify-end gap-3 mt-4 pt-4 border-t border-slate-100">
              <button
                type="button"
                className="px-5 py-2.5 rounded-xl text-slate-600 font-bold hover:bg-slate-100 transition-colors"
                onClick={closeModal}
                disabled={saving}
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-6 py-2.5 bg-[#094732] text-white font-bold rounded-xl shadow-lg shadow-emerald-900/10 hover:bg-[#063324] transform active:scale-95 transition-all disabled:opacity-70 disabled:active:scale-100"
                disabled={saving}
              >
                {saving ? "Guardando..." : "Guardar Cambios"}
              </button>
            </div>
        </form>
      </SimpleModal>

      {/* Confirmar Eliminación */}
      {dialogConfig && (
        <ConfirmDialog
          isOpen={dialogConfig.isOpen}
          title={dialogConfig.title}
          message={dialogConfig.message}
          onConfirm={dialogConfig.onConfirm}
          onCancel={() => setDialogConfig(null)}
          isProcessing={isProcessing}
          variant={dialogConfig.variant}
        />
      )}
    </div>
  );
}