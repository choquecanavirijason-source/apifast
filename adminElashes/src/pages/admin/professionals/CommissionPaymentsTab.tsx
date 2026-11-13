import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle, Clock, Plus, X, ChevronDown, ChevronUp, Banknote, RefreshCw, Info } from "lucide-react";
import { toast } from "react-toastify";
import type { ProfessionalForSelect, TicketItem } from "@/core/services/agenda/agenda.service";
import { CommissionPaymentsService, type CommissionPaymentOut } from "@/core/services/commission-payments/commission-payments.service";
import { Button, SectionCard } from "@/components/common/ui";
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

// ─── Tabla tipo libreta ───────────────────────────────────────────────────────

function TicketLedger({ tickets, proName }: { tickets: TicketItem[]; proName: string }) {
  if (tickets.length === 0) {
    return <p className="py-3 text-xs text-slate-400">Sin tickets en el período seleccionado.</p>;
  }

  let totalComision = 0;
  let totalCaja = 0;

  const rows = tickets.map((t) => {
    const isCancelled = t.status === "cancelled";
    const caja = isCancelled ? 0 : getTicketPriceTotal(t);
    const comision = isCancelled ? 0 : getTicketCommission(t);
    totalComision += comision;
    totalCaja += caja;
    const services = t.service_names?.length ? t.service_names.join(", ") : (t.service_name ?? "");
    return { t, isCancelled, caja, comision, services };
  });

  return (
    <div className="mt-3 overflow-hidden rounded-lg border border-slate-200">
      <div className="border-b border-slate-200 bg-slate-50 px-4 py-2 text-center">
        <span className="text-sm font-bold text-slate-700">{proName}</span>
        <p className="mt-0.5 text-[11px] text-slate-500">
          Cada fila es un servicio atendido en el período. Los cancelados (tachados) no suman comisión.
        </p>
      </div>
      {/* overflow-x-auto + table-fixed: sin esto, el ancho de cada columna
          seguía al contenido de esa fila y quedaba despareja entre filas,
          además de desbordar el contenedor en pantallas angostas. */}
      <div className="overflow-x-auto">
        {/* Comisión/Caja con ancho fijo en px (no %): en una tabla de solo 4
            columnas ocupando todo el ancho del modal, darles porcentaje las
            estiraba mucho y el número quedaba pegado al borde derecho, muy
            lejos del resto de la fila. Con ancho fijo angosto quedan cerca
            del contenido, igual que en Historial de tickets. */}
        <table className="w-full min-w-[480px] table-fixed border-collapse text-xs">
          <colgroup>
            <col className="w-[26%]" />
            <col />
            <col className="w-28" />
            <col className="w-28" />
          </colgroup>
          <thead>
            <tr className="bg-slate-100 text-slate-600">
              <th className="border-b border-slate-200 px-3 py-2 text-left font-semibold">Cliente</th>
              <th className="border-b border-slate-200 px-3 py-2 text-left font-semibold text-[11px]">Servicio</th>
              <th className="border-b border-slate-200 px-3 py-2 text-right font-semibold" title="Lo que le corresponde a la operaria por este servicio">Comisión</th>
              <th className="border-b border-slate-200 px-3 py-2 text-right font-semibold" title="Lo que pagó la clienta por el servicio">Cobrado</th>
            </tr>
          </thead>
        <tbody>
          {rows.map(({ t, isCancelled, caja, comision, services }) => (
            <tr key={t.id} className={isCancelled ? "bg-slate-100" : "odd:bg-white even:bg-slate-50"}>
              <td className={`truncate border-b border-slate-100 px-3 py-2 font-medium ${isCancelled ? "text-slate-400 line-through" : "text-slate-800"}`} title={t.client_name || undefined}>
                {isCancelled && <span className="mr-1 font-bold text-slate-400">✕</span>}
                {t.client_name || "—"}
              </td>
              <td className={`truncate border-b border-slate-100 px-3 py-2 text-[10px] ${isCancelled ? "text-slate-300 line-through" : "text-slate-500"}`} title={services || undefined}>
                {services || "—"}
              </td>
              <td className={`border-b border-slate-100 px-3 py-2 text-right tabular-nums ${isCancelled ? "text-slate-300" : "font-semibold text-slate-700"}`}>
                {isCancelled ? "—" : moneyFmt.format(comision)}
              </td>
              <td className={`border-b border-slate-100 px-3 py-2 text-right tabular-nums ${isCancelled ? "text-slate-300" : "font-semibold text-[#094732]"}`}>
                {isCancelled ? "—" : moneyFmt.format(caja)}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="bg-slate-100 font-bold">
            <td className="border-t-2 border-slate-300 px-3 py-2 text-slate-700" colSpan={2}>TOTAL</td>
            <td className="border-t-2 border-slate-300 px-3 py-2 text-right tabular-nums text-slate-800">{moneyFmt.format(totalComision)}</td>
            <td className="border-t-2 border-slate-300 px-3 py-2 text-right tabular-nums text-[#094732]">{moneyFmt.format(totalCaja)}</td>
          </tr>
        </tfoot>
        </table>
      </div>
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
    <form onSubmit={(e) => void handleSubmit(e)} className="mt-3 rounded-xl border border-[#094732]/20 bg-[#ecfdf5] p-4">
      <p className="mb-1 text-xs font-semibold text-[#094732]">
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

  return (
    <div className="flex flex-col gap-4">
      {/* Cómo leer esta pantalla */}
      <details data-tour="cm-legend" open className="group rounded-xl border border-sky-200 bg-sky-50/60 px-4 py-3">
        <summary className="flex cursor-pointer list-none items-center gap-2 text-xs font-bold text-sky-900">
          <Info className="h-4 w-4 shrink-0" />
          ¿Cómo leer esta pantalla?
          <ChevronDown className="ml-auto h-4 w-4 transition-transform group-open:rotate-180" />
        </summary>
        <ul className="mt-2 space-y-1.5 text-xs leading-relaxed text-slate-700">
          <li>
            <strong className="text-slate-900">Comisión ganada:</strong> lo que le corresponde a cada operaria por los servicios{" "}
            <em>completados</em> en el período elegido (los cancelados no cuentan). Se calcula con el porcentaje de cada servicio.
          </li>
          <li>
            <strong className="text-slate-900">Pagado:</strong> todo lo que ya se le registró como pagado, sea con{" "}
            <em>Confirmar pago</em> en Historial de tickets o con <em>Registrar pago</em> aquí.
          </li>
          <li>
            <strong className="text-slate-900">Pendiente:</strong> lo ganado menos lo pagado, es decir, lo que todavía falta darle.
          </li>
          <li>
            <strong className="text-slate-900">Registrar pago</strong> (botón verde de cada operaria): anota un pago por un monto libre como control.{" "}
            No marca tickets ni aparece en el Corte de caja; para eso usa <em>Confirmar pago</em> en Historial de tickets.
          </li>
          <li>
            <strong className="text-slate-900">Ver detalle:</strong> abre los servicios que sumaron la comisión y el historial de pagos de esa operaria.
          </li>
        </ul>
      </details>

      {/* Resumen global */}
      <div data-tour="cm-summary" className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4 text-center shadow-sm" title="Suma de las comisiones de todos los servicios completados en el período">
          <p className="text-xs font-semibold text-slate-500">Comisiones ganadas</p>
          <p className="mt-1 text-xl font-bold text-slate-800">{moneyFmt.format(totalEarned)}</p>
          <p className="text-[11px] text-slate-400">de servicios completados en el período</p>
        </div>
        <div className="rounded-xl border border-[#094732]/20 bg-[#ecfdf5] p-4 text-center shadow-sm" title="Suma de todos los pagos registrados a estas operarias">
          <p className="text-xs font-semibold text-[#094732]">Total pagado</p>
          <p className="mt-1 text-xl font-bold text-[#094732]">{moneyFmt.format(totalPaid)}</p>
          <p className="text-[11px] text-[#094732]/80">
            {loadingPayments ? "…" : `ya entregado · ${payments.length} pago${payments.length !== 1 ? "s" : ""} registrado${payments.length !== 1 ? "s" : ""}`}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-center shadow-sm" title="Lo ganado menos lo pagado">
          <p className="text-xs font-semibold text-slate-500">Pendiente por pagar</p>
          <p className="mt-1 text-xl font-bold text-slate-800">{moneyFmt.format(totalPending)}</p>
          <p className="text-[11px] text-slate-500">
            falta darle a {proStats.filter((s) => s.pending > 0).length} operaria{proStats.filter((s) => s.pending > 0).length !== 1 ? "s" : ""}
          </p>
        </div>
      </div>

      {selectedProfessionalId !== null && visibleProfessionals[0] && (
        <p className="text-xs font-semibold text-slate-600">
          Mostrando solo a {visibleProfessionals[0].username} — elegido en "Historial de tickets".
        </p>
      )}

      {(fromDate || toDate) && (
        <p className="text-xs text-slate-500">
          Período: <strong>{fromDate ? dateFmt(fromDate) : "inicio"}</strong> — <strong>{toDate ? dateFmt(toDate) : "hoy"}</strong>
        </p>
      )}

      {/* Tarjetas por operaria */}
      {proStats.map(({ pro, earned, paid, pending, isPaid, totalCaja, proPayments, sortedTickets, completedCount, cancelledCount }, proIndex) => {
        const isExpanded = expandedId === pro.id;
        const isRegistering = registeringId === pro.id;

        return (
          <SectionCard key={pro.id} bodyClassName="!p-4">
            <div {...(proIndex === 0 ? { "data-tour": "cm-card" } : {})} className="flex flex-wrap items-center gap-3">
              <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                isPaid ? "bg-[#094732] text-white" : "bg-slate-200 text-slate-600"
              }`}>
                {getInitials(pro.username)}
              </div>

              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-slate-800">{pro.username}</p>
                <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                  <span className="font-semibold text-[#094732]" title="Servicios terminados en el período: son los que generan comisión">{completedCount} completados</span>
                  {cancelledCount > 0 && (
                    <span className="font-semibold text-slate-500" title="No generan comisión">{cancelledCount} cancelados</span>
                  )}
                  <span className="text-slate-300">·</span>
                  <span title="Lo que pagaron las clientas por los servicios completados">Cobrado en servicios: <strong className="text-slate-700">{moneyFmt.format(totalCaja)}</strong></span>
                  <span className="text-slate-300">·</span>
                  <span title="Lo que le corresponde a la operaria por esos servicios">Comisión ganada: <strong className="text-slate-700">{moneyFmt.format(earned)}</strong></span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {earned === 0 ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold text-slate-500" title="No tiene servicios completados en el período, así que no hay nada que pagar">
                    Sin comisión
                  </span>
                ) : isPaid ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-[#ecfdf5] px-3 py-1 text-[11px] font-bold text-[#094732]" title="Ya se le pagó toda la comisión ganada">
                    <CheckCircle className="h-3.5 w-3.5" />Pagado completo
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-[11px] font-bold text-slate-600" title="Lo que todavía falta pagarle: ganado menos pagado">
                    <Clock className="h-3.5 w-3.5" />Falta pagar {moneyFmt.format(pending)}
                  </span>
                )}

                {earned > 0 && (
                  <Button
                    type="button"
                    size="sm"
                    {...(proIndex === 0 ? { "data-tour": "cm-register" } : {})}
                    title="Anota un pago por el monto que le entregaste. No entra al Corte de caja (para eso: Historial de tickets → Confirmar pago)"
                    variant={isPaid ? "secondary" : "primary"}
                    onClick={() => { setRegisteringId(isRegistering ? null : pro.id); setExpandedId(pro.id); }}
                    leftIcon={<Banknote className="h-3.5 w-3.5" />}
                  >
                    {isPaid ? "Registrar otro pago" : "Registrar pago"}
                  </Button>
                )}

                <button
                  type="button"
                  onClick={() => setExpandedId(isExpanded ? null : pro.id)}
                  className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-semibold text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
                >
                  {isExpanded ? (
                    <>Ocultar detalle <ChevronUp className="h-3.5 w-3.5" /></>
                  ) : (
                    <>Ver detalle <ChevronDown className="h-3.5 w-3.5" /></>
                  )}
                </button>
              </div>
            </div>

            {/* Barra de progreso */}
            {earned > 0 && (
              <div className="mt-3">
                <div className="mb-1 flex justify-between text-[11px] text-slate-500">
                  <span>Ya pagado: {moneyFmt.format(paid)}</span>
                  <span>{pending > 0.005 ? `Falta: ${moneyFmt.format(pending)}` : "Al día"}</span>
                  <span>Comisión ganada: {moneyFmt.format(earned)}</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-2 rounded-full bg-[#094732] transition-all"
                    style={{ width: `${Math.min(100, earned > 0 ? (paid / earned) * 100 : 0)}%` }}
                  />
                </div>
              </div>
            )}

            {/* Formulario de pago */}
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

            {/* Detalle expandido */}
            {isExpanded && !isRegistering && (
              <div className="mt-4 border-t border-slate-100 pt-3">
                <TicketLedger tickets={sortedTickets} proName={pro.username} />

                <div className="mt-4">
                  <p className="text-xs font-semibold text-slate-500">
                    Historial de pagos registrados
                  </p>
                  <p className="mb-2 text-[11px] text-slate-400">
                    Cada fila es un pago ya entregado (de Confirmar pago o registrado aquí). Si eliminas uno por error, ese monto vuelve a quedar como pendiente.
                  </p>
                  {loadingPayments ? (
                    <p className="flex items-center gap-1 text-xs text-slate-400">
                      <RefreshCw className="h-3 w-3 animate-spin" />Cargando…
                    </p>
                  ) : proPayments.length === 0 ? (
                    <p className="text-xs text-slate-400">No hay pagos registrados aún.</p>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {proPayments.map((p) => (
                        <div
                          key={p.id}
                          className="flex items-center justify-between gap-3 rounded-lg border border-[#094732]/15 bg-[#ecfdf5] px-3 py-2"
                        >
                          <div className="flex items-center gap-3">
                            <CheckCircle className="h-4 w-4 shrink-0 text-[#094732]" />
                            <div>
                              <p className="text-xs font-bold text-[#094732]">{moneyFmt.format(p.amount)}</p>
                              <p className="text-[11px] text-slate-500">
                                {dateFmt(p.registered_at)}
                                {p.period_start && <> · {dateFmt(p.period_start)} — {p.period_end ? dateFmt(p.period_end) : "hoy"}</>}
                                {p.notes && <> · {p.notes}</>}
                                {p.registered_by_name && <> · por {p.registered_by_name}</>}
                              </p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => void handleDeletePayment(p.id)}
                            className="rounded p-1 text-slate-300 transition-colors hover:bg-red-50 hover:text-red-500"
                            title="Eliminar registro"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </SectionCard>
        );
      })}
    </div>
  );
}
