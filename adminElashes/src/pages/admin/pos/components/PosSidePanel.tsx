/**
 * PosSidePanel — carrito visible en el sidebar de escritorio.
 * Solo muestra servicios agregados + total + botón para abrir el cobro.
 */
import { useMemo } from "react";
import { ShoppingCart, Trash2, ArrowRight, PackageOpen } from "lucide-react";
import type { ServiceOption } from "../../../../core/services/agenda/agenda.service";
import type { CartLine } from "../pos.types";

type Props = {
  cartLines: CartLine[];
  services: ServiceOption[];
  subtotal: number;
  total: number;
  discountValue: string;
  discountType: "amount" | "percent";
  onRemoveLine: (localId: string) => void;
  onOpenCheckout: () => void;
};

export default function PosSidePanel({
  cartLines,
  services,
  subtotal,
  total,
  discountValue,
  discountType,
  onRemoveLine,
  onOpenCheckout,
}: Props) {
  const cartCount = cartLines.length;

  const lineCountById = useMemo(() => {
    const m = new Map<string, number>();
    cartLines.forEach((l) => {
      const k = String(l.service_id || "");
      m.set(k, (m.get(k) ?? 0) + 1);
    });
    return m;
  }, [cartLines]);

  const hasDiscount =
    parseFloat(discountValue) > 0 && total !== subtotal;

  return (
    <div className="flex h-full flex-col overflow-hidden border-l border-[var(--ui-border)] bg-white">

      {/* ── Cabecera ──────────────────────────────────────────────────── */}
      <div className="flex shrink-0 items-center justify-between border-b border-[var(--ui-border)] px-4 py-3">
        <div className="flex items-center gap-2">
          <ShoppingCart className="h-4 w-4 text-[#094732]" />
          <span className="text-sm font-semibold text-[var(--ui-text)]">Carrito</span>
          {cartCount > 0 && (
            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[#094732] px-1.5 text-[10px] font-bold text-white">
              {cartCount}
            </span>
          )}
        </div>
        {cartCount > 0 && (
          <span className="text-sm font-bold text-[#094732]">Bs {total.toFixed(2)}</span>
        )}
      </div>

      {/* ── Lista de servicios ────────────────────────────────────────── */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {cartCount === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
            <PackageOpen className="h-10 w-10 text-[var(--ui-text-muted)]" />
            <p className="text-sm font-medium text-[var(--ui-text-muted)]">Sin servicios</p>
            <p className="text-xs text-[var(--ui-text-muted)]">
              Selecciona servicios del catálogo para comenzar una venta
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[var(--ui-border)]">
            {cartLines.map((line) => {
              const svcName =
                services.find((s) => String(s.id) === line.service_id)?.name ?? "Servicio";
              const rpt = lineCountById.get(String(line.service_id || "")) ?? 0;

              return (
                <div
                  key={line.localId}
                  className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-[var(--ui-surface-hover)]"
                >
                  {/* Ícono / indicador de duplicado */}
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#ecfdf5] text-[10px] font-bold text-[#094732]">
                    {rpt > 1 ? `×${rpt}` : "✓"}
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-[var(--ui-text)]">{svcName}</p>
                    <p className="text-xs font-semibold text-[#094732]">
                      Bs {line.price.toFixed(2)}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => onRemoveLine(line.localId)}
                    className="shrink-0 rounded-lg p-1 text-[var(--ui-text-muted)] transition hover:bg-[#fde7e9] hover:text-[#d13438]"
                    aria-label="Quitar"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Totales + Cobrar ─────────────────────────────────────────── */}
      {cartCount > 0 && (
        <div className="shrink-0 border-t border-[var(--ui-border)] bg-white px-4 py-4 space-y-3">
          {/* Subtotal y descuento */}
          <div className="space-y-1 text-xs">
            <div className="flex justify-between text-[var(--ui-text-muted)]">
              <span>Subtotal</span>
              <span>Bs {subtotal.toFixed(2)}</span>
            </div>
            {hasDiscount && (
              <div className="flex justify-between text-[#107c10]">
                <span>
                  Descuento{" "}
                  {discountType === "percent"
                    ? `(${discountValue}%)`
                    : `(Bs ${parseFloat(discountValue).toFixed(2)})`}
                </span>
                <span>− Bs {(subtotal - total).toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between border-t border-[var(--ui-border)] pt-1.5 text-sm font-bold text-[var(--ui-text)]">
              <span>Total</span>
              <span className="text-[#094732]">Bs {total.toFixed(2)}</span>
            </div>
          </div>

          {/* Botón de cobro */}
          <button
            type="button"
            onClick={onOpenCheckout}
            className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-[#094732] text-sm font-semibold text-white shadow-sm transition hover:bg-[#063324] active:bg-[#094732]"
          >
            Cobrar venta
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}
