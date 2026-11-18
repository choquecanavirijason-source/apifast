import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Banknote, CheckCircle } from "lucide-react";
import { AgendaService, type TicketItem } from "@/core/services/agenda/agenda.service";
import useAuth from "@/core/hooks/useAuth";
import { getTicketCommission } from "../../professionals/professionalCommission.utils";

const money = (value: number) =>
  new Intl.NumberFormat("es-BO", { style: "currency", currency: "BOB", maximumFractionDigits: 2 }).format(value);

/** Fecha local de hoy en YYYY-MM-DD (toISOString daría la de UTC). */
const todayLocal = () => new Date().toLocaleDateString("en-CA");

/**
 * Antes de cerrar la caja: cuánto falta pagarles hoy a las operarias. Un botón lleva a Comisiones y pagos
 * con el día de hoy ya filtrado, para pagar ahí (del efectivo de la caja, normalmente).
 */
export default function PendingCommissionsToday({ branchId }: { branchId: number | null }) {
  const navigate = useNavigate();
  const { isAdmin, hasPermissionByName } = useAuth();
  const canPay = isAdmin() || hasPermissionByName("commissions:pay");
  const [tickets, setTickets] = useState<TicketItem[] | null>(null);
  const today = todayLocal();

  useEffect(() => {
    if (!canPay) return;
    let cancelled = false;
    AgendaService.listTickets({ limit: 500, branch_id: branchId ?? undefined, start_date: today, end_date: today })
      .then((rows) => { if (!cancelled) setTickets(rows); })
      .catch(() => { if (!cancelled) setTickets([]); });
    return () => { cancelled = true; };
  }, [canPay, branchId, today]);

  const summary = useMemo(() => {
    const byPro = new Map<string, number>();
    let services = 0;
    for (const t of tickets ?? []) {
      if (t.status !== "completed" || t.pagado || !t.professional_id) continue;
      const commission = getTicketCommission(t);
      if (commission <= 0) continue;
      services += 1;
      const name = t.professional_name ?? `#${t.professional_id}`;
      byPro.set(name, (byPro.get(name) ?? 0) + commission);
    }
    const rows = Array.from(byPro.entries()).sort((a, b) => b[1] - a[1]);
    return { rows, services, total: rows.reduce((sum, [, amount]) => sum + amount, 0) };
  }, [tickets]);

  if (!canPay || tickets === null) return null;

  return (
    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-[var(--ui-border-strong)] bg-white px-4 py-3">
      <div>
        <p className="text-xs font-semibold text-[var(--ui-text)]">Comisiones de hoy por pagar</p>
        {summary.rows.length === 0 ? (
          <p className="mt-0.5 flex items-center gap-1 text-xs text-[var(--ui-text-muted)]">
            <CheckCircle className="h-3.5 w-3.5" /> No hay comisiones pendientes de hoy.
          </p>
        ) : (
          <>
            <p className="text-lg font-bold tabular-nums text-[var(--ui-text)]">{money(summary.total)}</p>
            <span className="text-xs text-[var(--ui-text-muted)]">
              {summary.rows.length} operaria{summary.rows.length !== 1 ? "s" : ""} · {summary.services} servicio
              {summary.services !== 1 ? "s" : ""}
            </span>
          </>
        )}
      </div>
      {summary.rows.length > 0 ? (
        <>
          <ul className="flex min-w-0 flex-1 flex-wrap gap-1.5">
            {summary.rows.slice(0, 6).map(([name, amount]) => (
              <li key={name} className="rounded-full border border-slate-200 px-2.5 py-1 text-[11px] text-slate-700">
                <span className="font-medium">{name}</span> · {money(amount)}
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() => navigate(`/admin/professionals/history?tab=comisiones&desde=${today}&hasta=${today}`)}
            className="ml-auto inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-slate-700"
          >
            <Banknote className="h-3.5 w-3.5" />
            Pagar comisiones de hoy
          </button>
        </>
      ) : null}
    </div>
  );
}
