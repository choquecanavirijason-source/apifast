import { useMemo, useState } from "react";
import { CheckCircle, Clock, Plus, X, ChevronDown, ChevronUp, Banknote } from "lucide-react";
import type { ProfessionalForSelect, TicketItem } from "@/core/services/agenda/agenda.service";
import { Button, SectionCard } from "@/components/common/ui";
import {
  formatCommissionRatePercent,
  getTicketCommission,
  getTicketPriceTotal,
} from "./professionalCommission.utils";

const STORAGE_KEY = "elashes-commission-payments";

type CommissionPayment = {
  id: string;
  professional_id: number;
  professional_name: string;
  amount: number;
  period_start: string;
  period_end: string;
  notes: string;
  registered_at: string;
};

function loadPayments(): CommissionPayment[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as CommissionPayment[];
  } catch {
    return [];
  }
}

function savePayments(payments: CommissionPayment[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payments));
  } catch { /* ignore */ }
}

const moneyFmt = new Intl.NumberFormat("es-BO", {
  style: "currency",
  currency: "BOB",
  maximumFractionDigits: 2,
});

const dateFmt = (iso: string) =>
  iso
    ? new Date(iso).toLocaleDateString("es-BO", { day: "2-digit", month: "short", year: "numeric" })
    : "—";

const CARD_COLORS = [
  { bg: "bg-violet-100", text: "text-violet-800" },
  { bg: "bg-pink-100", text: "text-pink-800" },
  { bg: "bg-sky-100", text: "text-sky-800" },
  { bg: "bg-amber-100", text: "text-amber-800" },
  { bg: "bg-emerald-100", text: "text-emerald-800" },
  { bg: "bg-rose-100", text: "text-rose-800" },
  { bg: "bg-indigo-100", text: "text-indigo-800" },
  { bg: "bg-teal-100", text: "text-teal-800" },
];

function getInitials(name: string) {
  return name.split(" ").map((w) => w[0] ?? "").join("").toUpperCase().slice(0, 2);
}

// ─── Tabla tipo libreta: Nombre | Comisión | Caja ─────────────────────────

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
      {/* Título libreta */}
      <div className="border-b border-slate-200 bg-slate-50 px-4 py-2 text-center">
        <span className="text-sm font-bold text-slate-700">{proName}</span>
      </div>

      <table className="w-full border-collapse text-xs">
        <thead>
          <tr className="bg-slate-100 text-slate-600">
            <th className="border-b border-slate-200 px-3 py-2 text-left font-semibold uppercase tracking-wide">Nombre</th>
            <th className="border-b border-slate-200 px-3 py-2 text-left font-semibold uppercase tracking-wide text-slate-500 text-[10px]">Servicio</th>
            <th className="border-b border-slate-200 px-3 py-2 text-right font-semibold uppercase tracking-wide">Comisión</th>
            <th className="border-b border-slate-200 px-3 py-2 text-right font-semibold uppercase tracking-wide">Caja</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ t, isCancelled, caja, comision, services }) => (
            <tr
              key={t.id}
              className={isCancelled ? "bg-rose-50" : "odd:bg-white even:bg-slate-50"}
            >
              <td className={`border-b border-slate-100 px-3 py-2 font-medium ${isCancelled ? "text-slate-400 line-through" : "text-slate-800"}`}>
                {isCancelled && <span className="mr-1 font-bold text-rose-500 no-underline" style={{ textDecoration: "none" }}>✕</span>}
                {t.client_name || "—"}
              </td>
              <td className={`border-b border-slate-100 px-3 py-2 text-[10px] ${isCancelled ? "text-slate-300 line-through" : "text-slate-500"}`}>
                {services || "—"}
              </td>
              <td className={`border-b border-slate-100 px-3 py-2 text-right tabular-nums ${isCancelled ? "text-slate-300" : "font-semibold text-blue-700"}`}>
                {isCancelled ? "—" : moneyFmt.format(comision)}
              </td>
              <td className={`border-b border-slate-100 px-3 py-2 text-right tabular-nums ${isCancelled ? "text-slate-300" : "font-semibold text-emerald-700"}`}>
                {isCancelled ? "—" : moneyFmt.format(caja)}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="bg-slate-100 font-bold">
            <td className="border-t-2 border-slate-300 px-3 py-2 text-slate-700" colSpan={2}>
              TOTAL
            </td>
            <td className="border-t-2 border-slate-300 px-3 py-2 text-right tabular-nums text-blue-800">
              {moneyFmt.format(totalComision)}
            </td>
            <td className="border-t-2 border-slate-300 px-3 py-2 text-right tabular-nums text-emerald-800">
              {moneyFmt.format(totalCaja)}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

// ─── Formulario para registrar pago ───────────────────────────────────────

function RegisterPaymentForm({
  professional,
  defaultAmount,
  fromDate,
  toDate,
  onSave,
  onCancel,
}: {
  professional: ProfessionalForSelect;
  defaultAmount: number;
  fromDate: string;
  toDate: string;
  onSave: (p: CommissionPayment) => void;
  onCancel: () => void;
}) {
  const [amount, setAmount] = useState(String(Math.max(0, defaultAmount).toFixed(2)));
  const [notes, setNotes] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));

  const fieldClass =
    "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-[#094732] focus:ring-1 focus:ring-[#094732]/25";

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(amount);
    if (Number.isNaN(amt) || amt <= 0) return;
    onSave({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      professional_id: professional.id,
      professional_name: professional.username,
      amount: amt,
      period_start: fromDate,
      period_end: toDate,
      notes: notes.trim(),
      registered_at: new Date(`${date}T12:00:00`).toISOString(),
    });
  };

  return (
    <form onSubmit={handleSubmit} className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
      <p className="mb-3 text-xs font-bold uppercase tracking-wide text-emerald-800">
        Registrar pago — {professional.username}
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
        <Button type="submit" size="sm">
          <Plus className="h-3.5 w-3.5" />Guardar pago
        </Button>
        <Button type="button" variant="secondary" size="sm" onClick={onCancel}>
          <X className="h-3.5 w-3.5" />Cancelar
        </Button>
        <span className="text-[11px] text-slate-500">
          Período: {fromDate ? dateFmt(fromDate) : "inicio"} — {toDate ? dateFmt(toDate) : "hoy"}
        </span>
      </div>
    </form>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────

type Props = {
  professionals: ProfessionalForSelect[];
  tickets: TicketItem[];
  fromDate: string;
  toDate: string;
};

export default function CommissionPaymentsTab({ professionals, tickets, fromDate, toDate }: Props) {
  const [payments, setPayments] = useState<CommissionPayment[]>(() => loadPayments());
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [registeringId, setRegisteringId] = useState<number | null>(null);

  const proStats = useMemo(() => {
    return professionals.map((pro, index) => {
      // Todos los tickets del período para esta operaria (completados + cancelados)
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

      // Orden: completados primero, cancelados al final
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
  }, [professionals, tickets, payments]);

  const totalEarned = useMemo(() => proStats.reduce((s, p) => s + p.earned, 0), [proStats]);
  const totalPaid = useMemo(() => proStats.reduce((s, p) => s + p.paid, 0), [proStats]);
  const totalPending = useMemo(() => proStats.reduce((s, p) => s + p.pending, 0), [proStats]);

  const handleSavePayment = (payment: CommissionPayment) => {
    const updated = [...payments, payment];
    setPayments(updated);
    savePayments(updated);
    setRegisteringId(null);
  };

  const handleDeletePayment = (id: string) => {
    if (!confirm("¿Eliminar este registro de pago?")) return;
    const updated = payments.filter((p) => p.id !== id);
    setPayments(updated);
    savePayments(updated);
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
      {/* ── Resumen global ───────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4 text-center shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Comisiones ganadas</p>
          <p className="mt-1 text-xl font-bold text-slate-800">{moneyFmt.format(totalEarned)}</p>
          <p className="text-[11px] text-slate-400">{formatCommissionRatePercent()} de tickets completados</p>
        </div>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-center shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Total pagado</p>
          <p className="mt-1 text-xl font-bold text-emerald-800">{moneyFmt.format(totalPaid)}</p>
          <p className="text-[11px] text-emerald-600">{payments.length} registro{payments.length !== 1 ? "s" : ""}</p>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-center shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">Pendiente</p>
          <p className="mt-1 text-xl font-bold text-amber-800">{moneyFmt.format(totalPending)}</p>
          <p className="text-[11px] text-amber-600">
            {proStats.filter((s) => s.pending > 0).length} operaria{proStats.filter((s) => s.pending > 0).length !== 1 ? "s" : ""}
          </p>
        </div>
      </div>

      {(fromDate || toDate) && (
        <p className="text-xs text-slate-500">
          Período: <strong>{fromDate ? dateFmt(fromDate) : "inicio"}</strong> — <strong>{toDate ? dateFmt(toDate) : "hoy"}</strong>
        </p>
      )}

      {/* ── Tarjetas por operaria ────────────────────────────────────── */}
      {proStats.map(({ pro, index, earned, paid, pending, isPaid, totalCaja, proPayments, sortedTickets, completedCount, cancelledCount }) => {
        const color = CARD_COLORS[index % CARD_COLORS.length];
        const isExpanded = expandedId === pro.id;
        const isRegistering = registeringId === pro.id;

        return (
          <SectionCard key={pro.id} bodyClassName="!p-4">
            {/* Cabecera */}
            <div className="flex flex-wrap items-center gap-3">
              <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                isPaid ? "bg-emerald-500 text-white" : earned > 0 ? "bg-amber-400 text-white" : `${color.bg} ${color.text}`
              }`}>
                {getInitials(pro.username)}
              </div>

              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-slate-800">{pro.username}</p>
                <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                  <span className="text-emerald-700 font-semibold">{completedCount} completados</span>
                  {cancelledCount > 0 && (
                    <span className="text-rose-500 font-semibold">{cancelledCount} cancelados</span>
                  )}
                  <span className="text-slate-300">·</span>
                  <span>Caja: <strong className="text-slate-700">{moneyFmt.format(totalCaja)}</strong></span>
                  <span className="text-slate-300">·</span>
                  <span>Comisión: <strong className="text-blue-700">{moneyFmt.format(earned)}</strong></span>
                </div>
              </div>

              {/* Estado de pago */}
              <div className="flex items-center gap-2">
                {earned === 0 ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold text-slate-500">
                    Sin comisión
                  </span>
                ) : isPaid ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-3 py-1 text-[11px] font-bold text-emerald-700">
                    <CheckCircle className="h-3.5 w-3.5" />
                    Pagado
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-3 py-1 text-[11px] font-bold text-amber-700">
                    <Clock className="h-3.5 w-3.5" />
                    Pendiente {moneyFmt.format(pending)}
                  </span>
                )}

                {earned > 0 && (
                  <Button
                    type="button"
                    size="sm"
                    variant={isPaid ? "secondary" : "primary"}
                    onClick={() => { setRegisteringId(isRegistering ? null : pro.id); setExpandedId(pro.id); }}
                  >
                    <Banknote className="h-3.5 w-3.5" />
                    {isPaid ? "Registrar otro pago" : "Registrar pago"}
                  </Button>
                )}

                <button
                  type="button"
                  onClick={() => setExpandedId(isExpanded ? null : pro.id)}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
                  title={isExpanded ? "Ocultar detalle" : "Ver detalle de tickets"}
                >
                  {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Barra de progreso */}
            {earned > 0 && (
              <div className="mt-3">
                <div className="mb-1 flex justify-between text-[11px] text-slate-500">
                  <span>Pagado: {moneyFmt.format(paid)}</span>
                  <span>Ganado: {moneyFmt.format(earned)}</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-2 rounded-full bg-emerald-500 transition-all"
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
                onSave={handleSavePayment}
                onCancel={() => setRegisteringId(null)}
              />
            )}

            {/* Detalle expandido */}
            {isExpanded && !isRegistering && (
              <div className="mt-4 border-t border-slate-100 pt-3">

                {/* Tabla tipo libreta: Nombre | Comisión | Caja */}
                <TicketLedger tickets={sortedTickets} proName={pro.username} />

                {/* Historial de pagos registrados */}
                <div className="mt-4">
                  <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">
                    Pagos registrados
                  </p>
                  {proPayments.length === 0 ? (
                    <p className="text-xs text-slate-400">No hay pagos registrados aún.</p>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {proPayments.map((p) => (
                        <div
                          key={p.id}
                          className="flex items-center justify-between gap-3 rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2"
                        >
                          <div className="flex items-center gap-3">
                            <CheckCircle className="h-4 w-4 shrink-0 text-emerald-500" />
                            <div>
                              <p className="text-xs font-bold text-emerald-700">{moneyFmt.format(p.amount)}</p>
                              <p className="text-[11px] text-slate-500">
                                {dateFmt(p.registered_at)}
                                {p.period_start && <> · {dateFmt(p.period_start)} — {p.period_end ? dateFmt(p.period_end) : "hoy"}</>}
                                {p.notes && <> · {p.notes}</>}
                              </p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleDeletePayment(p.id)}
                            className="rounded p-1 text-slate-300 hover:bg-red-50 hover:text-red-500 transition-colors"
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
