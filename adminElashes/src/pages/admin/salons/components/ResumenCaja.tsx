import { useState } from "react";
import { ChevronDown, ChevronUp, RefreshCw } from "lucide-react";
import type { CashSessionDetail } from "@/core/services/cash-session/cash-session.service";
import QueSeVendio from "./QueSeVendio";

const money = (value: number) =>
  new Intl.NumberFormat("es-BO", { style: "currency", currency: "BOB", maximumFractionDigits: 2 }).format(value);

function Line({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`flex items-baseline justify-between gap-3 py-1 ${strong ? "mt-1 border-t border-slate-300 pt-2 font-bold text-slate-900" : "text-slate-700"}`}>
      <span className="min-w-0 text-xs">{label}</span>
      <span className={`shrink-0 whitespace-nowrap tabular-nums ${strong ? "text-sm" : "text-xs font-medium"}`}>{value}</span>
    </div>
  );
}

/**
 * Resumen de la caja abierta: a la vista solo los dos números que importan (esperado en efectivo y total vendido) y,
 * con "Ver detalle", el desglose ordenado de cómo se llega a cada uno.
 */
export default function ResumenCaja({
  detail,
  openingAmount,
  loading,
  onRefresh,
}: {
  detail: CashSessionDetail | null;
  openingAmount: number;
  loading: boolean;
  onRefresh: () => void;
}) {
  const [open, setOpen] = useState(false);
  const commissions = detail?.cash_commissions ?? 0;
  const extras = detail?.cash_extras ?? 0;

  return (
    <div className="mt-4 rounded-lg border border-[var(--ui-border-strong)] bg-[var(--ui-surface-muted)] px-4 py-3">
      <div className="flex flex-wrap items-start gap-x-10 gap-y-3">
        <div>
          <p className="text-xs font-semibold text-[var(--ui-text-muted)]">Esperado en caja (solo efectivo)</p>
          <p className="text-2xl font-bold tabular-nums text-[var(--ui-text)]">{detail ? money(detail.expected_cash) : "…"}</p>
        </div>
        <div>
          <p className="text-xs font-semibold text-[var(--ui-text-muted)]">Total vendido (todos los métodos)</p>
          <p className="text-2xl font-bold tabular-nums text-[var(--ui-text)]">{detail ? money(detail.income_by_method.total) : "…"}</p>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
            className="inline-flex min-h-9 items-center gap-2 rounded-md border border-[#094732] bg-[#094732] px-3 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#0d6045] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#094732]"
          >
            {open ? "Ocultar detalle" : "Ver detalle"}
            {open ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>
          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--ui-text-muted)] hover:text-[var(--ui-text)] disabled:opacity-50"
            title="Volver a calcular con lo último que se registró"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            {loading ? "Actualizando…" : "Actualizar"}
          </button>
        </div>
      </div>

      {open && detail ? (
        <div className="mt-3 grid gap-4 border-t border-[var(--ui-border)] pt-3 sm:grid-cols-2">
          <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
            <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-slate-500">Cómo sale el efectivo esperado</p>
            <Line label="Monto inicial" value={money(openingAmount)} />
            <Line label="Ventas en efectivo" value={`+ ${money(detail.cash_sales)}`} />
            <Line label="Gastos" value={`− ${money(detail.cash_expenses)}`} />
            <Line label="Comisiones pagadas del efectivo" value={`− ${money(commissions)}`} />
            <Line label="Extras y bonos del efectivo" value={`− ${money(extras)}`} />
            <Line label="Esperado en caja" value={money(detail.expected_cash)} strong />
          </div>
          <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
            <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-slate-500">Ventas por método de pago</p>
            <Line label="Efectivo" value={money(detail.income_by_method.efectivo)} />
            <Line label="Tarjeta" value={money(detail.income_by_method.tarjeta)} />
            <Line label="Transferencia" value={money(detail.income_by_method.transferencia)} />
            <Line label="QR" value={money(detail.income_by_method.qr)} />
            {detail.income_by_method.mixto > 0 ? <Line label="Mixto" value={money(detail.income_by_method.mixto)} /> : null}
            <Line label="Total vendido" value={money(detail.income_by_method.total)} strong />
          </div>
          <QueSeVendio detail={detail} />
        </div>
      ) : null}
    </div>
  );
}
