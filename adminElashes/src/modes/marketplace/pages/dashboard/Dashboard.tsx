import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ShoppingBag, Tag, TrendingUp, Eye, EyeOff, AlertTriangle,
  Plus, ArrowRight, Loader2, ShoppingCart, DollarSign, Clock, CheckCircle,
} from "lucide-react";
import {
  fetchAdminProducts,
  fetchDashboardStats,
  fetchLowStockProducts,
  MARKETPLACE_MEDIA_BASE,
  type MarketplaceProduct,
  type DashboardStats,
} from "@/core/services/marketplace/marketplace.service";
import { StatCard } from "@/components/common/ui/index";

function imgUrl(url: string | null | undefined) {
  if (!url) return null;
  return url.startsWith("http") ? url : `${MARKETPLACE_MEDIA_BASE}${url}`;
}

export default function MarketplaceDashboard() {
  const navigate = useNavigate();
  const [products, setProducts] = useState<MarketplaceProduct[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [lowStock, setLowStock] = useState<MarketplaceProduct[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetchAdminProducts(),
      fetchDashboardStats(),
      fetchLowStockProducts(),
    ])
      .then(([prods, st, ls]) => {
        setProducts(prods);
        setStats(st);
        setLowStock(ls);
      })
      .finally(() => setLoading(false));
  }, []);

  const recent = [...products].slice(0, 6);
  // Categorías dinámicas derivadas de los productos reales
  const byCategory = Object.entries(
    products.reduce<Record<string, number>>((acc, p) => {
      const cat = p.category_name ?? "Sin categoría";
      acc[cat] = (acc[cat] ?? 0) + 1;
      return acc;
    }, {})
  )
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  return (
    <div className="p-6 space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard Marketplace</h1>
          <p className="text-sm text-gray-500 mt-0.5">Resumen de tu tienda en línea</p>
        </div>
        <button
          onClick={() => navigate("/marketplace/products")}
          className="flex items-center gap-2 bg-brand hover:opacity-90 text-white text-sm font-semibold px-4 py-2.5 rounded-xl shadow transition"
        >
          <Plus size={16} /> Nuevo producto
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="animate-spin text-brand" size={36} />
        </div>
      ) : (
        <>
          {/* Stats de productos */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-3">Productos</p>
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
              <StatCard label="Total" value={stats?.products.total ?? products.length} icon={<ShoppingBag size={18} />} tone="blue" />
              <StatCard label="Activos" value={stats?.products.active ?? 0} icon={<Eye size={18} />} tone="emerald" />
              <StatCard label="Inactivos" value={stats?.products.inactive ?? 0} icon={<EyeOff size={18} />} tone="slate" />
              <StatCard label="Stock bajo" value={stats?.products.low_stock ?? 0} icon={<AlertTriangle size={18} />} tone="amber" />
              <StatCard label="Agotados" value={stats?.products.out_of_stock ?? 0} icon={<AlertTriangle size={18} />} tone="secondary" />
            </div>
          </div>

          {/* Stats de órdenes */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-3">Pedidos</p>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <StatCard label="Total pedidos" value={stats?.orders.total ?? 0} icon={<ShoppingCart size={18} />} tone="blue" />
              <StatCard label="Pendientes" value={stats?.orders.pending ?? 0} icon={<Clock size={18} />} tone="amber" />
              <StatCard label="Confirmados" value={stats?.orders.confirmed ?? 0} icon={<CheckCircle size={18} />} tone="emerald" />
              <StatCard
                label="Revenue"
                value={`S/ ${(stats?.revenue ?? 0).toFixed(2)}`}
                icon={<DollarSign size={18} />}
                tone="secondary"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Últimos productos */}
            <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                <h2 className="text-sm font-semibold text-gray-800">Últimos productos</h2>
                <button
                  onClick={() => navigate("/marketplace/products")}
                  className="text-xs text-brand hover:underline flex items-center gap-1"
                >
                  Ver todos <ArrowRight size={12} />
                </button>
              </div>
              {recent.length === 0 ? (
                <div className="py-12 flex flex-col items-center text-gray-400 gap-2">
                  <ShoppingBag size={36} className="opacity-30" />
                  <p className="text-sm">No hay productos aún</p>
                  <button onClick={() => navigate("/marketplace/products")} className="text-xs text-brand hover:underline">
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
                        {imgUrl(p.image_url) ? (
                          <img src={imgUrl(p.image_url)!} alt={p.name} className="w-full h-full object-cover"
                            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                        ) : (
                          <ShoppingBag size={16} className="text-gray-300" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">{p.name}</p>
                        <p className="text-xs text-gray-400">{p.category_name ?? "Sin categoría"}</p>
                      </div>
                      <div className="text-right shrink-0 flex flex-col items-end gap-0.5">
                        <p className="text-sm font-semibold text-gray-900">S/ {p.price.toFixed(2)}</p>
                        <div className="flex items-center gap-1">
                          {p.is_low_stock && (
                            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700">
                              Stock bajo
                            </span>
                          )}
                          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                            p.is_active ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-500"
                          }`}>
                            {p.is_active ? "Activo" : "Inactivo"}
                          </span>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="flex flex-col gap-6">
              {/* Stock bajo */}
              {lowStock.length > 0 && (
                <div className="bg-white rounded-2xl border border-amber-200 shadow-sm overflow-hidden">
                  <div className="flex items-center justify-between px-5 py-4 border-b border-amber-100 bg-amber-50">
                    <h2 className="text-sm font-semibold text-amber-800 flex items-center gap-2">
                      <AlertTriangle size={14} className="text-amber-500" /> Stock bajo
                    </h2>
                    <button
                      onClick={() => navigate("/marketplace/products")}
                      className="text-xs text-amber-600 hover:underline flex items-center gap-1"
                    >
                      Ver todos <ArrowRight size={12} />
                    </button>
                  </div>
                  <ul className="px-4 py-2 divide-y divide-amber-50">
                    {lowStock.slice(0, 5).map((p) => (
                      <li key={p.id} className="py-2.5 flex items-center justify-between gap-2">
                        <span className="text-xs text-slate-700 truncate flex-1">{p.name}</span>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                            p.stock === 0 ? "bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-700"
                          }`}>
                            {p.stock === 0 ? "Agotado" : `${p.stock} uds`}
                          </span>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Por categoría */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex-1">
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                  <h2 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                    <Tag size={14} className="text-brand" /> Por categoría
                  </h2>
                  <button onClick={() => navigate("/marketplace/categories")}
                    className="text-xs text-brand hover:underline flex items-center gap-1">
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
                      const total = products.length;
                      const pct = total > 0 ? (cat.count / total) * 100 : 0;
                      return (
                        <li key={cat.name}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs text-gray-600 truncate">{cat.name}</span>
                            <span className="text-xs font-semibold text-gray-800 ml-2">{cat.count}</span>
                          </div>
                          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div className="h-full bg-brand rounded-full" style={{ width: `${pct}%` }} />
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>
          </div>

          {/* Accesos rápidos */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Ver pedidos", icon: <ShoppingCart size={18} />, path: "/marketplace/orders" },
              { label: "Gestionar productos", icon: <ShoppingBag size={18} />, path: "/marketplace/products" },
              { label: "Categorías", icon: <Tag size={18} />, path: "/marketplace/categories" },
              { label: "Importar inventario", icon: <TrendingUp size={18} />, path: "/marketplace/import-inventory" },
            ].map((item) => (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 hover:border-brand hover:text-brand transition"
              >
                {item.icon} {item.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
