import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCw, TrendingUp } from "lucide-react";
import { toast } from "react-toastify";
import { DashboardService, type RevenueSeriesItem } from "../../../core/services/dashboard/dashboard.service";
import { BRANCH_STORAGE_KEY, getSelectedBranchId } from "../../../core/utils/branch";

const moneyFormatter = new Intl.NumberFormat("es-BO", {
  style: "currency",
  currency: "BOB",
  maximumFractionDigits: 2,
});

const DAY_SHORT: Record<number, string> = { 0: "Dom", 1: "Lun", 2: "Mar", 3: "Mié", 4: "Jue", 5: "Vie", 6: "Sáb" };

function isoToday() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function addDays(iso: string, n: number) {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function mondayOfWeek(iso: string) {
  const d = new Date(`${iso}T00:00:00`);
  const diff = d.getDay() === 0 ? -6 : 1 - d.getDay();
  d.setDate(d.getDate() + diff);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

type ViewMode = "day" | "week";

interface DisplayRow {
  label: string;
  sublabel?: string;
  paid_amount: number;
  payments_count: number;
}

export default function CashFlowPage() {
  const [viewMode, setViewMode] = useState<ViewMode>("day");
  const [series, setSeries] = useState<RevenueSeriesItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [rangeStart, setRangeStart] = useState(() => addDays(isoToday(), -13));
  const [rangeEnd, setRangeEnd] = useState(isoToday);
  const [activeBranchId, setActiveBranchId] = useState<number | null>(() => getSelectedBranchId());

  useEffect(() => {
    const handleChange = () => setActiveBranchId(getSelectedBranchId());
    const handleStorage = (e: StorageEvent) => { if (e.key === BRANCH_STORAGE_KEY) handleChange(); };
    window.addEventListener("storage", handleStorage);
    window.addEventListener("branchchange", handleChange);
    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("branchchange", handleChange);
    };
  }, []);

  const loadData = useCallback(async () => {
    if (!rangeStart || !rangeEnd) return;
    setIsLoading(true);
    try {
      const result = await DashboardService.getRevenueSeries({
        from: rangeStart,
        to: rangeEnd,
        branch_id: activeBranchId ?? undefined,
        group_by: "day",
      });
      setSeries(result.series);
    } catch (error) {
      console.error(error);
      toast.error("No se pudo cargar el flujo de caja.");
    } finally {
      setIsLoading(false);
    }
  }, [rangeStart, rangeEnd, activeBranchId]);

  useEffect(() => { void loadData(); }, [loadData]);

  const displayRows: DisplayRow[] = useMemo(() => {
    if (viewMode === "day") {
      return series.map((item) => {
        const d = new Date(`${item.bucket}T00:00:00`);
        return {
          label: item.bucket,
          sublabel: DAY_SHORT[d.getDay()],
          paid_amount: item.paid_amount,
          payments_count: item.payments_count,
        };
      });
    }

    const weekMap = new Map<string, DisplayRow>();
    series.forEach((item) => {
      const monday = mondayOfWeek(item.bucket);
      const sunday = addDays(monday, 6);
      if (!weekMap.has(monday)) {
        weekMap.set(monday, {
          label: `${monday} — ${sunday}`,
          paid_amount: 0,
          payments_count: 0,
        });
      }
      const row = weekMap.get(monday)!;
      row.paid_amount += item.paid_amount;
      row.payments_count += item.payments_count;
    });
    return Array.from(weekMap.values());
  }, [series, viewMode]);

  const totalAmount = useMemo(() => displayRows.reduce((s, r) => s + r.paid_amount, 0), [displayRows]);
  const totalCount = useMemo(() => displayRows.reduce((s, r) => s + r.payments_count, 0), [displayRows]);
  const maxAmount = useMemo(() => Math.max(...displayRows.map((r) => r.paid_amount), 1), [displayRows]);
  const avgAmount = displayRows.length > 0 ? totalAmount / displayRows.length : 0;

  const setThisWeek = () => {
    const today = isoToday();
    setRangeStart(mondayOfWeek(today));
    setRangeEnd(today);
  };

  const setLast30 = () => {
    setRangeStart(addDays(isoToday(), -29));
    setRangeEnd(isoToday());
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto pb-6">
      {/* Controls bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600">
            <TrendingUp className="h-4 w-4" />
          </div>
          <span className="text-sm font-bold text-slate-800">Flujo de Caja</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* Quick range buttons */}
          <button
            type="button"
            onClick={setThisWeek}
            className="h-7 rounded-md border border-slate-200 bg-slate-50 px-2.5 text-xs font-medium text-slate-600 hover:bg-slate-100"
          >
            Esta semana
          </button>
          <button
            type="button"
            onClick={setLast30}
            className="h-7 rounded-md border border-slate-200 bg-slate-50 px-2.5 text-xs font-medium text-slate-600 hover:bg-slate-100"
          >
            Últimos 30 días
          </button>
          <label className="flex items-center gap-1 text-xs text-slate-500">
            Desde
            <input
              type="date"
              value={rangeStart}
              onChange={(e) => setRangeStart(e.target.value)}
              className="h-7 rounded-md border border-slate-300 px-1.5 text-xs text-slate-700 focus:border-emerald-400 focus:outline-none"
            />
          </label>
          <label className="flex items-center gap-1 text-xs text-slate-500">
            Hasta
            <input
              type="date"
              value={rangeEnd}
              onChange={(e) => setRangeEnd(e.target.value)}
              className="h-7 rounded-md border border-slate-300 px-1.5 text-xs text-slate-700 focus:border-emerald-400 focus:outline-none"
            />
          </label>
          <button
            type="button"
            onClick={() => void loadData()}
            disabled={isLoading}
            className="flex h-7 items-center gap-1 rounded-md border border-emerald-300 bg-emerald-50 px-3 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-60"
          >
            <RefreshCw className={`h-3 w-3 ${isLoading ? "animate-spin" : ""}`} />
            Actualizar
          </button>
          {/* Day / Week toggle */}
          <div className="flex rounded-lg border border-slate-200 bg-slate-100 p-0.5">
            {(["day", "week"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setViewMode(mode)}
                className={`rounded-md px-3 py-1 text-xs font-semibold transition-all ${
                  viewMode === mode
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                {mode === "day" ? "Por día" : "Por semana"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-600">Total ingresos</p>
          <p className="mt-0.5 text-xl font-bold text-emerald-900">{moneyFormatter.format(totalAmount)}</p>
        </div>
        <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-blue-600">Total cobros</p>
          <p className="mt-0.5 text-xl font-bold text-blue-900">{totalCount}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Promedio por {viewMode === "day" ? "día" : "semana"}
          </p>
          <p className="mt-0.5 text-xl font-bold text-slate-800">
            {displayRows.length > 0 ? moneyFormatter.format(avgAmount) : "—"}
          </p>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        {isLoading ? (
          <div className="flex h-48 items-center justify-center gap-2 text-sm text-slate-400">
            <RefreshCw className="h-4 w-4 animate-spin" />
            Cargando datos...
          </div>
        ) : displayRows.length === 0 ? (
          <div className="flex h-48 flex-col items-center justify-center gap-1 text-sm text-slate-400">
            <TrendingUp className="h-8 w-8 opacity-30" />
            Sin registros en el rango seleccionado.
          </div>
        ) : (
          <table className="w-full min-w-[520px] text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <th className="px-4 py-3">{viewMode === "day" ? "Fecha" : "Semana"}</th>
                <th className="px-4 py-3 text-right">Ingresos</th>
                <th className="px-4 py-3 text-right">Cobros</th>
                <th className="w-40 px-4 py-3">Distribución</th>
              </tr>
            </thead>
            <tbody>
              {displayRows.map((row, i) => (
                <tr key={i} className="border-b border-slate-50 transition hover:bg-slate-50/70">
                  <td className="px-4 py-2.5">
                    <span className="font-medium text-slate-700">{row.label}</span>
                    {row.sublabel ? (
                      <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">
                        {row.sublabel}
                      </span>
                    ) : null}
                  </td>
                  <td className={`px-4 py-2.5 text-right font-semibold tabular-nums ${row.paid_amount > 0 ? "text-emerald-700" : "text-slate-400"}`}>
                    {moneyFormatter.format(row.paid_amount)}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-slate-600">{row.payments_count}</td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-1.5">
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full bg-emerald-400 transition-all duration-300"
                          style={{ width: `${Math.round((row.paid_amount / maxAmount) * 100)}%` }}
                        />
                      </div>
                      <span className="w-8 text-right text-[10px] tabular-nums text-slate-400">
                        {Math.round((row.paid_amount / maxAmount) * 100)}%
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-slate-200 bg-slate-50">
                <td className="px-4 py-2.5 text-xs font-bold text-slate-600">
                  TOTAL — {displayRows.length} {viewMode === "day" ? "días" : "semanas"}
                </td>
                <td className="px-4 py-2.5 text-right text-sm font-bold tabular-nums text-emerald-700">
                  {moneyFormatter.format(totalAmount)}
                </td>
                <td className="px-4 py-2.5 text-right text-sm font-bold tabular-nums text-slate-700">{totalCount}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        )}
      </div>
    </div>
  );
}
