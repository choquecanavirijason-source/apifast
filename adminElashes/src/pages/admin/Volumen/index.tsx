import { useMemo, useState } from "react";
import {
  Plus,
  Search,
  Edit,
  Trash2,
  Layers,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import Layout from "@/components/common/layout";
import FilterActionBar from "@/components/common/FilterActionBar";
import { Button } from "@/components/common/ui";
import { useVolumen } from "./hooks/useVolumen";
import { VolumenForm } from "./components/VolumenForm";
import type { LashVolume } from "./types";

const PAGE_SIZE = 8;

export default function VolumenPage() {
  const {
    volumes,
    search,
    setSearch,
    loading,
    isModalOpen,
    form,
    saving,
    uploadingModel,
    isEditing,
    dialogConfig,
    isProcessing,
    openCreate,
    openEdit,
    closeModal,
    saveVolume,
    handleInputChange,
    handleModelChange,
    removeModel,
    confirmDelete,
    closeDialog,
  } = useVolumen();

  const [page, setPage] = useState(1);

  const totalPages = Math.max(1, Math.ceil(volumes.length / PAGE_SIZE));
  const paginated = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return volumes.slice(start, start + PAGE_SIZE);
  }, [volumes, page]);

  const handleSearchChange = (value: string) => {
    setSearch(value);
    setPage(1);
  };

  return (
    <Layout
      title="Volumen"
      subtitle="Catálogo de volúmenes y estilos para tus clientas"
      variant="cards"
      toolbar={
        <FilterActionBar
          left={
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar volumen..."
                className="w-64 rounded-lg border border-slate-200 py-2 pl-9 pr-4 text-sm outline-none transition-all focus:border-slate-300"
                value={search}
                onChange={(e) => handleSearchChange(e.target.value)}
              />
            </div>
          }
          right={
            <Button onClick={openCreate} leftIcon={<Plus className="h-4 w-4" />}>
              Nuevo volumen
            </Button>
          }
        />
      }
    >
      {loading ? (
        <p className="py-10 text-center text-sm text-slate-400">Cargando volúmenes...</p>
      ) : paginated.length === 0 ? (
        <p className="py-10 text-center text-sm text-slate-400">No se encontraron volúmenes.</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {paginated.map((vol: LashVolume) => (
            <div
              key={vol.id}
              className="group overflow-hidden rounded-xl border border-slate-200 bg-white transition-all hover:border-slate-300 hover:shadow-md"
            >
              <div className="flex aspect-video items-center justify-center overflow-hidden bg-slate-50">
                {vol.image ? (
                  <img src={vol.image} alt={vol.name} className="h-full w-full object-cover" />
                ) : (
                  <Layers className="h-8 w-8 text-slate-300" />
                )}
              </div>
              <div className="border-t border-slate-100 px-3 py-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-700">{vol.name}</p>
                    {vol.description ? (
                      <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">{vol.description}</p>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                    <button
                      type="button"
                      onClick={() => openEdit(vol)}
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-blue-600"
                      title="Editar"
                    >
                      <Edit className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => confirmDelete(vol)}
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                      title="Eliminar"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {totalPages > 1 ? (
        <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-4">
          <span className="text-xs text-slate-500">
            Mostrando <b>{(page - 1) * PAGE_SIZE + 1}</b>–<b>{Math.min(page * PAGE_SIZE, volumes.length)}</b> de{" "}
            <b>{volumes.length}</b>
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setPage(1)}
              disabled={page === 1}
              className="rounded-lg border border-slate-200 p-1.5 hover:bg-slate-50 disabled:opacity-30"
            >
              <ChevronsLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="rounded-lg border border-slate-200 p-1.5 hover:bg-slate-50 disabled:opacity-30"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="px-3 text-xs font-medium text-slate-600">
              Pág. {page} / {totalPages}
            </span>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="rounded-lg border border-slate-200 p-1.5 hover:bg-slate-50 disabled:opacity-30"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setPage(totalPages)}
              disabled={page === totalPages}
              className="rounded-lg border border-slate-200 p-1.5 hover:bg-slate-50 disabled:opacity-30"
            >
              <ChevronsRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      ) : null}

      <VolumenForm
        isOpen={isModalOpen}
        isEditing={isEditing}
        form={form}
        saving={saving}
        uploadingModel={uploadingModel}
        onClose={closeModal}
        onSave={saveVolume}
        onChange={handleInputChange}
        onModelChange={handleModelChange}
        onRemoveModel={removeModel}
      />

      {dialogConfig ? (
        <ConfirmDialog
          isOpen={dialogConfig.isOpen}
          title={dialogConfig.title}
          message={<p>{dialogConfig.message}</p>}
          confirmText="Eliminar"
          cancelText="Cancelar"
          variant={dialogConfig.variant}
          onConfirm={dialogConfig.onConfirm}
          onCancel={closeDialog}
          isProcessing={isProcessing}
        />
      ) : null}
    </Layout>
  );
}
