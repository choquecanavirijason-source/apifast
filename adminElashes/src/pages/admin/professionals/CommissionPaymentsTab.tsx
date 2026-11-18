import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { CheckCircle, ChevronDown, ChevronUp, Banknote, RefreshCw, Info, X } from "lucide-react";
import { toast } from "react-toastify";
import { AgendaService, type ProfessionalForSelect, type TicketItem } from "@/core/services/agenda/agenda.service";
import { CommissionPaymentsService, type CommissionPaymentOut } from "@/core/services/commission-payments/commission-payments.service";
import { getApiErrorMessage } from "@/core/utils/apiError";
import GenericModal from "@/components/common/modal/GenericModal";
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

const dateTimeFmt = (iso: string) =>
  iso
    ? new Date(iso).toLocaleString("es-BO", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
    : "—";

/** Día local (YYYY-MM-DD) de un instante ISO, para compararlo con los filtros de fecha. */
const localDay = (iso: string) => {
  const d = new Date(iso);
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${month}-${day}`;
};

function getInitials(name: string) {
  return name.split(" ").map((w) => w[0] ?? "").join("").toUpperCase().slice(0, 2);
}

/** Porcentaje que representa la comisión sobre el precio del servicio ("40%"). Con varios servicios es el promedio. */
function commissionPercent(t: TicketItem, commission: number): string {
  const price = getTicketPriceTotal(t);
  if (!(price > 0)) return "—";
  const pct = (commission / price) * 100;
  return `${Number.isInteger(Math.round(pct * 10) / 10) ? Math.round(pct) : (Math.round(pct * 10) / 10).toFixed(1)}%`;
}

const serviceLabel = (t: TicketItem) => (t.service_names?.length ? t.service_names.join(", ") : (t.service_name ?? "—"));

// Los pagos hechos con "Confirmar pago" por tickets guardan esta nota (ver commission_payout_service).
const TICKET_PAYMENT_NOTE = "desde Historial de tickets";
const isTicketPayment = (p: CommissionPaymentOut) => Boolean(p.notes?.includes(TICKET_PAYMENT_NOTE));

/** El lote es todo o nada: el servidor devuelve qué tickets lo impidieron. */
function payErrorMessage(err: unknown, tickets: TicketItem[]): string {
  if (axios.isAxiosError(err)) {
    const detail = (err.response?.data as { detail?: unknown } | undefined)?.detail as
      | { message?: string; errores?: { id: number; motivo: string }[] }
      | undefined;
    if (detail && typeof detail === "object" && Array.isArray(detail.errores)) {
      const label = (id: number) => {
        const t = tickets.find((x) => x.id === id);
        return t ? (t.ticket_code ?? `#${t.id}`) : `#${id}`;
      };
      return `${detail.message ?? "No se registró ningún pago."} ${detail.errores.map((e) => `${label(e.id)}: ${e.motivo}`).join(" · ")}`;
    }
  }
  return getApiErrorMessage(err, "No se pudo registrar el pago.");
}

// ─── Tabla de servicios (con casillas para pagar o con "Anular") ───────────────

type Selection = {
  selected: Set<number>;
  toggle: (id: number) => void;
  allSelected: boolean;
  someSelected: boolean;
  toggleAll: () => void;
};

function ServicesTable({
  tickets,
  amountOf,
  selection,
  onVoid,
}: {
  tickets: TicketItem[];
  amountOf: (t: TicketItem) => number;
  selection?: Selection;
  onVoid?: (t: TicketItem) => void;
}) {
  return (
    <div className="max-h-72 overflow-auto rounded-lg border border-slate-200 bg-white">
      <table className="w-full min-w-[560px] border-collapse text-xs">
        <thead>
          <tr className="sticky top-0 bg-slate-50 text-left text-slate-500">
            {selection ? (
              <th className="w-9 px-3 py-2">
                <input
                  type="checkbox"
                  aria-label="Seleccionar todos los servicios pendientes"
                  className="h-4 w-4 accent-slate-800"
                  checked={selection.allSelected}
                  ref={(el) => { if (el) el.indeterminate = selection.someSelected && !selection.allSelected; }}
                  onChange={selection.toggleAll}
                />
              </th>
            ) : null}
            <th className="px-3 py-2 font-semibold">Cliente</th>
            <th className="px-3 py-2 font-semibold">Servicio</th>
            <th className="px-3 py-2 font-semibold">Atendido</th>
            <th className="px-3 py-2 text-right font-semibold" title="Lo que costó el servicio (lo que pagó la clienta)">Precio</th>
            <th className="px-3 py-2 text-right font-semibold" title="Lo que gana la operaria por este servicio y qué porcentaje del precio es">Comisión</th>
            {onVoid ? <th className="px-3 py-2"><span className="sr-only">Anular</span></th> : null}
          </tr>
        </thead>
        <tbody>
          {tickets.map((t) => (
            <tr key={t.id} className="border-t border-slate-100">
              {selection ? (
                <td className="px-3 py-2">
                  <input
                    type="checkbox"
                    aria-label={`Pagar ${serviceLabel(t)} de ${t.client_name}`}
                    className="h-4 w-4 accent-slate-800"
                    checked={selection.selected.has(t.id)}
                    onChange={() => selection.toggle(t.id)}
                  />
                </td>
              ) : null}
              <td className="px-3 py-2 font-medium text-slate-800">{t.client_name || "—"}</td>
              <td className="px-3 py-2 text-slate-600">{serviceLabel(t)}</td>
              <td className="whitespace-nowrap px-3 py-2 text-slate-500">{dateTimeFmt(t.start_time)}</td>
              <td className="px-3 py-2 text-right tabular-nums text-slate-600">{moneyFmt.format(getTicketPriceTotal(t))}</td>
              <td className="px-3 py-2 text-right tabular-nums">
                <span className="block font-semibold text-slate-800">{moneyFmt.format(amountOf(t))}</span>
                <span className="block text-[11px] text-slate-400">{commissionPercent(t, amountOf(t))}</span>
              </td>
              {onVoid ? (
                <td className="px-3 py-2 text-right">
                  <button
                    type="button"
                    onClick={() => onVoid(t)}
                    className="text-[11px] font-medium text-slate-500 underline-offset-2 hover:text-slate-900 hover:underline"
                    title="Deshacer el pago de este servicio"
                  >
                    Anular
                  </button>
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="sticky bottom-0 border-t border-slate-300 bg-slate-50 font-semibold text-slate-800">
            <td className="px-3 py-2" colSpan={selection ? 4 : 3}>
              Total · {tickets.length} servicio{tickets.length !== 1 ? "s" : ""}
            </td>
            <td className="px-3 py-2 text-right tabular-nums">{moneyFmt.format(tickets.reduce((sum, t) => sum + getTicketPriceTotal(t), 0))}</td>
            <td className="px-3 py-2 text-right tabular-nums">{moneyFmt.format(tickets.reduce((sum, t) => sum + amountOf(t), 0))}</td>
            {onVoid ? <td /> : null}
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

// ─── Detalle de una operaria: pendiente (se paga aquí) y pagos hechos ──────────

function PaymentGroups({
  payments,
  tickets,
  loading,
  pendingAmount,
  overpaidAmount,
  canPay,
  canVoid,
  selected,
  onToggle,
  onToggleAll,
  onPay,
  onVoid,
  onDeletePayment,
}: {
  payments: CommissionPaymentOut[];
  tickets: TicketItem[];
  loading: boolean;
  pendingAmount: number;
  overpaidAmount: number;
  canPay: boolean;
  canVoid: boolean;
  selected: Set<number>;
  onToggle: (id: number) => void;
  onToggleAll: (ids: number[]) => void;
  onPay: (ids: number[]) => void;
  onVoid: (t: TicketItem) => void;
  onDeletePayment: (id: number) => void;
}) {
  const completed = tickets.filter((t) => t.status === "completed");
  const payable = completed.filter((t) => !t.pagado && getTicketCommission(t) > 0);
  const payableIds = payable.map((t) => t.id);
  const selectedPayable = payable.filter((t) => selected.has(t.id));
  const selectedTotal = selectedPayable.reduce((sum, t) => sum + getTicketCommission(t), 0);
  const payableTotal = payable.reduce((sum, t) => sum + getTicketCommission(t), 0);
  const byPayment = new Map<number, TicketItem[]>();
  for (const t of completed) {
    if (t.pagado && t.commission_payment_id != null) {
      byPayment.set(t.commission_payment_id, [...(byPayment.get(t.commission_payment_id) ?? []), t]);
    }
  }

  const selection: Selection | undefined = canPay
    ? {
        selected,
        toggle: onToggle,
        allSelected: payable.length > 0 && selectedPayable.length === payable.length,
        someSelected: selectedPayable.length > 0,
        toggleAll: () => onToggleAll(payableIds),
      }
    : undefined;

  return (
    <div className="space-y-4">
      {/* Pendiente: aquí se elige qué pagar */}
      <section className="rounded-lg border border-slate-300 bg-white">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-slate-100 px-3 py-2.5">
          <span className="text-sm font-semibold text-slate-900">Pendiente de pago</span>
          <span className="text-xs text-slate-500">
            {payable.length} servicio{payable.length !== 1 ? "s" : ""}
          </span>
          <span className="ml-auto text-sm font-bold tabular-nums text-slate-900" title="Comisión ganada menos lo ya pagado">
            Falta {moneyFmt.format(Math.max(pendingAmount, 0))}
          </span>
        </div>
        <div className="space-y-3 px-3 py-3">
          {overpaidAmount > 0.005 ? (
            <p className="rounded-lg bg-slate-100 px-3 py-2 text-xs text-slate-700">
              Se le registró <strong>{moneyFmt.format(overpaidAmount)} de más</strong> respecto a lo que ganó en este período (pagos manuales antiguos).
              Revisa los pagos de abajo.
            </p>
          ) : null}
          {payable.length > 0 && Math.abs(payableTotal - pendingAmount) > 0.005 ? (
            <p className="rounded-lg bg-slate-100 px-3 py-2 text-xs text-slate-700">
              La lista suma <strong>{moneyFmt.format(payableTotal)}</strong> pero a la operaria le faltan <strong>{moneyFmt.format(Math.max(pendingAmount, 0))}</strong>:
              tiene pagos manuales antiguos que cubrían parte sin marcar servicios. Marca solo lo que realmente falte.
            </p>
          ) : null}
          {payable.length === 0 ? (
            <p className="text-xs text-slate-500">No hay servicios pendientes de pago en este período.</p>
          ) : (
            <>
              <p className="text-xs text-slate-500">
                {canPay
                  ? "Marca los servicios que quieres pagar ahora y pulsa Pagar. Lo que no marques queda pendiente."
                  : "No tienes permiso para pagar comisiones: aquí solo puedes ver lo pendiente."}
              </p>
              <ServicesTable tickets={payable} amountOf={(t) => getTicketCommission(t)} selection={selection} />
              {canPay ? (
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs text-slate-600">
                    {selectedPayable.length === 0 ? (
                      "Ningún servicio marcado"
                    ) : (
                      <>
                        <strong className="text-slate-900">{selectedPayable.length}</strong> servicio{selectedPayable.length !== 1 ? "s" : ""} marcado
                        {selectedPayable.length !== 1 ? "s" : ""} · <strong className="text-slate-900">{moneyFmt.format(selectedTotal)}</strong>
                      </>
                    )}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      size="sm"
                      disabled={selectedPayable.length === 0}
                      onClick={() => onPay(selectedPayable.map((t) => t.id))}
                      className="!bg-slate-900 hover:!bg-slate-700"
                      leftIcon={<Banknote className="h-3.5 w-3.5" />}
                    >
                      Pagar seleccionados
                    </Button>
                    <button
                      type="button"
                      onClick={() => onPay(payableIds)}
                      className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                    >
                      Pagar todo ({moneyFmt.format(payableTotal)})
                    </button>
                  </div>
                </div>
              ) : null}
            </>
          )}
        </div>
      </section>

      {/* Pagos ya hechos */}
      <div>
        <p className="text-xs font-semibold text-slate-700">Pagos realizados</p>
        <p className="mb-2 text-[11px] text-slate-400">
          Toca un pago para ver qué servicios cubrió{canVoid ? ". Con \"Anular\" deshaces el pago de un servicio" : ""}.
        </p>
        {loading ? (
          <p className="flex items-center gap-1 text-xs text-slate-400">
            <RefreshCw className="h-3 w-3 animate-spin" />Cargando…
          </p>
        ) : payments.length === 0 ? (
          <p className="rounded-lg border border-dashed border-slate-300 bg-white px-3 py-3 text-xs text-slate-500">
            No hay pagos registrados en este período.
          </p>
        ) : (
          <div className="space-y-2">
            {payments.map((p) => {
              const linked = byPayment.get(p.id) ?? [];
              const byTickets = isTicketPayment(p);
              return (
                <details key={p.id} className="group rounded-lg border border-slate-200 bg-white">
                  <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-4 gap-y-1 px-3 py-2.5">
                    <span className="text-sm font-bold tabular-nums text-slate-900">{moneyFmt.format(p.amount)}</span>
                    <span className="text-xs text-slate-600">{dateTimeFmt(p.registered_at)}</span>
                    <span className="text-xs text-slate-500">
                      por <strong className="font-semibold text-slate-700">{p.registered_by_name ?? "—"}</strong>
                    </span>
                    <span className="rounded-full border border-slate-200 px-2 py-0.5 text-[10px] font-medium text-slate-500">
                      {byTickets ? "Por servicios" : "Pago manual (antiguo)"}
                    </span>
                    <span className="ml-auto flex items-center gap-2 text-xs text-slate-500">
                      {byTickets ? `${linked.length} servicio${linked.length !== 1 ? "s" : ""}` : null}
                      {canVoid ? (
                        <button
                          type="button"
                          onClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            onDeletePayment(p.id);
                          }}
                          className="rounded p-1 text-slate-300 transition-colors hover:bg-slate-100 hover:text-slate-700"
                          title="Eliminar este pago completo (sus servicios vuelven a quedar pendientes)"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      ) : null}
                      <ChevronDown className="h-4 w-4 text-slate-400 transition-transform group-open:rotate-180" />
                    </span>
                  </summary>
                  <div className="space-y-2 border-t border-slate-100 px-3 py-3">
                    {p.notes ? <p className="text-[11px] text-slate-500">{p.notes}</p> : null}
                    {linked.length > 0 ? (
                      <ServicesTable
                        tickets={linked}
                        amountOf={(t) => t.pagado_monto ?? getTicketCommission(t)}
                        onVoid={canVoid ? onVoid : undefined}
                      />
                    ) : byTickets ? (
                      <p className="text-xs text-slate-500">Los servicios de este pago están fuera del período filtrado arriba.</p>
                    ) : (
                      <p className="text-xs text-slate-500">
                        Pago antiguo registrado por un monto: no está ligado a servicios concretos.
                      </p>
                    )}
                  </div>
                </details>
              );
            })}
          </div>
        )}
      </div>
    </div>
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
  /** Permiso para pagar comisiones (commissions:pay). */
  canPay: boolean;
  /** Permiso para anular pagos (commissions:void). */
  canVoid: boolean;
  /** Se llama tras pagar o anular para que la pantalla vuelva a cargar los tickets. */
  onChanged: () => void | Promise<void>;
};

export default function CommissionPaymentsTab({
  professionals,
  tickets,
  fromDate,
  toDate,
  selectedProfessionalId,
  onStatsChange,
  canPay,
  canVoid,
  onChanged,
}: Props) {
  const [payments, setPayments] = useState<CommissionPaymentOut[]>([]);
  const [loadingPayments, setLoadingPayments] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  // Pago: tickets elegidos de la operaria abierta + diálogo de confirmación.
  const [selected, setSelected] = useState<Set<number>>(() => new Set());
  const [payTarget, setPayTarget] = useState<{ proName: string; ids: number[] } | null>(null);
  const [fromCash, setFromCash] = useState<"yes" | "no" | null>(null);
  const [paying, setPaying] = useState(false);
  const [voidTarget, setVoidTarget] = useState<TicketItem | null>(null);
  const [voidMotivo, setVoidMotivo] = useState("");
  const [voiding, setVoiding] = useState(false);

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

  // Cambiar de operaria abierta o de filtros limpia lo marcado: podría dejar de verse y pagarse sin querer.
  useEffect(() => {
    setSelected(new Set());
  }, [expandedId, fromDate, toDate, selectedProfessionalId]);

  // Tras recargar, conserva solo lo marcado que sigue pendiente.
  useEffect(() => {
    setSelected((current) => {
      if (current.size === 0) return current;
      const stillPending = new Set(tickets.filter((t) => current.has(t.id) && !t.pagado && t.status === "completed").map((t) => t.id));
      return stillPending.size === current.size ? current : stillPending;
    });
  }, [tickets]);

  const visibleProfessionals = useMemo(
    () =>
      selectedProfessionalId !== null
        ? professionals.filter((p) => p.id === selectedProfessionalId)
        : professionals,
    [professionals, selectedProfessionalId]
  );

  const proStats = useMemo(() => {
    const inPeriod = (iso: string) => {
      const day = localDay(iso);
      return (!fromDate || day >= fromDate) && (!toDate || day <= toDate);
    };
    return visibleProfessionals.map((pro) => {
      const allProTickets = tickets.filter((t) => t.professional_id === pro.id);
      const completedTickets = allProTickets.filter((t) => t.status === "completed");
      const cancelledTickets = allProTickets.filter((t) => t.status === "cancelled");

      const earned = completedTickets.reduce((s, t) => s + getTicketCommission(t), 0);
      const totalCaja = completedTickets.reduce((s, t) => s + getTicketPriceTotal(t), 0);

      // "Ya pagado" se mide en el MISMO período que "Comisión ganada": lo pagado de los servicios de la lista
      // (por servicios) más los pagos manuales antiguos hechos dentro del período.
      const linkedIds = new Set(completedTickets.filter((t) => t.pagado && t.commission_payment_id != null).map((t) => t.commission_payment_id));
      const proPayments = payments
        .filter((p) => p.professional_id === pro.id)
        .sort((a, b) => b.registered_at.localeCompare(a.registered_at));
      const visiblePayments = proPayments.filter((p) => (isTicketPayment(p) ? linkedIds.has(p.id) : inPeriod(p.registered_at)));
      const paidByTickets = completedTickets.filter((t) => t.pagado).reduce((s, t) => s + (t.pagado_monto ?? getTicketCommission(t)), 0);
      const paidManual = visiblePayments.filter((p) => !isTicketPayment(p)).reduce((s, p) => s + p.amount, 0);
      const paid = paidByTickets + paidManual;

      const pending = Math.max(0, earned - paid);
      const isPaid = earned > 0 && pending < 0.01;

      const sortedTickets = [
        ...completedTickets.sort((a, b) => b.start_time.localeCompare(a.start_time)),
        ...cancelledTickets.sort((a, b) => b.start_time.localeCompare(a.start_time)),
      ];
      const payableCount = completedTickets.filter((t) => !t.pagado && getTicketCommission(t) > 0).length;

      return {
        pro, earned, paid, pending, isPaid, totalCaja,
        visiblePayments, sortedTickets, payableCount,
        completedCount: completedTickets.length,
        cancelledCount: cancelledTickets.length,
      };
    });
  }, [visibleProfessionals, tickets, payments, fromDate, toDate]);

  const totalEarned = useMemo(() => proStats.reduce((s, p) => s + p.earned, 0), [proStats]);
  const totalPaid = useMemo(() => proStats.reduce((s, p) => s + p.paid, 0), [proStats]);
  const totalPending = useMemo(() => proStats.reduce((s, p) => s + p.pending, 0), [proStats]);
  const totalCaja = useMemo(() => proStats.reduce((s, p) => s + p.totalCaja, 0), [proStats]);
  const paymentCount = useMemo(() => proStats.reduce((s, p) => s + p.visiblePayments.length, 0), [proStats]);

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

  const toggleSelected = useCallback((id: number) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleAll = useCallback((ids: number[]) => {
    setSelected((current) => (ids.every((id) => current.has(id)) ? new Set() : new Set(ids)));
  }, []);

  const openPay = (proName: string, ids: number[]) => {
    if (ids.length === 0) return;
    setFromCash("yes"); // por defecto sale del efectivo de la caja; se puede cambiar a otro medio
    setPayTarget({ proName, ids });
  };

  const payTotal = useMemo(
    () => (payTarget ? tickets.filter((t) => payTarget.ids.includes(t.id)).reduce((s, t) => s + getTicketCommission(t), 0) : 0),
    [payTarget, tickets],
  );
  // Lo que falta según montos (comisión ganada − pagado). Si lo que se va a pagar lo supera, hay pagos manuales antiguos
  // que ya cubrían parte de estos servicios sin marcarlos: se avisa para no pagar dos veces.
  const payExcess = useMemo(() => {
    if (!payTarget) return 0;
    const stat = proStats.find((p) => p.pro.username === payTarget.proName);
    return stat ? Math.max(0, payTotal - stat.pending) : 0;
  }, [payTarget, payTotal, proStats]);

  const handleConfirmPay = async () => {
    if (!payTarget || fromCash === null) return;
    setPaying(true);
    try {
      const result = await AgendaService.payCommissions(payTarget.ids, fromCash === "yes");
      setPayTarget(null);
      setSelected(new Set());
      toast.success(
        `Pago registrado: ${result.tickets} servicio${result.tickets !== 1 ? "s" : ""} · ${moneyFmt.format(result.total)}` +
          (fromCash === "yes" ? " (del efectivo de la caja)." : "."),
      );
      await Promise.all([onChanged(), loadPayments()]);
    } catch (err) {
      // Todo o nada: no se guardó ninguno; la selección queda para corregirla.
      setPayTarget(null);
      toast.error(payErrorMessage(err, tickets), { autoClose: 8000 });
    } finally {
      setPaying(false);
    }
  };

  const handleConfirmVoid = async () => {
    if (!voidTarget) return;
    setVoiding(true);
    try {
      await AgendaService.voidCommissionPayment(voidTarget.id, voidMotivo);
      toast.success(`Pago anulado: ${voidTarget.ticket_code ?? `#${voidTarget.id}`}.`);
      setVoidTarget(null);
      setVoidMotivo("");
      await Promise.all([onChanged(), loadPayments()]);
    } catch (err) {
      toast.error(getApiErrorMessage(err, "No se pudo anular el pago."));
    } finally {
      setVoiding(false);
    }
  };

  const handleDeletePayment = async (id: number) => {
    if (!confirm("¿Eliminar este pago completo? Sus servicios vuelven a quedar pendientes.")) return;
    try {
      await CommissionPaymentsService.remove(id);
      toast.success("Pago eliminado.");
      await Promise.all([onChanged(), loadPayments()]);
    } catch (err) {
      toast.error(getApiErrorMessage(err, "No se pudo eliminar el pago."));
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
        <div className="rounded-xl border border-slate-200 bg-white p-4" title="Lo ya pagado de esos servicios">
          <p className="text-xs font-medium text-slate-500">Ya pagado</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">{moneyFmt.format(totalPaid)}</p>
          <p className="mt-0.5 text-xs text-slate-500">
            {loadingPayments ? "…" : `${paymentCount} pago${paymentCount !== 1 ? "s" : ""} en este período`}
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
              <th className="px-3 py-2.5 text-right" title="Lo que ya se le pagó de esos servicios">Ya pagado</th>
              <th className="px-3 py-2.5 text-right" title="Comisión ganada menos ya pagado">Falta pagar</th>
              <th className="px-4 py-2.5 text-right">
                <span className="sr-only">Acciones</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {proStats.map(({ pro, earned, paid, pending, totalCaja: caja, visiblePayments, sortedTickets, payableCount, completedCount, cancelledCount }, proIndex) => {
              const isExpanded = expandedId === pro.id;
              const hasPending = pending > 0.005;

              return (
                <Fragment key={pro.id}>
                  <tr className={`last:border-b-0 ${isExpanded ? "bg-slate-100" : "border-b border-slate-100 hover:bg-slate-50/70"}`}>
                    <td className={`border-l-4 px-4 py-3 ${isExpanded ? "border-l-slate-800" : "border-l-transparent"}`}>
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
                        Cobrado {moneyFmt.format(caja)}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right font-medium tabular-nums text-slate-900">{moneyFmt.format(earned)}</td>
                    <td className="px-3 py-3 text-right tabular-nums text-slate-700">{moneyFmt.format(paid)}</td>
                    <td className="px-3 py-3 text-right tabular-nums">
                      {earned === 0 ? (
                        <span className="text-slate-400" title="Sin servicios completados en el período">—</span>
                      ) : hasPending ? (
                        <span className="font-bold text-slate-900">{moneyFmt.format(pending)}</span>
                      ) : paid - earned > 0.005 ? (
                        <span className="inline-flex flex-col items-end text-xs font-medium text-slate-600" title="Se le pagó más de lo que ganó en este período">
                          <span className="inline-flex items-center gap-1"><CheckCircle className="h-3.5 w-3.5" /> Sin pendiente</span>
                          <span className="text-[11px] font-semibold text-slate-800">Pagado de más {moneyFmt.format(paid - earned)}</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-500">
                          <CheckCircle className="h-3.5 w-3.5" /> Al día
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1.5">
                        {canPay && payableCount > 0 ? (
                          <button
                            type="button"
                            {...(proIndex === 0 ? { "data-tour": "cm-register" } : {})}
                            title="Elige qué servicios pagarle ahora"
                            onClick={() => setExpandedId(pro.id)}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-[#094732] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[#0d6045]"
                          >
                            <Banknote className="h-3.5 w-3.5" />
                            Pagar
                          </button>
                        ) : null}
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

                  {isExpanded && (
                    <tr className="border-b-2 border-slate-300 bg-slate-100">
                      <td colSpan={6} className="border-l-4 border-l-slate-800 px-4 pb-5 pt-1">
                        <div className="rounded-xl border border-slate-300 bg-slate-50 p-4 shadow-sm">
                        <div className="mb-3 flex items-center justify-between gap-3 border-b border-slate-200 pb-2">
                          <p className="text-sm font-semibold text-slate-900">
                            Detalle de <span className="font-bold">{pro.username}</span>
                          </p>
                          <button
                            type="button"
                            onClick={() => setExpandedId(null)}
                            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-slate-500 transition hover:bg-slate-200 hover:text-slate-900"
                          >
                            Cerrar detalle <ChevronUp className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        <PaymentGroups
                          payments={visiblePayments}
                          tickets={sortedTickets}
                          loading={loadingPayments}
                          pendingAmount={pending}
                          overpaidAmount={Math.max(0, paid - earned)}
                          canPay={canPay}
                          canVoid={canVoid}
                          selected={selected}
                          onToggle={toggleSelected}
                          onToggleAll={toggleAll}
                          onPay={(ids) => openPay(pro.username, ids)}
                          onVoid={(t) => { setVoidMotivo(""); setVoidTarget(t); }}
                          onDeletePayment={(id) => void handleDeletePayment(id)}
                        />
                        </div>
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
          ¿Cómo leer esta tabla y cómo se paga?
          <ChevronDown className="ml-auto h-4 w-4 text-slate-400 transition-transform group-open:rotate-180" />
        </summary>
        <ul className="mt-2 space-y-1.5 text-xs leading-relaxed text-slate-600">
          <li><strong className="text-slate-800">Falta pagar = Comisión ganada − Ya pagado</strong>, siempre del mismo período.</li>
          <li>
            <strong className="text-slate-800">Comisión ganada:</strong> lo que le corresponde por los servicios <em>completados</em> (los cancelados no cuentan).
          </li>
          <li>
            <strong className="text-slate-800">Para pagar:</strong> pulsa <em>Pagar</em> en la operaria, marca los servicios que le pagas y confirma. Dirás si el dinero salió del
            efectivo de la caja: si sí, se descuenta del efectivo esperado al cerrar. El pago también queda como egreso en el Corte de caja.
          </li>
          <li>
            <strong className="text-slate-800">Anular:</strong> dentro del <em>Detalle</em>, cada servicio pagado tiene "Anular" por si se marcó por error; vuelve a quedar pendiente.
          </li>
        </ul>
      </details>

      {/* Confirmar el pago: aquí se pregunta de dónde salió el dinero */}
      <GenericModal
        isOpen={payTarget !== null}
        onClose={() => { if (!paying) setPayTarget(null); }}
        title="Confirmar pago de comisión"
        size="sm"
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setPayTarget(null)} disabled={paying}>
              Cancelar
            </Button>
            <Button size="sm" onClick={() => void handleConfirmPay()} disabled={paying || fromCash === null}>
              {paying ? "Guardando…" : "Confirmar pago"}
            </Button>
          </>
        }
      >
        {payTarget && (
          <div className="space-y-4 text-sm text-slate-800">
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-center">
              <p className="text-xs text-slate-500">
                Pagar a <strong className="text-slate-800">{payTarget.proName}</strong> por {payTarget.ids.length} servicio
                {payTarget.ids.length !== 1 ? "s" : ""}
              </p>
              <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">{moneyFmt.format(payTotal)}</p>
            </div>

            {payExcess > 0.005 ? (
              <p role="alert" className="rounded-lg border border-slate-300 bg-slate-100 px-3 py-2 text-xs text-slate-800">
                <strong>Ojo:</strong> esto es <strong>{moneyFmt.format(payExcess)} más</strong> de lo que le falta. Ya tiene pagos manuales antiguos que cubrían
                parte de estos servicios sin marcarlos. Si confirmas, quedará pagado de más.
              </p>
            ) : null}

            <fieldset className="space-y-2">
              <legend className="mb-1 text-xs font-semibold text-slate-700">¿De dónde sale el dinero? *</legend>
              {([
                ["yes", "Del efectivo de la caja", "Se descuenta del efectivo esperado al cerrar la caja."],
                ["no", "De otro medio", "Transferencia u otro: no afecta el efectivo de la caja."],
              ] as const).map(([value, title, hint]) => (
                <label
                  key={value}
                  className={`flex cursor-pointer items-start gap-2.5 rounded-lg border px-3 py-2.5 transition ${
                    fromCash === value ? "border-slate-800 bg-slate-50" : "border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  <input
                    type="radio"
                    name="commission-from-cash"
                    className="mt-0.5 h-4 w-4 accent-slate-800"
                    checked={fromCash === value}
                    onChange={() => setFromCash(value)}
                  />
                  <span>
                    <span className="block text-sm font-medium text-slate-900">{title}</span>
                    <span className="block text-xs text-slate-500">{hint}</span>
                  </span>
                </label>
              ))}
            </fieldset>
            <p className="text-xs text-slate-500">
              Se guarda todo junto o nada, y queda como egreso en el Corte de caja con quién lo pagó y cuándo.
            </p>
          </div>
        )}
      </GenericModal>

      {/* Anular el pago de un servicio */}
      <GenericModal
        isOpen={voidTarget !== null}
        onClose={() => { if (!voiding) setVoidTarget(null); }}
        title="Anular pago de comisión"
        size="sm"
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setVoidTarget(null)} disabled={voiding}>
              Cancelar
            </Button>
            <Button variant="danger" size="sm" onClick={() => void handleConfirmVoid()} disabled={voiding}>
              {voiding ? "Anulando…" : "Anular pago"}
            </Button>
          </>
        }
      >
        {voidTarget && (
          <div className="space-y-3 text-sm text-slate-800">
            <p>
              El servicio <strong>{voidTarget.ticket_code ?? `#${voidTarget.id}`}</strong> de{" "}
              <strong>{voidTarget.professional_name ?? "sin operaria"}</strong> volverá a quedar pendiente y se descontarán{" "}
              <strong>{moneyFmt.format(voidTarget.pagado_monto ?? getTicketCommission(voidTarget))}</strong> de su pago.
            </p>
            <label className="block">
              <span className="text-xs font-semibold text-slate-500">Motivo (opcional)</span>
              <input
                type="text"
                value={voidMotivo}
                maxLength={300}
                onChange={(e) => setVoidMotivo(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-slate-500"
                placeholder="Ej. se marcó por error"
              />
            </label>
          </div>
        )}
      </GenericModal>
    </div>
  );
}
