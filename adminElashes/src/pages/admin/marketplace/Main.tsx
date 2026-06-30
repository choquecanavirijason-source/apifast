import { useEffect, useRef, useState } from "react";
import { toast } from "react-toastify";
import { Plus, Pencil, Trash2, ShoppingBag, Eye, EyeOff, Loader2, X, Upload, ImageIcon } from "lucide-react";
import { Button, SectionCard, StatCard } from "../../../components/common/ui/index";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import variables from "@/core/config/variables";

// ─────────────────────────── types ───────────────────────────

interface MarketplaceProduct {
  id: number;
  name: string;
  brand: string | null;
  description: string | null;
  price: number;
  original_price: number | null;
  image_url: string | null;
  category: string | null;
  rating: number;
  review_count: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

type ProductForm = {
  name: string;
  brand: string;
  description: string;
  price: string;
  original_price: string;
  category: string;
  rating: string;
  review_count: string;
  is_active: boolean;
};

const emptyForm: ProductForm = {
  name: "",
  brand: "",
  description: "",
  price: "",
  original_price: "",
  category: "Maquillaje",
  rating: "0",
  review_count: "0",
  is_active: true,
};

const CATEGORIES = ["Maquillaje", "Skincare", "Cabello", "Perfumes", "Uñas", "Accesorios", "Otro"];

// ─────────────────────────── API helpers ───────────────────────────

function getToken() {
  return localStorage.getItem(variables.session.tokenName);
}

function apiUrl(path: string) {
  return `${variables.apiUrl}${path}`;
}

async function fetchProducts(): Promise<MarketplaceProduct[]> {
  const res = await fetch(apiUrl("/marketplace/admin/products?include_inactive=true"), {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  if (!res.ok) throw new Error("Error al cargar productos");
  return res.json();
}

async function createProduct(form: ProductForm, image: File | null): Promise<MarketplaceProduct> {
  const fd = new FormData();
  fd.append("name", form.name.trim());
  if (form.brand.trim()) fd.append("brand", form.brand.trim());
  if (form.description.trim()) fd.append("description", form.description.trim());
  fd.append("price", form.price);
  if (form.original_price) fd.append("original_price", form.original_price);
  if (form.category) fd.append("category", form.category);
  fd.append("rating", form.rating || "0");
  fd.append("review_count", form.review_count || "0");
  if (image) fd.append("image", image);

  const res = await fetch(apiUrl("/marketplace/admin/products"), {
    method: "POST",
    headers: { Authorization: `Bearer ${getToken()}` },
    body: fd,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Error al crear producto");
  }
  return res.json();
}

async function updateProduct(id: number, form: ProductForm, image: File | null): Promise<MarketplaceProduct> {
  const fd = new FormData();
  fd.append("name", form.name.trim());
  fd.append("brand", form.brand.trim());
  fd.append("description", form.description.trim());
  fd.append("price", form.price);
  fd.append("original_price", form.original_price || "");
  fd.append("category", form.category);
  fd.append("rating", form.rating || "0");
  fd.append("review_count", form.review_count || "0");
  fd.append("is_active", String(form.is_active));
  if (image) fd.append("image", image);

  const res = await fetch(apiUrl(`/marketplace/admin/products/${id}`), {
    method: "PUT",
    headers: { Authorization: `Bearer ${getToken()}` },
    body: fd,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Error al actualizar producto");
  }
  return res.json();
}

async function deleteProduct(id: number): Promise<void> {
  const res = await fetch(apiUrl(`/marketplace/admin/products/${id}`), {
    method: "DELETE",
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  if (!res.ok) throw new Error("Error al eliminar producto");
}

// ─────────────────────────── component ───────────────────────────

export default function MarketplacePage() {
  const [products, setProducts] = useState<MarketplaceProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<ProductForm>(emptyForm);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MarketplaceProduct | null>(null);
  const [filterCategory, setFilterCategory] = useState("Todos");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    setLoading(true);
    try {
      const data = await fetchProducts();
      setProducts(data);
    } catch {
      toast.error("No se pudieron cargar los productos del marketplace");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setImageFile(null);
    setImagePreview(null);
    setIsModalOpen(true);
  };

  const openEdit = (p: MarketplaceProduct) => {
    setEditingId(p.id);
    setForm({
      name: p.name,
      brand: p.brand ?? "",
      description: p.description ?? "",
      price: String(p.price),
      original_price: p.original_price ? String(p.original_price) : "",
      category: p.category ?? "Maquillaje",
      rating: String(p.rating),
      review_count: String(p.review_count),
      is_active: p.is_active,
    });
    setImageFile(null);
    setImagePreview(p.image_url ? buildImageUrl(p.image_url) : null);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingId(null);
    setForm(emptyForm);
    setImageFile(null);
    setImagePreview(null);
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { toast.error("El nombre es obligatorio"); return; }
    if (!form.price || Number(form.price) <= 0) { toast.error("El precio debe ser mayor a 0"); return; }

    setSaving(true);
    try {
      if (editingId !== null) {
        const updated = await updateProduct(editingId, form, imageFile);
        setProducts((prev) => prev.map((p) => (p.id === editingId ? updated : p)));
        toast.success("Producto actualizado");
      } else {
        const created = await createProduct(form, imageFile);
        setProducts((prev) => [created, ...prev]);
        toast.success("Producto creado");
      }
      closeModal();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteProduct(deleteTarget.id);
      setProducts((prev) => prev.filter((p) => p.id !== deleteTarget.id));
      toast.success("Producto eliminado");
    } catch {
      toast.error("Error al eliminar el producto");
    } finally {
      setDeleteTarget(null);
    }
  };

  const buildImageUrl = (url: string | null) => {
    if (!url) return null;
    if (url.startsWith("http")) return url;
    return `${variables.apiUrl}${url}`;
  };

  const filtered = filterCategory === "Todos"
    ? products
    : products.filter((p) => p.category === filterCategory);

  const activeCount = products.filter((p) => p.is_active).length;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <ShoppingBag size={24} className="text-emerald-600" /> Marketplace
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">Gestiona los productos que se muestran en la app de clientes</p>
        </div>
        <Button onClick={openCreate} className="flex items-center gap-2">
          <Plus size={16} />
          Nuevo producto
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total productos" value={String(products.length)} icon={<ShoppingBag size={20} />} />
        <StatCard label="Activos" value={String(activeCount)} icon={<Eye size={20} />} />
        <StatCard label="Inactivos" value={String(products.length - activeCount)} icon={<EyeOff size={20} />} />
        <StatCard label="Categorías" value={String(new Set(products.map((p) => p.category).filter(Boolean)).size)} icon={<ShoppingBag size={20} />} />
      </div>

      {/* Filter bar */}
      <div className="flex gap-2 flex-wrap">
        {["Todos", ...CATEGORIES].map((cat) => (
          <button
            key={cat}
            onClick={() => setFilterCategory(cat)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
              filterCategory === cat
                ? "bg-emerald-600 text-white shadow"
                : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Product grid */}
      {loading ? (
        <div className="flex justify-center items-center py-24">
          <Loader2 className="animate-spin text-emerald-600" size={36} />
        </div>
      ) : filtered.length === 0 ? (
        <SectionCard>
          <div className="flex flex-col items-center justify-center py-16 text-gray-400 gap-3">
            <ShoppingBag size={48} className="opacity-30" />
            <p className="text-lg font-medium">No hay productos aún</p>
            <p className="text-sm">Crea el primer producto para que aparezca en la app</p>
            <Button onClick={openCreate} className="mt-2 flex items-center gap-2">
              <Plus size={15} /> Crear producto
            </Button>
          </div>
        </SectionCard>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((p) => (
            <div
              key={p.id}
              className={`bg-white rounded-2xl border shadow-sm overflow-hidden flex flex-col transition-all hover:shadow-md ${
                !p.is_active ? "opacity-60" : ""
              }`}
            >
              {/* Image */}
              <div className="relative h-44 bg-gray-100 flex items-center justify-center">
                {p.image_url ? (
                  <img
                    src={buildImageUrl(p.image_url) ?? ""}
                    alt={p.name}
                    className="w-full h-full object-cover"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                  />
                ) : (
                  <ImageIcon size={40} className="text-gray-300" />
                )}
                {!p.is_active && (
                  <span className="absolute top-2 left-2 bg-gray-700/80 text-white text-xs px-2 py-0.5 rounded-full">
                    Inactivo
                  </span>
                )}
                {p.original_price && p.original_price > p.price && (
                  <span className="absolute top-2 right-2 bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                    -{Math.round(((p.original_price - p.price) / p.original_price) * 100)}%
                  </span>
                )}
              </div>

              {/* Info */}
              <div className="p-3 flex-1 flex flex-col gap-1">
                {p.brand && <p className="text-xs text-emerald-600 font-medium uppercase tracking-wide">{p.brand}</p>}
                <h3 className="text-sm font-semibold text-gray-800 line-clamp-2">{p.name}</h3>
                {p.category && (
                  <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full w-fit">{p.category}</span>
                )}
                <div className="flex items-baseline gap-1.5 mt-auto pt-2">
                  <span className="text-base font-bold text-gray-900">${p.price.toFixed(2)}</span>
                  {p.original_price && (
                    <span className="text-xs text-gray-400 line-through">${p.original_price.toFixed(2)}</span>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="px-3 pb-3 flex gap-2">
                <button
                  onClick={() => openEdit(p)}
                  className="flex-1 flex items-center justify-center gap-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg py-2 transition"
                >
                  <Pencil size={13} /> Editar
                </button>
                <button
                  onClick={() => setDeleteTarget(p)}
                  className="flex items-center justify-center gap-1.5 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg py-2 px-3 transition"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ─── Modal crear / editar ─── */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b sticky top-0 bg-white z-10">
              <h2 className="text-base font-semibold text-gray-800">
                {editingId ? "Editar producto" : "Nuevo producto"}
              </h2>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600 transition">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {/* Image upload */}
              <div className="flex flex-col items-center gap-3">
                <div
                  className="w-28 h-28 rounded-xl border-2 border-dashed border-gray-300 flex items-center justify-center bg-gray-50 overflow-hidden cursor-pointer hover:border-emerald-400 transition"
                  onClick={() => fileInputRef.current?.click()}
                >
                  {imagePreview ? (
                    <img src={imagePreview} alt="preview" className="w-full h-full object-cover" />
                  ) : (
                    <Upload size={28} className="text-gray-300" />
                  )}
                </div>
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="text-sm text-emerald-600 hover:underline"
                >
                  {imagePreview ? "Cambiar imagen" : "Subir imagen"}
                </button>
              </div>

              {/* Fields */}
              <div className="grid grid-cols-1 gap-3">
                <Field label="Nombre *" value={form.name} onChange={(v) => setForm((f) => ({ ...f, name: v }))} placeholder="Ej: Sérum Vitamina C" />
                <Field label="Marca" value={form.brand} onChange={(v) => setForm((f) => ({ ...f, brand: v }))} placeholder="Ej: Glow Lab" />

                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Categoría</label>
                  <select
                    value={form.category}
                    onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                  >
                    {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <Field label="Precio *" type="number" value={form.price} onChange={(v) => setForm((f) => ({ ...f, price: v }))} placeholder="0.00" />
                  <Field label="Precio original" type="number" value={form.original_price} onChange={(v) => setForm((f) => ({ ...f, original_price: v }))} placeholder="0.00" />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Descripción</label>
                  <textarea
                    value={form.description}
                    onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                    rows={3}
                    placeholder="Descripción del producto..."
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-emerald-400"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <Field label="Rating (0-5)" type="number" value={form.rating} onChange={(v) => setForm((f) => ({ ...f, rating: v }))} placeholder="0.0" />
                  <Field label="Reseñas" type="number" value={form.review_count} onChange={(v) => setForm((f) => ({ ...f, review_count: v }))} placeholder="0" />
                </div>

                {editingId !== null && (
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={form.is_active}
                      onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
                      className="w-4 h-4 accent-emerald-600"
                    />
                    <span className="text-sm text-gray-700">Producto activo (visible en app)</span>
                  </label>
                )}
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold transition disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {saving && <Loader2 size={15} className="animate-spin" />}
                  {editingId ? "Guardar cambios" : "Crear producto"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirm delete */}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        title="Eliminar producto"
        message={`¿Eliminar "${deleteTarget?.name}"? Esta acción no se puede deshacer.`}
        confirmLabel="Eliminar"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}

// ─── tiny field helper ───

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        step={type === "number" ? "any" : undefined}
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
      />
    </div>
  );
}
