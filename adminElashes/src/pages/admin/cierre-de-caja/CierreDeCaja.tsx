import { useEffect, useMemo, useState } from "react";
import {
  Banknote,
  CheckCircle,
  CreditCard,
  Printer,
  QrCode,
  Wallet,
  XCircle,
} from "lucide-react";
import { toast } from "react-toastify";

import StatCard from "@/components/common/ui/StatCard";
import SectionCard from "@/components/common/ui/SectionCard";
import Button from "@/components/common/ui/Button";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import DataTable, {
  type DataTableColumn,
} from "@/components/common/table/DataTable";
import {
  AgendaService,
  type ProfessionalForSelect,
} from "../../../core/services/agenda/agenda.service";
import { BranchService } from "../../../core/services/branch/branch.service";
import { PosSaleService } from "../../../core/services/pos-sale/pos-sale.service";
import {
  ReportsService,
  type DailyClosingItem,
  type DailyClosingResponse,
} from "../../../core/services/reports/reports.service";
import { CommissionPaymentsService } from "../../../core/services/commission-payments/commission-payments.service";
import { getLogoUrlForPdf } from "../../../core/hooks/useLogo";

type DailyClosingItemWithId = DailyClosingItem & { id: number };

// ── Constantes ────────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<string, string> = {
  pending: "Pendiente",
  in_service: "En servicio",
  confirmed: "Confirmado",
  completed: "Completado",
  cancelled: "Cancelado",
};

const PAYMENT_LABELS: Record<string, string> = {
  cash: "Efectivo",
  qr: "QR",
  transfer: "Transferencia",
  card: "Tarjeta",
  mixed: "Mixto",
};

const PAYMENT_ICONS: Record<string, typeof Banknote> = {
  cash: Banknote,
  qr: QrCode,
  transfer: Wallet,
  card: CreditCard,
};

const PAYMENT_COLORS: Record<string, string> = {
  cash: "bg-emerald-50 text-emerald-700 border-emerald-200",
  qr: "bg-violet-50 text-violet-700 border-violet-200",
  transfer: "bg-blue-50 text-blue-700 border-blue-200",
  card: "bg-orange-50 text-orange-700 border-orange-200",
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("es-BO", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-BO", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function PaymentBadge({ method }: { method: string | null }) {
  if (!method)
    return <span className="text-[10px] text-[#a19f9d]">Sin cobrar</span>;
  const Icon = PAYMENT_ICONS[method] ?? Banknote;
  const color =
    PAYMENT_COLORS[method] ?? "bg-gray-50 text-gray-700 border-gray-200";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${color}`}
    >
      <Icon size={10} />
      {PAYMENT_LABELS[method] ?? method}
    </span>
  );
}

// ── Impresión ─────────────────────────────────────────────────────────────────

async function printReport(
  dateLabel: string,
  branchName: string,
  professionalName: string,
  report: DailyClosingResponse,
  paymentConfirmations: Record<
    string,
    { confirmedAt: string; amount: number }
  > = {},
) {
  // Abrir la ventana ya mismo (síncrono) para que el navegador no la bloquee como pop-up.
  const win = window.open("", "_blank");
  if (!win) return;

  const logoUrl = await getLogoUrlForPdf();
  const logoHtml = logoUrl
    ? `<div style="text-align:center;margin-bottom:12px"><img src="${logoUrl}" alt="Logo" style="max-height:85px;max-width:260px;object-fit:contain" /></div>`
    : "";
  const rows = report.items
    .map(
      (item, i) => `
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
        <td>${item.payment_method ? (PAYMENT_LABELS[item.payment_method] ?? item.payment_method) : "Sin cobrar"}</td>
        <td>Bs ${item.total_price.toFixed(2)}</td>
        <td>${(item.commission_rate * 100).toFixed(0)}% = Bs ${item.commission.toFixed(2)}</td>
      </tr>`,
    )
    .join("");

  const summaryRows = report.summary_by_professional
    .map((p) => {
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
    .map(
      ([method, total]) =>
        `<tr><td>${PAYMENT_LABELS[method] ?? method}</td><td>Bs ${total.toFixed(2)}</td></tr>`,
    )
    .join("");

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <title>Reporte por comisiones – ${dateLabel}</title>
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
  ${logoHtml}
  <h2>Reporte por comisiones</h2>
  <p class="sub">Fecha: ${dateLabel}${branchName ? " · " + branchName : ""}${professionalName ? " · Operaria: " + professionalName : ""}</p>

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

  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 300);
}

// ── Componente principal ──────────────────────────────────────────────────────

const EMPTY_REPORT: DailyClosingResponse = {
  date: "",
  to_date: null,
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
  const [fromDate, setFromDate] = useState(todayStr());
  const [toDate, setToDate] = useState(todayStr());
  const [branchId, setBranchId] = useState<number | null>(null);
  const [professionalId, setProfessionalId] = useState<number | null>(null);
  const [branches, setBranches] = useState<{ id: number; name: string }[]>([]);
  const [professionals, setProfessionals] = useState<ProfessionalForSelect[]>(
    [],
  );
  const [report, setReport] = useState<DailyClosingResponse>(EMPTY_REPORT);
  const [loading, setLoading] = useState(false);
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  // Cobro al finalizar: cual sale_id está siendo cobrado ahora
  const [cobrandoSaleId, setCobrandoSaleId] = useState<number | null>(null);
  const [cobrandoMethod, setCobrandoMethod] = useState("cash");
  const [cobrandoLoading, setCobrandoLoading] = useState(false);

  const registrarPago = async (saleId: number) => {
    setCobrandoLoading(true);
    try {
      await PosSaleService.update(saleId, {
        payment_method: cobrandoMethod,
        status: "paid",
      });
      toast.success("Pago registrado correctamente.");
      setCobrandoSaleId(null);
      // Recargar reporte
      setLoading(true);
      ReportsService.getDailyClosing({
        date: fromDate,
        to_date: toDate,
        branch_id: branchId,
        professional_id: professionalId,
      })
        .then(setReport)
        .catch(() => {})
        .finally(() => setLoading(false));
    } catch {
      toast.error("No se pudo registrar el pago.");
    } finally {
      setCobrandoLoading(false);
    }
  };

  // Confirmaciones de entrega de comisión — persistidas como CommissionPayment
  // (period_start/period_end == el rango de fechas elegido arriba), para que
  // sobrevivan a un refresco de página en vez de vivir solo en memoria.
  // key = professional_id, value = { confirmedAt, amount }
  const [paymentConfirmations, setPaymentConfirmations] = useState<
    Record<string, { confirmedAt: string; amount: number }>
  >({});
  const [confirmingKey, setConfirmingKey] = useState<string | null>(null);
  const [pendingConfirmation, setPendingConfirmation] = useState<
    { key: string; amount: number; professionalName: string } | null
  >(null);

  const loadConfirmations = () => {
    CommissionPaymentsService.list({
      period_start: fromDate,
      period_end: toDate,
    })
      .then((payments) => {
        const map: Record<string, { confirmedAt: string; amount: number }> = {};
        for (const p of payments) {
          map[String(p.professional_id)] = {
            confirmedAt: new Date(p.registered_at).toLocaleString("es-BO"),
            amount: p.amount,
          };
        }
        setPaymentConfirmations(map);
      })
      .catch(() => {});
  };

  const confirmPayment = async (professionalKey: string, amount: number) => {
    const professionalId = Number(professionalKey);
    if (Number.isNaN(professionalId)) return;
    setConfirmingKey(professionalKey);
    try {
      await CommissionPaymentsService.create({
        professional_id: professionalId,
        amount,
        period_start: fromDate,
        period_end: toDate,
        notes: "Confirmado desde Reporte por comisiones",
      });
      loadConfirmations();
    } catch {
      toast.error("No se pudo guardar la confirmación.");
    } finally {
      setConfirmingKey(null);
    }
  };

  useEffect(() => {
    BranchService.list({ limit: 100 })
      .then(setBranches)
      .catch(() => {});
  }, []);

  // Recargar operarias cuando cambia la sucursal y limpiar selección si ya no aplica
  useEffect(() => {
    AgendaService.listProfessionalsForSelect({
      limit: 200,
      role_name: "Operaria",
      branch_id: branchId ?? undefined,
    })
      .then((data) => {
        setProfessionals(data);
        // Si la operaria seleccionada no está en la nueva sucursal, limpiarla
        if (professionalId && !data.some((p) => p.id === professionalId)) {
          setProfessionalId(null);
        }
      })
      .catch(() => {});
  }, [branchId]);

  useEffect(() => {
    setLoading(true);
    ReportsService.getDailyClosing({
      date: fromDate,
      to_date: toDate,
      branch_id: branchId,
      professional_id: professionalId,
    })
      .then(setReport)
      .catch(() => toast.error("Error al cargar el reporte"))
      .finally(() => setLoading(false));
    loadConfirmations();
  }, [fromDate, toDate, branchId, professionalId]);

  const updateStatus = async (id: number, newStatus: string) => {
    setUpdatingId(id);
    try {
      await ReportsService.updateStatus(id, newStatus);
      toast.success(
        newStatus === "completed" ? "Ticket finalizado" : "Ticket cancelado",
      );
      // Recargar reporte completo para que comisiones y totales queden correctos
      setLoading(true);
      ReportsService.getDailyClosing({
        date: fromDate,
        to_date: toDate,
        branch_id: branchId,
        professional_id: professionalId,
      })
        .then(setReport)
        .catch(() => toast.error("Error al recargar el reporte"))
        .finally(() => setLoading(false));
    } catch {
      toast.error("No se pudo actualizar el estado");
    } finally {
      setUpdatingId(null);
    }
  };

  const selectedBranchName = useMemo(
    () => branches.find((b) => b.id === branchId)?.name ?? "",
    [branches, branchId],
  );

  const selectedProfessionalName = useMemo(
    () => professionals.find((p) => p.id === professionalId)?.username ?? "",
    [professionals, professionalId],
  );

  const isActionable = (status: string) =>
    status !== "completed" && status !== "cancelled";

  const paymentSummaryEntries = Object.entries(report.totals_by_payment);

  const tableData = useMemo<DailyClosingItemWithId[]>(
    () => report.items.map((item) => ({ ...item, id: item.appointment_id })),
    [report.items],
  );

  const columns: DataTableColumn<DailyClosingItemWithId>[] = [
    {
      key: "codes",
      header: "Ticket / Venta",
      render: (item) => (
        <div>
          <p className="font-mono text-[11px] font-bold text-[#323130]">
            {item.ticket_code ?? `#${item.appointment_id}`}
          </p>
          {item.sale_code && (
            <p className="font-mono text-[10px] text-[#a19f9d]">
              {item.sale_code}
            </p>
          )}
        </div>
      ),
      getValue: (item) => item.ticket_code ?? String(item.appointment_id),
    },
    {
      key: "client_name",
      header: "Cliente",
      render: (item) => (
        <span className="font-medium text-[#323130]">{item.client_name}</span>
      ),
      sortable: true,
      getValue: (item) => item.client_name,
    },
    {
      key: "services",
      header: "Servicio(s)",
      render: (item) => (
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
      ),
      getValue: (item) => item.service_names.join(", "),
    },
    {
      key: "professional_name",
      header: "Operaria",
      render: (item) => (
        <span className="whitespace-nowrap">
          {item.professional_name}
          <span className="ml-1 text-[10px] text-[#a19f9d]">
            {(item.commission_rate * 100).toFixed(0)}%
          </span>
        </span>
      ),
      sortable: true,
      getValue: (item) => item.professional_name,
    },
    {
      key: "start_time",
      header: "Hora",
      render: (item) => (
        <span className="whitespace-nowrap font-mono text-[11px] text-[#605e5c]">
          {fmtTime(item.start_time)}
          <span className="block text-[9px] text-[#a19f9d]">
            {fmtDate(item.start_time)}
          </span>
        </span>
      ),
      sortable: true,
      getValue: (item) => item.start_time,
    },
    {
      key: "payment_method",
      header: "Pago",
      render: (item) => (
        <PaymentBadge
          method={item.is_paid ? (item.payment_method ?? null) : null}
        />
      ),
      getValue: (item) => (item.is_paid ? (item.payment_method ?? "") : ""),
    },
    {
      key: "total_price",
      header: "Monto / Saldo",
      render: (item) => (
        <div className="whitespace-nowrap">
          <p className="font-semibold text-[#323130]">
            Bs {item.total_price.toFixed(2)}
          </p>
          {item.balance_due > 0 ? (
            <p className="text-[10px] font-semibold text-[#d83b01]">
              Debe Bs {item.balance_due.toFixed(2)}
            </p>
          ) : item.is_paid ? (
            <p className="text-[10px] font-semibold text-[#107c10]">Saldado</p>
          ) : null}
        </div>
      ),
      sortable: true,
      getValue: (item) => item.total_price,
    },
    {
      key: "commission",
      header: "Comisión",
      render: (item) => {
        const isCompleted =
          item.status === "completed" || item.status === "confirmed";
        if (isCompleted)
          return (
            <span className="whitespace-nowrap font-semibold text-[#0078d4]">
              Bs {item.commission.toFixed(2)}
            </span>
          );
        if (item.status === "cancelled")
          return <span className="text-[10px] text-[#a19f9d]">—</span>;
        return <span className="text-[10px] text-[#8a6a1f]">Pend.</span>;
      },
      sortable: true,
      getValue: (item) => item.commission,
    },
    {
      key: "row_actions",
      header: "Acciones",
      filterable: false,
      searchable: false,
      render: (item) => (
        <div className="flex flex-col gap-1">
          {!item.is_paid && item.sale_id ? (
            cobrandoSaleId === item.sale_id ? (
              <div className="flex flex-wrap items-center gap-1">
                <select
                  value={cobrandoMethod}
                  onChange={(e) => setCobrandoMethod(e.target.value)}
                  className="h-7 rounded-sm border border-[#8a8886] bg-white px-1 text-[10px] text-[#323130] outline-none"
                >
                  <option value="cash">Efectivo</option>
                  <option value="qr">QR</option>
                  <option value="transfer">Transferencia</option>
                  <option value="card">Tarjeta</option>
                </select>
                <Button
                  size="sm"
                  variant="primary"
                  onClick={() => void registrarPago(item.sale_id!)}
                  disabled={cobrandoLoading}
                >
                  {cobrandoLoading ? "…" : "OK"}
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setCobrandoSaleId(null)}
                >
                  ✕
                </Button>
              </div>
            ) : (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  setCobrandoSaleId(item.sale_id!);
                  setCobrandoMethod("cash");
                }}
              >
                Cobrar
              </Button>
            )
          ) : null}
          {isActionable(item.status) && (
            <div className="flex gap-1">
              <Button
                size="sm"
                variant="primary"
                leftIcon={<CheckCircle size={10} />}
                onClick={() => updateStatus(item.appointment_id, "completed")}
                disabled={updatingId === item.appointment_id}
              >
                Finalizar
              </Button>
              <Button
                size="sm"
                variant="danger"
                leftIcon={<XCircle size={10} />}
                onClick={() => updateStatus(item.appointment_id, "cancelled")}
                disabled={updatingId === item.appointment_id}
              >
                Cancelar
              </Button>
            </div>
          )}
        </div>
      ),
    },
  ];

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#f3f2f1] p-4 sm:p-6">
      {/* Header */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-[#1b1a19]">
            Reporte por comisiones
          </h1>
        </div>
        <Button
          variant="primary"
          leftIcon={<Printer size={15} />}
          onClick={() =>
            void printReport(
              fromDate === toDate ? fromDate : `${fromDate} — ${toDate}`,
              selectedBranchName,
              selectedProfessionalName,
              report,
              paymentConfirmations,
            )
          }
          disabled={report.items.length === 0}
        >
          Imprimir PDF
        </Button>
      </div>

      {/* Filtros */}
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-semibold uppercase tracking-wide text-[#605e5c]">
            Desde
          </label>
          <input
            type="date"
            value={fromDate}
            onChange={(e) => {
              const value = e.target.value;
              setFromDate(value);
              if (value > toDate) setToDate(value);
            }}
            className="h-9 rounded-sm border border-[#edebe9] bg-white px-3 text-sm focus:border-[#063324] focus:outline-none"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-semibold uppercase tracking-wide text-[#605e5c]">
            Hasta
          </label>
          <input
            type="date"
            value={toDate}
            min={fromDate}
            onChange={(e) => setToDate(e.target.value)}
            className="h-9 rounded-sm border border-[#edebe9] bg-white px-3 text-sm focus:border-[#063324] focus:outline-none"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-semibold uppercase tracking-wide text-[#605e5c]">
            Operaria
          </label>
          <select
            value={professionalId ?? ""}
            onChange={(e) =>
              setProfessionalId(
                e.target.value === "" ? null : Number(e.target.value),
              )
            }
            className="h-9 rounded-sm border border-[#edebe9] bg-white px-3 text-sm focus:border-[#063324] focus:outline-none"
          >
            <option value="">Todas las operarias</option>
            {professionals.map((p) => (
              <option key={p.id} value={p.id}>
                {p.username}
                {p.branch_name ? ` — ${p.branch_name}` : ""}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Tarjetas de resumen */}
      {!loading && report.items.length > 0 && (
        <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <StatCard
            label="Total cobrado"
            value={`Bs ${report.total_paid.toFixed(2)}`}
            tone="emerald"
            icon={<Banknote size={14} />}
          />
          {report.total_unpaid > 0 && (
            <StatCard
              label="Sin cobrar"
              value={`Bs ${report.total_unpaid.toFixed(2)}`}
              tone="amber"
              helperText="Tickets completados sin pago"
            />
          )}
          {paymentSummaryEntries.map(([method, total]) => {
            const Icon = PAYMENT_ICONS[method] ?? Banknote;
            return (
              <StatCard
                key={method}
                label={PAYMENT_LABELS[method] ?? method}
                value={`Bs ${total.toFixed(2)}`}
                tone="slate"
                icon={<Icon size={14} />}
              />
            );
          })}
          <StatCard
            label="Comisiones a pagar"
            value={`Bs ${report.grand_commission.toFixed(2)}`}
            tone="blue"
            icon={<Wallet size={14} />}
          />
        </div>
      )}

      {/* Confirmación de comisiones por operaria */}
      {!loading && report.summary_by_professional.length > 0 && (
        <SectionCard
          variant="business"
          className="mb-5"
          bodyClassName="!p-0"
          title="Confirmación de comisiones"
          subtitle="Marcá cada operaria cuando le hayas entregado su comisión · Solo tickets completados"
        >
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="border-b border-[#edebe9] bg-[#faf9f8]">
                {[
                  "Operaria",
                  "Tickets",
                  "Total Bs",
                  "% Com.",
                  "Comisión Bs",
                  "Confirmación",
                ].map((h) => (
                  <th
                    key={h}
                    className="px-3 py-2 text-left text-[10px] font-bold uppercase tracking-wide text-[#605e5c]"
                  >
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
                    <td className="px-3 py-2 font-medium text-[#323130]">
                      {p.professional_name}
                    </td>
                    <td className="px-3 py-2 text-[#605e5c]">
                      {p.ticket_count}
                    </td>
                    <td className="px-3 py-2 font-semibold text-[#323130]">
                      Bs {p.total_price.toFixed(2)}
                    </td>
                    <td className="px-3 py-2 text-[#605e5c]">
                      {(p.commission_rate * 100).toFixed(0)}%
                    </td>
                    <td className="px-3 py-2 font-semibold text-[#0078d4]">
                      Bs {p.commission.toFixed(2)}
                    </td>
                    <td className="px-4 py-2">
                      {conf ? (
                        <div>
                          <span className="inline-block rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-bold text-green-800">
                            ✓ Confirmado
                          </span>
                          <p className="mt-0.5 text-[10px] text-[#605e5c]">
                            {conf.confirmedAt}
                          </p>
                        </div>
                      ) : (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() =>
                            setPendingConfirmation({
                              key,
                              amount: p.commission,
                              professionalName: p.professional_name,
                            })
                          }
                          disabled={confirmingKey === key || !p.professional_id}
                        >
                          {confirmingKey === key
                            ? "Guardando…"
                            : "Confirmar recibo"}
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </SectionCard>
      )}

      {/* Tabla de tickets — DataTable común */}
      <SectionCard
        variant="business"
        title="Detalle de tickets"
        subtitle={`${report.items.length} ticket(s) · Solo completados cuentan para comisión`}
        bodyClassName="!p-3"
      >
        {!loading && report.items.length > 0 && (
          <div className="mb-3 flex items-center gap-4 rounded-sm border border-[#edebe9] bg-[#f3f2f1] px-4 py-2 text-xs">
            <span className="font-bold text-[#323130]">
              Total:{" "}
              <span className="text-[#0078d4]">
                Bs {report.grand_total.toFixed(2)}
              </span>
            </span>
            <span className="text-[#605e5c]">|</span>
            <span className="font-bold text-[#323130]">
              Comisiones:{" "}
              <span className="text-[#0078d4]">
                Bs {report.grand_commission.toFixed(2)}
              </span>
            </span>
          </div>
        )}
        <DataTable
          data={tableData}
          columns={columns}
          loading={loading}
          enableGlobalSearch
          globalSearchPlaceholder="Buscar ticket, cliente, servicio…"
          enableColumnFilters
          tableMinWidth="min-w-[920px]"
          availableLimits={[10, 25, 50]}
        />
      </SectionCard>

      <ConfirmDialog
        isOpen={pendingConfirmation !== null}
        title="Confirmar comisión"
        message={
          pendingConfirmation
            ? `¿Confirmás que le entregaste Bs ${pendingConfirmation.amount.toFixed(2)} de comisión a ${pendingConfirmation.professionalName}?`
            : ""
        }
        confirmText="Confirmar"
        variant="success"
        isProcessing={confirmingKey === pendingConfirmation?.key}
        onConfirm={() => {
          if (!pendingConfirmation) return;
          void confirmPayment(pendingConfirmation.key, pendingConfirmation.amount);
          setPendingConfirmation(null);
        }}
        onCancel={() => setPendingConfirmation(null)}
      />
    </div>
  );
}
