import { useEffect, useRef, useState } from "react";
import { toast } from "react-toastify";
import { Layers, Plus, Pencil, Trash2, Upload, Eye, EyeOff, ShoppingBag } from "lucide-react";

import Layout from "@/components/common/layout";
import FilterActionBar from "@/components/common/FilterActionBar";
import GenericModal from "@/components/common/modal/GenericModal";
import { Button, InputField, StatCard } from "@/components/common/ui";
import DataTable, { type DataTableColumn, type DataTableAction } from "@/components/common/table/DataTable";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { marketplaceApi, MARKETPLACE_MEDIA_BASE } from "@/core/services/marketplace/marketplace.service";

interface Collection {
  id: number;
  name: string;
  description: string | null;
  image_url: string | null;
  is_active: boolean;
  product_count: number;
}

type Form = { name: string; description: string };
const emptyForm: Form = { name: "", description: "" };

function buildImgUrl(url: string | null) {
  if (!url) return null;
  return url.startsWith("http") ? url : `${MARKETPLACE_MEDIA_BASE}${url}`;
}

export default function CollectionsPage() {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<Form>(emptyForm);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Collection | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await marketplaceApi.get<Collection[]>("/api/collections/admin");
      setCollections(data);
    } catch {
      toast.error("No se pudieron cargar las colecciones");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const openNew = () => {
    setEditingId(null); setForm(emptyForm);
    setImageFile(null); setImagePreview(null);
    setIsModalOpen(true);
  };

  const openEdit = (c: Collection) => {
    setEditingId(c.id);
    setForm({ name: c.name, description: c.description ?? "" });
    setImageFile(null);
    setImagePreview(buildImgUrl(c.image_url));
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false); setEditingId(null);
    setForm(emptyForm); setImageFile(null); setImagePreview(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { toast.error("El nombre es obligatorio"); return; }
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append("name", form.name.trim());
      if (form.description.trim()) fd.append("description", form.description.trim());
      if (imageFile) fd.append("image", imageFile);

      if (editingId !== null) {
        const { data } = await marketplaceApi.put<Collection>(`/api/collections/admin/${editingId}`, fd);
        setCollections((prev) => prev.map((c) => (c.id === editingId ? data : c)));
        toast.success("Colección actualizada");
      } else {
        const { data } = await marketplaceApi.post<Collection>("/api/collections/admin", fd);
        setCollections((prev) => [data, ...prev]);
        toast.success("Colección creada");
      }
      closeModal();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (c: Collection) => {
    try {
      const fd = new FormData();
      fd.append("is_active", String(!c.is_active));
      const { data } = await marketplaceApi.put<Collection>(`/api/collections/admin/${c.id}`, fd);
      setCollections((prev) => prev.map((x) => (x.id === c.id ? data : x)));
    } catch { toast.error("No se pudo cambiar el estado"); }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await marketplaceApi.delete(`/api/collections/admin/${deleteTarget.id}`);
      setCollections((prev) => prev.filter((c) => c.id !== deleteTarget.id));
      toast.success("Colección eliminada");
    } catch { toast.error("Error al eliminar"); }
    finally { setDeleteTarget(null); }
  };

  const activeCount = collections.filter((c) => c.is_active).length;

  const columns: DataTableColumn<Collection>[] = [
    {
      key: "name",
      header: "Colección",
      sortable: true,
      render: (c) => {
        const img = buildImgUrl(c.image_url);
        return (
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 shrink-0 rounded-lg border border-slate-100 bg-slate-50 overflow-hidden flex items-center justify-center">
              {img
                ? <img src={img} alt={c.name} className="h-full w-full object-cover" />
                : <Layers className="h-4 w-4 text-slate-300" />}
            </div>
            <div>
              <p className="font-semibold text-slate-800">{c.name}</p>
              {c.description && <p className="text-xs text-slate-500 truncate max-w-xs">{c.description}</p>}
            </div>
          </div>
        );
      },
      getValue: (c) => c.name,
    },
    {
      key: "product_count",
      header: "Productos",
      sortable: true,
      render: (c) => (
        <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700">
          <ShoppingBag className="h-3 w-3" /> {c.product_count}
        </span>
      ),
      getValue: (c) => c.product_count,
    },
    {
      key: "is_active",
      header: "Estado",
      sortable: true,
      render: (c) => (
        <button
          onClick={() => void handleToggle(c)}
          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold transition ${
            c.is_active ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200" : "bg-rose-100 text-rose-700 hover:bg-rose-200"
          }`}
        >
          {c.is_active ? <><Eye className="h-3 w-3" /> Activa</> : <><EyeOff className="h-3 w-3" /> Inactiva</>}
        </button>
      ),
      getValue: (c) => (c.is_active ? "activa" : "inactiva"),
    },
  ];

  const actions: DataTableAction<Collection>[] = [
    { label: "Editar", icon: <Pencil className="h-4 w-4" />, onClick: openEdit },
    { label: "Eliminar", icon: <Trash2 className="h-4 w-4" />, onClick: (c) => setDeleteTarget(c), variant: "danger" },
  ];

  const toolbar = (
    <FilterActionBar
      left={
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Layers className="h-4 w-4" />
          <span><strong className="text-slate-800">{collections.length}</strong> colecciones — <strong className="text-slate-800">{activeCount}</strong> activas</span>
        </div>
      }
      right={<Button onClick={openNew} leftIcon={<Plus className="h-4 w-4" />}>Nueva colección</Button>}
    />
  );

  return (
    <>
      <Layout title="Colecciones" subtitle="Agrupa productos en colecciones temáticas para el marketplace." variant="table" toolbar={toolbar}>
        <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <StatCard label="Total colecciones" value={collections.length} icon={<Layers className="h-4 w-4" />} tone="slate" />
          <StatCard label="Activas" value={activeCount} icon={<Eye className="h-4 w-4" />} tone="primary" />
        </div>

        <DataTable
          data={collections}
          columns={columns}
          actions={actions}
          loading={loading}
          defaultLimit={10}
          availableLimits={[5, 10, 20]}
          globalSearchPlaceholder="Buscar colección…"
        />
      </Layout>

      <GenericModal
        isOpen={isModalOpen}
        onClose={closeModal}
        title={editingId ? "Editar colección" : "Nueva colección"}
        size="sm"
        asForm
        onSubmit={handleSubmit}
        footer={
          <>
            <Button type="button" variant="secondary" onClick={closeModal}>Cancelar</Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Guardando…" : editingId ? "Guardar cambios" : "Crear colección"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="flex flex-col items-center gap-2">
            <div
              onClick={() => fileRef.current?.click()}
              className="h-24 w-24 cursor-pointer overflow-hidden rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 flex items-center justify-center hover:border-brand transition"
            >
              {imagePreview
                ? <img src={imagePreview} alt="preview" className="h-full w-full object-cover" />
                : <Upload className="h-6 w-6 text-slate-300" />}
            </div>
            <input ref={fileRef} type="file" accept="image/*" className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                setImageFile(f);
                setImagePreview(URL.createObjectURL(f));
              }} />
            <button type="button" onClick={() => fileRef.current?.click()} className="text-xs text-brand hover:underline">
              {imagePreview ? "Cambiar imagen" : "Subir imagen"}
            </button>
          </div>
          <InputField label="Nombre *" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Ej: Colección Verano" />
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-brand-tertiary">Descripción</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              rows={2}
              placeholder="Descripción opcional…"
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none resize-none transition-all focus:border-brand focus:ring-2 focus:ring-brand/20"
            />
          </div>
        </div>
      </GenericModal>

      <ConfirmDialog
        isOpen={!!deleteTarget}
        title="Eliminar colección"
        message={<p>¿Eliminar <strong>{deleteTarget?.name}</strong>? Los productos no se eliminan.</p>}
        confirmText="Eliminar"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </>
  );
}
