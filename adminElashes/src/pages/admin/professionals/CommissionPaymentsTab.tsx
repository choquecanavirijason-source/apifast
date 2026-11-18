import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle, Plus, X, ChevronDown, ChevronUp, Banknote, RefreshCw, Info } from "lucide-react";
import { toast } from "react-toastify";
import type { ProfessionalForSelect, TicketItem } from "@/core/services/agenda/agenda.service";
import { CommissionPaymentsService, type CommissionPaymentOut } from "@/core/services/commission-payments/commission-payments.service";
import { Button } from "@/components/common/ui";
import {
  getTicketCommission,
  getTicketPriceTotal,
} from "./professionalCommission.utils";
import type { CommissionExportRow, CommissionExportTotals } from "./History";

const moneyFmt = new Intl.NumberFormat("es-BO", {
  style: "currency",
  currency: "BOB",
  maximumFractionDigits: 2,
});

const dateFmt = (iso: string) =>
  iso
    ? new Date(iso).toLocaleDateString("es-BO", { day: "2-digit", month: "short", year: "numeric" })
    : "—";

function getInitials(name: string) {
  return name.split(" ").map((w) => w[0] ?? "").join("").toUpperCase().slice(0, 2);
}

// ─── Detalle agrupado por pagos ───────────────────────────────────────────────

const dateTimeFmt = (iso: string) =>
  iso
    ? new Date(iso).toLocaleString("es-BO", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
    : "—";

const serviceLabel = (t: TicketItem) => (t.service_names?.length ? t.service_names.join(", ") : (t.service_name ?? "—"));

function ServicesTable({ tickets, amountOf }: { tickets: TicketItem[]; amountOf: (t: TicketItem) => number }) {
  return (
    <div className="max-h-72 overflow-auto rounded-lg border border-slate-200 bg-white">
      <table className="w-full min-w-[520px] border-collapse text-xs">
        <thead>
          <tr className="sticky top-0 bg-slate-50 text-left text-slate-500">
            <th className="px-3 py-2 font-semibold">Cliente</th>
            <th className="px-3 py-2 font-semibold">Servicio</th>
            <th className="px-3 py-2 font-semibold">Atendido</th>
            <th className="px-3 py-2 text-right font-semibold">Comisión</th>
          </tr>
        </thead>
        <tbody>
          {tickets.map((t) => (
            <tr key={t.id} className="border-t border-slate-100">
              <td className="px-3 py-2 font-medium text-slate-800">{t.client_name || "—"}</td>
              <td className="px-3 py-2 text-slate-600">{serviceLabel(t)}</td>
              <td className="whitespace-nowrap px-3 py-2 text-slate-500">{dateTimeFmt(t.start_time)}</td>
              <td className="px-3 py-2 text-right font-semibold tabular-nums text-slate-800">{moneyFmt.format(amountOf(t))}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Detalle de una operaria ordenado por PAGOS: cada pago (cuándo, quién lo hizo y cuánto) es un desplegable que
 * muestra los servicios que cubrió, y aparte queda lo que todavía no se le pagó.
 */
function PaymentGroups({
  payments,
  tickets,
  loading,
  onDelete,
}: {
  payments: CommissionPaymentOut[];
  tickets: TicketItem[];
  loading: boolean;
  onDelete: (id: number) => void;
}) {
  const completed = tickets.filter((t) => t.status === "completed");
  const unpaid = completed.filter((t) => !t.pagado);
  const unpaidTotal = unpaid.reduce((sum, t) => sum + getTicketCommission(t), 0);
  const byPayment = new Map<number, TicketItem[]>();
  for (const t of completed) {
    if (t.pagado && t.commission_payment_id != null) {
      byPayment.set(t.commission_payment_id, [...(byPayment.get(t.commission_payment_id) ?? []), t]);
    }
  }

  return (
    <div className="space-y-4">
      {/* Pagos ya hechos */}
      <div>
        <p className="text-xs font-semibold text-slate-700">Pagos realizados</p>
        <p className="mb-2 text-[11px] text-slate-400">
          Toca un pago para ver qué servicios cubrió. Si eliminas uno por error, ese monto vuelve a quedar como pendiente.
        </p>
        {loading ? (
          <p className="flex items-center gap-1 text-xs text-slate-400">
            <RefreshCw className="h-3 w-3 animate-spin" />Cargando…
          </p>
        ) : payments.length === 0 ? (
          <p className="rounded-lg border border-dashed border-slate-300 bg-white px-3 py-3 text-xs text-slate-500">
            Todavía no se le registró ningún pago.
          </p>
        ) : (
          <div className="space-y-2">
            {payments.map((p) => {
              const linked = byPayment.get(p.id) ?? [];
              const linkedTotal = linked.reduce((sum, t) => sum + (t.pagado_monto ?? getTicketCommission(t)), 0);
              const outside = Math.max(0, p.amount - linkedTotal);
              const byTickets = linked.length > 0 || Boolean(p.notes?.includes("desde Historial de tickets"));
              return (
                <details key={p.id} className="group rounded-lg border border-slate-200 bg-white">
                  <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-4 gap-y-1 px-3 py-2.5">
                    <span className="text-sm font-bold tabular-nums text-slate-900">{moneyFmt.format(p.amount)}</span>
                    <span className="text-xs text-slate-600">{dateTimeFmt(p.registered_at)}</span>
                    <span className="text-xs text-slate-500">por <strong className="font-semibold text-slate-700">{p.registered_by_name ?? "—"}</strong></span>
                    <span className="rounded-full border border-slate-200 px-2 py-0.5 text-[10px] font-medium text-slate-500">
                      {byTickets ? "Confirmar pago por tickets" : "Pago manual"}
                    </span>
                    <span className="ml-auto flex items-center gap-2 text-xs text-slate-500">
                      {byTickets ? `${linked.length} servicio${linked.length !== 1 ? "s" : ""}` : null}
                      <button
                        type="button"
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          onDelete(p.id);
                        }}
                        className="rounded p-1 text-slate-300 transition-colors hover:bg-slate-100 hover:text-slate-700"
                        title="Eliminar este pago"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                      <ChevronDown className="h-4 w-4 text-slate-400 transition-transform group-open:rotate-180" />
                    </span>
                  </summary>
                  <div className="space-y-2 border-t border-slate-100 px-3 py-3">
                    {p.period_start || p.notes ? (
                      <p className="text-[11px] text-slate-500">
                        {p.period_start ? <>Período: {dateFmt(p.period_start)} — {p.period_end ? dateFmt(p.period_end) : "hoy"}. </> : null}
                        {p.notes ?? ""}
                      </p>
                    ) : null}
                    {linked.length > 0 ? (
                      <ServicesTable tickets={linked} amountOf={(t) => t.pagado_monto ?? getTicketCommission(t)} />
                    ) : byTickets ? (
                      <p className="text-xs text-slate-500">Los servicios de este pago están fuera del período filtrado arriba.</p>
                    ) : (
                      <p className="text-xs text-slate-500">Pago registrado a mano por un monto: no está ligado a servicios concretos.</p>
                    )}
                    {linked.length > 0 && outside > 0.005 ? (
                      <p className="text-[11px] text-slate-400">
                        + {moneyFmt.format(outside)} de servicios fuera del período filtrado.
                      </p>
                    ) : null}
                  </div>
                </details>
              );
            })}
          </div>
        )}
      </div>

      {/* Pendiente */}
      <details open={unpaid.length > 0} className="group rounded-lg border border-slate-300 bg-white">
        <summary className="flex cursor-pointer list-none items-center gap-3 px-3 py-2.5">
          <span className="text-sm font-semibold text-slate-900">Pendiente de pago</span>
          <span className="text-xs text-slate-500">
            {unpaid.length} servicio{unpaid.length !== 1 ? "s" : ""}
          </span>
          <span className="ml-auto flex items-center gap-2">
            <span className="text-sm font-bold tabular-nums text-slate-900">{moneyFmt.format(unpaidTotal)}</span>
            <ChevronDown className="h-4 w-4 text-slate-400 transition-transform group-open:rotate-180" />
          </span>
        </summary>
        <div className="border-t border-slate-100 px-3 py-3">
          {unpaid.length === 0 ? (
            <p className="text-xs text-slate-500">Todos los servicios completados de este período ya están pagados.</p>
          ) : (
            <ServicesTable tickets={unpaid} amountOf={(t) => getTicketCommission(t)} />
          )}
        </div>
      </details>
    </div>
  );
}

// ─── Formulario para registrar pago ──────────────────────────────────────────

function RegisterPaymentForm({
  professional,
  defaultAmount,
  fromDate,
  toDate,
  onSave,
  onCancel,
  saving,
}: {
  professional: ProfessionalForSelect;
  defaultAmount: number;
  fromDate: string;
  toDate: string;
  onSave: (amount: number, date: string, notes: string) => Promise<void>;
  onCancel: () => void;
  saving: boolean;
}) {
  const [amount, setAmount] = useState(String(Math.max(0, defaultAmount).toFixed(2)));
  const [notes, setNotes] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));

  const fieldClass =
    "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-[#094732] focus:ring-1 focus:ring-[#094732]/25";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(amount);
    if (Number.isNaN(amt) || amt <= 0) return;
    await onSave(amt, date, notes.trim());
  };

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
      <p className="mb-1 text-sm font-semibold text-slate-800">
        Registrar pago — {professional.username}
      </p>
      <p className="mb-3 flex items-start gap-1.5 text-[11px] leading-snug text-slate-600">
        <Info className="mt-0.5 h-3 w-3 shrink-0 text-slate-400" />
        <span>
          Anota un pago por el monto que le entregaste (ya viene el pendiente, puedes cambiarlo). Sirve de control en esta pantalla:{" "}
          <strong>no marca tickets ni entra al Corte de caja</strong>. Para que salga como egreso en el Corte, usa{" "}
          <strong>Historial de tickets → Confirmar pago</strong>.
        </span>
      </p>
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-600">Monto (Bs.)</label>
          <input type="number" step="0.01" min="0.01" required value={amount}
            onChange={(e) => setAmount(e.target.value)} className={fieldClass} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-600">Fecha de pago</label>
          <input type="date" required value={date}
            onChange={(e) => setDate(e.target.value)} className={fieldClass} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-600">Notas (opcional)</label>
          <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)}
            placeholder="Ej. Quincena mayo..." className={fieldClass} />
        </div>
      </div>
      <div className="mt-3 flex items-center gap-2">
        <Button type="submit" size="sm" disabled={saving}>
          {saving ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
          {saving ? "Guardando…" : "Guardar pago"}
        </Button>
        <Button type="button" variant="secondary" size="sm" onClick={onCancel} disabled={saving}>
          <X className="h-3.5 w-3.5" />Cancelar
        </Button>
        <span className="text-[11px] text-slate-500">
          Período: {fromDate ? dateFmt(fromDate) : "inicio"} — {toDate ? dateFmt(toDate) : "hoy"}
        </span>
      </div>
    </form>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

type Props = {
  professionals: ProfessionalForSelect[];
  tickets: TicketItem[];
  fromDate: string;
  toDate: string;
  /** Misma operaria elegida en la pestaña "Historial de tickets" — para que
   * cambiar de pestaña no "pierda" el filtro que ya se había elegido. */
  selectedProfessionalId: number | null;
  /** Reporta el detalle por cita (ya con todos los filtros aplicados) y los
   * totales hacia arriba, para que el botón "PDF" de la pantalla pueda
   * exportar esta misma vista cuando esta pestaña está activa. */
  onStatsChange?: (rows: CommissionExportRow[], totals: CommissionExportTotals) => void;
};

export default function CommissionPaymentsTab({ professionals, tickets, fromDate, toDate, selectedProfessionalId, onStatsChange }: Props) {
  const [payments, setPayments] = useState<CommissionPaymentOut[]>([]);
  const [loadingPayments, setLoadingPayments] = useState(false);
  const [saving, setSaving] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [registeringId, setRegisteringId] = useState<number | null>(null);

  const loadPayments = useCallback(async () => {
    setLoadingPayments(true);
    try {
      const data = await CommissionPaymentsService.list();
      setPayments(data);
    } catch {
      toast.error("No se pudo cargar el historial de pagos.");
    } finally {
      setLoadingPayments(false);
    }
  }, []);

  useEffect(() => { void loadPayments(); }, [loadPayments]);

  const visibleProfessionals = useMemo(
    () =>
      selectedProfessionalId !== null
        ? professionals.filter((p) => p.id === selectedProfessionalId)
        : professionals,
    [professionals, selectedProfessionalId]
  );

  const proStats = useMemo(() => {
    return visibleProfessionals.map((pro, index) => {
      const allProTickets = tickets.filter((t) => t.professional_id === pro.id);
      const completedTickets = allProTickets.filter((t) => t.status === "completed");
      const cancelledTickets = allProTickets.filter((t) => t.status === "cancelled");

      const earned = completedTickets.reduce((s, t) => s + getTicketCommission(t), 0);
      const totalCaja = completedTickets.reduce((s, t) => s + getTicketPriceTotal(t), 0);

      const proPayments = payments
        .filter((p) => p.professional_id === pro.id)
        .sort((a, b) => b.registered_at.localeCompare(a.registered_at));

      const paid = proPayments.reduce((s, p) => s + p.amount, 0);
      const pending = Math.max(0, earned - paid);
      const isPaid = earned > 0 && pending < 0.01;

      const sortedTickets = [
        ...completedTickets.sort((a, b) => a.start_time.localeCompare(b.start_time)),
        ...cancelledTickets.sort((a, b) => a.start_time.localeCompare(b.start_time)),
      ];

      return {
        pro, index, earned, paid, pending, isPaid, totalCaja,
        proPayments, allProTickets, sortedTickets,
        completedCount: completedTickets.length,
        cancelledCount: cancelledTickets.length,
      };
    });
  }, [visibleProfessionals, tickets, payments]);

  const totalEarned = useMemo(() => proStats.reduce((s, p) => s + p.earned, 0), [proStats]);
  const totalPaid = useMemo(() => proStats.reduce((s, p) => s + p.paid, 0), [proStats]);
  const totalPending = useMemo(() => proStats.reduce((s, p) => s + p.pending, 0), [proStats]);
  const totalCaja = useMemo(() => proStats.reduce((s, p) => s + p.totalCaja, 0), [proStats]);

  useEffect(() => {
    if (!onStatsChange) return;
    const rows: CommissionExportRow[] = proStats.flatMap((s) =>
      s.sortedTickets.map((t) => {
        const isCancelled = t.status === "cancelled";
        return {
          professional_name: s.pro.username,
          client_name: t.client_name || "—",
          services: t.service_names?.length ? t.service_names.join(", ") : (t.service_name ?? ""),
          fecha: t.start_time ? dateFmt(t.start_time) : "",
          hora: t.start_time
            ? new Date(t.start_time).toLocaleTimeString("es-BO", { hour: "2-digit", minute: "2-digit" })
            : "",
          status: isCancelled ? "Cancelado" : "Completado",
          caja: isCancelled ? 0 : getTicketPriceTotal(t),
          comision: isCancelled ? 0 : getTicketCommission(t),
        };
      })
    );
    onStatsChange(rows, { caja: totalCaja, comision: totalEarned, pagado: totalPaid, pendiente: totalPending });
  }, [proStats, totalCaja, totalEarned, totalPaid, totalPending, onStatsChange]);

  const handleSavePayment = async (pro: ProfessionalForSelect, amount: number, date: string, notes: string) => {
    setSaving(true);
    try {
      const created = await CommissionPaymentsService.create({
        professional_id: pro.id,
        amount,
        period_start: fromDate || null,
        period_end: toDate || null,
        notes: notes || null,
        registered_at: new Date(`${date}T12:00:00`).toISOString(),
      });
      setPayments((prev) => [created, ...prev]);
      setRegisteringId(null);
      toast.success(`Pago de Bs ${amount.toFixed(2)} registrado para ${pro.username}.`);
    } catch {
      toast.error("No se pudo guardar el pago.");
    } finally {
      setSaving(false);
    }
  };

  const handleDeletePayment = async (id: number) => {
    if (!confirm("¿Eliminar este registro de pago?")) return;
    try {
      await CommissionPaymentsService.remove(id);
      setPayments((prev) => prev.filter((p) => p.id !== id));
      toast.success("Registro eliminado.");
    } catch {
      toast.error("No se pudo eliminar el registro.");
    }
  };

  if (professionals.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center text-sm text-slate-400">
        No hay operarias registradas.
      </div>
    );
  }

  const operariasConPendiente = proStats.filter((p) => p.pending > 0.005).length;

  return (
    <div className="flex flex-col gap-4">
      {/* Resumen: tres cifras, sin colores */}
      <div data-tour="cm-summary" className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4" title="Suma de las comisiones de los servicios completados en el período">
          <p className="text-xs font-medium text-slate-500">Comisión ganada</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">{moneyFmt.format(totalEarned)}</p>
          <p className="mt-0.5 text-xs text-slate-500">por servicios completados</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4" title="Suma de todos los pagos registrados a estas operarias">
          <p className="text-xs font-medium text-slate-500">Ya pagado</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">{moneyFmt.format(totalPaid)}</p>
          <p className="mt-0.5 text-xs text-slate-500">
            {loadingPayments ? "…" : `${payments.length} pago${payments.length !== 1 ? "s" : ""} registrado${payments.length !== 1 ? "s" : ""}`}
          </p>
        </div>
        <div className="rounded-xl border-2 border-slate-800 bg-white p-4" title="Comisión ganada menos lo ya pagado">
          <p className="text-xs font-medium text-slate-600">Falta pagar</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">{moneyFmt.format(totalPending)}</p>
          <p className="mt-0.5 text-xs text-slate-500">
            {operariasConPendiente === 0 ? "todas al día" : `a ${operariasConPendiente} operaria${operariasConPendiente !== 1 ? "s" : ""}`}
          </p>
        </div>
      </div>

      {(selectedProfessionalId !== null && visibleProfessionals[0]) || fromDate || toDate ? (
        <p className="text-xs text-slate-500">
          {selectedProfessionalId !== null && visibleProfessionals[0] ? (
            <>Solo <strong className="text-slate-700">{visibleProfessionals[0].username}</strong>. </>
          ) : null}
          {fromDate || toDate ? (
            <>
              Período: <strong className="text-slate-700">{fromDate ? dateFmt(fromDate) : "inicio"}</strong> —{" "}
              <strong className="text-slate-700">{toDate ? dateFmt(toDate) : "hoy"}</strong>
            </>
          ) : null}
        </p>
      ) : null}

      {/* Tabla por operaria */}
      <div data-tour="cm-card" className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full min-w-[760px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold text-slate-500">
              <th className="px-4 py-2.5">Operaria</th>
              <th className="px-3 py-2.5" title="Servicios terminados en el período: son los que generan comisión">Servicios</th>
              <th className="px-3 py-2.5 text-right" title="Lo que le corresponde por esos servicios">Comisión ganada</th>
              <th className="px-3 py-2.5 text-right" title="Lo que ya se le entregó">Ya pagado</th>
              <th className="px-3 py-2.5 text-right" title="Comisión ganada menos ya pagado">Falta pagar</th>
              <th className="px-4 py-2.5 text-right">
                <span className="sr-only">Acciones</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {proStats.map(({ pro, earned, paid, pending, isPaid, totalCaja, proPayments, sortedTickets, completedCount, cancelledCount }, proIndex) => {
              const isExpanded = expandedId === pro.id;
              const isRegistering = registeringId === pro.id;
              const hasPending = pending > 0.005;

              return (
                <Fragment key={pro.id}>
                  <tr className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50/70">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-200 text-xs font-bold text-slate-700">
                          {getInitials(pro.username)}
                        </span>
                        <span className="font-semibold text-slate-900">{pro.username}</span>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-slate-700">
                      <span className="font-medium">{completedCount}</span> completados
                      {cancelledCount > 0 ? <span className="text-xs text-slate-400"> · {cancelledCount} cancelados</span> : null}
                      <span className="block text-xs text-slate-400" title="Lo que pagaron las clientas por los servicios completados">
                        Cobrado {moneyFmt.format(totalCaja)}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right font-medium tabular-nums text-slate-900">{moneyFmt.format(earned)}</td>
                    <td className="px-3 py-3 text-right tabular-nums text-slate-700">{moneyFmt.format(paid)}</td>
                    <td className="px-3 py-3 text-right tabular-nums">
                      {earned === 0 ? (
                        <span className="text-slate-400" title="Sin servicios completados en el período">—</span>
                      ) : hasPending ? (
                        <span className="font-bold text-slate-900">{moneyFmt.format(pending)}</span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-500">
                          <CheckCircle className="h-3.5 w-3.5" /> Al día
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1.5">
                        {earned > 0 && (
                          <button
                            type="button"
                            {...(proIndex === 0 ? { "data-tour": "cm-register" } : {})}
                            title="Anota un pago por el monto que le entregaste. No entra al Corte de caja (para eso: Historial de tickets → Confirmar pago)"
                            onClick={() => { setRegisteringId(isRegistering ? null : pro.id); setExpandedId(pro.id); }}
                            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                              hasPending && !isPaid
                                ? "bg-slate-900 text-white hover:bg-slate-700"
                                : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                            }`}
                          >
                            <Banknote className="h-3.5 w-3.5" />
                            {hasPending ? "Registrar pago" : "Registrar otro pago"}
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setExpandedId(isExpanded ? null : pro.id)}
                          aria-expanded={isExpanded}
                          className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
                        >
                          {isExpanded ? "Ocultar" : "Detalle"}
                          {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                        </button>
                      </div>
                    </td>
                  </tr>

                  {(isRegistering || isExpanded) && (
                    <tr key={`${pro.id}-detail`} className="border-b border-slate-100 bg-slate-50/50">
                      <td colSpan={6} className="px-4 pb-4">
                        {isRegistering && (
                          <RegisterPaymentForm
                            professional={pro}
                            defaultAmount={pending}
                            fromDate={fromDate}
                            toDate={toDate}
                            saving={saving}
                            onSave={(amount, date, notes) => handleSavePayment(pro, amount, date, notes)}
                            onCancel={() => setRegisteringId(null)}
                          />
                        )}

                        {isExpanded && !isRegistering && (
                          <div className="pt-1">
                            <PaymentGroups payments={proPayments} tickets={sortedTickets} loading={loadingPayments} onDelete={(id) => void handleDeletePayment(id)} />
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-slate-300 bg-slate-50 text-sm font-bold text-slate-900">
              <td className="px-4 py-3" colSpan={2}>Total</td>
              <td className="px-3 py-3 text-right tabular-nums">{moneyFmt.format(totalEarned)}</td>
              <td className="px-3 py-3 text-right tabular-nums">{moneyFmt.format(totalPaid)}</td>
              <td className="px-3 py-3 text-right tabular-nums">{moneyFmt.format(totalPending)}</td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Cómo se lee: corto y plegable */}
      <details data-tour="cm-legend" className="group rounded-xl border border-slate-200 bg-white px-4 py-3">
        <summary className="flex cursor-pointer list-none items-center gap-2 text-xs font-semibold text-slate-700">
          <Info className="h-4 w-4 shrink-0 text-slate-400" />
          ¿Cómo leer esta tabla?
          <ChevronDown className="ml-auto h-4 w-4 text-slate-400 transition-transform group-open:rotate-180" />
        </summary>
        <ul className="mt-2 space-y-1.5 text-xs leading-relaxed text-slate-600">
          <li><strong className="text-slate-800">Falta pagar = Comisión ganada − Ya pagado.</strong></li>
          <li>
            <strong className="text-slate-800">Comisión ganada:</strong> lo que le corresponde por los servicios <em>completados</em> en el período (los cancelados no cuentan).
          </li>
          <li>
            <strong className="text-slate-800">Ya pagado:</strong> todo lo registrado como entregado, con <em>Confirmar pago</em> en Historial de tickets o con <em>Registrar pago</em> aquí.
          </li>
          <li>
            <strong className="text-slate-800">Registrar pago</strong> anota un monto libre como control; <strong>no entra al Corte de caja</strong>. Para eso usa <em>Confirmar pago</em> en Historial de tickets.
          </li>
          <li><strong className="text-slate-800">Detalle</strong> muestra los pagos que se le hicieron (cuándo y quién), con los servicios que cubrió cada uno, y aparte lo que todavía está pendiente.</li>
        </ul>
      </details>
    </div>
  );
}
