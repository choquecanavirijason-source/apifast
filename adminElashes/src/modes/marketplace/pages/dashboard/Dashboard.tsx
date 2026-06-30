import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ShoppingBag, Tag, TrendingUp, Eye, EyeOff,
  Plus, ArrowRight, Loader2,
} from "lucide-react";
import {
  fetchAdminProducts,
  computeStats,
  MARKETPLACE_MEDIA_BASE,
  type MarketplaceProduct,
} from "@/core/services/marketplace/marketplace.service";
import { StatCard } from "@/components/common/ui/index";

const CATEGORIES = ["Todos", "Maquillaje", "Skincare", "Cabello", "Perfumes", "Uñas", "Accesorios"];

export default function MarketplaceDashboard() {
  const navigate = useNavigate();
  const [products, setProducts] = useState<MarketplaceProduct[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAdminProducts()
      .then(setProducts)
      .finally(() => setLoading(false));
  }, []);

  const stats = computeStats(products);
  const recent = [...products].slice(0, 6);
  const byCategory = CATEGORIES.slice(1).map((cat) => ({
    name: cat,
    count: products.filter((p) => p.category === cat).length,
  })).filter((c) => c.count > 0);

  return (
    <div className="p-6 space-y-8 max-w-7xl mx-auto">
      {/* Title */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard Marketplace</h1>
          <p className="text-sm text-gray-500 mt-0.5">Resumen de tu tienda en línea</p>
        </div>
        <button
          onClick={() => navigate("/marketplace/products/new")}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl shadow transition"
        >
          <Plus size={16} /> Nuevo producto
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="animate-spin text-blue-500" size={36} />
        </div>
      ) : (
        <>
          {/* Stats grid */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            <StatCard label="Total" value={stats.total} icon={<ShoppingBag size={18} />} tone="blue" />
            <StatCard label="Activos" value={stats.active} icon={<Eye size={18} />} tone="emerald" />
            <StatCard label="Inactivos" value={stats.inactive} icon={<EyeOff size={18} />} tone="slate" />
            <StatCard label="Categorías" value={stats.categories} icon={<Tag size={18} />} tone="secondary" />
            <StatCard
              label="Precio promedio"
              value={`$${stats.avg_price.toFixed(2)}`}
              icon={<TrendingUp size={18} />}
              tone="amber"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Recent products */}
            <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                <h2 className="text-sm font-semibold text-gray-800">Últimos productos</h2>
                <button
                  onClick={() => navigate("/marketplace/products")}
                  className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                >
                  Ver todos <ArrowRight size={12} />
                </button>
              </div>
              {recent.length === 0 ? (
                <div className="py-12 flex flex-col items-center text-gray-400 gap-2">
                  <ShoppingBag size={36} className="opacity-30" />
                  <p className="text-sm">No hay productos aún</p>
                  <button
                    onClick={() => navigate("/marketplace/products/new")}
                    className="text-xs text-blue-600 hover:underline"
                  >
                    Crear el primero →
                  </button>
                </div>
              ) : (
                <ul>
                  {recent.map((p) => (
                    <li
                      key={p.id}
                      className="flex items-center gap-3 px-5 py-3 border-b border-gray-50 last:border-0 hover:bg-gray-50 transition cursor-pointer"
                      onClick={() => navigate("/marketplace/products")}
                    >
                      <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center overflow-hidden shrink-0">
                        {p.image_url ? (
                          <img
                            src={p.image_url.startsWith("http") ? p.image_url : `${MARKETPLACE_MEDIA_BASE}${p.image_url}`}
                            alt={p.name}
                            className="w-full h-full object-cover"
                            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                          />
                        ) : (
                          <ShoppingBag size={16} className="text-gray-300" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">{p.name}</p>
                        <p className="text-xs text-gray-400">{p.category ?? "Sin categoría"}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-semibold text-gray-900">${p.price.toFixed(2)}</p>
                        <span
                          className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                            p.is_active
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-gray-100 text-gray-500"
                          }`}
                        >
                          {p.is_active ? "Activo" : "Inactivo"}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Categories breakdown */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                <h2 className="text-sm font-semibold text-gray-800">Por categoría</h2>
                <button
                  onClick={() => navigate("/marketplace/categories")}
                  className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                >
                  Gestionar <ArrowRight size={12} />
                </button>
              </div>
              {byCategory.length === 0 ? (
                <div className="py-12 flex flex-col items-center text-gray-400 gap-2">
                  <Tag size={28} className="opacity-30" />
                  <p className="text-xs">Sin datos aún</p>
                </div>
              ) : (
                <ul className="px-5 py-3 space-y-3">
                  {byCategory.map((cat) => {
                    const pct = stats.total > 0 ? (cat.count / stats.total) * 100 : 0;
                    return (
                      <li key={cat.name}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-gray-600">{cat.name}</span>
                          <span className="text-xs font-semibold text-gray-800">
                            {cat.count}
                          </span>
                        </div>
                        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-blue-500 rounded-full"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
