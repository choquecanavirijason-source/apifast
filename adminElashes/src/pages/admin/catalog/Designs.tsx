import { useEffect, useMemo, useState } from "react";
import {
  Plus,
  Search,
  Edit,
  Trash2,
  Eye,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Image as ImageIcon,
  Box,
  X,
} from "lucide-react";
import { toast } from "react-toastify";
import api from "@/core/services/api";
import variables from "@/core/config/variables";
import Layout from "@/components/common/layout";
import FilterActionBar from "@/components/common/FilterActionBar";
import GenericModal from "@/components/common/modal/GenericModal";
import { Button } from "@/components/common/ui";

const MODEL_3D_EXTENSIONS = [".glb", ".gltf", ".obj", ".fbx", ".stl"];

type DesignCombo = {
  id: number;
  name: string;
  effect: string;
  eyeType: string;
  design: string;
  volume: string;
  note: string;
  pngPreview: string;
  modelFileName: string;
  modelFileUrl: string;
};

type DesignApiItem = {
  id: number;
  name: string;
  effect: string | null;
  eye_type: string | null;
  lash_design: string | null;
  volume: string | null;
  note: string | null;
  image: string | null;
  model_3d_url: string | null;
  model_3d_filename: string | null;
};

type CatalogOption = { id: number; name: string };

const emptyForm = {
  name: "",
  effect: "",
  eyeType: "",
  design: "",
  volume: "",
  note: "",
  pngPreview: "",
  modelFileName: "",
  modelFileUrl: "",
};

const PAGE_SIZE = 8;

type ModalMode = "create" | "edit" | "view" | null;

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

// El backend devuelve rutas relativas ("/media/design-models/...");
// nginx expone el mismo host bajo "/api" en producción y directo en local,
// así que anteponer variables.apiUrl resuelve ambos casos.
const resolveMediaUrl = (path: string) => {
  if (!path || /^https?:\/\//i.test(path)) return path;
  return `${variables.apiUrl}${path}`;
};

const fromApi = (item: DesignApiItem): DesignCombo => ({
  id: item.id,
  name: item.name,
  effect: item.effect ?? "",
  eyeType: item.eye_type ?? "",
  design: item.lash_design ?? "",
  volume: item.volume ?? "",
  note: item.note ?? "",
  pngPreview: item.image ?? "",
  modelFileName: item.model_3d_filename ?? "",
  modelFileUrl: item.model_3d_url ?? "",
});

export default function DesignsPage() {
  const [rows, setRows] = useState<DesignCombo[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [activeRow, setActiveRow] = useState<DesignCombo | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [uploadingModel, setUploadingModel] = useState(false);
  const [confirmDeleteItem, setConfirmDeleteItem] = useState<DesignCombo | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const [effects, setEffects] = useState<CatalogOption[]>([]);
  const [eyeTypes, setEyeTypes] = useState<CatalogOption[]>([]);
  const [lashDesigns, setLashDesigns] = useState<CatalogOption[]>([]);
  const [volumes, setVolumes] = useState<CatalogOption[]>([]);

  useEffect(() => {
    void loadDesigns();
    void loadCatalogOptions();
  }, []);

  const loadDesigns = async () => {
    setLoading(true);
    try {
      const response = await api.get("/catalogs/designs");
      setRows((response.data as DesignApiItem[]).map(fromApi));
    } catch {
      toast.error("Error al cargar los diseños");
    } finally {
      setLoading(false);
    }
  };

  // Trae las opciones reales creadas en Tecnología, Efectos, Tipos de ojo y
  // Volumen para que los selects de este modal siempre estén al día.
  const loadCatalogOptions = async () => {
    try {
      const [effectsRes, eyeTypesRes, lashDesignsRes, volumesRes] = await Promise.all([
        api.get("/catalogs/effects", { params: { limit: 500 } }),
        api.get("/catalogs/eye-types", { params: { limit: 500 } }),
        api.get("/catalogs/lash-designs", { params: { limit: 500 } }),
        api.get("/catalogs/volumes", { params: { limit: 500 } }),
      ]);
      setEffects(effectsRes.data);
      setEyeTypes(eyeTypesRes.data);
      setLashDesigns(lashDesignsRes.data);
      setVolumes(volumesRes.data);
    } catch {
      toast.error("No se pudieron cargar las opciones de efecto, tipo de ojo, tecnología o volumen.");
    }
  };

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return rows;
    return rows.filter((item) =>
      [item.name, item.effect, item.eyeType, item.design, item.volume, item.note]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(query))
    );
  }, [search, rows]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const paginated = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredRows.slice(start, start + PAGE_SIZE);
  }, [filteredRows, page]);

  const handleSearchChange = (value: string) => {
    setSearch(value);
    setPage(1);
  };

  const resetForm = () => setForm(emptyForm);

  const openCreate = () => {
    resetForm();
    setActiveRow(null);
    setModalMode("create");
  };

  const openEdit = (item: DesignCombo) => {
    setActiveRow(item);
    setForm({
      name: item.name,
      effect: item.effect,
      eyeType: item.eyeType,
      design: item.design,
      volume: item.volume,
      note: item.note,
      pngPreview: item.pngPreview,
      modelFileName: item.modelFileName,
      modelFileUrl: item.modelFileUrl,
    });
    setModalMode("edit");
  };

  const handlePngChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setForm((prev) => ({ ...prev, pngPreview: String(reader.result) }));
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

  const removePng = () => setForm((prev) => ({ ...prev, pngPreview: "" }));
  const removeModel = () => setForm((prev) => ({ ...prev, modelFileName: "", modelFileUrl: "" }));

  const openView = (item: DesignCombo) => {
    setActiveRow(item);
    setModalMode("view");
  };

  const closeModal = () => {
    setModalMode(null);
    setActiveRow(null);
    resetForm();
  };

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    const name = form.name.trim();
    if (!name) return;

    const payload = {
      name,
      effect: form.effect || null,
      eye_type: form.eyeType || null,
      lash_design: form.design || null,
      volume: form.volume || null,
      note: form.note || null,
      image: form.pngPreview || null,
      model_3d_url: form.modelFileUrl || null,
      model_3d_filename: form.modelFileName || null,
    };

    setSaving(true);
    try {
      if (modalMode === "edit" && activeRow) {
        await api.put(`/catalogs/designs/${activeRow.id}`, payload);
        toast.success("Diseño actualizado.");
      } else {
        await api.post("/catalogs/designs", payload);
        toast.success("Diseño creado.");
      }
      await loadDesigns();
      closeModal();
    } catch (error) {
      toast.error(getErrorMessage(error, "No se pudo guardar el diseño"));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirmDeleteItem) return;
    setIsDeleting(true);
    try {
      await api.delete(`/catalogs/designs/${confirmDeleteItem.id}`);
      await loadDesigns();
      setConfirmDeleteItem(null);
      toast.success("Diseño eliminado.");
    } catch (error) {
      toast.error(getErrorMessage(error, "No se pudo eliminar el diseño"));
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Layout
      title="Diseños"
      subtitle="Combinaciones sugeridas de efectos, tipos de ojo y diseños"
      variant="cards"
      toolbar={
        <FilterActionBar
          left={
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar diseño..."
                className="w-64 rounded-lg border border-slate-200 py-2 pl-9 pr-4 text-sm outline-none transition-all focus:border-slate-300"
                value={search}
                onChange={(e) => handleSearchChange(e.target.value)}
              />
            </div>
          }
          right={
            <Button onClick={openCreate} leftIcon={<Plus className="h-4 w-4" />}>
              Nuevo diseño
            </Button>
          }
        />
      }
    >
      {loading ? (
        <p className="py-10 text-center text-sm text-slate-400">Cargando diseños...</p>
      ) : paginated.length === 0 ? (
        <p className="py-10 text-center text-sm text-slate-400">No se encontraron diseños.</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {paginated.map((item) => (
            <div
              key={item.id}
              className="group overflow-hidden rounded-xl border border-slate-200 bg-white transition-all hover:border-slate-300 hover:shadow-md"
            >
              <div className="flex aspect-video items-center justify-center overflow-hidden bg-slate-50">
                {item.pngPreview ? (
                  <img src={item.pngPreview} alt={item.name} className="h-full w-full object-cover" />
                ) : (
                  <Sparkles className="h-8 w-8 text-slate-300" />
                )}
              </div>
              <div className="border-t border-slate-100 px-3 py-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-700">{item.name}</p>
                    {item.note ? (
                      <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">{item.note}</p>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                    <button
                      type="button"
                      onClick={() => openView(item)}
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-emerald-600"
                      title="Ver"
                    >
                      <Eye className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => openEdit(item)}
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-blue-600"
                      title="Editar"
                    >
                      <Edit className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteItem(item)}
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
            Mostrando <b>{(page - 1) * PAGE_SIZE + 1}</b>–<b>{Math.min(page * PAGE_SIZE, filteredRows.length)}</b> de{" "}
            <b>{filteredRows.length}</b>
          </span>
          <div className="flex items-center gap-1">
            <button type="button" onClick={() => setPage(1)} disabled={page === 1} className="rounded-lg border border-slate-200 p-1.5 hover:bg-slate-50 disabled:opacity-30">
              <ChevronsLeft className="h-4 w-4" />
            </button>
            <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="rounded-lg border border-slate-200 p-1.5 hover:bg-slate-50 disabled:opacity-30">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="px-3 text-xs font-medium text-slate-600">Pág. {page} / {totalPages}</span>
            <button type="button" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="rounded-lg border border-slate-200 p-1.5 hover:bg-slate-50 disabled:opacity-30">
              <ChevronRight className="h-4 w-4" />
            </button>
            <button type="button" onClick={() => setPage(totalPages)} disabled={page === totalPages} className="rounded-lg border border-slate-200 p-1.5 hover:bg-slate-50 disabled:opacity-30">
              <ChevronsRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      ) : null}

      <GenericModal
        isOpen={modalMode === "create" || modalMode === "edit"}
        title={modalMode === "edit" ? "Editar diseño" : "Crear diseño"}
        onClose={closeModal}
        size="md"
        asForm
        onSubmit={handleSave}
        footer={
          <>
            <button type="button" onClick={closeModal} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50">
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving || uploadingModel}
              className="rounded-xl bg-[#094732] px-4 py-2 text-sm font-semibold text-white hover:bg-[#063324] disabled:opacity-60"
            >
              {saving ? "Guardando..." : "Guardar"}
            </button>
          </>
        }
      >
        <div className="grid gap-4">
          <div>
            <label className="text-xs font-semibold uppercase text-slate-500">Nombre</label>
            <input
              value={form.name}
              onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
              className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm outline-none focus:border-emerald-500 focus:bg-white"
              placeholder="Nombre del diseño"
              required
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-xs font-semibold uppercase text-slate-500">Efecto</label>
              <select
                value={form.effect}
                onChange={(event) => setForm((prev) => ({ ...prev, effect: event.target.value }))}
                className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:bg-white"
              >
                <option value="">
                  {effects.length === 0 ? "Sin efectos creados" : "Selecciona un efecto"}
                </option>
                {effects.map((item) => <option key={item.id} value={item.name}>{item.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold uppercase text-slate-500">Tipo de ojo</label>
              <select
                value={form.eyeType}
                onChange={(event) => setForm((prev) => ({ ...prev, eyeType: event.target.value }))}
                className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:bg-white"
              >
                <option value="">
                  {eyeTypes.length === 0 ? "Sin tipos de ojo creados" : "Selecciona un tipo de ojo"}
                </option>
                {eyeTypes.map((item) => <option key={item.id} value={item.name}>{item.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold uppercase text-slate-500">Tecnología</label>
              <select
                value={form.design}
                onChange={(event) => setForm((prev) => ({ ...prev, design: event.target.value }))}
                className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:bg-white"
              >
                <option value="">
                  {lashDesigns.length === 0 ? "Sin tecnologías creadas" : "Selecciona una tecnología"}
                </option>
                {lashDesigns.map((item) => <option key={item.id} value={item.name}>{item.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold uppercase text-slate-500">Volumen</label>
              <select
                value={form.volume}
                onChange={(event) => setForm((prev) => ({ ...prev, volume: event.target.value }))}
                className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:bg-white"
              >
                <option value="">
                  {volumes.length === 0 ? "Sin volúmenes creados" : "Selecciona un volumen"}
                </option>
                {volumes.map((item) => <option key={item.id} value={item.name}>{item.name}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold uppercase text-slate-500">Nota</label>
            <textarea
              value={form.note}
              onChange={(event) => setForm((prev) => ({ ...prev, note: event.target.value }))}
              className="mt-2 min-h-[110px] w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-emerald-500 focus:bg-white"
              placeholder="Descripcion rapida del diseño"
            />
          </div>

          <div className="border-t border-slate-100 pt-4">
            <p className="text-xs font-semibold uppercase text-slate-500">Archivos de pestañas</p>
            <div className="mt-3 grid gap-4 md:grid-cols-2">
              <div>
                <label className="text-xs font-medium text-slate-500">Imagen PNG</label>
                <div className="relative mt-2 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-center transition-colors hover:bg-slate-100">
                  <input
                    type="file"
                    accept="image/png"
                    onChange={handlePngChange}
                    className="absolute inset-0 cursor-pointer opacity-0"
                  />
                  {form.pngPreview ? (
                    <div className="relative">
                      <img src={form.pngPreview} alt="Preview PNG" className="mx-auto h-24 object-contain" />
                      <button
                        type="button"
                        onClick={removePng}
                        className="absolute -right-2 -top-2 rounded-full bg-white p-1 text-slate-400 shadow hover:text-rose-600"
                        title="Quitar imagen"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : (
                    <div className="py-3 text-slate-400">
                      <ImageIcon className="mx-auto mb-1 h-7 w-7" />
                      <p className="text-xs">Subir archivo .png</p>
                    </div>
                  )}
                </div>
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
        </div>
      </GenericModal>

      <GenericModal isOpen={modalMode === "view"} title="Detalle del diseño" onClose={closeModal} size="md">
        {activeRow && (
          <div className="grid gap-4 text-sm text-slate-600">
            <div>
              <p className="text-xs font-semibold uppercase text-slate-400">Nombre</p>
              <p className="text-base font-semibold text-slate-800">{activeRow.name}</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-xs font-semibold uppercase text-slate-400">Efecto</p>
                <p>{activeRow.effect || "—"}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase text-slate-400">Tipo de ojo</p>
                <p>{activeRow.eyeType || "—"}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase text-slate-400">Tecnología</p>
                <p>{activeRow.design || "—"}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase text-slate-400">Volumen</p>
                <p>{activeRow.volume || "—"}</p>
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase text-slate-400">Nota</p>
              <p>{activeRow.note || "Sin nota"}</p>
            </div>
            <div className="grid gap-4 border-t border-slate-100 pt-4 md:grid-cols-2">
              <div>
                <p className="text-xs font-semibold uppercase text-slate-400">Imagen PNG</p>
                {activeRow.pngPreview ? (
                  <img src={activeRow.pngPreview} alt={activeRow.name} className="mt-2 h-24 rounded-lg border border-slate-100 object-contain" />
                ) : (
                  <p className="mt-1 text-slate-400">Sin imagen</p>
                )}
              </div>
              <div>
                <p className="text-xs font-semibold uppercase text-slate-400">Modelo 3D</p>
                {activeRow.modelFileName ? (
                  <a
                    href={resolveMediaUrl(activeRow.modelFileUrl)}
                    download={activeRow.modelFileName}
                    className="mt-2 flex items-center gap-2 text-emerald-700 hover:underline"
                  >
                    <Box className="h-4 w-4" />
                    {activeRow.modelFileName}
                  </a>
                ) : (
                  <p className="mt-1 text-slate-400">Sin modelo 3D</p>
                )}
              </div>
            </div>
          </div>
        )}
      </GenericModal>

      <GenericModal isOpen={Boolean(confirmDeleteItem)} title="Eliminar diseño" onClose={() => setConfirmDeleteItem(null)} size="sm">
        <div className="space-y-4 text-sm text-slate-600">
          <p>
            Vas a eliminar el diseño <span className="font-semibold text-slate-800">{confirmDeleteItem?.name}</span>. Esta acción no se puede deshacer.
          </p>
          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => setConfirmDeleteItem(null)} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50">
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => void handleDelete()}
              disabled={isDeleting}
              className="rounded-xl bg-rose-500 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-600 disabled:opacity-60"
            >
              {isDeleting ? "Eliminando..." : "Eliminar"}
            </button>
          </div>
        </div>
      </GenericModal>
    </Layout>
  );
}
