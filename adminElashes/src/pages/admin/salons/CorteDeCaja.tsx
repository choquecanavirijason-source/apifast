import { useCallback, useEffect, useState } from "react";
import { Banknote, Download, Filter, TrendingDown, TrendingUp } from "lucide-react";
import Layout from "@/components/common/layout";
import FilterActionBar from "@/components/common/FilterActionBar";
import { Button, SectionCard, StatCard } from "@/components/common/ui";
import { ExpenseService, type CashSummary } from "@/core/services/expense/expense.service";
import { BranchService } from "@/core/services/branch/branch.service";
import { BRANCH_STORAGE_KEY, getSelectedBranchId } from "@/core/utils/branch";
import { generateTablePdf } from "@/core/utils/generateTablePdf";

const fieldClass =
  "w-full rounded-sm border border-[#8a8886] bg-white px-3 py-2 text-sm text-[#323130] outline-none transition focus:border-[#0078d4] focus:ring-1 focus:ring-[#0078d4]/35";

const moneyFormatter = new Intl.NumberFormat("es-BO", {
  style: "currency",
  currency: "BOB",
  maximumFractionDigits: 2,
});

const money = (n: number) => moneyFormatter.format(n);

export default function CorteDeCaja() {
  const [branchId, setBranchId] = useState<number | null>(() => getSelectedBranchId());
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [summary, setSummary] = useState<CashSummary | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [branchName, setBranchName] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await ExpenseService.getCashSummary({
        branch_id: branchId ?? undefined,
        start_date: startDate || undefined,
        end_date: endDate || undefined,
      });
      setSummary(data);
    } catch {
      setError("No se pudo cargar el corte de caja.");
      setSummary(null);
    } finally {
      setIsLoading(false);
    }
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

  const dateRangeLabel = startDate || endDate
    ? `${startDate ? new Date(startDate).toLocaleDateString("es-BO") : "inicio"} — ${endDate ? new Date(endDate).toLocaleDateString("es-BO") : "hoy"}`
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
        { seccion: "Dinero en caja", concepto: "Ventas en efectivo", monto: money(summary.cash_in_register.ventas_efectivo) },
        { seccion: "Dinero en caja", concepto: "Gastos en efectivo", monto: money(summary.cash_in_register.gastos_efectivo) },
        { seccion: "Dinero en caja", concepto: "Saldo", monto: money(summary.cash_in_register.saldo) },
        { seccion: "Ingresos por método", concepto: "Efectivo", monto: money(summary.income_by_method.efectivo) },
        { seccion: "Ingresos por método", concepto: "Tarjeta", monto: money(summary.income_by_method.tarjeta) },
        { seccion: "Ingresos por método", concepto: "Transferencia", monto: money(summary.income_by_method.transferencia) },
        { seccion: "Ingresos por método", concepto: "QR", monto: money(summary.income_by_method.qr) },
        { seccion: "Ingresos por método", concepto: "Total ingresos", monto: money(summary.income_by_method.total) },
        { seccion: "Gastos", concepto: "Gastos", monto: money(summary.expenses.gastos) },
        { seccion: "Gastos", concepto: "Total egresos", monto: money(summary.expenses.total) },
      ],
    });
  };

  return (
    <Layout
      title="Corte de Caja"
      subtitle="Ingresos por método de pago y gastos, para la sucursal y el rango de fechas elegidos arriba."
      variant="cards"
      toolbar={
        <FilterActionBar
          left={<span className="text-xs font-semibold text-slate-600">Sucursal activa: la del selector de arriba</span>}
          right={
            <div className="flex items-center gap-2">
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
        <div className="grid gap-3 rounded-sm border border-[#d2d0ce] bg-[#faf9f8] p-3 sm:grid-cols-3">
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-[#605e5c]">Fecha inicio</label>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={`${fieldClass} mt-1`} />
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-[#605e5c]">Fecha fin</label>
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
          <SectionCard title="Dinero en caja" actions={<Banknote className="h-4 w-4 text-emerald-600" />}>
            <div className="space-y-2">
              <StatCard label="Ventas en efectivo" value={money(summary.cash_in_register.ventas_efectivo)} tone="emerald" />
              <StatCard label="Gastos en efectivo" value={money(summary.cash_in_register.gastos_efectivo)} tone="rose" />
              <StatCard label="Saldo" value={money(summary.cash_in_register.saldo)} tone="blue" />
            </div>
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
              <StatCard label="Gastos" value={money(summary.expenses.gastos)} tone="rose" />
              <StatCard label="Total egresos" value={money(summary.expenses.total)} tone="rose" />
            </div>
          </SectionCard>
        </div>
      )}

      {isLoading ? <p className="text-sm text-slate-500">Cargando…</p> : null}
    </Layout>
  );
}
