import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "react-toastify";
import { Plus, Pencil, Trash2, Upload, ImageIcon, Eye, EyeOff, ShoppingBag, DollarSign, LayoutList, LayoutGrid, Search, Package, AlertTriangle, TrendingDown, Video, X, Star, StarOff, FileDown } from "lucide-react";

import Layout from "@/components/common/layout";
import FilterActionBar from "@/components/common/FilterActionBar";
import GenericModal from "@/components/common/modal/GenericModal";
import { Button, InputField, StatCard } from "@/components/common/ui";
import DataTable, { type DataTableColumn, type DataTableAction } from "@/components/common/table/DataTable";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { generateTablePdf } from "@/core/utils/generateTablePdf";

import {
  fetchAdminProducts,
  fetchAdminCategories,
  createMarketplaceProduct,
  updateMarketplaceProduct,
  deleteMarketplaceProduct,
  adjustProductStock,
  setProductFeatured,
  MARKETPLACE_MEDIA_BASE,
  type MarketplaceProduct,
  type MarketplaceCategory,
} from "@/core/services/marketplace/marketplace.service";

type Form = {
  name: string; brand: string; description: string;
  price: string; original_price: string;
  category_id: string; stock: string; low_stock_threshold: string;
  video_url: string; is_active: boolean;
};

const emptyForm: Form = {
  name: "", brand: "", description: "",
  price: "", original_price: "", category_id: "",
  stock: "0", low_stock_threshold: "5", video_url: "", is_active: true,
};

function buildImgUrl(url: string | null) {
  if (!url) return null;
  return url.startsWith("http") ? url : `${MARKETPLACE_MEDIA_BASE}${url}`;
}

export default function ProductsPage() {
  const [searchParams] = useSearchParams();
  const openNew = searchParams.get("action") === "new";

  const [products, setProducts] = useState<MarketplaceProduct[]>([]);
  const [categories, setCategories] = useState<MarketplaceCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [filterStatus, setFilterStatus] = useState<"all" | "active" | "inactive" | "low_stock" | "out_of_stock">("all");
  const [stockTarget, setStockTarget] = useState<MarketplaceProduct | null>(null);
  const [newStockValue, setNewStockValue] = useState("");
  const [adjustingStock, setAdjustingStock] = useState(false);

  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
  const [gridSearch, setGridSearch] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(openNew);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<Form>(emptyForm);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MarketplaceProduct | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [prods, cats] = await Promise.all([fetchAdminProducts(), fetchAdminCategories()]);
      setProducts(prods);
      setCategories(cats);
    } catch {
      toast.error("Error al cargar productos");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const filtered = products.filter((p) =>
    filterStatus === "all" ? true :
    filterStatus === "active" ? p.is_active :
    filterStatus === "inactive" ? !p.is_active :
    filterStatus === "low_stock" ? (p.is_active && p.is_low_stock && p.stock > 0) :
    (p.is_active && p.stock === 0)
  );

  const gridFiltered = gridSearch.trim()
    ? filtered.filter((p) =>
        p.name.toLowerCase().includes(gridSearch.toLowerCase()) ||
        (p.brand ?? "").toLowerCase().includes(gridSearch.toLowerCase()) ||
        (categories.find((c) => c.id === p.category_id)?.name ?? "").toLowerCase().includes(gridSearch.toLowerCase())
      )
    : filtered;

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setImageFile(null);
    setImagePreview(null);
    setVideoFile(null);
    setIsModalOpen(true);
  };

  const openEdit = (p: MarketplaceProduct) => {
    setEditingId(p.id);
    setForm({
      name: p.name, brand: p.brand ?? "", description: p.description ?? "",
      price: String(p.price), original_price: p.original_price ? String(p.original_price) : "",
      category_id: p.category_id ? String(p.category_id) : "",
      stock: String(p.stock), low_stock_threshold: String(p.low_stock_threshold ?? 5),
      video_url: p.video_url ?? "", is_active: p.is_active,
    });
    setImageFile(null);
    setImagePreview(buildImgUrl(p.image_url));
    setVideoFile(null);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingId(null);
    setForm(emptyForm);
    setImageFile(null);
    setImagePreview(null);
    setVideoFile(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { toast.error("El nombre es obligatorio"); return; }
    if (!form.price || Number(form.price) <= 0) { toast.error("El precio debe ser mayor a 0"); return; }
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        brand: form.brand.trim() || undefined,
        description: form.description.trim() || undefined,
        price: Number(form.price),
        original_price: form.original_price ? Number(form.original_price) : undefined,
        category_id: form.category_id ? Number(form.category_id) : undefined,
        stock: Number(form.stock) || 0,
        low_stock_threshold: Number(form.low_stock_threshold) || 5,
        video_url: form.video_url.trim() || undefined,
        image: imageFile,
        video: videoFile,
      };
      if (editingId !== null) {
        const updated = await updateMarketplaceProduct(editingId, { ...payload, is_active: form.is_active });
        setProducts((prev) => prev.map((p) => (p.id === editingId ? updated : p)));
        toast.success("Producto actualizado");
      } else {
        const created = await createMarketplaceProduct(payload);
        setProducts((prev) => [created, ...prev]);
        toast.success("Producto creado");
      }
      closeModal();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  const openStockModal = (p: MarketplaceProduct) => {
    setStockTarget(p);
    setNewStockValue(String(p.stock));
  };

  const handleAdjustStock = async () => {
    if (!stockTarget) return;
    const parsed = parseInt(newStockValue, 10);
    if (isNaN(parsed) || parsed < 0) { toast.error("Cantidad inválida"); return; }
    setAdjustingStock(true);
    try {
      const updated = await adjustProductStock(stockTarget.id, parsed);
      setProducts((prev) => prev.map((p) => (p.id === stockTarget.id ? updated : p)));
      toast.success(`Stock de "${stockTarget.name}" actualizado a ${parsed} uds`);
      setStockTarget(null);
    } catch {
      toast.error("Error al ajustar el stock");
    } finally {
      setAdjustingStock(false);
    }
  };

  const handleToggleFeatured = async (p: MarketplaceProduct) => {
    const next = !p.is_featured;
    try {
      const updated = await setProductFeatured(p.id, next);
      setProducts((prev) => prev.map((x) => (x.id === p.id ? updated : x)));
      toast.success(next ? `"${p.name}" ahora es destacado` : `"${p.name}" ya no es destacado`);
    } catch {
      toast.error("Error al actualizar destacado");
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteMarketplaceProduct(deleteTarget.id);
      setProducts((prev) => prev.filter((p) => p.id !== deleteTarget.id));
      toast.success("Producto eliminado");
    } catch {
      toast.error("Error al eliminar");
    } finally {
      setDeleteTarget(null);
    }
  };

  const activeCount = products.filter((p) => p.is_active).length;
  const lowStockCount = products.filter((p) => p.is_active && p.is_low_stock && p.stock > 0).length;
  const outOfStockCount = products.filter((p) => p.is_active && p.stock === 0).length;
  const totalValue = products.reduce((s, p) => s + p.price * (p.stock ?? 0), 0);

  const columns: DataTableColumn<MarketplaceProduct>[] = [
    {
      key: "name",
      header: "Producto",
      sortable: true,
      render: (p) => {
        const imgUrl = buildImgUrl(p.image_url);
        const catName = categories.find((c) => c.id === p.category_id)?.name ?? p.category_name;
        return (
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 shrink-0 rounded-lg border border-slate-100 bg-slate-50 overflow-hidden flex items-center justify-center">
              {imgUrl
                ? <img src={imgUrl} alt={p.name} className="h-full w-full object-cover" />
                : <ImageIcon className="h-4 w-4 text-slate-300" />}
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-slate-800 truncate flex items-center gap-1">
                {p.is_featured && (
                  <Star className="h-3.5 w-3.5 shrink-0 fill-amber-400 text-amber-400" />
                )}
                <span className="truncate">{p.name}</span>
              </p>
              {catName && <p className="text-xs text-slate-500 truncate">{catName}</p>}
            </div>
          </div>
        );
      },
      getValue: (p) => p.name,
    },
    {
      key: "brand",
      header: "Marca",
      sortable: true,
      render: (p) => <span className="text-slate-600">{p.brand || "—"}</span>,
    },
    {
      key: "price",
      header: "Precio",
      sortable: true,
      render: (p) => (
        <div>
          <span className="font-semibold text-slate-800">${p.price.toFixed(2)}</span>
          {p.original_price && (
            <span className="ml-1.5 text-xs text-slate-400 line-through">${p.original_price.toFixed(2)}</span>
          )}
        </div>
      ),
      getValue: (p) => p.price,
    },
    {
      key: "stock",
      header: "Stock",
      sortable: true,
      render: (p) => (
        <div className="flex flex-col gap-0.5">
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold w-fit ${
            p.stock === 0 ? "bg-rose-100 text-rose-700" :
            p.is_low_stock ? "bg-amber-100 text-amber-700" :
            "bg-emerald-100 text-emerald-700"
          }`}>
            {p.stock ?? 0} uds
          </span>
          {p.is_low_stock && p.stock > 0 && (
            <span className="text-[10px] text-amber-600 font-medium">Stock bajo</span>
          )}
          {p.stock === 0 && (
            <span className="text-[10px] text-rose-600 font-medium">Agotado</span>
          )}
        </div>
      ),
      getValue: (p) => p.stock ?? 0,
    },
    {
      key: "is_active",
      header: "Estado",
      sortable: true,
      render: (p) => (
        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
          p.is_active ? "bg-slate-100 text-slate-700" : "bg-rose-100 text-rose-700"
        }`}>
          {p.is_active ? <><Eye className="h-3 w-3" /> Activo</> : <><EyeOff className="h-3 w-3" /> Inactivo</>}
        </span>
      ),
      getValue: (p) => (p.is_active ? "activo" : "inactivo"),
    },
  ];

  const actions: DataTableAction<MarketplaceProduct>[] = [
    { label: "Editar", icon: <Pencil className="h-4 w-4" />, onClick: openEdit },
    { label: "Ajustar stock", icon: <Package className="h-4 w-4" />, onClick: openStockModal },
    {
      label: "Destacar",
      icon: <Star className="h-4 w-4" />,
      onClick: handleToggleFeatured,
      show: (p) => !p.is_featured,
    },
    {
      label: "Quitar destacado",
      icon: <StarOff className="h-4 w-4" />,
      onClick: handleToggleFeatured,
      show: (p) => p.is_featured,
    },
    { label: "Eliminar", icon: <Trash2 className="h-4 w-4" />, onClick: (p) => setDeleteTarget(p), variant: "danger" },
  ];

  const handleExportPdf = () => {
    void generateTablePdf({
      title: "Productos del Marketplace",
      filename: "productos-marketplace",
      orientation: "landscape",
      meta: [
        { label: "Productos", value: String(filtered.length) },
        { label: "Activos", value: String(activeCount) },
      ],
      columns: [
        { key: "name", header: "Producto" },
        { key: "brand", header: "Marca" },
        { key: "price", header: "Precio" },
        { key: "stock", header: "Stock" },
        { key: "is_active", header: "Estado" },
      ],
      rows: filtered.map((p) => ({
        name: p.name,
        brand: p.brand || "—",
        price: `$${p.price.toFixed(2)}`,
        stock: p.stock ?? 0,
        is_active: p.is_active ? "Activo" : "Inactivo",
      })),
    });
  };

  const toolbar = (
    <FilterActionBar
      left={
        <div className="flex flex-wrap gap-1 rounded-xl border border-slate-200 bg-slate-100/80 p-1 w-fit">
          {([
            { key: "all" as const, label: `Todos (${products.length})`, warn: false, danger: false },
            { key: "active" as const, label: `Activos (${activeCount})`, warn: false, danger: false },
            { key: "inactive" as const, label: `Inactivos (${products.length - activeCount})`, warn: false, danger: false },
            { key: "low_stock" as const, label: `Stock bajo (${lowStockCount})`, warn: lowStockCount > 0, danger: false },
            { key: "out_of_stock" as const, label: `Agotados (${outOfStockCount})`, warn: false, danger: outOfStockCount > 0 },
          ]).map(({ key, label, warn, danger }) => (
            <Button
              key={key}
              variant="ghost"
              size="md"
              onClick={() => setFilterStatus(key)}
              className={
                filterStatus === key
                  ? "bg-white text-slate-900 shadow-sm ring-1 ring-black/5"
                  : warn
                  ? "text-amber-600 hover:bg-amber-50"
                  : danger
                  ? "text-rose-600 hover:bg-rose-50"
                  : "text-slate-500 hover:bg-slate-200/50 hover:text-slate-700"
              }
            >
              {label}
            </Button>
          ))}
        </div>
      }
      right={
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-slate-200 bg-slate-100/80 p-0.5">
            <button
              onClick={() => setViewMode("list")}
              title="Vista lista"
              className={`flex items-center justify-center rounded-md p-1.5 transition ${viewMode === "list" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
            >
              <LayoutList className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode("grid")}
              title="Vista cuadrícula"
              className={`flex items-center justify-center rounded-md p-1.5 transition ${viewMode === "grid" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
          </div>
          <Button variant="secondary" onClick={handleExportPdf} leftIcon={<FileDown className="h-4 w-4" />}>
            PDF
          </Button>
          <Button onClick={openCreate} leftIcon={<Plus className="h-4 w-4" />}>
            Nuevo producto
          </Button>
        </div>
      }
    />
  );

  return (
    <>
      <Layout
        title="Productos"
        subtitle="Administra el catálogo de productos del marketplace."
        variant="table"
        toolbar={toolbar}
      >
        <div className="mb-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard label="Total productos" value={products.length} icon={<ShoppingBag className="h-4 w-4" />} tone="slate" />
          <StatCard label="Activos" value={activeCount} icon={<Eye className="h-4 w-4" />} tone="primary" />
          <StatCard label="Stock bajo" value={lowStockCount} icon={<TrendingDown className="h-4 w-4" />} tone="amber" />
          <StatCard label="Agotados" value={outOfStockCount} icon={<AlertTriangle className="h-4 w-4" />} tone="rose" />
        </div>

        {viewMode === "list" ? (
          <DataTable
            data={filtered}
            columns={columns}
            actions={actions}
            loading={loading}
            defaultLimit={10}
            availableLimits={[5, 10, 20, 50]}
            globalSearchPlaceholder="Buscar por nombre, marca o categoría…"
            enableColumnFilters
          />
        ) : (
          <ProductGrid
            products={gridFiltered}
            categories={categories}
            loading={loading}
            search={gridSearch}
            onSearchChange={setGridSearch}
            onEdit={openEdit}
            onDelete={(p) => setDeleteTarget(p)}
          />
        )}
      </Layout>

      {/* Modal crear / editar */}
      <GenericModal
        isOpen={isModalOpen}
        onClose={closeModal}
        title={editingId ? "Editar producto" : "Nuevo producto"}
        size="md"
        asForm
        onSubmit={handleSubmit}
        footer={
          <>
            <Button type="button" variant="secondary" onClick={closeModal}>Cancelar</Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Guardando…" : editingId ? "Guardar cambios" : "Crear producto"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {/* Imagen */}
          <div className="flex flex-col items-center gap-2">
            <div
              onClick={() => fileInputRef.current?.click()}
              className="h-28 w-28 cursor-pointer overflow-hidden rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 flex items-center justify-center hover:border-brand transition"
            >
              {imagePreview
                ? <img src={imagePreview} alt="preview" className="h-full w-full object-cover" />
                : <Upload className="h-7 w-7 text-slate-300" />}
            </div>
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                setImageFile(f);
                setImagePreview(URL.createObjectURL(f));
              }} />
            <button type="button" onClick={() => fileInputRef.current?.click()}
              className="text-xs text-brand hover:underline">
              {imagePreview ? "Cambiar imagen" : "Subir imagen"}
            </button>
          </div>

          <InputField
            label="Nombre *"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="Ej: Sérum Vitamina C"
          />
          <InputField
            label="Marca"
            value={form.brand}
            onChange={(e) => setForm((f) => ({ ...f, brand: e.target.value }))}
            placeholder="Ej: Glow Lab"
          />

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-brand-tertiary">Categoría</label>
            <select
              value={form.category_id}
              onChange={(e) => setForm((f) => ({ ...f, category_id: e.target.value }))}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition-all focus:border-brand focus:ring-2 focus:ring-brand/20"
            >
              <option value="">Sin categoría</option>
              {categories.filter((c) => c.is_active).map((c) => (
                <option key={c.id} value={String(c.id)}>{c.name}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <InputField label="Precio *" type="number" value={form.price}
              onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))} placeholder="0.00" />
            <InputField label="Precio original" type="number" value={form.original_price}
              onChange={(e) => setForm((f) => ({ ...f, original_price: e.target.value }))} placeholder="0.00" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <InputField label="Stock" type="number" value={form.stock}
              onChange={(e) => setForm((f) => ({ ...f, stock: e.target.value }))} placeholder="0" />
            <InputField label="Alerta stock bajo" type="number" value={form.low_stock_threshold}
              onChange={(e) => setForm((f) => ({ ...f, low_stock_threshold: e.target.value }))} placeholder="5" />
          </div>

          <InputField
            label="Video (link directo)"
            value={form.video_url}
            onChange={(e) => setForm((f) => ({ ...f, video_url: e.target.value }))}
            placeholder="https://ejemplo.com/video.mp4"
            hint={videoFile ? "Se ignorará: hay un archivo de video seleccionado abajo" : undefined}
          />

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-brand-tertiary">
              O sube un archivo de video (mp4, mov, webm — máx. 80 MB)
            </label>
            <input
              ref={videoInputRef}
              type="file"
              accept="video/mp4,video/quicktime,video/webm,.mp4,.mov,.webm,.m4v"
              className="hidden"
              onChange={(e) => setVideoFile(e.target.files?.[0] ?? null)}
            />
            {videoFile ? (
              <div className="flex items-center gap-2 rounded-xl border border-brand/30 bg-brand/5 px-3 py-2">
                <Video className="h-4 w-4 text-brand shrink-0" />
                <span className="flex-1 min-w-0 truncate text-sm text-slate-700">{videoFile.name}</span>
                <button
                  type="button"
                  onClick={() => { setVideoFile(null); if (videoInputRef.current) videoInputRef.current.value = ""; }}
                  className="shrink-0 rounded-lg p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-500 transition"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => videoInputRef.current?.click()}
                className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 py-3 text-sm text-slate-500 hover:border-brand hover:text-brand transition"
              >
                <Upload className="h-4 w-4" /> Subir archivo de video
              </button>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-brand-tertiary">Descripción</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              rows={3}
              placeholder="Descripción del producto…"
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none resize-none transition-all focus:border-brand focus:ring-2 focus:ring-brand/20"
            />
          </div>

          {editingId !== null && (
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
                className="h-4 w-4 accent-brand rounded"
              />
              <span className="text-sm text-slate-700">Visible en la app (activo)</span>
            </label>
          )}
        </div>
      </GenericModal>

      <ConfirmDialog
        isOpen={!!deleteTarget}
        title="Eliminar producto"
        message={<p>¿Eliminar <strong>{deleteTarget?.name}</strong>? Esta acción no se puede deshacer.</p>}
        confirmText="Eliminar"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      {/* Modal ajuste de stock */}
      <GenericModal
        isOpen={!!stockTarget}
        onClose={() => setStockTarget(null)}
        title="Ajustar stock"
        size="sm"
        footer={
          <>
            <Button type="button" variant="secondary" onClick={() => setStockTarget(null)}>Cancelar</Button>
            <Button type="button" onClick={handleAdjustStock} disabled={adjustingStock}>
              {adjustingStock ? "Guardando…" : "Guardar"}
            </Button>
          </>
        }
      >
        {stockTarget && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 rounded-xl bg-slate-50 border border-slate-200 p-3">
              {buildImgUrl(stockTarget.image_url) ? (
                <img src={buildImgUrl(stockTarget.image_url)!} alt={stockTarget.name}
                  className="h-12 w-12 rounded-lg object-cover shrink-0 border border-slate-100" />
              ) : (
                <div className="h-12 w-12 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                  <ImageIcon className="h-5 w-5 text-slate-300" />
                </div>
              )}
              <div className="min-w-0">
                <p className="font-semibold text-slate-800 truncate">{stockTarget.name}</p>
                <p className="text-sm text-slate-500">Stock actual: <strong className={
                  stockTarget.stock === 0 ? "text-rose-600" : stockTarget.is_low_stock ? "text-amber-600" : "text-emerald-600"
                }>{stockTarget.stock} uds</strong></p>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Nuevo stock total</label>
              <input
                type="number"
                min={0}
                value={newStockValue}
                onChange={(e) => setNewStockValue(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && void handleAdjustStock()}
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-lg font-bold text-slate-800 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 transition text-center"
                autoFocus
              />
            </div>

            <div className="flex gap-2">
              {[1, 5, 10, 25, 50].map((delta) => (
                <button
                  key={delta}
                  type="button"
                  onClick={() => setNewStockValue((v) => String(Math.max(0, (parseInt(v, 10) || 0) + delta)))}
                  className="flex-1 rounded-lg border border-slate-200 bg-slate-50 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition"
                >
                  +{delta}
                </button>
              ))}
            </div>
            <p className="text-xs text-slate-400 text-center">Los botones suman al valor actual del campo</p>
          </div>
        )}
      </GenericModal>
    </>
  );
}

// ── Vista cuadrícula ─────────────────────────────────────────────────────────

function ProductGrid({
  products, categories, loading, search, onSearchChange, onEdit, onDelete,
}: {
  products: MarketplaceProduct[];
  categories: MarketplaceCategory[];
  loading: boolean;
  search: string;
  onSearchChange: (v: string) => void;
  onEdit: (p: MarketplaceProduct) => void;
  onDelete: (p: MarketplaceProduct) => void;
}) {
  return (
    <div>
      {/* Búsqueda para la vista cuadrícula */}
      <div className="mb-4 relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
        <input
          type="text"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Buscar por nombre, marca o categoría…"
          className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-700 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 transition"
        />
      </div>

      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-slate-200 bg-slate-100 animate-pulse aspect-[3/4]" />
          ))}
        </div>
      ) : products.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-slate-400">
          <ShoppingBag className="h-10 w-10 mb-2 opacity-40" />
          <p className="text-sm">Sin productos</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {products.map((p) => {
            const imgUrl = buildImgUrl(p.image_url);
            const catName = categories.find((c) => c.id === p.category_id)?.name ?? p.category_name;
            return (
              <div
                key={p.id}
                className="group flex flex-col rounded-xl border border-slate-200 bg-white overflow-hidden hover:shadow-md transition-shadow"
              >
                {/* Imagen */}
                <div className="relative aspect-square bg-slate-50 overflow-hidden">
                  {imgUrl ? (
                    <img
                      src={imgUrl}
                      alt={p.name}
                      className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center">
                      <ImageIcon className="h-8 w-8 text-slate-200" />
                    </div>
                  )}
                  {!p.is_active && (
                    <div className="absolute inset-0 bg-white/60 flex items-center justify-center">
                      <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 text-xs font-semibold text-rose-700">
                        <EyeOff className="h-3 w-3" /> Inactivo
                      </span>
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="flex flex-col flex-1 p-3 gap-1">
                  <p className="font-semibold text-slate-800 text-sm leading-tight line-clamp-2">{p.name}</p>
                  {catName && <p className="text-xs text-slate-500 truncate">{catName}</p>}
                  {p.brand && <p className="text-xs text-slate-400 truncate">{p.brand}</p>}

                  <div className="mt-auto pt-2 flex items-end justify-between gap-1">
                    <div className="min-w-0">
                      <p className="font-bold text-brand text-sm">${p.price.toFixed(2)}</p>
                      {p.original_price && (
                        <p className="text-xs text-slate-400 line-through">${p.original_price.toFixed(2)}</p>
                      )}
                    </div>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${
                      (p.stock ?? 0) > 0 ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"
                    }`}>
                      {p.stock ?? 0}
                    </span>
                  </div>

                  {/* Acciones */}
                  <div className="flex gap-1.5 pt-2">
                    <button
                      onClick={() => onEdit(p)}
                      className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-slate-100 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-200 transition"
                    >
                      <Pencil className="h-3 w-3" /> Editar
                    </button>
                    <button
                      onClick={() => onDelete(p)}
                      className="flex items-center justify-center rounded-lg bg-rose-50 p-1.5 text-rose-600 hover:bg-rose-100 transition"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
