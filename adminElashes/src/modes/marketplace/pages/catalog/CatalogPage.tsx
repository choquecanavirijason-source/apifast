import { useEffect, useState, useMemo } from "react";
import { toast } from "react-toastify";
import { Search, ShoppingBag, Star, Tag, PackageSearch, X } from "lucide-react";

import {
  fetchAdminProducts,
  fetchAdminCategories,
  MARKETPLACE_MEDIA_BASE,
  type MarketplaceProduct,
  type MarketplaceCategory,
} from "@/core/services/marketplace/marketplace.service";

// ── helpers ───────────────────────────────────────────────────────────────────

function imgUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  return url.startsWith("http") ? url : `${MARKETPLACE_MEDIA_BASE}${url}`;
}

// ── ProductCard ───────────────────────────────────────────────────────────────

function ProductCard({ p }: { p: MarketplaceProduct }) {
  const thumb = imgUrl(p.image_url);
  const hasDiscount = p.original_price && p.original_price > p.price;
  const discountPct = hasDiscount
    ? Math.round(((p.original_price! - p.price) / p.original_price!) * 100)
    : 0;

  return (
    <div className="group flex flex-col rounded-2xl border border-slate-200 bg-white overflow-hidden hover:shadow-md transition-shadow duration-200">
      {/* Imagen */}
      <div className="relative aspect-square bg-slate-100 overflow-hidden">
        {thumb ? (
          <img
            src={thumb}
            alt={p.name}
            className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="h-full w-full flex items-center justify-center">
            <ShoppingBag className="h-10 w-10 text-slate-200" />
          </div>
        )}
        {hasDiscount && (
          <span className="absolute top-2 left-2 rounded-full bg-rose-500 px-2 py-0.5 text-[10px] font-bold text-white">
            −{discountPct}%
          </span>
        )}
        {p.rating >= 4.5 && (
          <span className="absolute top-2 right-2 flex items-center gap-0.5 rounded-full bg-amber-400 px-1.5 py-0.5 text-[10px] font-bold text-white">
            <Star className="h-2.5 w-2.5 fill-white" /> Top
          </span>
        )}
      </div>

      {/* Info */}
      <div className="flex flex-col gap-1.5 p-3">
        {p.category_name && (
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-brand">
            <Tag className="h-2.5 w-2.5" /> {p.category_name}
          </span>
        )}
        <p className="text-sm font-semibold text-slate-800 leading-snug line-clamp-2">{p.name}</p>
        {p.brand && <p className="text-[11px] text-slate-400">{p.brand}</p>}

        <div className="mt-auto flex items-end justify-between pt-1">
          <div className="flex flex-col">
            {hasDiscount && (
              <span className="text-[11px] text-slate-400 line-through">
                S/ {p.original_price!.toFixed(2)}
              </span>
            )}
            <span className="text-base font-bold text-slate-800">
              S/ {p.price.toFixed(2)}
            </span>
          </div>
          <div className="flex items-center gap-0.5 text-amber-400">
            <Star className="h-3 w-3 fill-amber-400" />
            <span className="text-xs font-semibold text-slate-600">{p.rating.toFixed(1)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── page ──────────────────────────────────────────────────────────────────────

export default function MarketplaceCatalogPage() {
  const [products, setProducts] = useState<MarketplaceProduct[]>([]);
  const [categories, setCategories] = useState<MarketplaceCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("Todos");

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchAdminProducts(false), fetchAdminCategories()])
      .then(([prods, cats]) => {
        setProducts(prods);
        setCategories(cats);
      })
      .catch(() => toast.error("Error al cargar el catálogo"))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    let list = products.filter((p) => p.is_active);
    if (selectedCategory !== "Todos") {
      list = list.filter((p) => p.category_name === selectedCategory);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.brand ?? "").toLowerCase().includes(q) ||
          (p.category_name ?? "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [products, selectedCategory, search]);

  const activeCategories = categories.filter((c) => c.is_active);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 pt-6 pb-4 border-b border-slate-100 bg-white">
        <div className="flex items-center justify-between mb-1">
          <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <PackageSearch size={22} className="text-brand" /> Catálogo público
          </h1>
          <span className="text-xs text-slate-400">
            {filtered.length} producto{filtered.length !== 1 ? "s" : ""} visibles
          </span>
        </div>
        <p className="text-sm text-slate-500">Vista de cómo verán los clientes el marketplace en la app.</p>

        {/* Barra de búsqueda */}
        <div className="relative mt-4 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar producto, marca o categoría…"
            className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-9 text-sm text-slate-700 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 transition"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Chips de categoría */}
        {activeCategories.length > 0 && (
          <div className="flex gap-2 mt-3 flex-wrap">
            {["Todos", ...activeCategories.map((c) => c.name)].map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                  selectedCategory === cat
                    ? "bg-brand text-white shadow-sm"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Grid de productos */}
      <div className="flex-1 overflow-y-auto p-6">
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="rounded-2xl border border-slate-200 bg-white overflow-hidden animate-pulse">
                <div className="aspect-square bg-slate-100" />
                <div className="p-3 space-y-2">
                  <div className="h-3 w-1/2 rounded bg-slate-100" />
                  <div className="h-4 w-3/4 rounded bg-slate-100" />
                  <div className="h-4 w-1/3 rounded bg-slate-100" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-slate-400">
            <PackageSearch className="h-14 w-14 mb-3 text-slate-200" />
            <p className="font-semibold text-slate-500">
              {search || selectedCategory !== "Todos"
                ? "Sin resultados para tu búsqueda"
                : "No hay productos activos en el catálogo"}
            </p>
            <p className="text-sm mt-1">
              {search || selectedCategory !== "Todos"
                ? "Prueba con otra búsqueda o categoría"
                : "Activa productos desde la sección Productos"}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {filtered.map((p) => (
              <ProductCard key={p.id} p={p} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
