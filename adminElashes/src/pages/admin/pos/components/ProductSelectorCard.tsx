import { useMemo, useState } from "react";
import { Plus, Search } from "lucide-react";

import type { Product } from "../../../../core/types/IProduct";
import type { ProductCartLine } from "../pos.types";
import { Button } from "../../../../components/common/ui";

type ProductSelectorCardProps = {
  labelClass: string;
  fieldClass: string;
  products: Product[];
  canManageInventory: boolean;
  onCreateProduct: () => void;
  productLines: ProductCartLine[];
  onAddProductToCart: (product: Product) => void;
  onUpdateProductQuantity: (localId: string, quantity: number) => void;
  onRemoveProductLine: (localId: string) => void;
};

export default function ProductSelectorCard({
  labelClass,
  fieldClass,
  products,
  canManageInventory,
  onCreateProduct,
  productLines,
  onAddProductToCart,
  onUpdateProductQuantity,
  onRemoveProductLine,
}: ProductSelectorCardProps) {
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");

  const lineByProductId = useMemo(() => {
    const map = new Map<string, ProductCartLine>();
    productLines.forEach((line) => map.set(line.product_id, line));
    return map;
  }, [productLines]);

  const categoryOptions = useMemo(
    () => Array.from(new Set(products.map((p) => p.category).filter(Boolean))).sort(),
    [products]
  );

  const filteredProducts = useMemo(() => {
    const term = search.trim().toLowerCase();
    return products.filter((p) => {
      const matchesCategory = categoryFilter === "all" || p.category === categoryFilter;
      const matchesTerm = !term || p.name.toLowerCase().includes(term) || p.sku.toLowerCase().includes(term);
      return matchesCategory && matchesTerm;
    });
  }, [products, search, categoryFilter]);

  return (
    <div className="flex h-full min-h-0 flex-col rounded-lg border border-[var(--ui-border)] bg-[var(--ui-surface)] shadow-sm">
      <div className="shrink-0 p-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label className={labelClass}>Buscar producto</label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--ui-text-muted)]" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Nombre o SKU..."
                className={`${fieldClass} pl-9`}
              />
            </div>
          </div>
          <div className="sm:w-56">
            <label className={labelClass}>Categoría</label>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className={fieldClass}
            >
              <option value="all">Todas las categorías</option>
              {categoryOptions.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
          {canManageInventory && (
            <Button
              type="button"
              onClick={onCreateProduct}
              leftIcon={<Plus className="h-4 w-4" />}
              className="shrink-0"
            >
              Nuevo producto
            </Button>
          )}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto border-t border-[var(--ui-border)] p-3 max-h-[calc(100dvh-15rem)]">
        {filteredProducts.length === 0 ? (
          <p className="py-6 text-center text-xs text-[var(--ui-text-muted)]">
            {products.length === 0 ? "Esta sucursal no tiene productos con stock." : "Sin resultados para el filtro/búsqueda."}
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {filteredProducts.map((product) => {
              const line = lineByProductId.get(String(product.id));
              const qty = line?.quantity ?? 0;
              const outOfStock = product.stock <= 0;
              return (
                <div
                  key={product.id}
                  className={`flex flex-col overflow-hidden rounded-xl border bg-white shadow-sm transition ${
                    qty > 0
                      ? "border-[#094732] shadow-[0_0_0_2px_rgba(0,120,212,0.15)]"
                      : outOfStock
                        ? "border-[var(--ui-border)] opacity-60"
                        : "border-[var(--ui-border)] hover:border-[#094732]"
                  }`}
                >
                  <div className="flex h-24 w-full shrink-0 items-center justify-center bg-[var(--ui-surface-muted)] text-xl font-black text-[var(--ui-text-muted)]">
                    {product.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex flex-col gap-1.5 px-2.5 py-2">
                    <p className="line-clamp-1 text-xs font-semibold text-[var(--ui-text)]">{product.name}</p>
                    <div className="flex items-center justify-between">
                      <p className="text-[11px] font-bold text-[#094732]">Bs {product.price.toFixed(2)}</p>
                      <p className={`text-[10px] font-semibold ${outOfStock ? "text-rose-600" : "text-[var(--ui-text-muted)]"}`}>
                        {outOfStock ? "Sin stock" : `Stock: ${product.stock}`}
                      </p>
                    </div>

                    {qty === 0 ? (
                      <button
                        type="button"
                        onClick={() => onAddProductToCart(product)}
                        disabled={outOfStock}
                        className="mt-0.5 flex h-7 w-full items-center justify-center rounded-lg bg-[#094732] text-xs font-bold text-white shadow transition hover:bg-[#063324] disabled:cursor-not-allowed disabled:bg-[#c8c6c4]"
                      >
                        Agregar
                      </button>
                    ) : (
                      <div className="mt-0.5 flex items-center justify-between gap-1">
                        <button
                          type="button"
                          onClick={() =>
                            line && (qty <= 1 ? onRemoveProductLine(line.localId) : onUpdateProductQuantity(line.localId, qty - 1))
                          }
                          className="flex h-7 w-7 items-center justify-center rounded-full border border-[var(--ui-border-strong)] bg-white text-base font-bold leading-none text-[var(--ui-text)] shadow-sm transition hover:bg-[var(--ui-surface-hover)]"
                        >
                          −
                        </button>
                        <span className="text-xs font-bold text-[#094732]">{qty}</span>
                        <button
                          type="button"
                          onClick={() => onAddProductToCart(product)}
                          disabled={qty >= product.stock}
                          className="flex h-7 w-7 items-center justify-center rounded-full bg-[#094732] text-base font-bold leading-none text-white shadow transition hover:bg-[#063324] disabled:cursor-not-allowed disabled:bg-[#c8c6c4]"
                        >
                          +
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
