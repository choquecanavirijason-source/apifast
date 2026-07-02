import { useEffect, useRef, useState } from "react";
import { toast } from "react-toastify";
import {
  Plus, Pencil, Trash2, Tag, Eye, EyeOff, Upload, ImageIcon,
  LayoutList, LayoutGrid, PackagePlus, Search, Loader2, Check,
} from "lucide-react";

import Layout from "@/components/common/layout";
import FilterActionBar from "@/components/common/FilterActionBar";
import GenericModal from "@/components/common/modal/GenericModal";
import { Button, InputField, StatCard } from "@/components/common/ui";
import DataTable, { type DataTableColumn, type DataTableAction } from "@/components/common/table/DataTable";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";

import {
  fetchAdminCategories,
  fetchAdminProducts,
  createCategory,
  updateCategory,
  deleteCategory,
  updateMarketplaceProduct,
  MARKETPLACE_MEDIA_BASE,
  type MarketplaceCategory,
  type MarketplaceProduct,
} from "@/core/services/marketplace/marketplace.service";

type Form = { name: string; description: string };
const emptyForm: Form = { name: "", description: "" };

function buildImgUrl(url: string | null) {
  if (!url) return null;
  return url.startsWith("http") ? url : `${MARKETPLACE_MEDIA_BASE}${url}`;
}

export default function CategoriesPage() {
  const [categories, setCategories] = useState<MarketplaceCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<Form>(emptyForm);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const [deleteTarget, setDeleteTarget] = useState<MarketplaceCategory | null>(null);
  const [toggling, setToggling] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");

  // ── Product assignment ───────────────────────────────────────────────
  const [assignTarget, setAssignTarget] = useState<MarketplaceCategory | null>(null);
  const [allProducts, setAllProducts] = useState<MarketplaceProduct[]>([]);
  const [assignSearch, setAssignSearch] = useState("");
  const [assignSelected, setAssignSelected] = useState<Set<number>>(new Set());
  const [assignOriginal, setAssignOriginal] = useState<Set<number>>(new Set());
  const [assignLoading, setAssignLoading] = useState(false);
  const [assignSaving, setAssignSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try { setCategories(await fetchAdminCategories()); }
    catch { toast.error("No se pudieron cargar las categorías"); }
    finally { setLoading(false); }
  };

  useEffect(() => { void load(); }, []);

  // ── CRUD categoría ────────────────────────────────────────────────────
  const openNew = () => {
    setEditingId(null); setForm(emptyForm);
    setImageFile(null); setImagePreview(null);
    setIsModalOpen(true);
  };

  const openEdit = (cat: MarketplaceCategory) => {
    setEditingId(cat.id);
    setForm({ name: cat.name, description: cat.description ?? "" });
    setImageFile(null);
    setImagePreview(buildImgUrl(cat.image_url));
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
      if (editingId !== null) {
        const updated = await updateCategory(editingId, { ...form, image: imageFile ?? undefined });
        setCategories((prev) => prev.map((c) => (c.id === editingId ? updated : c)));
        toast.success("Categoría actualizada");
      } else {
        const created = await createCategory({ ...form, image: imageFile ?? undefined });
        setCategories((prev) => [created, ...prev]);
        toast.success("Categoría creada");
      }
      closeModal();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (cat: MarketplaceCategory) => {
    setToggling(cat.id);
    try {
      const updated = await updateCategory(cat.id, { is_active: !cat.is_active });
      setCategories((prev) => prev.map((c) => (c.id === cat.id ? updated : c)));
    } catch { toast.error("No se pudo cambiar el estado"); }
    finally { setToggling(null); }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteCategory(deleteTarget.id);
      setCategories((prev) => prev.filter((c) => c.id !== deleteTarget.id));
      toast.success("Categoría eliminada");
    } catch { toast.error("Error al eliminar"); }
    finally { setDeleteTarget(null); }
  };

  // ── Asignar productos ─────────────────────────────────────────────────
  const openAssign = async (cat: MarketplaceCategory) => {
    setAssignTarget(cat);
    setAssignSearch("");
    setAssignLoading(true);
    try {
      const prods = await fetchAdminProducts(true);
      setAllProducts(prods);
      const inCat = new Set(prods.filter((p) => p.category_id === cat.id).map((p) => p.id));
      setAssignSelected(new Set(inCat));
      setAssignOriginal(new Set(inCat));
    } catch {
      toast.error("No se pudieron cargar los productos");
    } finally {
      setAssignLoading(false);
    }
  };

  const closeAssign = () => {
    setAssignTarget(null);
    setAllProducts([]);
    setAssignSelected(new Set());
    setAssignOriginal(new Set());
    setAssignSearch("");
  };

  const handleAssignSave = async () => {
    if (!assignTarget) return;
    setAssignSaving(true);
    try {
      const toAdd = allProducts.filter((p) => assignSelected.has(p.id) && !assignOriginal.has(p.id));
      const toRemove = allProducts.filter((p) => !assignSelected.has(p.id) && assignOriginal.has(p.id));
      await Promise.all([
        ...toAdd.map((p) => updateMarketplaceProduct(p.id, { category_id: assignTarget.id })),
        ...toRemove.map((p) => updateMarketplaceProduct(p.id, { category_id: null })),
      ]);
      const total = toAdd.length + toRemove.length;
      if (total > 0) toast.success(`${toAdd.length > 0 ? `${toAdd.length} asignado${toAdd.length > 1 ? "s" : ""}` : ""}${toAdd.length > 0 && toRemove.length > 0 ? ", " : ""}${toRemove.length > 0 ? `${toRemove.length} removido${toRemove.length > 1 ? "s" : ""}` : ""}`);
      else toast.info("Sin cambios");
      closeAssign();
    } catch {
      toast.error("Error al guardar la asignación");
    } finally {
      setAssignSaving(false);
    }
  };

  const filteredAssignProducts = assignSearch.trim()
    ? allProducts.filter((p) => p.name.toLowerCase().includes(assignSearch.toLowerCase()) || (p.brand ?? "").toLowerCase().includes(assignSearch.toLowerCase()))
    : allProducts;

  // ── Table ─────────────────────────────────────────────────────────────
  const activeCount = categories.filter((c) => c.is_active).length;

  const columns: DataTableColumn<MarketplaceCategory>[] = [
    {
      key: "name",
      header: "Categoría",
      sortable: true,
      render: (cat) => {
        const imgUrl = buildImgUrl(cat.image_url);
        return (
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 shrink-0 rounded-lg border border-slate-100 bg-slate-50 overflow-hidden flex items-center justify-center">
              {imgUrl
                ? <img src={imgUrl} alt={cat.name} className="h-full w-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                : <ImageIcon className="h-4 w-4 text-slate-300" />}
            </div>
            <span className="font-semibold text-slate-800">{cat.name}</span>
          </div>
        );
      },
      getValue: (cat) => cat.name,
    },
    {
      key: "description",
      header: "Descripción",
      render: (cat) => <span className="text-slate-600 text-sm">{cat.description || "—"}</span>,
    },
    {
      key: "is_active",
      header: "Estado",
      sortable: true,
      render: (cat) => (
        <button
          onClick={() => void handleToggle(cat)}
          disabled={toggling === cat.id}
          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold transition ${
            cat.is_active
              ? "bg-slate-100 text-slate-700 hover:bg-slate-200"
              : "bg-rose-100 text-rose-700 hover:bg-rose-200"
          }`}
        >
          {cat.is_active ? <><Eye className="h-3 w-3" /> Activa</> : <><EyeOff className="h-3 w-3" /> Inactiva</>}
        </button>
      ),
      getValue: (cat) => (cat.is_active ? "activa" : "inactiva"),
    },
  ];

  const actions: DataTableAction<MarketplaceCategory>[] = [
    { label: "Editar", icon: <Pencil className="h-4 w-4" />, onClick: openEdit },
    { label: "Asignar productos", icon: <PackagePlus className="h-4 w-4" />, onClick: (c) => void openAssign(c) },
    { label: "Eliminar", icon: <Trash2 className="h-4 w-4" />, onClick: (c) => setDeleteTarget(c), variant: "danger" },
  ];

  const toolbar = (
    <FilterActionBar
      left={
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Tag className="h-4 w-4" />
          <span><strong className="text-slate-800">{categories.length}</strong> categorías — <strong className="text-slate-800">{activeCount}</strong> activas</span>
        </div>
      }
      right={
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-slate-200 bg-slate-100/80 p-0.5">
            <button onClick={() => setViewMode("list")} title="Vista lista"
              className={`flex items-center justify-center rounded-md p-1.5 transition ${viewMode === "list" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
              <LayoutList className="h-4 w-4" />
            </button>
            <button onClick={() => setViewMode("grid")} title="Vista cuadrícula"
              className={`flex items-center justify-center rounded-md p-1.5 transition ${viewMode === "grid" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
              <LayoutGrid className="h-4 w-4" />
            </button>
          </div>
          <Button onClick={openNew} leftIcon={<Plus className="h-4 w-4" />}>Nueva categoría</Button>
        </div>
      }
    />
  );

  return (
    <>
      <Layout title="Categorías" subtitle="Organiza el catálogo del marketplace por categorías." variant="table" toolbar={toolbar}>
        <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <StatCard label="Total categorías" value={categories.length} icon={<Tag className="h-4 w-4" />} tone="slate" />
          <StatCard label="Activas" value={activeCount} icon={<Eye className="h-4 w-4" />} tone="primary" />
        </div>

        {viewMode === "list" ? (
          <DataTable
            data={categories}
            columns={columns}
            actions={actions}
            loading={loading}
            defaultLimit={10}
            availableLimits={[5, 10, 20]}
            globalSearchPlaceholder="Buscar categoría…"
          />
        ) : (
          <div className={`grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 ${loading ? "opacity-60 pointer-events-none" : ""}`}>
            {categories.map((cat) => {
              const imgUrl = buildImgUrl(cat.image_url);
              return (
                <div key={cat.id} className="group flex flex-col rounded-xl border border-slate-200 bg-white overflow-hidden hover:shadow-md transition-shadow">
                  <div className="aspect-square bg-slate-50 overflow-hidden flex items-center justify-center">
                    {imgUrl ? (
                      <img src={imgUrl} alt={cat.name} className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                    ) : (
                      <Tag className="h-10 w-10 text-slate-200" />
                    )}
                  </div>
                  <div className="p-3 flex flex-col gap-1.5">
                    <p className="font-semibold text-slate-800 text-sm truncate">{cat.name}</p>
                    {cat.description && <p className="text-xs text-slate-500 line-clamp-2">{cat.description}</p>}
                    <button onClick={() => void handleToggle(cat)} disabled={toggling === cat.id}
                      className={`mt-1 inline-flex items-center justify-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold transition ${
                        cat.is_active ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200" : "bg-rose-100 text-rose-700 hover:bg-rose-200"
                      }`}>
                      {cat.is_active ? <><Eye className="h-3 w-3" /> Activa</> : <><EyeOff className="h-3 w-3" /> Inactiva</>}
                    </button>
                    <div className="flex gap-1.5 pt-1">
                      <button onClick={() => openEdit(cat)}
                        className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-slate-100 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-200 transition">
                        <Pencil className="h-3 w-3" /> Editar
                      </button>
                      <button onClick={() => void openAssign(cat)}
                        className="flex items-center justify-center rounded-lg bg-brand/10 p-1.5 text-brand hover:bg-brand/20 transition" title="Asignar productos">
                        <PackagePlus className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={() => setDeleteTarget(cat)}
                        className="flex items-center justify-center rounded-lg bg-rose-50 p-1.5 text-rose-600 hover:bg-rose-100 transition">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Layout>

      {/* Modal editar / crear categoría */}
      <GenericModal isOpen={isModalOpen} onClose={closeModal}
        title={editingId ? "Editar categoría" : "Nueva categoría"} size="sm" asForm onSubmit={handleSubmit}
        footer={
          <>
            <Button type="button" variant="secondary" onClick={closeModal}>Cancelar</Button>
            <Button type="submit" disabled={saving}>{saving ? "Guardando…" : editingId ? "Guardar cambios" : "Crear categoría"}</Button>
          </>
        }>
        <div className="space-y-4">
          <div className="flex flex-col items-center gap-2">
            <div onClick={() => fileRef.current?.click()}
              className="h-24 w-24 cursor-pointer overflow-hidden rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 flex items-center justify-center hover:border-brand transition">
              {imagePreview ? <img src={imagePreview} alt="preview" className="h-full w-full object-cover" /> : <Upload className="h-6 w-6 text-slate-300" />}
            </div>
            <input ref={fileRef} type="file" accept="image/*" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (!f) return; setImageFile(f); setImagePreview(URL.createObjectURL(f)); }} />
            <button type="button" onClick={() => fileRef.current?.click()} className="text-xs text-brand hover:underline">
              {imagePreview ? "Cambiar imagen" : "Subir imagen"}
            </button>
          </div>
          <InputField label="Nombre *" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Ej: Maquillaje" />
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-brand-tertiary">Descripción</label>
            <textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              rows={2} placeholder="Descripción opcional…"
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none resize-none transition-all focus:border-brand focus:ring-2 focus:ring-brand/20" />
          </div>
        </div>
      </GenericModal>

      {/* Modal asignar productos */}
      <GenericModal isOpen={!!assignTarget} onClose={closeAssign}
        title={`Asignar productos — ${assignTarget?.name ?? ""}`} size="md"
        footer={
          <>
            <Button type="button" variant="secondary" onClick={closeAssign}>Cancelar</Button>
            <Button onClick={() => void handleAssignSave()} disabled={assignSaving}>
              {assignSaving ? "Guardando…" : `Guardar (${assignSelected.size} seleccionados)`}
            </Button>
          </>
        }>
        <div className="space-y-3">
          {/* Buscador */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
            <input value={assignSearch} onChange={(e) => setAssignSearch(e.target.value)}
              placeholder="Buscar producto por nombre o marca…"
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-300 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 transition" />
          </div>

          {/* Lista de productos */}
          <div className="h-72 overflow-y-auto rounded-xl border border-slate-200 divide-y divide-slate-50">
            {assignLoading ? (
              <div className="flex items-center justify-center h-full gap-2 text-slate-400">
                <Loader2 className="h-5 w-5 animate-spin" /> Cargando productos…
              </div>
            ) : filteredAssignProducts.length === 0 ? (
              <div className="flex items-center justify-center h-full text-sm text-slate-400">
                Sin productos
              </div>
            ) : filteredAssignProducts.map((p) => {
              const checked = assignSelected.has(p.id);
              const img = buildImgUrl(p.image_url);
              const otherCat = p.category_id !== null && p.category_id !== assignTarget?.id ? p.category_name : null;
              return (
                <label key={p.id} className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-slate-50 transition">
                  <input type="checkbox" checked={checked}
                    onChange={() => setAssignSelected((prev) => {
                      const next = new Set(prev);
                      if (next.has(p.id)) next.delete(p.id); else next.add(p.id);
                      return next;
                    })}
                    className="h-4 w-4 accent-brand rounded shrink-0" />
                  <div className="h-9 w-9 shrink-0 rounded-lg border border-slate-100 bg-slate-50 overflow-hidden flex items-center justify-center">
                    {img
                      ? <img src={img} alt={p.name} className="h-full w-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                      : <ImageIcon className="h-3.5 w-3.5 text-slate-300" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">{p.name}</p>
                    {otherCat ? (
                      <p className="text-xs text-amber-600">En: {otherCat}</p>
                    ) : checked && p.category_id === assignTarget?.id ? (
                      <p className="text-xs text-emerald-600 flex items-center gap-1"><Check className="h-3 w-3" /> En esta categoría</p>
                    ) : (
                      <p className="text-xs text-slate-400">{p.brand || "Sin marca"}</p>
                    )}
                  </div>
                  <span className="text-xs font-semibold text-slate-600 shrink-0">S/ {p.price.toFixed(2)}</span>
                </label>
              );
            })}
          </div>

          <p className="text-xs text-slate-400 text-right">
            {assignSelected.size} producto{assignSelected.size !== 1 ? "s" : ""} seleccionado{assignSelected.size !== 1 ? "s" : ""}
          </p>
        </div>
      </GenericModal>

      <ConfirmDialog
        isOpen={!!deleteTarget}
        title="Eliminar categoría"
        message={<p>¿Eliminar <strong>{deleteTarget?.name}</strong>? Esta acción no se puede deshacer.</p>}
        confirmText="Eliminar" variant="danger"
        onConfirm={handleDelete} onCancel={() => setDeleteTarget(null)}
      />
    </>
  );
}
