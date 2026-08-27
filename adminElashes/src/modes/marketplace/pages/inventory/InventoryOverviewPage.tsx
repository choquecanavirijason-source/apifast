import { useEffect, useState } from "react";
import { Warehouse, ShoppingBag, Check, AlertTriangle, Search, RefreshCw, ImageIcon } from "lucide-react";
import { toast } from "react-toastify";
import {
  fetchInventoryProducts,
  fetchAdminProducts,
  MARKETPLACE_MEDIA_BASE,
  type MarketplaceProduct,
} from "@/core/services/marketplace/marketplace.service";
import variables from "@/core/config/variables";
import Layout from "@/components/common/layout";
import { StatCard } from "@/components/common/ui";

interface SalonProduct {
  id: number;
  sku: string;
  name: string;
  price: number;
  cost: number;
  status: boolean;
  image_url: string | null;
  category: { id: number; name: string } | null;
}

const ELASHES_BASE = variables.apiUrl || "http://34.55.150.142";

function salonImg(url: string | null) {
  if (!url) return null;
  return url.startsWith("http") ? url : `${ELASHES_BASE}/api${url}`;
}

function mpImg(url: string | null) {
  if (!url) return null;
  return url.startsWith("http") ? url : `${MARKETPLACE_MEDIA_BASE}${url}`;
}

type Tab = "all" | "salon" | "marketplace";

type Row = {
  key: string;
  name: string;
  source: "salon" | "marketplace" | "both";
  salon?: SalonProduct;
  mp?: MarketplaceProduct;
};

export default function InventoryOverviewPage() {
  const [salon, setSalon] = useState<SalonProduct[]>([]);
  const [marketplace, setMarketplace] = useState<MarketplaceProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("all");
  const [search, setSearch] = useState("");

  async function load() {
    setLoading(true);
    try {
      const [s, m] = await Promise.all([fetchInventoryProducts(), fetchAdminProducts(true)]);
      setSalon(s as SalonProduct[]);
      setMarketplace(m);
    } catch {
      toast.error("Error al cargar el inventario");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  // ── Cruzar por nombre ──────────────────────────────────────────────
  const mpByName = new Map(marketplace.map((p) => [p.name.toLowerCase(), p]));
  const salonByName = new Map(salon.map((p) => [p.name.toLowerCase(), p]));

  const rows: Row[] = [];
  const seen = new Set<string>();

  for (const p of salon) {
    const key = p.name.toLowerCase();
    const match = mpByName.get(key);
    rows.push({ key: `s-${p.id}`, name: p.name, source: match ? "both" : "salon", salon: p, mp: match });
    seen.add(key);
  }
  for (const p of marketplace) {
    const key = p.name.toLowerCase();
    if (!seen.has(key)) {
      rows.push({ key: `mp-${p.id}`, name: p.name, source: "marketplace", mp: p });
    }
  }

  const inBoth = rows.filter((r) => r.source === "both").length;
  const onlySalon = rows.filter((r) => r.source === "salon").length;
  const onlyMp = rows.filter((r) => r.source === "marketplace").length;

  const filtered = rows.filter((r) => {
    const matchSearch = !search.trim() || r.name.toLowerCase().includes(search.toLowerCase());
    const matchTab =
      tab === "all" ? true :
      tab === "salon" ? r.source !== "marketplace" :
      r.source !== "salon";
    return matchSearch && matchTab;
  });

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: "all", label: "Todos", count: rows.length },
    { key: "salon", label: "Salón", count: salon.length },
    { key: "marketplace", label: "Marketplace", count: marketplace.length },
  ];

  return (
    <Layout
      title="Inventario General"
      subtitle="Visión consolidada del inventario del salón y el marketplace."
      variant="table"
    >
      {/* Stats */}
      <div className="mb-4 grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          label="Inventario salón"
          value={salon.length}
          icon={<Warehouse className="h-4 w-4" />}
          tone="blue"
        />
        <StatCard
          label="En marketplace"
          value={marketplace.length}
          icon={<ShoppingBag className="h-4 w-4" />}
          tone="primary"
        />
        <StatCard
          label="En ambos sistemas"
          value={inBoth}
          icon={<Check className="h-4 w-4" />}
          tone="emerald"
        />
        <StatCard
          label="Solo en un sistema"
          value={onlySalon + onlyMp}
          icon={<AlertTriangle className="h-4 w-4" />}
          tone="amber"
        />
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 px-4 py-3 border-b border-slate-100">
          <div className="flex gap-1 bg-slate-100 rounded-xl p-1">
            {tabs.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
                  tab === t.key ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
                }`}
              >
                {t.label} ({t.count})
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar producto…"
                className="pl-8 pr-3 py-1.5 text-sm rounded-lg border border-slate-200 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 transition w-44"
              />
            </div>
            <button
              onClick={load}
              disabled={loading}
              className="flex items-center gap-1.5 text-xs text-slate-600 hover:text-slate-900 border border-slate-200 rounded-lg px-2.5 py-1.5 transition hover:bg-slate-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Actualizar
            </button>
          </div>
        </div>

        {/* Leyenda de origen */}
        <div className="flex items-center gap-4 px-4 py-2 border-b border-slate-50 bg-slate-50/50">
          {[
            { color: "bg-emerald-100 text-emerald-700", label: "Salón + Marketplace" },
            { color: "bg-blue-100 text-blue-700", label: "Solo Salón" },
            { color: "bg-purple-100 text-purple-700", label: "Solo Marketplace" },
          ].map((l) => (
            <span key={l.label} className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${l.color}`}>
              {l.label}
            </span>
          ))}
        </div>

        {/* Tabla */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/60">
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide w-8">#</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Producto</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Origen</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Precio salón</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Precio MP</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Stock MP</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Categoría</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className="border-b border-slate-50">
                    <td colSpan={7} className="px-4 py-3">
                      <div className="h-9 bg-slate-100 rounded-lg animate-pulse" />
                    </td>
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-14 text-center text-slate-400 text-sm">
                    Sin resultados
                  </td>
                </tr>
              ) : (
                filtered.map((r, idx) => {
                  const img = r.mp ? mpImg(r.mp.image_url) : r.salon ? salonImg(r.salon.image_url) : null;
                  const stripe = idx % 2 === 0 ? "bg-white" : "bg-slate-50/40";
                  const sourceBadge =
                    r.source === "both"
                      ? "bg-emerald-100 text-emerald-700"
                      : r.source === "salon"
                      ? "bg-blue-100 text-blue-700"
                      : "bg-purple-100 text-purple-700";
                  const sourceLabel =
                    r.source === "both" ? "Salón + MP" : r.source === "salon" ? "Solo Salón" : "Solo Marketplace";

                  return (
                    <tr key={r.key} className={`border-b border-slate-50 hover:bg-emerald-50/30 transition-colors ${stripe}`}>
                      <td className="px-4 py-3 text-xs text-slate-400 font-medium tabular-nums">{idx + 1}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 shrink-0 rounded-lg border border-slate-100 bg-slate-50 overflow-hidden flex items-center justify-center">
                            {img ? (
                              <img
                                src={img}
                                alt={r.name}
                                className="h-full w-full object-cover"
                                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                              />
                            ) : (
                              <ImageIcon className="h-4 w-4 text-slate-300" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-slate-800 truncate">{r.name}</p>
                            {r.salon?.sku && <p className="text-xs text-slate-400">{r.salon.sku}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${sourceBadge}`}>
                          {sourceLabel}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-700 font-medium text-sm">
                        {r.salon ? `S/ ${r.salon.price.toFixed(2)}` : "—"}
                      </td>
                      <td className="px-4 py-3 text-slate-700 font-medium text-sm">
                        {r.mp ? `S/ ${r.mp.price.toFixed(2)}` : "—"}
                      </td>
                      <td className="px-4 py-3">
                        {r.mp ? (
                          <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                            r.mp.stock === 0
                              ? "bg-rose-100 text-rose-700"
                              : r.mp.is_low_stock
                              ? "bg-amber-100 text-amber-700"
                              : "bg-emerald-100 text-emerald-700"
                          }`}>
                            {r.mp.stock} uds
                          </span>
                        ) : "—"}
                      </td>
                      <td className="px-4 py-3 text-slate-500 text-sm">
                        {r.mp?.category_name ?? r.salon?.category?.name ?? "—"}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {!loading && (
          <div className="px-4 py-2.5 border-t border-slate-100 bg-white">
            <p className="text-xs text-slate-500">
              Mostrando <strong className="text-slate-800">{filtered.length}</strong> de{" "}
              <strong className="text-slate-800">{rows.length}</strong> registros
            </p>
          </div>
        )}
      </div>
    </Layout>
  );
}
