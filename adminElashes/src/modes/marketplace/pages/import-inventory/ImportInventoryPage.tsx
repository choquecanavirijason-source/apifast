import { useEffect, useState } from "react";
import { PackagePlus, Check, AlertCircle, Loader2, Download, ImageIcon, RefreshCw, LayoutList, LayoutGrid, Search } from "lucide-react";
import { toast } from "react-toastify";
import {
  fetchInventoryProducts,
  fetchAdminProducts,
  importInventoryProduct,
  type MarketplaceProduct,
} from "@/core/services/marketplace/marketplace.service";

import Layout from "@/components/common/layout";
import FilterActionBar from "@/components/common/FilterActionBar";
import { Button, StatCard } from "@/components/common/ui";
import DataTable, { type DataTableColumn, type DataTableAction } from "@/components/common/table/DataTable";

interface InventoryProduct {
  id: number;
  sku: string;
  name: string;
  price: number;
  cost: number;
  status: boolean;
  image_url: string | null;
  category_id: number | null;
  category: { id: number; name: string } | null;
}

const ELASHES_BACKEND =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_URL) ||
  "http://34.55.150.142";

function buildInvImg(url: string | null) {
  if (!url) return null;
  if (url.startsWith("http")) return url;
  return `${ELASHES_BACKEND}/api${url}`;
}

export default function ImportInventoryPage() {
  const [inventory, setInventory] = useState<InventoryProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [importing, setImporting] = useState<number | null>(null);
  const [imported, setImported] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
  const [gridSearch, setGridSearch] = useState("");

  useEffect(() => { void load(); }, []);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [inv, mp] = await Promise.all([
        fetchInventoryProducts(),
        fetchAdminProducts(true),
      ]);
      setInventory(inv as InventoryProduct[]);
      const names = new Set((mp as MarketplaceProduct[]).map((p) => p.name.toLowerCase()));
      setImported(names);
    } catch {
      setError("No se pudo cargar el inventario. Verifica que elashesbackend esté corriendo.");
    } finally {
      setLoading(false);
    }
  }

  async function handleImport(product: InventoryProduct) {
    if (imported.has(product.name.toLowerCase())) return;
    setImporting(product.id);
    try {
      await importInventoryProduct({
        name: product.name,
        price: product.price,
        stock: 0,
        image_url: product.image_url ? buildInvImg(product.image_url) : null,
      });
      setImported((prev) => new Set([...prev, product.name.toLowerCase()]));
      toast.success(`"${product.name}" importado al marketplace`);
    } catch {
      toast.error("Error al importar el producto");
    } finally {
      setImporting(null);
    }
  }

  const importedCount = inventory.filter((p) => imported.has(p.name.toLowerCase())).length;
  const pendingCount  = inventory.length - importedCount;

  const gridFiltered = gridSearch.trim()
    ? inventory.filter((p) =>
        p.name.toLowerCase().includes(gridSearch.toLowerCase()) ||
        (p.sku ?? "").toLowerCase().includes(gridSearch.toLowerCase()) ||
        (p.category?.name ?? "").toLowerCase().includes(gridSearch.toLowerCase())
      )
    : inventory;

  const columns: DataTableColumn<InventoryProduct>[] = [
    {
      key: "name",
      header: "Producto",
      sortable: true,
      render: (p) => {
        const img = buildInvImg(p.image_url);
        return (
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 shrink-0 rounded-lg border border-slate-100 bg-slate-50 overflow-hidden flex items-center justify-center">
              {img
                ? <img src={img} alt={p.name} className="h-full w-full object-cover"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                : <ImageIcon className="h-4 w-4 text-slate-300" />}
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-slate-800 truncate">{p.name}</p>
              <p className="text-xs text-slate-500">{p.sku}</p>
            </div>
          </div>
        );
      },
      getValue: (p) => p.name,
    },
    {
      key: "category",
      header: "Categoría",
      sortable: true,
      render: (p) => (
        <span className="text-slate-600 text-sm">{p.category?.name ?? "—"}</span>
      ),
      getValue: (p) => p.category?.name ?? "",
    },
    {
      key: "price",
      header: "Precio",
      sortable: true,
      render: (p) => <span className="font-semibold text-slate-800">${p.price.toFixed(2)}</span>,
      getValue: (p) => p.price,
    },
    {
      key: "imported",
      header: "Estado",
      sortable: true,
      render: (p) => {
        const isImported = imported.has(p.name.toLowerCase());
        return isImported ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 text-emerald-700 px-2.5 py-0.5 text-xs font-semibold">
            <Check className="h-3 w-3" /> En marketplace
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 text-slate-500 px-2.5 py-0.5 text-xs font-semibold">
            Pendiente
          </span>
        );
      },
      getValue: (p) => (imported.has(p.name.toLowerCase()) ? "importado" : "pendiente"),
    },
  ];

  const actions: DataTableAction<InventoryProduct>[] = [
    {
      label: "Importar",
      icon: <PackagePlus className="h-4 w-4" />,
      onClick: (p) => void handleImport(p),
      variant: "primary",
      show: (p) => !imported.has(p.name.toLowerCase()) && importing !== p.id,
    },
  ];

  const toolbar = (
    <FilterActionBar
      left={
        error ? (
          <div className="flex items-center gap-2 text-sm text-rose-600">
            <AlertCircle className="h-4 w-4" />
            <span>{error}</span>
          </div>
        ) : (
          <span className="text-sm text-slate-500">
            <strong className="text-slate-800">{inventory.length}</strong> productos del inventario ·{" "}
            <strong className="text-emerald-700">{importedCount}</strong> ya en marketplace ·{" "}
            <strong className="text-slate-800">{pendingCount}</strong> pendientes
          </span>
        )
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
          <Button
            variant="secondary"
            onClick={load}
            disabled={loading}
            leftIcon={<RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />}
          >
            Actualizar
          </Button>
        </div>
      }
    />
  );

  return (
    <Layout
      title="Importar del Inventario"
      subtitle="Selecciona productos del inventario del salón para agregarlos al marketplace."
      variant="table"
      toolbar={toolbar}
    >
      <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard
          label="Total en inventario"
          value={inventory.length}
          icon={<Download className="h-4 w-4" />}
          tone="slate"
        />
        <StatCard
          label="Ya en marketplace"
          value={importedCount}
          icon={<Check className="h-4 w-4" />}
          tone="primary"
        />
        <StatCard
          label="Pendientes de importar"
          value={pendingCount}
          icon={<PackagePlus className="h-4 w-4" />}
          tone="secondary"
        />
      </div>

      {importing !== null && (
        <div className="mb-3 flex items-center gap-2 rounded-lg border border-brand/20 bg-brand/5 px-3 py-2 text-sm text-brand">
          <Loader2 className="h-4 w-4 animate-spin" />
          Importando producto…
        </div>
      )}

      {viewMode === "list" ? (
        <DataTable
          data={inventory}
          columns={columns}
          actions={actions}
          loading={loading}
          defaultLimit={10}
          availableLimits={[5, 10, 20, 50]}
          globalSearchPlaceholder="Buscar por nombre, SKU o categoría…"
          enableColumnFilters
        />
      ) : (
        <InventoryGrid
          products={gridFiltered}
          imported={imported}
          importing={importing}
          loading={loading}
          search={gridSearch}
          onSearchChange={setGridSearch}
          onImport={handleImport}
        />
      )}
    </Layout>
  );
}

// ── Vista cuadrícula inventario ──────────────────────────────────────────────

function InventoryGrid({
  products, imported, importing, loading, search, onSearchChange, onImport,
}: {
  products: InventoryProduct[];
  imported: Set<string>;
  importing: number | null;
  loading: boolean;
  search: string;
  onSearchChange: (v: string) => void;
  onImport: (p: InventoryProduct) => void;
}) {
  return (
    <div>
      <div className="mb-4 relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
        <input
          type="text"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Buscar por nombre, SKU o categoría…"
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
          <Download className="h-10 w-10 mb-2 opacity-40" />
          <p className="text-sm">Sin productos</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {products.map((p) => {
            const img = buildInvImg(p.image_url);
            const isImported = imported.has(p.name.toLowerCase());
            const isImporting = importing === p.id;
            return (
              <div
                key={p.id}
                className="group flex flex-col rounded-xl border border-slate-200 bg-white overflow-hidden hover:shadow-md transition-shadow"
              >
                <div className="relative aspect-square bg-slate-50 overflow-hidden">
                  {img ? (
                    <img
                      src={img}
                      alt={p.name}
                      className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center">
                      <ImageIcon className="h-8 w-8 text-slate-200" />
                    </div>
                  )}
                  {isImported && (
                    <div className="absolute top-2 right-2">
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-600 px-2 py-0.5 text-xs font-semibold text-white shadow">
                        <Check className="h-3 w-3" /> MP
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex flex-col flex-1 p-3 gap-1">
                  <p className="font-semibold text-slate-800 text-sm leading-tight line-clamp-2">{p.name}</p>
                  <p className="text-xs text-slate-500 truncate">{p.sku}</p>
                  {p.category && <p className="text-xs text-slate-400 truncate">{p.category.name}</p>}
                  <p className="mt-auto pt-2 font-bold text-brand text-sm">${p.price.toFixed(2)}</p>

                  <button
                    disabled={isImported || isImporting}
                    onClick={() => onImport(p)}
                    className={`mt-1.5 flex w-full items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-semibold transition ${
                      isImported
                        ? "bg-emerald-50 text-emerald-700 cursor-default"
                        : isImporting
                        ? "bg-slate-100 text-slate-400 cursor-wait"
                        : "bg-brand text-white hover:bg-brand/90"
                    }`}
                  >
                    {isImporting ? (
                      <><Loader2 className="h-3 w-3 animate-spin" /> Importando…</>
                    ) : isImported ? (
                      <><Check className="h-3 w-3" /> En marketplace</>
                    ) : (
                      <><PackagePlus className="h-3 w-3" /> Importar</>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
