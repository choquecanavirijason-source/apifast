import { useEffect, useRef, useState } from "react";
import { toast } from "react-toastify";
import {
  Layers, Plus, Pencil, Trash2, Upload, Eye, EyeOff,
  ShoppingBag, Package, X, Search, Tag,
} from "lucide-react";

import Layout from "@/components/common/layout";
import FilterActionBar from "@/components/common/FilterActionBar";
import GenericModal from "@/components/common/modal/GenericModal";
import { Button, InputField, StatCard } from "@/components/common/ui";
import DataTable, { type DataTableColumn, type DataTableAction } from "@/components/common/table/DataTable";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";

import {
  fetchAdminCollections,
  createCollection,
  updateCollection,
  deleteCollection,
  fetchCollectionProducts,
  addProductToCollection,
  removeProductFromCollection,
  fetchAdminProducts,
  MARKETPLACE_MEDIA_BASE,
  type MarketplaceCollection,
  type MarketplaceProduct,
  type CollectionPreviewProduct,
} from "@/core/services/marketplace/marketplace.service";

// ── helpers ───────────────────────────────────────────────────────────────────

type Form = { name: string; description: string };
const emptyForm: Form = { name: "", description: "" };

function img(url: string | null | undefined): string | null {
  if (!url) return null;
  return url.startsWith("http") ? url : `${MARKETPLACE_MEDIA_BASE}${url}`;
}

// ── CollectionCard ─────────────────────────────────────────────────────────────

function CollectionCard({
  col,
  onEdit,
  onDelete,
  onProducts,
  onToggle,
}: {
  col: MarketplaceCollection;
  onEdit: () => void;
  onDelete: () => void;
  onProducts: () => void;
  onToggle: () => void;
}) {
  const cover = img(col.image_url);
  const previews = col.preview_products ?? [];

  return (
    <div className="group flex flex-col rounded-2xl border border-slate-200 bg-white overflow-hidden hover:shadow-lg transition-shadow duration-200">
      {/* Imagen / collage */}
      <div className="relative aspect-[4/3] bg-slate-100 overflow-hidden">
        {cover ? (
          <img src={cover} alt={col.name} className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300" />
        ) : previews.length >= 4 ? (
          /* collage 2×2 */
          <div className="grid grid-cols-2 h-full">
            {previews.slice(0, 4).map((p) => {
              const pImg = img(p.image_url);
              return (
                <div key={p.id} className="overflow-hidden border border-white bg-slate-50">
                  {pImg
                    ? <img src={pImg} alt={p.name} className="h-full w-full object-cover" />
                    : <div className="h-full w-full flex items-center justify-center"><ShoppingBag className="h-5 w-5 text-slate-200" /></div>}
                </div>
              );
            })}
          </div>
        ) : previews.length > 0 ? (
          /* single preview */
          (() => {
            const pImg = img(previews[0].image_url);
            return pImg
              ? <img src={pImg} alt={previews[0].name} className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300" />
              : <div className="h-full w-full flex items-center justify-center"><Layers className="h-12 w-12 text-slate-200" /></div>;
          })()
        ) : (
          <div className="h-full w-full flex items-center justify-center">
            <Layers className="h-12 w-12 text-slate-200" />
          </div>
        )}

        {/* badge de conteo */}
        <div className="absolute top-2 right-2 flex items-center gap-1 rounded-full bg-black/50 px-2 py-0.5 text-xs font-semibold text-white backdrop-blur-sm">
          <ShoppingBag className="h-3 w-3" /> {col.product_count}
        </div>

        {/* badge estado */}
        <button
          onClick={onToggle}
          className={`absolute top-2 left-2 inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold backdrop-blur-sm transition ${
            col.is_active ? "bg-emerald-500/90 text-white hover:bg-emerald-600" : "bg-slate-800/70 text-white hover:bg-slate-900"
          }`}
        >
          {col.is_active ? <><Eye className="h-3 w-3" /> Activa</> : <><EyeOff className="h-3 w-3" /> Inactiva</>}
        </button>
      </div>

      {/* info + productos preview */}
      <div className="flex flex-col gap-3 p-4">
        <div>
          <p className="font-bold text-slate-800 text-sm leading-snug">{col.name}</p>
          {col.description && (
            <p className="mt-0.5 text-xs text-slate-500 line-clamp-2">{col.description}</p>
          )}
        </div>

        {/* mini lista de productos */}
        {previews.length > 0 && (
          <div className="space-y-1.5">
            {previews.map((p) => {
              const pImg = img(p.image_url);
              return (
                <div key={p.id} className="flex items-center gap-2">
                  <div className="h-7 w-7 shrink-0 rounded-lg overflow-hidden border border-slate-100 bg-slate-50">
                    {pImg
                      ? <img src={pImg} alt={p.name} className="h-full w-full object-cover" />
                      : <ShoppingBag className="h-3.5 w-3.5 m-1.5 text-slate-200" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-slate-700 truncate">{p.name}</p>
                    {p.category_name && (
                      <span className="inline-flex items-center gap-0.5 text-[10px] text-brand font-medium">
                        <Tag className="h-2.5 w-2.5" /> {p.category_name}
                      </span>
                    )}
                  </div>
                  <span className="text-xs font-semibold text-slate-600 shrink-0">S/ {p.price.toFixed(0)}</span>
                </div>
              );
            })}
            {col.product_count > 4 && (
              <p className="text-xs text-slate-400 text-center">+{col.product_count - 4} más</p>
            )}
          </div>
        )}

        {/* acciones */}
        <div className="flex gap-1.5 pt-1 border-t border-slate-100">
          <button
            onClick={onProducts}
            className="flex flex-1 items-center justify-center gap-1 rounded-xl bg-brand/10 py-2 text-xs font-semibold text-brand hover:bg-brand/20 transition"
          >
            <Package className="h-3.5 w-3.5" /> Gestionar
          </button>
          <button
            onClick={onEdit}
            className="flex items-center justify-center rounded-xl bg-slate-100 px-3 py-2 text-slate-600 hover:bg-slate-200 transition"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={onDelete}
            className="flex items-center justify-center rounded-xl bg-rose-50 px-3 py-2 text-rose-500 hover:bg-rose-100 transition"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ── page ──────────────────────────────────────────────────────────────────────

export default function CollectionsPage() {
  const [collections, setCollections] = useState<MarketplaceCollection[]>([]);
  const [loading, setLoading] = useState(true);

  // create / edit
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<Form>(emptyForm);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // delete
  const [deleteTarget, setDeleteTarget] = useState<MarketplaceCollection | null>(null);

  // products modal
  const [prodModalCol, setProdModalCol] = useState<MarketplaceCollection | null>(null);
  const [colProducts, setColProducts] = useState<MarketplaceProduct[]>([]);
  const [allProducts, setAllProducts] = useState<MarketplaceProduct[]>([]);
  const [prodSearch, setProdSearch] = useState("");
  const [prodLoading, setProdLoading] = useState(false);
  const [toggling, setToggling] = useState<number | null>(null);

  // ── data ────────────────────────────────────────────────────────────────────

  const load = async () => {
    setLoading(true);
    try { setCollections(await fetchAdminCollections()); }
    catch { toast.error("No se pudieron cargar las colecciones"); }
    finally { setLoading(false); }
  };

  useEffect(() => { void load(); }, []);

  // ── form ─────────────────────────────────────────────────────────────────────

  const openNew = () => {
    setEditingId(null); setForm(emptyForm);
    setImageFile(null); setImagePreview(null); setFormOpen(true);
  };

  const openEdit = (c: MarketplaceCollection) => {
    setEditingId(c.id);
    setForm({ name: c.name, description: c.description ?? "" });
    setImageFile(null); setImagePreview(img(c.image_url)); setFormOpen(true);
  };

  const closeForm = () => {
    setFormOpen(false); setEditingId(null);
    setForm(emptyForm); setImageFile(null); setImagePreview(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { toast.error("El nombre es obligatorio"); return; }
    setSaving(true);
    try {
      if (editingId !== null) {
        const updated = await updateCollection(editingId, { ...form, image: imageFile ?? undefined });
        setCollections((prev) => prev.map((c) => (c.id === editingId ? updated : c)));
        toast.success("Colección actualizada");
      } else {
        const created = await createCollection({ ...form, image: imageFile ?? undefined });
        setCollections((prev) => [created, ...prev]);
        toast.success("Colección creada");
      }
      closeForm();
    } catch (err) { toast.error(err instanceof Error ? err.message : "Error al guardar"); }
    finally { setSaving(false); }
  };

  // ── toggle ────────────────────────────────────────────────────────────────

  const handleToggle = async (c: MarketplaceCollection) => {
    try {
      const updated = await updateCollection(c.id, { is_active: !c.is_active });
      setCollections((prev) => prev.map((x) => (x.id === c.id ? updated : x)));
    } catch { toast.error("No se pudo cambiar el estado"); }
  };

  // ── delete ─────────────────────────────────────────────────────────────────

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteCollection(deleteTarget.id);
      setCollections((prev) => prev.filter((c) => c.id !== deleteTarget.id));
      toast.success("Colección eliminada");
    } catch { toast.error("Error al eliminar"); }
    finally { setDeleteTarget(null); }
  };

  // ── products modal ─────────────────────────────────────────────────────────

  const openProductsModal = async (c: MarketplaceCollection) => {
    setProdModalCol(c); setProdSearch(""); setProdLoading(true);
    try {
      const [cp, all] = await Promise.all([
        fetchCollectionProducts(c.id),
        fetchAdminProducts(true),
      ]);
      setColProducts(cp);
      setAllProducts(all);
    } catch { toast.error("Error al cargar productos"); }
    finally { setProdLoading(false); }
  };

  const closeProductsModal = async () => {
    // recarga la colección para actualizar los previews
    if (prodModalCol) {
      const fresh = await fetchAdminCollections().catch(() => null);
      if (fresh) setCollections(fresh);
    }
    setProdModalCol(null); setColProducts([]); setAllProducts([]); setProdSearch("");
  };

  const handleAddProduct = async (product: MarketplaceProduct) => {
    if (!prodModalCol) return;
    setToggling(product.id);
    try {
      await addProductToCollection(prodModalCol.id, product.id);
      setColProducts((prev) => [...prev, product]);
    } catch { toast.error("Error al agregar producto"); }
    finally { setToggling(null); }
  };

  const handleRemoveProduct = async (product: MarketplaceProduct) => {
    if (!prodModalCol) return;
    setToggling(product.id);
    try {
      await removeProductFromCollection(prodModalCol.id, product.id);
      setColProducts((prev) => prev.filter((p) => p.id !== product.id));
    } catch { toast.error("Error al quitar producto"); }
    finally { setToggling(null); }
  };

  // ── derived ───────────────────────────────────────────────────────────────

  const activeCount = collections.filter((c) => c.is_active).length;
  const colProductIds = new Set(colProducts.map((p) => p.id));
  const available = allProducts.filter(
    (p) =>
      !colProductIds.has(p.id) &&
      (prodSearch === "" ||
        p.name.toLowerCase().includes(prodSearch.toLowerCase()) ||
        (p.brand ?? "").toLowerCase().includes(prodSearch.toLowerCase()))
  );

  // ── table columns (list view) ─────────────────────────────────────────────

  const columns: DataTableColumn<MarketplaceCollection>[] = [
    {
      key: "name",
      header: "Colección",
      sortable: true,
      render: (c) => {
        const cover = img(c.image_url);
        const previews: CollectionPreviewProduct[] = c.preview_products ?? [];
        const thumb = cover ?? img(previews[0]?.image_url ?? null);
        return (
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 shrink-0 rounded-xl overflow-hidden border border-slate-100 bg-slate-50">
              {thumb
                ? <img src={thumb} alt={c.name} className="h-full w-full object-cover" />
                : <Layers className="h-5 w-5 m-3.5 text-slate-200" />}
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-slate-800">{c.name}</p>
              {c.description && (
                <p className="text-xs text-slate-500 truncate max-w-xs">{c.description}</p>
              )}
              {previews.length > 0 && (
                <div className="mt-1 flex gap-1">
                  {previews.slice(0, 3).map((p) => {
                    const pi = img(p.image_url);
                    return (
                      <div key={p.id} title={`${p.name}${p.category_name ? ` · ${p.category_name}` : ""}`}
                        className="h-5 w-5 rounded overflow-hidden border border-slate-100 bg-slate-50">
                        {pi
                          ? <img src={pi} alt={p.name} className="h-full w-full object-cover" />
                          : <ShoppingBag className="h-3 w-3 m-1 text-slate-200" />}
                      </div>
                    );
                  })}
                  {c.product_count > 3 && (
                    <span className="text-[10px] text-slate-400 self-center">+{c.product_count - 3}</span>
                  )}
                </div>
              )}
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

  const actions: DataTableAction<MarketplaceCollection>[] = [
    { label: "Gestionar", icon: <Package className="h-4 w-4" />, onClick: (c) => void openProductsModal(c) },
    { label: "Editar", icon: <Pencil className="h-4 w-4" />, onClick: openEdit },
    { label: "Eliminar", icon: <Trash2 className="h-4 w-4" />, onClick: (c) => setDeleteTarget(c), variant: "danger" },
  ];

  // ── toolbar ───────────────────────────────────────────────────────────────

  const toolbar = (
    <FilterActionBar
      left={
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Layers className="h-4 w-4" />
          <span>
            <strong className="text-slate-800">{collections.length}</strong> colecciones —{" "}
            <strong className="text-slate-800">{activeCount}</strong> activas
          </span>
        </div>
      }
      right={
        <Button onClick={openNew} leftIcon={<Plus className="h-4 w-4" />}>
          Nueva colección
        </Button>
      }
    />
  );

  // ── render ────────────────────────────────────────────────────────────────

  return (
    <>
      <Layout
        title="Colecciones"
        subtitle="Agrupa productos en colecciones temáticas para el marketplace."
        variant="table"
        toolbar={toolbar}
      >
        <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <StatCard label="Total colecciones" value={collections.length} icon={<Layers className="h-4 w-4" />} tone="slate" />
          <StatCard label="Activas" value={activeCount} icon={<Eye className="h-4 w-4" />} tone="primary" />
        </div>

        {/* Vista cuadrícula (default) */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rounded-2xl border border-slate-200 bg-white overflow-hidden animate-pulse">
                <div className="aspect-[4/3] bg-slate-100" />
                <div className="p-4 space-y-2">
                  <div className="h-4 w-3/4 rounded bg-slate-100" />
                  <div className="h-3 w-1/2 rounded bg-slate-100" />
                </div>
              </div>
            ))}
          </div>
        ) : collections.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400">
            <Layers className="h-12 w-12 mb-3 text-slate-200" />
            <p className="font-medium">Sin colecciones</p>
            <p className="text-sm mt-1">Crea la primera colección con el botón de arriba.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {collections.map((c) => (
              <CollectionCard
                key={c.id}
                col={c}
                onEdit={() => openEdit(c)}
                onDelete={() => setDeleteTarget(c)}
                onProducts={() => void openProductsModal(c)}
                onToggle={() => void handleToggle(c)}
              />
            ))}
          </div>
        )}

        {/* Vista lista opcional — activable desde toolbar si se agrega toggle */}
        <div className="mt-6">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Vista lista</p>
          <DataTable
            data={collections}
            columns={columns}
            actions={actions}
            loading={loading}
            defaultLimit={5}
            availableLimits={[5, 10, 20]}
            globalSearchPlaceholder="Buscar colección…"
          />
        </div>
      </Layout>

      {/* ── Modal crear / editar ─────────────────────────────────────────────── */}
      <GenericModal
        isOpen={formOpen}
        onClose={closeForm}
        title={editingId ? "Editar colección" : "Nueva colección"}
        size="sm"
        asForm
        onSubmit={handleSubmit}
        footer={
          <>
            <Button type="button" variant="secondary" onClick={closeForm}>Cancelar</Button>
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
              className="h-28 w-full cursor-pointer overflow-hidden rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 flex items-center justify-center hover:border-brand transition"
            >
              {imagePreview
                ? <img src={imagePreview} alt="preview" className="h-full w-full object-cover" />
                : (
                  <div className="flex flex-col items-center gap-1 text-slate-400">
                    <Upload className="h-7 w-7" />
                    <span className="text-xs">Imagen de portada</span>
                  </div>
                )}
            </div>
            <input ref={fileRef} type="file" accept="image/*" className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                setImageFile(f);
                setImagePreview(URL.createObjectURL(f));
              }} />
            <button type="button" onClick={() => fileRef.current?.click()}
              className="text-xs text-brand hover:underline">
              {imagePreview ? "Cambiar imagen" : "Subir imagen de portada"}
            </button>
          </div>
          <InputField
            label="Nombre *"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="Ej: Colección Verano"
          />
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

      {/* ── Modal gestión de productos ───────────────────────────────────────── */}
      <GenericModal
        isOpen={!!prodModalCol}
        onClose={() => void closeProductsModal()}
        title={`Productos en "${prodModalCol?.name ?? ""}"`}
        size="lg"
        footer={<Button onClick={() => void closeProductsModal()}>Listo</Button>}
      >
        {prodLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand border-t-transparent" />
          </div>
        ) : (
          <div className="space-y-5">
            {/* Productos en la colección */}
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                En esta colección ({colProducts.length})
              </p>
              {colProducts.length === 0 ? (
                <p className="text-sm text-slate-400 italic">Sin productos aún. Agrégalos abajo.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {colProducts.map((p) => {
                    const pi = img(p.image_url);
                    return (
                      <div key={p.id}
                        className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                        <div className="h-10 w-10 shrink-0 rounded-lg overflow-hidden border border-slate-100 bg-white">
                          {pi
                            ? <img src={pi} alt={p.name} className="h-full w-full object-cover" />
                            : <ShoppingBag className="h-4 w-4 m-3 text-slate-200" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-800 truncate">{p.name}</p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            {p.category_name && (
                              <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-brand">
                                <Tag className="h-2.5 w-2.5" />{p.category_name}
                              </span>
                            )}
                            <span className="text-[10px] text-slate-400">S/ {p.price.toFixed(2)}</span>
                          </div>
                        </div>
                        <button
                          onClick={() => void handleRemoveProduct(p)}
                          disabled={toggling === p.id}
                          className="shrink-0 rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-500 transition"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="border-t border-slate-100" />

            {/* Agregar productos */}
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Agregar productos ({available.length} disponibles)
              </p>
              <div className="relative mb-3">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  value={prodSearch}
                  onChange={(e) => setProdSearch(e.target.value)}
                  placeholder="Buscar por nombre o marca…"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm text-slate-700 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
                />
              </div>
              {available.length === 0 ? (
                <p className="text-center text-sm text-slate-400 italic py-4">
                  {prodSearch ? "Sin resultados" : "Todos los productos ya están en esta colección."}
                </p>
              ) : (
                <div className="max-h-56 overflow-y-auto divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
                  {available.map((p) => {
                    const pi = img(p.image_url);
                    return (
                      <div key={p.id} className="flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50 transition">
                        <div className="h-9 w-9 shrink-0 rounded-lg overflow-hidden border border-slate-100 bg-slate-50">
                          {pi
                            ? <img src={pi} alt={p.name} className="h-full w-full object-cover" />
                            : <ShoppingBag className="h-4 w-4 m-2.5 text-slate-200" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-800 truncate">{p.name}</p>
                          <div className="flex items-center gap-1.5">
                            {p.category_name && (
                              <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-brand">
                                <Tag className="h-2.5 w-2.5" />{p.category_name}
                              </span>
                            )}
                            <span className="text-[10px] text-slate-400">S/ {p.price.toFixed(2)}</span>
                          </div>
                        </div>
                        <button
                          onClick={() => void handleAddProduct(p)}
                          disabled={toggling === p.id}
                          className="shrink-0 rounded-lg bg-brand/10 px-3 py-1.5 text-xs font-semibold text-brand hover:bg-brand/20 transition disabled:opacity-50"
                        >
                          {toggling === p.id ? "…" : "+ Agregar"}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </GenericModal>

      {/* ── Confirmar eliminación ─────────────────────────────────────────────── */}
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
