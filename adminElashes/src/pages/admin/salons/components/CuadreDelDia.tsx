import type { CashSessionDetail } from "@/core/services/cash-session/cash-session.service";

const money = (value: number) =>
  new Intl.NumberFormat("es-BO", { style: "currency", currency: "BOB", maximumFractionDigits: 2 }).format(value);

function Row({ label, value, hint, strong }: { label: string; value: string; hint?: string; strong?: boolean }) {
  return (
    <div className={`flex items-baseline justify-between gap-3 py-1.5 ${strong ? "border-t border-slate-300 pt-2.5 font-bold text-slate-900" : "text-slate-700"}`}>
      <span className="min-w-0 text-xs" title={hint}>{label}</span>
      <span className={`shrink-0 whitespace-nowrap tabular-nums ${strong ? "text-base" : "text-sm font-medium"}`}>{value}</span>
    </div>
  );
}

/**
 * Cuadre del día en dos columnas, como la hoja del cuaderno: a la izquierda lo que HAY (efectivo contado más lo
 * recibido por tarjeta, transferencia y QR) y a la derecha lo que DEBERÍA HABER (caja inicial más lo vendido menos lo
 * que salió de la caja). Las dos columnas deben coincidir; la diferencia es lo que sobra o falta.
 */
export default function CuadreDelDia({
  detail,
  openingAmount,
  countedAmount,
}: {
  detail: CashSessionDetail | null;
  openingAmount: number;
  countedAmount: string;
}) {
  if (!detail) return null;
  const hasCounted = countedAmount.trim() !== "" && Number.isFinite(Number(countedAmount));
  const counted = hasCounted ? Number(countedAmount) : 0;

  const income = detail.income_by_method;
  const nonCash = income.tarjeta + income.transferencia + income.qr + income.mixto;
  const received = counted + nonCash;

  const commissions = detail.cash_commissions ?? 0;
  const extras = detail.cash_extras ?? 0;
  const expected = openingAmount + income.total - detail.cash_expenses - commissions - extras;
  const difference = Math.round((received - expected) * 100) / 100;

  const verdict = !hasCounted
    ? "Escribe el efectivo contado para ver si cuadra."
    : Math.abs(difference) < 0.005
      ? "Cuadra: las dos columnas son iguales."
      : difference > 0
        ? `Sobra ${money(difference)}`
        : `Falta ${money(Math.abs(difference))}`;

  return (
    <div className="mt-4 rounded-lg border border-[var(--ui-border-strong)] bg-white p-4" data-tour="cash-cuadre">
      <p className="mb-3 text-sm font-semibold text-[var(--ui-text)]">Cuadre del día</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-slate-200 px-3 py-2">
          <p className="mb-1 text-xs font-bold uppercase tracking-wide text-slate-500">Lo que hay</p>
          <Row label="Efectivo contado" value={hasCounted ? money(counted) : "—"} />
          <Row label="Tarjeta" value={money(income.tarjeta)} />
          <Row label="Transferencia" value={money(income.transferencia)} />
          <Row label="QR" value={money(income.qr)} />
          {income.mixto > 0 ? <Row label="Mixto" value={money(income.mixto)} /> : null}
          <Row label="Total" value={money(received)} strong />
        </div>
        <div className="rounded-lg border border-slate-200 px-3 py-2">
          <p className="mb-1 text-xs font-bold uppercase tracking-wide text-slate-500">Lo que debería haber</p>
          <Row label="Caja inicial" value={money(openingAmount)} />
          <Row label="Ventas del día (todos los métodos)" value={`+ ${money(income.total)}`} />
          <Row label="Gastos" value={`− ${money(detail.cash_expenses)}`} hint="Los gastos que se registraron en la caja" />
          <Row label="Comisiones pagadas del efectivo" value={`− ${money(commissions)}`} />
          <Row label="Extras y bonos del efectivo" value={`− ${money(extras)}`} />
          <Row label="Total" value={money(expected)} strong />
        </div>
      </div>
      <p className="mt-3 rounded-lg bg-slate-100 px-3 py-2 text-center text-sm font-semibold text-slate-900">{verdict}</p>
    </div>
  );
}
