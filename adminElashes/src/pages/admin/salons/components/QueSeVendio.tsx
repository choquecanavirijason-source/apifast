import type { CashSessionDetail } from "@/core/services/cash-session/cash-session.service";

const money = (value: number) =>
  new Intl.NumberFormat("es-BO", { style: "currency", currency: "BOB", maximumFractionDigits: 2 }).format(value);

function Line({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`flex items-baseline justify-between gap-3 py-1 ${strong ? "mt-1 border-t border-slate-300 pt-2 font-bold text-slate-900" : "text-slate-700"}`}>
      <span className="text-xs">{label}</span>
      <span className={`tabular-nums ${strong ? "text-sm" : "text-xs font-medium"}`}>{value}</span>
    </div>
  );
}

/**
 * "Qué se vendió": dos tarjetas (servicios realizados y productos vendidos) con cantidad y monto, como el diario del
 * cuaderno. Se usa en el resumen de la caja abierta y en el detalle de cada sesión del historial.
 * Devuelve las dos tarjetas sueltas para que quien la use las acomode en su cuadrícula.
 */
export default function QueSeVendio({ detail }: { detail: CashSessionDetail }) {
  const services = detail.services_sold ?? [];
  const products = detail.products_sold ?? [];
  return (
    <>
      <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
        <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-slate-500">Servicios realizados</p>
        {services.length === 0 ? (
          <p className="py-1.5 text-xs text-slate-400">No hay servicios cobrados.</p>
        ) : (
          <>
            {services.map((row) => (
              <Line key={row.service_id} label={`${row.name} × ${row.count}`} value={money(row.total)} />
            ))}
            <Line
              label={`Total · ${services.reduce((sum, row) => sum + row.count, 0)} servicios`}
              value={money(services.reduce((sum, row) => sum + row.total, 0))}
              strong
            />
          </>
        )}
      </div>
      <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
        <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-slate-500">Productos vendidos</p>
        {products.length === 0 ? (
          <p className="py-1.5 text-xs text-slate-400">No se vendió ningún producto.</p>
        ) : (
          <>
            {products.map((row) => (
              <Line key={row.product_id} label={`${row.name} × ${row.quantity}`} value={money(row.total)} />
            ))}
            <Line
              label={`Total · ${products.reduce((sum, row) => sum + row.quantity, 0)} unidades`}
              value={money(products.reduce((sum, row) => sum + row.total, 0))}
              strong
            />
          </>
        )}
      </div>
    </>
  );
}
