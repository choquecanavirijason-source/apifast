import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Gift, Trash2, X } from "lucide-react";
import { toast } from "react-toastify";
import Layout from "@/components/common/layout";
import FilterActionBar from "@/components/common/FilterActionBar";
import { Button, SectionCard, StatCard } from "@/components/common/ui";
import DataTable, { type DataTableColumn } from "@/components/common/table/DataTable";
import { OperatorBonusService, type OperatorBonusOut } from "@/core/services/expense/expense.service";
import useAuth from "@/core/hooks/useAuth";
import { getApiErrorMessage } from "@/core/utils/apiError";
import { BRANCH_STORAGE_KEY, getSelectedBranchId } from "@/core/utils/branch";
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

/**
 * Extras y bonos a operarias (Ventas y caja › Extras y bonos). Mismos datos
 * que la lista de Corte de Caja: lo que se registra aquí cuenta como egreso
 * ("Extras / Bonificaciones") y baja el saldo del corte en esas fechas.
 */
export default function ExtrasYBonos() {
  const { isAdmin, hasPermissionByName } = useAuth();
  const canManage = isAdmin() || hasPermissionByName("payments:manage");

  const [branchId, setBranchId] = useState<number | null>(() => getSelectedBranchId());
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [professionalFilter, setProfessionalFilter] = useState("");
  const [bonuses, setBonuses] = useState<OperatorBonusOut[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      setBonuses(
        await OperatorBonusService.list({
          branch_id: branchId ?? undefined,
          from_date: fromDate || undefined,
          to_date: toDate || undefined,
        }),
      );
    } catch (err) {
      setBonuses([]);
      setError(getApiErrorMessage(err, "No se pudo cargar los extras."));
    } finally {
      setIsLoading(false);
    }
  }, [branchId, fromDate, toDate]);

  useEffect(() => { void load(); }, [load]);

  // Misma sucursal que el selector global de la cabecera.
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

  const professionals = useMemo(
    () => Array.from(new Set(bonuses.map((b) => b.professional_name))).sort((a, b) => a.localeCompare(b)),
    [bonuses],
  );

  const visible = useMemo(
    () => (professionalFilter ? bonuses.filter((b) => b.professional_name === professionalFilter) : bonuses),
    [bonuses, professionalFilter],
  );

  const total = useMemo(() => visible.reduce((s, b) => s + b.amount, 0), [visible]);

  const handleDelete = useCallback(async (bonus: OperatorBonusOut) => {
    if (!confirm(`¿Eliminar el extra de ${money(bonus.amount)} a ${bonus.professional_name}?`)) return;
    setDeletingId(bonus.id);
    try {
      await OperatorBonusService.remove(bonus.id);
      setBonuses((current) => current.filter((b) => b.id !== bonus.id));
      toast.success("Extra eliminado.");
    } catch (err) {
      toast.error(getApiErrorMessage(err, "No se pudo eliminar el extra."));
    } finally {
      setDeletingId(null);
    }
  }, []);

  const columns = useMemo<DataTableColumn<OperatorBonusOut>[]>(() => [
    {
      key: "bonus_date",
      header: "Fecha",
      sortable: true,
      getValue: (b) => b.bonus_date,
      render: (b) => <span className="text-xs font-medium tabular-nums">{formatDay(b.bonus_date)}</span>,
    },
    {
      key: "professional_name",
      header: "Operaria",
      sortable: true,
      render: (b) => <span className="font-semibold text-[var(--ui-text)]">{b.professional_name}</span>,
    },
    {
      key: "amount",
      header: "Monto",
      sortable: true,
      getValue: (b) => b.amount,
      render: (b) => <span className="text-xs font-semibold tabular-nums text-[var(--ui-accent)]">{money(b.amount)}</span>,
    },
    {
      key: "reason",
      header: "Motivo",
      render: (b) => (
        <span className="line-clamp-2 max-w-[28rem] text-xs text-[var(--ui-text)]" title={b.reason}>{b.reason}</span>
      ),
    },
    {
      key: "branch_name",
      header: "Sucursal",
      sortable: true,
      getValue: (b) => b.branch_name ?? "",
      render: (b) => <span className="text-xs text-[var(--ui-text-muted)]">{b.branch_name ?? "—"}</span>,
    },
    {
      key: "created_by_name",
      header: "Registrado por",
      getValue: (b) => b.created_by_name ?? "",
      render: (b) => <span className="text-xs text-[var(--ui-text-muted)]">{b.created_by_name ?? "—"}</span>,
    },
    ...(canManage
      ? [
          {
            key: "acciones",
            header: "",
            render: (b: OperatorBonusOut) => (
              <button
                type="button"
                onClick={() => void handleDelete(b)}
                disabled={deletingId === b.id}
                className="rounded p-1 text-[var(--ui-text-muted)] transition-colors hover:bg-rose-50 hover:text-rose-600 disabled:opacity-40"
                title="Eliminar extra"
                aria-label={`Eliminar extra de ${b.professional_name}`}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            ),
          } satisfies DataTableColumn<OperatorBonusOut>,
        ]
      : []),
  ], [canManage, deletingId, handleDelete]);

  const hasFilters = Boolean(fromDate || toDate || professionalFilter);

  return (
    <Layout
      title="Extras y bonos"
      subtitle="Incentivos y bonificaciones a operarias. Cuentan como egreso en el Corte de caja de su fecha."
      variant="cards"
      toolbar={
        <FilterActionBar
          left={<span className="text-xs font-semibold text-slate-600">Sucursal activa: la del selector de arriba</span>}
          right={
            <div className="flex items-center gap-2">
              {canManage && (
                <Button size="sm" onClick={() => setModalOpen(true)} leftIcon={<Gift className="h-3.5 w-3.5" />}>
                  Registrar Extra / Bono
                </Button>
              )}
              <Button variant="secondary" size="sm" onClick={() => void load()}>Actualizar</Button>
            </div>
          }
        />
      }
    >
      <SectionCard bodyClassName="!p-4">
        <div className="grid gap-3 rounded-lg border border-[var(--ui-border-strong)] bg-[var(--ui-surface-muted)] p-3 sm:grid-cols-4">
          <div>
            <label className="text-xs font-semibold text-[var(--ui-text-muted)]">Desde</label>
            <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className={`${fieldClass} mt-1`} />
          </div>
          <div>
            <label className="text-xs font-semibold text-[var(--ui-text-muted)]">Hasta</label>
            <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className={`${fieldClass} mt-1`} />
          </div>
          <div>
            <label className="text-xs font-semibold text-[var(--ui-text-muted)]">Operaria</label>
            <select
              value={professionalFilter}
              onChange={(e) => setProfessionalFilter(e.target.value)}
              className={`${fieldClass} mt-1`}
            >
              <option value="">Todas</option>
              {professionals.map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <Button
              variant="secondary"
              className="w-full"
              disabled={!hasFilters}
              onClick={() => { setFromDate(""); setToDate(""); setProfessionalFilter(""); }}
              leftIcon={<X className="h-3.5 w-3.5" />}
            >
              Limpiar filtros
            </Button>
          </div>
        </div>
      </SectionCard>

      <div className="grid grid-cols-2 gap-3 sm:max-w-md">
        <StatCard label="Extras en el período" value={visible.length} tone="slate" />
        <StatCard label="Total" value={money(total)} tone="emerald" />
      </div>

      {error ? <p className="text-sm text-rose-600">{error}</p> : null}

      <SectionCard bodyClassName="!p-0">
        <DataTable
          data={visible}
          columns={columns}
          loading={isLoading}
          enableGlobalSearch={false}
          enableColumnFilters={false}
          defaultLimit={25}
        />
      </SectionCard>

      <p className="text-xs text-[var(--ui-text-muted)]">
        Para ver cómo afectan al saldo, abre el{" "}
        <Link to="/admin/salons/corte-caja" className="font-semibold text-[var(--ui-accent)] hover:underline">
          Corte de caja
        </Link>{" "}
        con el mismo rango de fechas.
      </p>

      <RegisterBonusModal
        isOpen={modalOpen}
        branchId={branchId}
        onClose={() => setModalOpen(false)}
        onSaved={() => { setModalOpen(false); void load(); }}
      />
    </Layout>
  );
}
