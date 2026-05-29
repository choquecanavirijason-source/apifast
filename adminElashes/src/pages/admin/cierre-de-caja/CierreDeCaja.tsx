import { useEffect, useMemo, useState } from "react";
import { CheckCircle, Printer, XCircle } from "lucide-react";
import { toast } from "react-toastify";

import { AgendaService, type ProfessionalForSelect } from "../../../core/services/agenda/agenda.service";
import { BranchService } from "../../../core/services/branch/branch.service";
import {
  ReportsService,
  type DailyClosingItem,
} from "../../../core/services/reports/reports.service";

const COMMISSION_PCT = 40;

const STATUS_LABELS: Record<string, string> = {
  pending: "Pendiente",
  in_service: "En servicio",
  confirmed: "Confirmado",
  completed: "Completado",
  cancelled: "Cancelado",
};

const STATUS_CLASS: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  in_service: "bg-blue-100 text-blue-800",
  confirmed: "bg-indigo-100 text-indigo-800",
  completed: "bg-green-100 text-green-800",
  cancelled: "bg-red-100 text-red-800",
};

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function fmtTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString("es-BO", { hour: "2-digit", minute: "2-digit" });
}

function fmtDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("es-BO", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function printReport(
  date: string,
  branchName: string,
  professionalName: string,
  items: DailyClosingItem[],
  grandTotal: number,
  grandCommission: number
) {
  const rows = items
    .map(
      (item, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>${item.ticket_code ?? "-"}</td>
        <td>${item.client_name}</td>
        <td>${item.service_names.join(", ")}</td>
        <td>${item.professional_name}</td>
        <td>${fmtDate(item.start_time)} ${fmtTime(item.start_time)}</td>
        <td>${item.duration_minutes} min</td>
        <td>${STATUS_LABELS[item.status] ?? item.status}</td>
        <td>Bs ${item.total_price.toFixed(2)}</td>
        <td>Bs ${item.commission.toFixed(2)}</td>
        <td>${item.branch_name}</td>
      </tr>`
    )
    .join("");

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <title>Cierre de Caja – ${date}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; font-size: 11px; padding: 20px; color: #1a1a1a; }
    h2 { font-size: 16px; margin-bottom: 4px; }
    .sub { color: #555; margin-bottom: 16px; font-size: 12px; }
    table { width: 100%; border-collapse: collapse; }
    th { background: #063324; color: #fff; padding: 6px 8px; text-align: left; font-size: 10px; }
    td { padding: 5px 8px; border-bottom: 1px solid #e5e7eb; vertical-align: top; }
    tr:nth-child(even) td { background: #f9fafb; }
    .total-row td { font-weight: bold; background: #f0fdf4; border-top: 2px solid #065f46; }
    @media print { body { padding: 0; } }
  </style>
</head>
<body>
  <h2>Cierre de Caja</h2>
  <p class="sub">Fecha: ${date}${branchName ? " · " + branchName : ""}${professionalName ? " · Operaria: " + professionalName : ""}</p>
  <table>
    <thead>
      <tr>
        <th>#</th><th>Código</th><th>Cliente</th><th>Servicio(s)</th>
        <th>Operaria</th><th>Fecha/Hora</th><th>Duración</th><th>Estado</th>
        <th>Precio</th><th>Comisión (${COMMISSION_PCT}%)</th><th>Sucursal</th>
      </tr>
    </thead>
    <tbody>
      ${rows}
      <tr class="total-row">
        <td colspan="8">TOTALES</td>
        <td>Bs ${grandTotal.toFixed(2)}</td>
        <td>Bs ${grandCommission.toFixed(2)}</td>
        <td></td>
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
  setTimeout(() => {
    win.print();
  }, 300);
}

export default function CierreDeCaja() {
  const [date, setDate] = useState(todayStr());
  const [branchId, setBranchId] = useState<number | null>(null);
  const [professionalId, setProfessionalId] = useState<number | null>(null);
  const [branches, setBranches] = useState<{ id: number; name: string }[]>([]);
  const [professionals, setProfessionals] = useState<ProfessionalForSelect[]>([]);
  const [items, setItems] = useState<DailyClosingItem[]>([]);
  const [grandTotal, setGrandTotal] = useState(0);
  const [grandCommission, setGrandCommission] = useState(0);
  const [loading, setLoading] = useState(false);
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  useEffect(() => {
    BranchService.list({ limit: 100 }).then(setBranches).catch(() => {});
    AgendaService.listProfessionalsForSelect({ limit: 200, role_name: "Operaria" })
      .then(setProfessionals)
      .catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    ReportsService.getDailyClosing({ date, branch_id: branchId, professional_id: professionalId })
      .then((res) => {
        setItems(res.items);
        setGrandTotal(res.grand_total);
        setGrandCommission(res.grand_commission);
      })
      .catch(() => toast.error("Error al cargar el reporte"))
      .finally(() => setLoading(false));
  }, [date, branchId, professionalId]);

  const updateStatus = async (id: number, newStatus: string) => {
    setUpdatingId(id);
    try {
      await ReportsService.updateStatus(id, newStatus);
      setItems((prev) =>
        prev.map((item) =>
          item.appointment_id === id ? { ...item, status: newStatus } : item
        )
      );
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

  return (
    <div className="min-h-screen bg-[#f3f2f1] p-4 sm:p-6">
      {/* Header */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-[#1b1a19]">Cierre de Caja</h1>
          <p className="mt-0.5 text-sm text-[#605e5c]">
            Reporte diario de tickets por operaria
          </p>
        </div>
        <button
          onClick={() => printReport(date, selectedBranchName, selectedProfessionalName, items, grandTotal, grandCommission)}
          disabled={items.length === 0}
          className="flex items-center gap-2 rounded-sm bg-[#063324] px-4 py-2 text-sm font-semibold text-white hover:bg-[#094d33] disabled:opacity-40"
        >
          <Printer size={15} />
          Imprimir PDF
        </button>
      </div>

      {/* Filters */}
      <div className="mb-5 flex flex-wrap gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-semibold uppercase tracking-wide text-[#605e5c]">
            Fecha
          </label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="h-9 rounded-sm border border-[#edebe9] bg-white px-3 text-sm focus:border-[#063324] focus:outline-none"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-semibold uppercase tracking-wide text-[#605e5c]">
            Sucursal
          </label>
          <select
            value={branchId ?? ""}
            onChange={(e) =>
              setBranchId(e.target.value === "" ? null : Number(e.target.value))
            }
            className="h-9 rounded-sm border border-[#edebe9] bg-white px-3 text-sm focus:border-[#063324] focus:outline-none"
          >
            <option value="">Todas las sucursales</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-semibold uppercase tracking-wide text-[#605e5c]">
            Operaria
          </label>
          <select
            value={professionalId ?? ""}
            onChange={(e) =>
              setProfessionalId(e.target.value === "" ? null : Number(e.target.value))
            }
            className="h-9 rounded-sm border border-[#edebe9] bg-white px-3 text-sm focus:border-[#063324] focus:outline-none"
          >
            <option value="">Todas las operarias</option>
            {professionals.map((p) => (
              <option key={p.id} value={p.id}>
                {p.username}{p.branch_name ? ` — ${p.branch_name}` : ""}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-sm border border-[#edebe9] bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-[#edebe9] bg-[#f3f2f1]">
                {[
                  "#",
                  "Código",
                  "Cliente",
                  "Servicio(s)",
                  "Operaria",
                  "Fecha/Hora",
                  "Duración",
                  "Estado",
                  "Precio",
                  `Comisión (${COMMISSION_PCT}%)`,
                  "Sucursal",
                  "Acciones",
                ].map((col) => (
                  <th
                    key={col}
                    className="px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-[#605e5c]"
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={12} className="py-10 text-center text-sm text-[#605e5c]">
                    Cargando...
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={12} className="py-10 text-center text-sm text-[#605e5c]">
                    No hay tickets para esta fecha y sucursal.
                  </td>
                </tr>
              ) : (
                <>
                  {items.map((item, idx) => (
                    <tr
                      key={item.appointment_id}
                      className="border-b border-[#edebe9] transition hover:bg-[#faf9f8]"
                    >
                      <td className="px-3 py-2 text-[#605e5c]">{idx + 1}</td>
                      <td className="px-3 py-2 font-mono text-xs text-[#323130]">
                        {item.ticket_code ?? "-"}
                      </td>
                      <td className="px-3 py-2 text-[#323130]">{item.client_name}</td>
                      <td className="max-w-[200px] px-3 py-2">
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
                      <td className="px-3 py-2 text-[#323130]">{item.professional_name}</td>
                      <td className="whitespace-nowrap px-3 py-2 text-xs text-[#605e5c]">
                        {fmtDate(item.start_time)}
                        <br />
                        <span className="font-semibold text-[#323130]">
                          {fmtTime(item.start_time)}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-[#605e5c]">
                        {item.duration_minutes} min
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                            STATUS_CLASS[item.status] ?? "bg-gray-100 text-gray-700"
                          }`}
                        >
                          {STATUS_LABELS[item.status] ?? item.status}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 font-semibold text-[#323130]">
                        Bs {item.total_price.toFixed(2)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 font-semibold text-[#0078d4]">
                        Bs {item.commission.toFixed(2)}
                      </td>
                      <td className="px-3 py-2 text-xs text-[#605e5c]">{item.branch_name}</td>
                      <td className="px-3 py-2">
                        {isActionable(item.status) ? (
                          <div className="flex gap-1">
                            <button
                              onClick={() => updateStatus(item.appointment_id, "completed")}
                              disabled={updatingId === item.appointment_id}
                              title="Finalizar"
                              className="flex items-center gap-1 rounded-sm bg-green-600 px-2 py-1 text-[10px] font-semibold text-white hover:bg-green-700 disabled:opacity-50"
                            >
                              <CheckCircle size={11} />
                              Finalizar
                            </button>
                            <button
                              onClick={() => updateStatus(item.appointment_id, "cancelled")}
                              disabled={updatingId === item.appointment_id}
                              title="Cancelar cobro"
                              className="flex items-center gap-1 rounded-sm bg-red-500 px-2 py-1 text-[10px] font-semibold text-white hover:bg-red-600 disabled:opacity-50"
                            >
                              <XCircle size={11} />
                              Cancelar
                            </button>
                          </div>
                        ) : (
                          <span className="text-[10px] text-[#a19f9d]">—</span>
                        )}
                      </td>
                    </tr>
                  ))}

                  {/* Totals row */}
                  <tr className="border-t-2 border-[#063324] bg-[#f0fdf4]">
                    <td
                      colSpan={8}
                      className="px-3 py-2.5 text-right text-sm font-bold text-[#323130]"
                    >
                      TOTALES
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 font-bold text-[#323130]">
                      Bs {grandTotal.toFixed(2)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 font-bold text-[#0078d4]">
                      Bs {grandCommission.toFixed(2)}
                    </td>
                    <td colSpan={2} />
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
