import { useEffect, useMemo, useState } from "react";
import {
  Plus,
  Search,
  Edit,
  Trash2,
  Image as ImageIcon,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import { toast } from "react-toastify";
import api from "@/core/services/api";
import Layout from "@/components/common/layout";
import FilterActionBar from "@/components/common/FilterActionBar";
import GenericModal from "@/components/common/modal/GenericModal";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { Button } from "@/components/common/ui";

type Effect = { id: number; name: string; image: string };

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

export default function EffectsPage() {
  const [effects, setEffects] = useState<Effect[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentEffect, setCurrentEffect] = useState<Effect | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Effect | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const PAGE_SIZE = 8;
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return effects.filter((effect) => effect.name.toLowerCase().includes(query));
  }, [effects, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, page]);

  useEffect(() => {
    void loadEffects();
  }, []);

  const loadEffects = async () => {
    setLoading(true);
    try {
      const response = await api.get("/catalogs/effects");
      setEffects(response.data);
    } catch {
      toast.error("Error al cargar efectos");
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setForm((prev) => ({ ...prev, image: String(reader.result ?? "") }));
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = form.name.trim();
    if (!name) {
      toast.warning("El nombre es obligatorio.");
      return;
    }

    setSaving(true);
    try {
      const payload = { name, image: form.image || null };
      if (currentEffect) {
        await api.put(`/catalogs/effects/${currentEffect.id}`, payload);
      } else {
        await api.post("/catalogs/effects", payload);
      }
      await loadEffects();
      setIsModalOpen(false);
      setCurrentEffect(null);
      setForm(emptyForm);
      toast.success(currentEffect ? "Efecto actualizado." : "Efecto creado.");
    } catch (error) {
      toast.error(getErrorMessage(error, "No se pudo guardar el efecto"));
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await api.delete(`/catalogs/effects/${deleteTarget.id}`);
      await loadEffects();
      setDeleteTarget(null);
      toast.success("Efecto eliminado.");
    } catch (error) {
      toast.error(getErrorMessage(error, "No se pudo eliminar el efecto"));
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Layout
      title="Efectos"
      subtitle="Catálogo de estilos de pestañas disponibles"
      variant="cards"
      toolbar={
        <FilterActionBar
          left={
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar efectos..."
                className="w-64 rounded-lg border border-slate-200 py-2 pl-9 pr-4 text-sm outline-none transition-all focus:border-slate-300"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
              />
            </div>
          }
          right={
            <Button
              onClick={() => {
                setForm(emptyForm);
                setCurrentEffect(null);
                setIsModalOpen(true);
              }}
              leftIcon={<Plus className="h-4 w-4" />}
            >
              Nuevo efecto
            </Button>
          }
        />
      }
    >
      {loading ? (
        <p className="py-10 text-center text-sm text-slate-400">Cargando efectos...</p>
      ) : paginated.length === 0 ? (
        <p className="py-10 text-center text-sm text-slate-400">No se encontraron efectos.</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {paginated.map((item) => (
            <div
              key={item.id}
              className="group overflow-hidden rounded-xl border border-slate-200 bg-white transition-all hover:border-slate-300 hover:shadow-md"
            >
              <div className="flex aspect-video items-center justify-center overflow-hidden bg-slate-50">
                {item.image ? (
                  <img src={item.image} alt={item.name} className="h-full w-full object-cover" />
                ) : (
                  <Sparkles className="h-8 w-8 text-slate-300" />
                )}
              </div>
              <div className="flex items-center justify-between border-t border-slate-100 px-3 py-2.5">
                <span className="truncate text-sm font-semibold text-slate-700">{item.name}</span>
                <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                  <button
                    type="button"
                    onClick={() => {
                      setCurrentEffect(item);
                      setForm({ name: item.name, image: item.image });
                      setIsModalOpen(true);
                    }}
                    className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-blue-600"
                  >
                    <Edit className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteTarget(item)}
                    className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {totalPages > 1 ? (
        <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-4">
          <span className="text-xs text-slate-500">
            Mostrando <b>{(page - 1) * PAGE_SIZE + 1}</b>–<b>{Math.min(page * PAGE_SIZE, filtered.length)}</b> de{" "}
            <b>{filtered.length}</b>
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

      <GenericModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setCurrentEffect(null);
          setForm(emptyForm);
        }}
        title={currentEffect ? "Editar efecto" : "Nuevo efecto"}
        size="md"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700">Nombre *</label>
            <input
              value={form.name}
              onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none"
              placeholder="Ej. Ojo de muñeca"
              required
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700">Imagen de referencia</label>
            <div className="relative cursor-pointer rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-center transition-colors hover:bg-slate-100">
              <input
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="absolute inset-0 cursor-pointer opacity-0"
              />
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
                onClick={() => setForm((prev) => ({ ...prev, image: "" }))}
              >
                Quitar imagen
              </button>
            ) : null}
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setIsModalOpen(false);
                setCurrentEffect(null);
                setForm(emptyForm);
              }}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Guardando..." : currentEffect ? "Actualizar" : "Crear"}
            </Button>
          </div>
        </form>
      </GenericModal>

      <ConfirmDialog
        isOpen={!!deleteTarget}
        title="Eliminar efecto"
        message={
          <p>
            ¿Seguro que deseas eliminar <strong>{deleteTarget?.name}</strong>? Esta acción no se puede deshacer.
          </p>
        }
        confirmText="Eliminar"
        cancelText="Cancelar"
        variant="danger"
        onConfirm={() => void handleDeleteConfirm()}
        onCancel={() => setDeleteTarget(null)}
        isProcessing={isDeleting}
      />
    </Layout>
  );
}
