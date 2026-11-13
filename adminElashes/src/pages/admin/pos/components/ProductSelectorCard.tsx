import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Minus, PackageOpen, Plus, Search, SearchX, ShoppingCart, X } from "lucide-react";

import type { Product } from "../../../../core/types/IProduct";
import type { ProductCartLine } from "../pos.types";

type ProductSelectorCardProps = {
  products: Product[];
  canManageInventory: boolean;
  onCreateProduct: () => void;
  productLines: ProductCartLine[];
  onAddProductToCart: (product: Product) => void;
  onUpdateProductQuantity: (localId: string, quantity: number) => void;
  onRemoveProductLine: (localId: string) => void;
  /** Abre el carrito (el resumen inferior lleva ahí). */
  onOpenCart: () => void;
};

const money = (value: number) => `Bs ${value.toFixed(2)}`;

/** "Adhesivo Premium Negro" -> "AP"; una sola palabra -> sus dos primeras letras. */
const initialsOf = (name: string) => {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
};

/** Foto del producto; si no tiene o no carga, un fondo de marca con sus iniciales. */
function ProductThumb({ name, src }: { name: string; src?: string }) {
  const [failed, setFailed] = useState(false);
  if (src && !failed) {
    return (
      <img
        src={src}
        alt=""
        loading="lazy"
        onError={() => setFailed(true)}
        className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
      />
    );
  }
  return (
    <div className="flex h-full w-full items-center justify-center bg-linear-to-br from-[#094732]/10 via-[#f6f1e7] to-[#9F8351]/25">
      <span className="text-4xl font-black tracking-tight text-[#094732]/35">{initialsOf(name)}</span>
    </div>
  );
}

const chipClass = (active: boolean) =>
  `inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-xs font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[#094732]/40 ${
    active
      ? "border-[#094732] bg-[#094732] text-white shadow-sm"
      : "border-[var(--ui-border-strong)] bg-[var(--ui-surface)] text-[var(--ui-text)] hover:border-[#094732]/50 hover:bg-[var(--ui-surface-hover)]"
  }`;

export default function ProductSelectorCard({
  products,
  canManageInventory,
  onCreateProduct,
  productLines,
  onAddProductToCart,
  onUpdateProductQuantity,
  onRemoveProductLine,
  onOpenCart,
}: ProductSelectorCardProps) {
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [onlyInStock, setOnlyInStock] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const lineByProductId = useMemo(() => {
    const map = new Map<string, ProductCartLine>();
    productLines.forEach((line) => map.set(line.product_id, line));
    return map;
  }, [productLines]);

  // Categorías con cuántos productos tiene cada una (para los chips).
  const categories = useMemo(() => {
    const counts = new Map<string, number>();
    products.forEach((p) => {
      if (p.category) counts.set(p.category, (counts.get(p.category) ?? 0) + 1);
    });
    return Array.from(counts.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => a.name.localeCompare(b.name, "es"));
  }, [products]);

  const term = search.trim().toLowerCase();

  const filteredProducts = useMemo(() => {
    return products
      .filter((p) => {
        if (categoryFilter !== "all" && p.category !== categoryFilter) return false;
        if (onlyInStock && p.stock <= 0) return false;
        if (!term) return true;
        return (
          p.name.toLowerCase().includes(term) ||
          p.sku.toLowerCase().includes(term) ||
          (p.category ?? "").toLowerCase().includes(term)
        );
      })
      // Lo que se puede vender primero; lo agotado al final.
      .sort((a, b) => Number(a.stock <= 0) - Number(b.stock <= 0));
  }, [products, categoryFilter, onlyInStock, term]);

  // Al cambiar la búsqueda o los filtros se vuelve al inicio de la lista (si no, la primera tarjeta quedaba cortada).
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [term, categoryFilter, onlyInStock]);

  const cartUnits = productLines.reduce((sum, line) => sum + line.quantity, 0);
  const cartTotal = productLines.reduce((sum, line) => sum + line.unit_price * line.quantity, 0);

  const hasActiveFilters = Boolean(term) || categoryFilter !== "all" || onlyInStock;
  const clearFilters = () => {
    setSearch("");
    setCategoryFilter("all");
    setOnlyInStock(false);
  };

  // Un solo resultado (o el SKU exacto, como al escanear un código) se agrega con Enter.
  const quickMatch = useMemo(() => {
    if (!term) return null;
    const exactSku = products.find((p) => p.sku.toLowerCase() === term);
    if (exactSku) return exactSku;
    return filteredProducts.length === 1 ? filteredProducts[0] : null;
  }, [term, products, filteredProducts]);

  const handleSearchKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      setSearch("");
      return;
    }
    if (event.key !== "Enter" || !quickMatch) return;
    event.preventDefault();
    const line = lineByProductId.get(String(quickMatch.id));
    if (quickMatch.stock <= 0 || (line && line.quantity >= quickMatch.stock)) return;
    onAddProductToCart(quickMatch);
    setSearch("");
  };

  return (
    <div className="@container flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-[var(--ui-border)] bg-[var(--ui-surface)] shadow-sm">
      {/* ── Buscar y filtrar ─────────────────────────────────────────────── */}
      <div className="shrink-0 space-y-2.5 border-b border-[var(--ui-border)] p-3 sm:p-4">
        <div className="flex items-center gap-2">
          <div className="relative min-w-[9rem] flex-1">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-[var(--ui-text-muted)]" aria-hidden />
            <input
              type="text"
              inputMode="search"
              enterKeyHint="search"
              autoComplete="off"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              placeholder="Buscar por nombre, categoría o escanear el SKU…"
              aria-label="Buscar producto"
              className="h-11 w-full rounded-xl border border-[var(--ui-border-strong)] bg-[var(--ui-input)] pl-10 pr-10 text-sm text-[var(--ui-text)] outline-none transition placeholder:text-[var(--ui-text-muted)] focus:border-[#094732] focus:ring-2 focus:ring-[#094732]/20"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                aria-label="Borrar búsqueda"
                className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-[var(--ui-text-muted)] transition hover:bg-[var(--ui-surface-hover)] hover:text-[var(--ui-text)]"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          {canManageInventory && (
            <button
              type="button"
              onClick={onCreateProduct}
              aria-label="Nuevo producto"
              title="Nuevo producto"
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center gap-1.5 rounded-xl border border-[#9F8351]/50 bg-[#9F8351]/10 text-sm font-semibold text-[#6f5a31] transition hover:bg-[#9F8351]/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#9F8351]/50 @lg:w-auto @lg:px-4"
            >
              <Plus className="h-4 w-4" aria-hidden />
              <span className="hidden @lg:inline" aria-hidden>Nuevo producto</span>
            </button>
          )}
        </div>

        <div className="flex flex-nowrap items-center gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden @lg:flex-wrap @lg:overflow-visible @lg:pb-0">
          <button type="button" onClick={() => setCategoryFilter("all")} className={chipClass(categoryFilter === "all")}>
            Todas
            <span className={`rounded-full px-1.5 text-[10px] font-bold ${categoryFilter === "all" ? "bg-white/20" : "bg-[var(--ui-surface-muted)] text-[var(--ui-text-muted)]"}`}>
              {products.length}
            </span>
          </button>
          {categories.map(({ name, count }) => (
            <button key={name} type="button" onClick={() => setCategoryFilter(name)} className={chipClass(categoryFilter === name)}>
              {name}
              <span className={`rounded-full px-1.5 text-[10px] font-bold ${categoryFilter === name ? "bg-white/20" : "bg-[var(--ui-surface-muted)] text-[var(--ui-text-muted)]"}`}>
                {count}
              </span>
            </button>
          ))}
          <span className="mx-1 h-5 w-px shrink-0 bg-[var(--ui-border-strong)]" aria-hidden />
          <button type="button" onClick={() => setOnlyInStock((v) => !v)} aria-pressed={onlyInStock} className={chipClass(onlyInStock)}>
            {onlyInStock && <Check className="h-3.5 w-3.5" aria-hidden />}
            Solo con stock
          </button>
          <p className="ml-auto hidden whitespace-nowrap text-xs text-[var(--ui-text-muted)] @lg:block">
            <span className="font-semibold text-[var(--ui-text)]">{filteredProducts.length}</span>
            {filteredProducts.length === 1 ? " producto" : " productos"}
            {hasActiveFilters && products.length !== filteredProducts.length ? ` de ${products.length}` : ""}
          </p>
        </div>
        <p className="text-xs text-[var(--ui-text-muted)] @lg:hidden">
          <span className="font-semibold text-[var(--ui-text)]">{filteredProducts.length}</span>
          {filteredProducts.length === 1 ? " producto" : " productos"}
          {hasActiveFilters && products.length !== filteredProducts.length ? ` de ${products.length}` : ""}
        </p>

        {/* Atajo: aparece solo cuando hay un único resultado (o se escaneó un SKU exacto) */}
        {quickMatch && quickMatch.stock > 0 ? (
          <p className="truncate rounded-lg bg-[#094732]/8 px-3 py-1.5 text-xs text-[var(--ui-text-muted)]">
            <kbd className="rounded border border-[var(--ui-border-strong)] bg-[var(--ui-surface)] px-1.5 py-0.5 font-sans text-[10px] font-semibold text-[var(--ui-text)]">Enter</kbd>{" "}
            para agregar <span className="font-semibold text-[var(--ui-text)]">{quickMatch.name}</span>
          </p>
        ) : null}
      </div>

      {/* ── Productos ────────────────────────────────────────────────────── */}
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto bg-[var(--ui-surface-muted)]/50 p-3 sm:p-4 max-h-[calc(100dvh-19rem)]">
        {filteredProducts.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 px-4 py-12 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--ui-surface)] text-[var(--ui-text-muted)] shadow-sm">
              {products.length === 0 ? <PackageOpen className="h-7 w-7" aria-hidden /> : <SearchX className="h-7 w-7" aria-hidden />}
            </span>
            <div>
              <p className="text-sm font-semibold text-[var(--ui-text)]">
                {products.length === 0 ? "Esta sucursal no tiene productos con stock" : "No hay productos que coincidan"}
              </p>
              <p className="mt-0.5 text-xs text-[var(--ui-text-muted)]">
                {products.length === 0
                  ? "Registra un producto o carga un lote en Inventario."
                  : term
                    ? `No encontramos «${search.trim()}» con estos filtros.`
                    : "Prueba con otra categoría o quita el filtro de stock."}
              </p>
            </div>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="h-9 rounded-xl border border-[var(--ui-border-strong)] bg-[var(--ui-surface)] px-4 text-xs font-semibold text-[var(--ui-text)] transition hover:bg-[var(--ui-surface-hover)]"
              >
                Limpiar filtros
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(11rem,1fr))] gap-3 sm:gap-4">
            {filteredProducts.map((product) => {
              const line = lineByProductId.get(String(product.id));
              const qty = line?.quantity ?? 0;
              const outOfStock = product.stock <= 0;
              const lowStock = !outOfStock && product.minStock > 0 && product.stock <= product.minStock;
              const atMax = qty >= product.stock;
              return (
                <article
                  key={product.id}
                  className={`group relative flex flex-col overflow-hidden rounded-2xl border bg-[var(--ui-surface)] transition-all duration-200 ${
                    qty > 0
                      ? "border-[#094732] shadow-md ring-2 ring-[#094732]/20"
                      : outOfStock
                        ? "border-[var(--ui-border)] opacity-70"
                        : "border-[var(--ui-border)] shadow-sm hover:-translate-y-0.5 hover:border-[#094732]/50 hover:shadow-md"
                  }`}
                >
                  {/* Foto: tocarla agrega una unidad */}
                  <button
                    type="button"
                    onClick={() => onAddProductToCart(product)}
                    disabled={outOfStock || atMax}
                    aria-label={`Agregar ${product.name}`}
                    className="relative aspect-3/2 w-full shrink-0 overflow-hidden bg-[var(--ui-surface-muted)] focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#094732] disabled:cursor-not-allowed"
                  >
                    <ProductThumb name={product.name} src={product.imageUrl} />
                    {outOfStock && (
                      <span className="absolute inset-0 flex items-center justify-center bg-white/55 backdrop-blur-[1px]">
                        <span className="rounded-full bg-rose-600 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-white shadow">Agotado</span>
                      </span>
                    )}
                    {qty > 0 && (
                      <span className="absolute right-2 top-2 flex h-7 min-w-7 items-center justify-center gap-0.5 rounded-full bg-[#094732] px-2 text-xs font-bold text-white shadow-lg">
                        <Check className="h-3 w-3" aria-hidden />
                        {qty}
                      </span>
                    )}
                    {lowStock && (
                      <span className="absolute left-2 top-2 rounded-full bg-amber-500 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white shadow">
                        Quedan {product.stock}
                      </span>
                    )}
                  </button>

                  <div className="flex flex-1 flex-col gap-2.5 p-3">
                    <div className="min-w-0">
                      <h3 className="line-clamp-2 min-h-[2.5em] text-[13px] font-semibold leading-snug text-[var(--ui-text)]">{product.name}</h3>
                      <p className="mt-0.5 truncate text-[11px] text-[var(--ui-text-muted)]">
                        {product.category || "Sin categoría"} · {product.sku}
                      </p>
                    </div>

                    <div className="mt-auto flex items-end justify-between gap-2">
                      <p className="text-lg font-bold leading-none text-[#094732]">{money(product.price)}</p>
                      <p
                        className={`flex items-center gap-1 text-[11px] font-medium ${
                          outOfStock ? "text-rose-600" : lowStock ? "text-amber-600" : "text-[var(--ui-text-muted)]"
                        }`}
                      >
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${outOfStock ? "bg-rose-500" : lowStock ? "bg-amber-500" : "bg-emerald-500"}`}
                          aria-hidden
                        />
                        {outOfStock ? "Sin stock" : `${product.stock} en stock`}
                      </p>
                    </div>

                    {qty === 0 ? (
                      <button
                        type="button"
                        onClick={() => onAddProductToCart(product)}
                        disabled={outOfStock}
                        className="flex h-10 w-full items-center justify-center gap-1.5 rounded-xl bg-[#094732] text-sm font-semibold text-white shadow-sm transition hover:bg-[#063324] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#094732]/50 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-[var(--ui-border-strong)] disabled:text-[var(--ui-text-muted)] disabled:shadow-none"
                      >
                        <Plus className="h-4 w-4" aria-hidden />
                        Agregar
                      </button>
                    ) : (
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between rounded-xl bg-[#094732]/8 p-1">
                          <button
                            type="button"
                            onClick={() =>
                              line && (qty <= 1 ? onRemoveProductLine(line.localId) : onUpdateProductQuantity(line.localId, qty - 1))
                            }
                            aria-label={qty <= 1 ? `Quitar ${product.name}` : `Quitar una unidad de ${product.name}`}
                            className="flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--ui-border-strong)] bg-[var(--ui-surface)] text-[var(--ui-text)] shadow-sm transition hover:bg-[var(--ui-surface-hover)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#094732]/40"
                          >
                            <Minus className="h-4 w-4" aria-hidden />
                          </button>
                          <span className="min-w-8 text-center text-base font-bold tabular-nums text-[#094732]" aria-live="polite">{qty}</span>
                          <button
                            type="button"
                            onClick={() => onAddProductToCart(product)}
                            disabled={atMax}
                            aria-label={`Agregar una unidad de ${product.name}`}
                            title={atMax ? "Es todo el stock disponible" : undefined}
                            className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#094732] text-white shadow-sm transition hover:bg-[#063324] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#094732]/50 disabled:cursor-not-allowed disabled:bg-[var(--ui-border-strong)] disabled:text-[var(--ui-text-muted)]"
                          >
                            <Plus className="h-4 w-4" aria-hidden />
                          </button>
                        </div>
                        <p className="flex items-center justify-between px-1 text-[11px] text-[var(--ui-text-muted)]">
                          <span>{atMax ? "Todo el stock" : "Subtotal"}</span>
                          <span className="font-bold text-[var(--ui-text)]">{money(product.price * qty)}</span>
                        </p>
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Resumen de lo que lleva ──────────────────────────────────────── */}
      {productLines.length > 0 && (
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-x-3 gap-y-2 border-t border-[var(--ui-border)] bg-[var(--ui-surface)] px-4 py-3 shadow-[0_-10px_24px_-14px_rgba(0,0,0,0.25)]">
          <div className="flex min-w-0 flex-1 basis-40 items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#094732]/10 text-[#094732]">
              <ShoppingCart className="h-5 w-5" aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-[var(--ui-text)]">
                {productLines.length} {productLines.length === 1 ? "producto" : "productos"} · {cartUnits} {cartUnits === 1 ? "unidad" : "unidades"}
              </p>
              <p className="truncate text-xs text-[var(--ui-text-muted)]">Productos en esta venta</p>
            </div>
          </div>
          <div className="ml-auto flex shrink-0 items-center gap-3">
            <p className="text-xl font-bold tabular-nums text-[#094732]">{money(cartTotal)}</p>
            <button
              type="button"
              onClick={onOpenCart}
              className="h-10 rounded-xl bg-[#094732] px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#063324] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#094732]/50 focus-visible:ring-offset-2"
            >
              Ver carrito
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
