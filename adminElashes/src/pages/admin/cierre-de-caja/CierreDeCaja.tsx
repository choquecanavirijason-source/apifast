import { useEffect, useMemo, useState } from "react";
import { Banknote, CheckCircle, CreditCard, Printer, QrCode, Wallet, XCircle } from "lucide-react";
import { toast } from "react-toastify";

import { AgendaService, type ProfessionalForSelect } from "../../../core/services/agenda/agenda.service";
import { BranchService } from "../../../core/services/branch/branch.service";
import {
  ReportsService,
  type DailyClosingItem,
  type DailyClosingResponse,
} from "../../../core/services/reports/reports.service";

// ── Constantes ────────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<string, string> = {
  pending:    "Pendiente",
  in_service: "En servicio",
  confirmed:  "Confirmado",
  completed:  "Completado",
  cancelled:  "Cancelado",
};

const STATUS_CLASS: Record<string, string> = {
  pending:    "bg-yellow-100 text-yellow-800",
  in_service: "bg-blue-100 text-blue-800",
  confirmed:  "bg-indigo-100 text-indigo-800",
  completed:  "bg-green-100 text-green-800",
  cancelled:  "bg-red-100 text-red-800",
};

const PAYMENT_LABELS: Record<string, string> = {
  cash:     "Efectivo",
  qr:       "QR",
  transfer: "Transferencia",
  card:     "Tarjeta",
};

const PAYMENT_ICONS: Record<string, typeof Banknote> = {
  cash:     Banknote,
  qr:       QrCode,
  transfer: Wallet,
  card:     CreditCard,
};

const PAYMENT_COLORS: Record<string, string> = {
  cash:     "bg-emerald-50 text-emerald-700 border-emerald-200",
  qr:       "bg-violet-50 text-violet-700 border-violet-200",
  transfer: "bg-blue-50 text-blue-700 border-blue-200",
  card:     "bg-orange-50 text-orange-700 border-orange-200",
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("es-BO", { hour: "2-digit", minute: "2-digit" });
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-BO", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function PaymentBadge({ method }: { method: string | null }) {
  if (!method) return <span className="text-[10px] text-[#a19f9d]">Sin cobrar</span>;
  const Icon = PAYMENT_ICONS[method] ?? Banknote;
  const color = PAYMENT_COLORS[method] ?? "bg-gray-50 text-gray-700 border-gray-200";
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${color}`}>
      <Icon size={10} />
      {PAYMENT_LABELS[method] ?? method}
    </span>
  );
}

// ── Impresión ─────────────────────────────────────────────────────────────────

function printReport(
  date: string,
  branchName: string,
  professionalName: string,
  report: DailyClosingResponse,
  paymentConfirmations: Record<string, { confirmedAt: string; amount: number }> = {},
) {
  const rows = report.items
    .map((item, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>${item.ticket_code ?? "-"}</td>
        <td>${item.sale_code ?? "-"}</td>
        <td>${item.client_name}</td>
        <td>${item.service_names.join(", ")}</td>
        <td>${item.professional_name}</td>
        <td>${fmtDate(item.start_time)} ${fmtTime(item.start_time)}</td>
        <td>${item.duration_minutes} min</td>
        <td>${STATUS_LABELS[item.status] ?? item.status}</td>
        <td>${item.payment_method ? PAYMENT_LABELS[item.payment_method] ?? item.payment_method : "Sin cobrar"}</td>
        <td>Bs ${item.total_price.toFixed(2)}</td>
        <td>${(item.commission_rate * 100).toFixed(0)}% = Bs ${item.commission.toFixed(2)}</td>
      </tr>`)
    .join("");

  const summaryRows = report.summary_by_professional
    .map(p => {
      const key = String(p.professional_id ?? p.professional_name);
      const conf = paymentConfirmations[key];
      return `
      <tr>
        <td>${p.professional_name}</td>
        <td>${p.ticket_count}</td>
        <td>Bs ${p.total_price.toFixed(2)}</td>
        <td>${(p.commission_rate * 100).toFixed(0)}%</td>
        <td>Bs ${p.commission.toFixed(2)}</td>
        <td>${conf ? `✓ Confirmado (${conf.confirmedAt})` : "Pendiente"}</td>
      </tr>`;
    })
    .join("");

  const paymentRows = Object.entries(report.totals_by_payment)
    .map(([method, total]) => `<tr><td>${PAYMENT_LABELS[method] ?? method}</td><td>Bs ${total.toFixed(2)}</td></tr>`)
    .join("");

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <title>Cierre de Caja – ${date}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; font-size: 10px; padding: 16px; color: #1a1a1a; }
    h2 { font-size: 15px; margin-bottom: 4px; }
    h3 { font-size: 12px; margin: 12px 0 6px; }
    .sub { color: #555; margin-bottom: 12px; font-size: 11px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
    th { background: #063324; color: #fff; padding: 5px 6px; text-align: left; font-size: 9px; }
    td { padding: 4px 6px; border-bottom: 1px solid #e5e7eb; vertical-align: top; }
    tr:nth-child(even) td { background: #f9fafb; }
    .total-row td { font-weight: bold; background: #f0fdf4; border-top: 2px solid #065f46; }
    .summary-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    @media print { body { padding: 0; } }
  </style>
</head>
<body>
  <h2>Cierre de Caja</h2>
  <p class="sub">Fecha: ${date}${branchName ? " · " + branchName : ""}${professionalName ? " · Operaria: " + professionalName : ""}</p>

  <div class="summary-grid">
    <div>
      <h3>Resumen por método de pago</h3>
      <table>
        <thead><tr><th>Método</th><th>Total</th></tr></thead>
        <tbody>
          ${paymentRows}
          <tr class="total-row"><td>Sin cobrar</td><td>Bs ${report.total_unpaid.toFixed(2)}</td></tr>
        </tbody>
      </table>
    </div>
    <div>
      <h3>Resumen por operaria</h3>
      <table>
        <thead><tr><th>Operaria</th><th>Tickets</th><th>Total</th><th>%</th><th>Comisión</th><th>Confirmación</th></tr></thead>
        <tbody>${summaryRows}</tbody>
      </table>
    </div>
  </div>

  <h3>Detalle de tickets</h3>
  <table>
    <thead>
      <tr>
        <th>#</th><th>Ticket</th><th>Venta</th><th>Cliente</th><th>Servicio(s)</th>
        <th>Operaria</th><th>Fecha/Hora</th><th>Duración</th><th>Estado</th>
        <th>Pago</th><th>Precio</th><th>Comisión</th>
      </tr>
    </thead>
    <tbody>
      ${rows}
      <tr class="total-row">
        <td colspan="10">TOTALES</td>
        <td>Bs ${report.grand_total.toFixed(2)}</td>
        <td>Bs ${report.grand_commission.toFixed(2)}</td>
      </tr>
    </tbody>
  </table>
</body>
</html>`;

  const win = window.open("", "_blank");
  if (!win) return;
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 300);
}

// ── Componente principal ──────────────────────────────────────────────────────

const EMPTY_REPORT: DailyClosingResponse = {
  date: "",
  branch_id: null,
  branch_name: null,
  items: [],
  grand_total: 0,
  grand_commission: 0,
  total_paid: 0,
  total_unpaid: 0,
  totals_by_payment: {},
  summary_by_professional: [],
};

export default function CierreDeCaja() {
  const [date, setDate] = useState(todayStr());
  const [branchId, setBranchId] = useState<number | null>(null);
  const [professionalId, setProfessionalId] = useState<number | null>(null);
  const [branches, setBranches] = useState<{ id: number; name: string }[]>([]);
  const [professionals, setProfessionals] = useState<ProfessionalForSelect[]>([]);
  const [report, setReport] = useState<DailyClosingResponse>(EMPTY_REPORT);
  const [loading, setLoading] = useState(false);
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  // Confirmaciones de pago: key = professionalId o nombre, value = { confirmedAt, amount }
  const [paymentConfirmations, setPaymentConfirmations] = useState<Record<string, { confirmedAt: string; amount: number }>>({});

  const confirmPayment = (professionalKey: string, amount: number) => {
    setPaymentConfirmations((prev) => ({
      ...prev,
      [professionalKey]: { confirmedAt: new Date().toLocaleString("es-BO"), amount },
    }));
  };

  useEffect(() => {
    BranchService.list({ limit: 100 }).then(setBranches).catch(() => {});
    AgendaService.listProfessionalsForSelect({ limit: 200, role_name: "Operaria" })
      .then(setProfessionals).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    setPaymentConfirmations({});
    ReportsService.getDailyClosing({ date, branch_id: branchId, professional_id: professionalId })
      .then(setReport)
      .catch(() => toast.error("Error al cargar el reporte"))
      .finally(() => setLoading(false));
  }, [date, branchId, professionalId]);

  const updateStatus = async (id: number, newStatus: string) => {
    setUpdatingId(id);
    try {
      await ReportsService.updateStatus(id, newStatus);
      setReport((prev) => ({
        ...prev,
        items: prev.items.map((item) =>
          item.appointment_id === id ? { ...item, status: newStatus } : item
        ),
      }));
      toast.success(newStatus === "completed" ? "Ticket finalizado" : "Ticket cancelado");
    } catch {
      toast.error("No se pudo actualizar el estado");
    } finally {
      setUpdatingId(null);
    }
  };

  const selectedBranchName = useMemo(
    () => branches.find((b) => b.id === branchId)?.name ?? "",
    [branches, branchId]
  );

  const selectedProfessionalName = useMemo(
    () => professionals.find((p) => p.id === professionalId)?.username ?? "",
    [professionals, professionalId]
  );

  const isActionable = (status: string) =>
    status !== "completed" && status !== "cancelled";

  const paymentSummaryEntries = Object.entries(report.totals_by_payment);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#f3f2f1] p-4 sm:p-6">

      {/* Header */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-[#1b1a19]">Cierre de Caja</h1>
          <p className="mt-0.5 text-sm text-[#605e5c]">Reporte diario de tickets por operaria</p>
        </div>
        <button
          onClick={() => printReport(date, selectedBranchName, selectedProfessionalName, report, paymentConfirmations)}
          disabled={report.items.length === 0}
          className="flex items-center gap-2 rounded-sm bg-[#063324] px-4 py-2 text-sm font-semibold text-white hover:bg-[#094d33] disabled:opacity-40"
        >
          <Printer size={15} />
          Imprimir PDF
        </button>
      </div>

      {/* Filtros */}
      <div className="mb-5 flex flex-wrap gap-3">
        {[
          {
            label: "Fecha",
            content: (
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="h-9 rounded-sm border border-[#edebe9] bg-white px-3 text-sm focus:border-[#063324] focus:outline-none"
              />
            ),
          },
          {
            label: "Sucursal",
            content: (
              <select
                value={branchId ?? ""}
                onChange={(e) => setBranchId(e.target.value === "" ? null : Number(e.target.value))}
                className="h-9 rounded-sm border border-[#edebe9] bg-white px-3 text-sm focus:border-[#063324] focus:outline-none"
              >
                <option value="">Todas las sucursales</option>
                {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            ),
          },
          {
            label: "Operaria",
            content: (
              <select
                value={professionalId ?? ""}
                onChange={(e) => setProfessionalId(e.target.value === "" ? null : Number(e.target.value))}
                className="h-9 rounded-sm border border-[#edebe9] bg-white px-3 text-sm focus:border-[#063324] focus:outline-none"
              >
                <option value="">Todas las operarias</option>
                {professionals.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.username}{p.branch_name ? ` — ${p.branch_name}` : ""}
                  </option>
                ))}
              </select>
            ),
          },
        ].map(({ label, content }) => (
          <div key={label} className="flex flex-col gap-1">
            <label className="text-[11px] font-semibold uppercase tracking-wide text-[#605e5c]">{label}</label>
            {content}
          </div>
        ))}
      </div>

      {/* Tarjetas de resumen */}
      {!loading && report.items.length > 0 && (
        <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {/* Total cobrado */}
          <div className="rounded-sm border border-[#edebe9] bg-white p-3 shadow-sm">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-[#605e5c]">Total cobrado</p>
            <p className="mt-1 text-lg font-bold text-[#107c10]">Bs {report.total_paid.toFixed(2)}</p>
          </div>
          {/* Sin cobrar */}
          <div className="rounded-sm border border-[#edebe9] bg-white p-3 shadow-sm">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-[#605e5c]">Sin cobrar</p>
            <p className="mt-1 text-lg font-bold text-[#d83b01]">Bs {report.total_unpaid.toFixed(2)}</p>
          </div>
          {/* Por método de pago */}
          {paymentSummaryEntries.map(([method, total]) => {
            const Icon = PAYMENT_ICONS[method] ?? Banknote;
            return (
              <div key={method} className="rounded-sm border border-[#edebe9] bg-white p-3 shadow-sm">
                <p className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-[#605e5c]">
                  <Icon size={11} />
                  {PAYMENT_LABELS[method] ?? method}
                </p>
                <p className="mt-1 text-lg font-bold text-[#323130]">Bs {total.toFixed(2)}</p>
              </div>
            );
          })}
          {/* Comisiones */}
          <div className="rounded-sm border border-[#edebe9] bg-white p-3 shadow-sm">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-[#605e5c]">Comisiones</p>
            <p className="mt-1 text-lg font-bold text-[#0078d4]">Bs {report.grand_commission.toFixed(2)}</p>
          </div>
        </div>
      )}

      {/* Resumen por operaria */}
      {!loading && report.summary_by_professional.length > 1 && (
        <div className="mb-5 overflow-hidden rounded-sm border border-[#edebe9] bg-white shadow-sm">
          <div className="border-b border-[#edebe9] bg-[#f3f2f1] px-4 py-2">
            <p className="text-xs font-bold uppercase tracking-wide text-[#323130]">Resumen por operaria</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-[#edebe9] bg-[#faf9f8]">
                  {["Operaria", "Tickets", "Total Bs", "% Comisión", "Comisión Bs", "Confirmación"].map((h) => (
                    <th key={h} className="px-4 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-[#605e5c]">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {report.summary_by_professional.map((p) => {
                  const key = String(p.professional_id ?? p.professional_name);
                  const conf = paymentConfirmations[key];
                  return (
                    <tr key={key} className="border-b border-[#edebe9]">
                      <td className="px-4 py-2 font-medium text-[#323130]">{p.professional_name}</td>
                      <td className="px-4 py-2 text-[#605e5c]">{p.ticket_count}</td>
                      <td className="px-4 py-2 font-semibold text-[#323130]">Bs {p.total_price.toFixed(2)}</td>
                      <td className="px-4 py-2 text-[#605e5c]">{(p.commission_rate * 100).toFixed(0)}%</td>
                      <td className="px-4 py-2 font-semibold text-[#0078d4]">Bs {p.commission.toFixed(2)}</td>
                      <td className="px-4 py-2">
                        {conf ? (
                          <div>
                            <span className="inline-block rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-bold text-green-800">
                              ✓ Confirmado
                            </span>
                            <p className="mt-0.5 text-[10px] text-[#605e5c]">{conf.confirmedAt}</p>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => confirmPayment(key, p.commission)}
                            className="rounded-sm border border-[#edebe9] bg-[#f3f2f1] px-3 py-1 text-[11px] font-semibold text-[#323130] hover:bg-[#edebe9]"
                          >
                            Confirmar recibo
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tabla de tickets */}
      <div className="overflow-hidden rounded-sm border border-[#edebe9] bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-250 border-collapse text-sm">
            <thead>
              <tr className="border-b border-[#edebe9] bg-[#f3f2f1]">
                {["#", "Ticket", "Venta", "Cliente", "Servicio(s)", "Operaria",
                  "Fecha/Hora", "Estado", "Pago", "Precio", "Adelanto", "Saldo", "Comisión", "Acciones"].map((col) => (
                  <th key={col} className="px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-[#605e5c]">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={14} className="py-10 text-center text-sm text-[#605e5c]">
                    Cargando...
                  </td>
                </tr>
              ) : report.items.length === 0 ? (
                <tr>
                  <td colSpan={14} className="py-10 text-center text-sm text-[#605e5c]">
                    No hay tickets para esta fecha y sucursal.
                  </td>
                </tr>
              ) : (
                <>
                  {report.items.map((item, idx) => (
                    <tr
                      key={item.appointment_id}
                      className={`border-b border-[#edebe9] transition hover:bg-[#faf9f8] ${
                        item.status === "cancelled" ? "opacity-60" : ""
                      }`}
                    >
                      <td className="px-3 py-2 text-[#605e5c]">{idx + 1}</td>
                      <td className="px-3 py-2 font-mono text-xs text-[#323130]">
                        {item.ticket_code ?? "-"}
                      </td>
                      <td className="px-3 py-2 font-mono text-xs text-[#605e5c]">
                        {item.sale_code ?? <span className="text-[#a19f9d]">—</span>}
                      </td>
                      <td className="px-3 py-2 text-[#323130]">{item.client_name}</td>
                      <td className="max-w-45 px-3 py-2">
                        <div className="flex flex-wrap gap-1">
                          {item.service_names.map((svc, i) => (
                            <span
                              key={i}
                              className="rounded-sm border border-[#9dc4e6] bg-[#eff6fc] px-1.5 py-0.5 text-[10px] font-semibold text-[#005a9e]"
                            >
                              {svc}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-[#323130]">
                        {item.professional_name}
                        <span className="ml-1 text-[10px] text-[#a19f9d]">
                          ({(item.commission_rate * 100).toFixed(0)}%)
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-xs text-[#605e5c]">
                        {fmtDate(item.start_time)}<br />
                        <span className="font-semibold text-[#323130]">{fmtTime(item.start_time)}</span>
                      </td>
                      <td className="px-3 py-2">
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_CLASS[item.status] ?? "bg-gray-100 text-gray-700"}`}>
                          {STATUS_LABELS[item.status] ?? item.status}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-3 py-2">
                        <PaymentBadge method={item.is_paid ? (item.payment_method ?? null) : null} />
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 font-semibold text-[#323130]">
                        Bs {item.total_price.toFixed(2)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2">
                        {item.advance_payment_amount > 0 ? (
                          <span className="font-semibold text-emerald-700">
                            Bs {item.advance_payment_amount.toFixed(2)}
                          </span>
                        ) : (
                          <span className="text-[10px] text-[#a19f9d]">—</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2">
                        {item.balance_due > 0 ? (
                          <span className="font-semibold text-[#d83b01]">
                            Bs {item.balance_due.toFixed(2)}
                          </span>
                        ) : item.is_paid ? (
                          <span className="text-[10px] font-semibold text-[#107c10]">Saldado</span>
                        ) : (
                          <span className="text-[10px] text-[#a19f9d]">—</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 font-semibold text-[#0078d4]">
                        Bs {item.commission.toFixed(2)}
                      </td>
                      <td className="px-3 py-2">
                        {isActionable(item.status) ? (
                          <div className="flex gap-1">
                            <button
                              onClick={() => updateStatus(item.appointment_id, "completed")}
                              disabled={updatingId === item.appointment_id}
                              title="Finalizar"
                              className="flex items-center gap-1 rounded-sm bg-green-600 px-2 py-1 text-[10px] font-semibold text-white hover:bg-green-700 disabled:opacity-50"
                            >
                              <CheckCircle size={11} /> Finalizar
                            </button>
                            <button
                              onClick={() => updateStatus(item.appointment_id, "cancelled")}
                              disabled={updatingId === item.appointment_id}
                              title="Cancelar"
                              className="flex items-center gap-1 rounded-sm bg-red-500 px-2 py-1 text-[10px] font-semibold text-white hover:bg-red-600 disabled:opacity-50"
                            >
                              <XCircle size={11} /> Cancelar
                            </button>
                          </div>
                        ) : (
                          <span className="text-[10px] text-[#a19f9d]">—</span>
                        )}
                      </td>
                    </tr>
                  ))}

                  {/* Fila de totales */}
                  <tr className="border-t-2 border-[#063324] bg-[#f0fdf4]">
                    <td colSpan={9} className="px-3 py-2.5 text-right text-sm font-bold text-[#323130]">
                      TOTALES
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 font-bold text-[#323130]">
                      Bs {report.grand_total.toFixed(2)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 font-bold text-emerald-700">
                      Bs {report.items.reduce((s, i) => s + i.advance_payment_amount, 0).toFixed(2)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 font-bold text-[#d83b01]">
                      Bs {report.items.reduce((s, i) => s + i.balance_due, 0).toFixed(2)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 font-bold text-[#0078d4]">
                      Bs {report.grand_commission.toFixed(2)}
                    </td>
                    <td />
                  </tr>
                </>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
