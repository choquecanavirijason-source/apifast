import { useEffect, useMemo, useState } from "react";
import {
  Plus,
  Search,
  Edit,
  Trash2,
  Image as ImageIcon,
  Eye,
  Box,
  X,
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

const MODEL_3D_EXTENSIONS = [".glb", ".gltf", ".obj", ".fbx", ".stl"];

type EyeType = {
  id: number;
  name: string;
  image: string;
  model_3d_url?: string | null;
  model_3d_filename?: string | null;
};

const emptyForm = { name: "", image: "", modelFileName: "", modelFileUrl: "" };

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

export default function EyeTypesPage() {
  const [eyeTypes, setEyeTypes] = useState<EyeType[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentEyeType, setCurrentEyeType] = useState<EyeType | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [uploadingModel, setUploadingModel] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<EyeType | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const PAGE_SIZE = 8;
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return eyeTypes.filter((item) => item.name.toLowerCase().includes(query));
  }, [eyeTypes, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, page]);

  useEffect(() => {
    void loadEyeTypes();
  }, []);

  const loadEyeTypes = async () => {
    setLoading(true);
    try {
      const response = await api.get("/catalogs/eye-types");
      setEyeTypes(response.data);
    } catch {
      toast.error("Error al cargar tipos de ojo");
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

  const handleModelChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadingModel(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await api.post("/catalogs/designs/upload-model", formData);
      setForm((prev) => ({
        ...prev,
        modelFileName: response.data.model_3d_filename ?? file.name,
        modelFileUrl: response.data.model_3d_url,
      }));
    } catch (error) {
      toast.error(getErrorMessage(error, "No se pudo subir el modelo 3D"));
    } finally {
      setUploadingModel(false);
      event.target.value = "";
    }
  };

  const removeModel = () => setForm((prev) => ({ ...prev, modelFileName: "", modelFileUrl: "" }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = form.name.trim();
    if (!name) {
      toast.warning("El nombre es obligatorio.");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name,
        image: form.image || null,
        model_3d_url: form.modelFileUrl || null,
        model_3d_filename: form.modelFileName || null,
      };
      if (currentEyeType) {
        await api.put(`/catalogs/eye-types/${currentEyeType.id}`, payload);
      } else {
        await api.post("/catalogs/eye-types", payload);
      }
      await loadEyeTypes();
      setIsModalOpen(false);
      setCurrentEyeType(null);
      setForm(emptyForm);
      toast.success(currentEyeType ? "Tipo de ojo actualizado." : "Tipo de ojo creado.");
    } catch (error) {
      toast.error(getErrorMessage(error, "No se pudo guardar el tipo de ojo"));
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await api.delete(`/catalogs/eye-types/${deleteTarget.id}`);
      await loadEyeTypes();
      setDeleteTarget(null);
      toast.success("Tipo de ojo eliminado.");
    } catch (error) {
      toast.error(getErrorMessage(error, "No se pudo eliminar el tipo de ojo"));
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Layout
      title="Tipos de ojo"
      subtitle="Clasificación anatómica para diagnósticos"
      variant="cards"
      toolbar={
        <FilterActionBar
          left={
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar tipos de ojo..."
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
                setCurrentEyeType(null);
                setIsModalOpen(true);
              }}
              leftIcon={<Plus className="h-4 w-4" />}
            >
              Nuevo tipo
            </Button>
          }
        />
      }
    >
      {loading ? (
        <p className="py-10 text-center text-sm text-slate-400">Cargando tipos de ojo...</p>
      ) : paginated.length === 0 ? (
        <p className="py-10 text-center text-sm text-slate-400">No se encontraron tipos de ojo.</p>
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
                  <Eye className="h-8 w-8 text-slate-300" />
                )}
              </div>
              <div className="flex items-center justify-between border-t border-slate-100 px-3 py-2.5">
                <span className="truncate text-sm font-semibold text-slate-700">{item.name}</span>
                <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                  <button
                    type="button"
                    onClick={() => {
                      setCurrentEyeType(item);
                      setForm({
                        name: item.name,
                        image: item.image,
                        modelFileName: item.model_3d_filename ?? "",
                        modelFileUrl: item.model_3d_url ?? "",
                      });
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
          setCurrentEyeType(null);
          setForm(emptyForm);
        }}
        title={currentEyeType ? "Editar tipo de ojo" : "Nuevo tipo de ojo"}
        size="md"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700">Nombre / clasificación *</label>
            <input
              value={form.name}
              onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none"
              placeholder="Ej. Ojo almendrado"
              required
            />
          </div>
          <div className="border-t border-slate-100 pt-4">
            <p className="text-xs font-semibold uppercase text-slate-500">Archivos</p>
            <div className="mt-3 grid gap-4 md:grid-cols-2">
              <div>
                <label className="text-xs font-medium text-slate-500">Imagen de referencia</label>
                <div className="relative mt-2 cursor-pointer rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-center transition-colors hover:bg-slate-100">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="absolute inset-0 cursor-pointer opacity-0"
                  />
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
                    onClick={() => setForm((prev) => ({ ...prev, image: "" }))}
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
                    onChange={(e) => void handleModelChange(e)}
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
                        onClick={removeModel}
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
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setIsModalOpen(false);
                setCurrentEyeType(null);
                setForm(emptyForm);
              }}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={saving || uploadingModel}>
              {saving ? "Guardando..." : currentEyeType ? "Actualizar" : "Crear"}
            </Button>
          </div>
        </form>
      </GenericModal>

      <ConfirmDialog
        isOpen={!!deleteTarget}
        title="Eliminar tipo de ojo"
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
