// src/pages/admin/Volumen/index.tsx
import React from "react";
import { Plus, Search, Edit, Trash2, Image as ImageIcon, Sparkles } from "lucide-react";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { useVolumen } from "./hooks/useVolumen";
import { VolumenForm } from "./components/VolumenForm";

export default function VolumenPage() {
  const {
    volumes,
    search,
    setSearch,
    loading,
    isModalOpen,
    form,
    saving,
    isEditing,
    dialogConfig,
    isProcessing,
    openCreate,
    openEdit,
    closeModal,
    saveVolume,
    handleInputChange,
    confirmDelete,
    closeDialog
  } = useVolumen();

  return (
    <div className="p-6 md:p-10 min-h-screen bg-slate-50/50 font-sans">
      <div className="mb-8 flex items-center gap-3">
        <div className="p-2 bg-emerald-100 rounded-lg">
          <Sparkles className="w-6 h-6 text-[#094732]" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Volumen</h1>
          <p className="text-slate-500 text-sm">
            Gestiona la coleccion de disenos disponibles para tus clientes.
          </p>
        </div>
      </div>

      <div className="bg-emerald-50/40 rounded-[1.5rem] border border-emerald-100 shadow-sm p-6 md:p-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div className="relative w-full md:w-80">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-slate-400" />
            </div>
            <input
              type="text"
              placeholder="Buscar estilo..."
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
            <span>Nuevo Estilo</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {loading && (
            <div className="col-span-full py-12 text-center text-slate-400 bg-white/50 rounded-2xl border border-dashed border-slate-300">
              Cargando volúmenes...
            </div>
          )}

          {!loading && volumes.length === 0 && (
            <div className="col-span-full py-12 text-center text-slate-400 bg-white/50 rounded-2xl border border-dashed border-slate-300">
              Intenta ajustar tu búsqueda o crea un nuevo volumen.
            </div>
          )}

          {volumes.map((vol) => (
            <div
              key={vol.id}
              className="group bg-white rounded-2xl p-4 border border-slate-200 shadow-sm hover:shadow-md hover:border-emerald-200 transition-all duration-300 flex flex-col gap-4"
            >
              <div className="relative aspect-[4/3] w-full rounded-xl overflow-hidden bg-slate-50 border border-slate-100 flex items-center justify-center group-hover:scale-[1.02] transition-transform duration-500">
                {vol.image ? (
                  <img src={vol.image} alt={vol.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="flex flex-col items-center gap-2 text-slate-300">
                    <ImageIcon className="w-10 h-10" />
                    <span className="text-xs font-medium">Sin imagen</span>
                  </div>
                )}
              </div>

              <div className="flex-1 flex flex-col gap-2">
                <span className="font-bold text-slate-700 text-lg">{vol.name}</span>
                <p className="text-sm text-slate-500 leading-relaxed line-clamp-2">
                  {vol.description || "Sin descripcion disponible."}
                </p>
              </div>

              <div className="flex items-center justify-between mt-auto">
                <button
                  onClick={() => openEdit(vol)}
                  className="flex-1 p-2 bg-slate-100 hover:bg-[#094732] hover:text-white text-slate-600 rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  <Edit className="w-4 h-4" />
                  Editar
                </button>
                <button
                  onClick={() => confirmDelete(vol)}
                  className="ml-2 p-2 bg-rose-50 hover:bg-rose-500 hover:text-white text-rose-500 rounded-lg transition-colors"
                  title="Eliminar"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* --- MODALS --- */}
      <VolumenForm
        isOpen={isModalOpen}
        isEditing={isEditing}
        form={form}
        saving={saving}
        onClose={closeModal}
        onSave={saveVolume}
        onChange={handleInputChange}
      />

      {dialogConfig && (
        <ConfirmDialog
          isOpen={dialogConfig.isOpen}
          title={dialogConfig.title}
          message={dialogConfig.message}
          confirmText={dialogConfig.variant === "danger" ? "Eliminar" : "Confirmar"}
          variant={dialogConfig.variant}
          onConfirm={dialogConfig.onConfirm}
          onCancel={closeDialog}
          isProcessing={isProcessing}
        />
      )}
    </div>
  );
}