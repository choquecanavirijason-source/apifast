import { useCallback, useEffect, useState } from "react";
import { Download, Filter, Gift, Scale, Trash2, TrendingDown, TrendingUp } from "lucide-react";
import { toast } from "react-toastify";
import Layout from "@/components/common/layout";
import FilterActionBar from "@/components/common/FilterActionBar";
import { Button, SectionCard, StatCard } from "@/components/common/ui";
import {
  ExpenseService,
  OperatorBonusService,
  type CashSummary,
  type OperatorBonusOut,
} from "@/core/services/expense/expense.service";
import { BranchService } from "@/core/services/branch/branch.service";
import useAuth from "@/core/hooks/useAuth";
import { getApiErrorMessage } from "@/core/utils/apiError";
import { BRANCH_STORAGE_KEY, getSelectedBranchId } from "@/core/utils/branch";
import { generateTablePdf } from "@/core/utils/generateTablePdf";
import RegisterBonusModal from "./components/RegisterBonusModal";

const fieldClass =
  "w-full rounded-lg border border-[var(--ui-border-strong)] bg-white px-3 py-2 text-sm text-[var(--ui-text)] outline-none transition focus:border-brand-secondary focus:ring-1 focus:ring-brand-secondary/35";

const moneyFormatter = new Intl.NumberFormat("es-BO", {
  style: "currency",
  currency: "BOB",
  maximumFractionDigits: 2,
});

const money = (n: number) => moneyFormatter.format(n);

// "YYYY-MM-DD" -> "dd/mm/aaaa" sin pasar por Date (no se corre de día).
const formatDay = (iso: string) => {
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
};

export default function CorteDeCaja() {
  const { isAdmin, hasPermissionByName } = useAuth();
  const canManage = isAdmin() || hasPermissionByName("payments:manage");

  const [branchId, setBranchId] = useState<number | null>(() => getSelectedBranchId());
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [summary, setSummary] = useState<CashSummary | null>(null);
  const [bonuses, setBonuses] = useState<OperatorBonusOut[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [branchName, setBranchName] = useState<string | null>(null);
  const [bonusModalOpen, setBonusModalOpen] = useState(false);

  // Resumen y extras con los mismos filtros: cambiar fechas o sucursal
  // recalcula gastos, comisiones pagadas, extras y saldo de una vez.
  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    const [summaryResult, bonusesResult] = await Promise.allSettled([
      ExpenseService.getCashSummary({
        branch_id: branchId ?? undefined,
        start_date: startDate || undefined,
        end_date: endDate || undefined,
      }),
      OperatorBonusService.list({
        branch_id: branchId ?? undefined,
        from_date: startDate || undefined,
        to_date: endDate || undefined,
      }),
    ]);
    if (summaryResult.status === "fulfilled") {
      setSummary(summaryResult.value);
    } else {
      setError(getApiErrorMessage(summaryResult.reason, "No se pudo cargar el corte de caja."));
      setSummary(null);
    }
    setBonuses(bonusesResult.status === "fulfilled" ? bonusesResult.value : []);
    setIsLoading(false);
  }, [branchId, startDate, endDate]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (!branchId) {
      setBranchName(null);
      return;
    }
    BranchService.list({ limit: 200 })
      .then((branches) => setBranchName(branches.find((b) => b.id === branchId)?.name ?? null))
      .catch(() => setBranchName(null));
  }, [branchId]);

  useEffect(() => {
    const handleChange = () => setBranchId(getSelectedBranchId());
    const handleStorage = (e: StorageEvent) => { if (e.key === BRANCH_STORAGE_KEY) handleChange(); };
    window.addEventListener("storage", handleStorage);
    window.addEventListener("branchchange", handleChange);
    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("branchchange", handleChange);
    };
  }, []);

  const handleDeleteBonus = async (bonus: OperatorBonusOut) => {
    if (!confirm(`¿Eliminar el extra de ${money(bonus.amount)} a ${bonus.professional_name}?`)) return;
    try {
      await OperatorBonusService.remove(bonus.id);
      toast.success("Extra eliminado.");
      await load();
    } catch (err) {
      toast.error(getApiErrorMessage(err, "No se pudo eliminar el extra."));
    }
  };

  const dateRangeLabel = startDate || endDate
    ? `${startDate ? formatDay(startDate) : "inicio"} — ${endDate ? formatDay(endDate) : "hoy"}`
    : "Todo el período";

  const handleDownloadPdf = () => {
    if (!summary) return;
    void generateTablePdf({
      title: "Corte de Caja",
      subtitle: `${branchName ?? "Todas las sucursales"} · ${dateRangeLabel}`,
      filename: "corte-de-caja",
      columns: [
        { header: "Sección", key: "seccion" },
        { header: "Concepto", key: "concepto" },
        { header: "Monto", key: "monto" },
      ],
      rows: [
        { seccion: "Ingresos por método", concepto: "Efectivo", monto: money(summary.income_by_method.efectivo) },
        { seccion: "Ingresos por método", concepto: "Tarjeta", monto: money(summary.income_by_method.tarjeta) },
        { seccion: "Ingresos por método", concepto: "Transferencia", monto: money(summary.income_by_method.transferencia) },
        { seccion: "Ingresos por método", concepto: "QR", monto: money(summary.income_by_method.qr) },
        { seccion: "Ingresos por método", concepto: "Total ingresos", monto: money(summary.income_by_method.total) },
        { seccion: "Gastos", concepto: "Gastos generales", monto: money(summary.expenses.gastos) },
        { seccion: "Gastos", concepto: "Comisiones pagadas", monto: money(summary.expenses.comisiones_pagadas) },
        { seccion: "Gastos", concepto: "Extras / Bonificaciones", monto: money(summary.expenses.extras) },
        { seccion: "Gastos", concepto: "Total egresos", monto: money(summary.expenses.total) },
        ...bonuses.map((b) => ({
          seccion: "Detalle de extras",
          concepto: `${formatDay(b.bonus_date)} · ${b.professional_name} · ${b.reason}`,
          monto: money(b.amount),
        })),
        { seccion: "Balance", concepto: "Total ingresos", monto: money(summary.balance.total_ingresos) },
        { seccion: "Balance", concepto: "Total egresos", monto: money(summary.balance.total_egresos) },
        { seccion: "Balance", concepto: "Saldo en caja", monto: money(summary.balance.saldo) },
      ],
    });
  };

  return (
    <Layout
      title="Corte de Caja"
      subtitle="Ingresos por método de pago y egresos (gastos, comisiones pagadas y extras a operarias), para la sucursal y el rango de fechas elegidos."
      variant="cards"
      toolbar={
        <FilterActionBar
          left={<span className="text-xs font-semibold text-slate-600">Sucursal activa: la del selector de arriba</span>}
          right={
            <div className="flex items-center gap-2">
              {canManage && (
                <Button
                  size="sm"
                  onClick={() => setBonusModalOpen(true)}
                  leftIcon={<Gift className="h-3.5 w-3.5" />}
                >
                  Registrar Extra / Bono
                </Button>
              )}
              <Button
                variant="secondary"
                size="sm"
                onClick={handleDownloadPdf}
                disabled={!summary}
                leftIcon={<Download className="h-3.5 w-3.5" />}
              >
                PDF
              </Button>
              <Button variant="secondary" size="sm" onClick={() => void load()}>Actualizar</Button>
            </div>
          }
        />
      }
    >
      <SectionCard bodyClassName="!p-4">
        <div className="grid gap-3 rounded-lg border border-[var(--ui-border-strong)] bg-[var(--ui-surface-muted)] p-3 sm:grid-cols-3">
          <div>
            <label className="text-xs font-semibold text-[var(--ui-text-muted)]">Fecha inicio</label>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={`${fieldClass} mt-1`} />
          </div>
          <div>
            <label className="text-xs font-semibold text-[var(--ui-text-muted)]">Fecha fin</label>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className={`${fieldClass} mt-1`} />
          </div>
          <div className="flex items-end">
            <Button onClick={() => void load()} leftIcon={<Filter className="h-3.5 w-3.5" />} className="w-full">
              Filtrar
            </Button>
          </div>
        </div>
      </SectionCard>

      {error ? <p className="text-sm text-rose-600">{error}</p> : null}

      {summary && (
        <div className="grid gap-4 lg:grid-cols-3">
          <SectionCard title="Balance final de caja" actions={<Scale className="h-4 w-4 text-emerald-600" />}>
            <div className="space-y-2">
              <StatCard label="Total ingresos" value={money(summary.balance.total_ingresos)} tone="emerald" />
              <StatCard label="Total egresos" value={money(summary.balance.total_egresos)} tone="rose" />
              <StatCard
                label="Saldo en caja"
                value={money(summary.balance.saldo)}
                tone={summary.balance.saldo < 0 ? "rose" : "blue"}
              />
            </div>
            <p className="mt-2 text-[11px] text-[var(--ui-text-muted)]">
              Saldo = total ingresos − (gastos + comisiones pagadas + extras).
            </p>
          </SectionCard>

          <SectionCard title="Ingresos por método" actions={<TrendingUp className="h-4 w-4 text-blue-600" />}>
            <div className="space-y-2">
              <StatCard label="Efectivo" value={money(summary.income_by_method.efectivo)} tone="slate" />
              <StatCard label="Tarjeta" value={money(summary.income_by_method.tarjeta)} tone="slate" />
              <StatCard label="Transferencia" value={money(summary.income_by_method.transferencia)} tone="slate" />
              <StatCard label="QR" value={money(summary.income_by_method.qr)} tone="slate" />
              <StatCard label="Total ingresos" value={money(summary.income_by_method.total)} tone="emerald" />
            </div>
          </SectionCard>

          <SectionCard title="Gastos" actions={<TrendingDown className="h-4 w-4 text-rose-600" />}>
            <div className="space-y-2">
              <StatCard label="Gastos generales" value={money(summary.expenses.gastos)} tone="slate" />
              <StatCard label="Comisiones pagadas" value={money(summary.expenses.comisiones_pagadas)} tone="slate" />
              <StatCard label="Extras / Bonificaciones" value={money(summary.expenses.extras)} tone="slate" />
              <StatCard label="Total egresos" value={money(summary.expenses.total)} tone="rose" />
            </div>
            <p className="mt-2 text-[11px] text-[var(--ui-text-muted)]">
              Comisiones pagadas: tickets marcados como "Pagado" en Equipo, por fecha de pago.
            </p>
          </SectionCard>
        </div>
      )}

      {summary && (
        <SectionCard
          title="Extras / Bonificaciones del período"
          actions={<Gift className="h-4 w-4 text-[var(--ui-accent)]" />}
          bodyClassName="!p-0"
        >
          {bonuses.length === 0 ? (
            <p className="p-4 text-sm text-[var(--ui-text-muted)]">No hay extras registrados en este rango.</p>
          ) : (
            <ul className="divide-y divide-[var(--ui-border)]">
              {bonuses.map((b) => (
                <li key={b.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                  <div className="min-w-0">
                    <p className="font-semibold text-[var(--ui-text)]">
                      {b.professional_name}
                      <span className="ml-2 text-xs font-normal text-[var(--ui-text-muted)]">
                        {formatDay(b.bonus_date)}
                        {b.branch_name ? ` · ${b.branch_name}` : ""}
                        {b.created_by_name ? ` · por ${b.created_by_name}` : ""}
                      </span>
                    </p>
                    <p className="truncate text-xs text-[var(--ui-text-muted)]" title={b.reason}>{b.reason}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="font-semibold tabular-nums text-[var(--ui-text)]">{money(b.amount)}</span>
                    {canManage && (
                      <button
                        type="button"
                        onClick={() => void handleDeleteBonus(b)}
                        className="rounded p-1 text-[var(--ui-text-muted)] transition-colors hover:bg-rose-50 hover:text-rose-600"
                        title="Eliminar extra"
                        aria-label={`Eliminar extra de ${b.professional_name}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      )}

      {isLoading ? <p className="text-sm text-slate-500">Cargando…</p> : null}

      <RegisterBonusModal
        isOpen={bonusModalOpen}
        branchId={branchId}
        onClose={() => setBonusModalOpen(false)}
        onSaved={() => { setBonusModalOpen(false); void load(); }}
      />
    </Layout>
  );
}
