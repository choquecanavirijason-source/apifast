import { useMemo } from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { CalendarClock, Clock, FileDown, PlusCircle, Receipt } from "lucide-react";
import StatCard from "../../../../components/common/ui/StatCard";

import type { PosSaleItem } from "../../../../core/services/pos-sale/pos-sale.service";
import type { TicketItem } from "../../../../core/services/agenda/agenda.service";
import { getLocalDateInputValue } from "../pos.helpers";
import DataTable from "../../../../components/common/table/DataTable";
import type { DataTableColumn } from "../../../../components/common/table/DataTable";

type Props = {
  receiptSale: PosSaleItem | null;
  sales: PosSaleItem[];
  existingTickets: TicketItem[];
  onNavigateToNewSale: () => void;
};

type FlatRow = {
  id: number;
  ticket_code: string;
  client_name: string;
  sale_code: string;
  services: string;
  professional: string;
  time: string;
  raw_start: string;
  status: string;
  payment: string;
  total_sale: number;
};

const PAY_LABELS: Record<string, string> = {
  cash: "Efectivo", qr: "QR", transfer: "Transferencia", card: "Tarjeta",
};

const STATUS_CSS: Record<string, string> = {
  pending:    "bg-yellow-100 text-yellow-800",
  confirmed:  "bg-purple-100 text-purple-800",
  waiting:    "bg-orange-100 text-orange-800",
  in_service: "bg-blue-100 text-blue-800",
  completed:  "bg-green-100 text-green-800",
  cancelled:  "bg-red-100 text-red-800",
};

const STATUS_LABELS: Record<string, string> = {
  pending:    "En espera",
  confirmed:  "Confirmado",
  waiting:    "Esperando",
  in_service: "En servicio",
  completed:  "Completado",
  cancelled:  "Cancelado",
};

const COLUMNS: DataTableColumn<FlatRow>[] = [
  {
    key: "ticket_code",
    header: "Código",
    sortable: true,
    render: (r) => (
      <span className="font-mono text-[11px] font-bold text-[#094732]">{r.ticket_code}</span>
    ),
    getValue: (r) => r.ticket_code,
  },
  {
    key: "client_name",
    header: "Cliente",
    sortable: true,
    render: (r) => <span className="font-semibold text-[#323130]">{r.client_name}</span>,
    getValue: (r) => r.client_name,
  },
  {
    key: "services",
    header: "Servicios",
    sortable: false,
    render: (r) => <span className="text-[#323130]">{r.services}</span>,
    getValue: (r) => r.services,
  },
  {
    key: "professional",
    header: "Profesional",
    sortable: true,
    render: (r) => (
      <span className={r.professional ? "font-medium text-[#107c10]" : "italic text-[#a19f9d]"}>
        {r.professional || "Sin asignar"}
      </span>
    ),
    getValue: (r) => r.professional || "Sin asignar",
  },
  {
    key: "time",
    header: "Hora",
    sortable: true,
    render: (r) => <span className="tabular-nums text-[#323130]">{r.time || "—"}</span>,
    getValue: (r) => r.raw_start,
  },
  {
    key: "status",
    header: "Estado",
    sortable: true,
    render: (r) => (
      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_CSS[r.status] ?? "bg-gray-100 text-gray-700"}`}>
        {STATUS_LABELS[r.status] ?? r.status}
      </span>
    ),
    getValue: (r) => STATUS_LABELS[r.status] ?? r.status,
  },
  {
    key: "payment",
    header: "Pago",
    sortable: true,
    render: (r) => <span className="text-[#605e5c]">{PAY_LABELS[r.payment] ?? r.payment}</span>,
    getValue: (r) => PAY_LABELS[r.payment] ?? r.payment,
  },
  {
    key: "total_sale",
    header: "Total",
    sortable: true,
    render: (r) => (
      <span className="font-bold tabular-nums text-[#107c10]">Bs {r.total_sale.toFixed(2)}</span>
    ),
    getValue: (r) => r.total_sale,
  },
];

export default function TodayTicketsSummary({
  receiptSale, sales, existingTickets, onNavigateToNewSale,
}: Props) {
  const todayStr = getLocalDateInputValue();

  const todaySales = useMemo(() => [
    ...(receiptSale ? [receiptSale] : []),
    ...sales.filter((s) => String(s.created_at ?? "").slice(0, 10) === todayStr && s.id !== receiptSale?.id),
  ], [receiptSale, sales, todayStr]);

  const rows = useMemo<FlatRow[]>(() =>
    todaySales.flatMap((sale) =>
      sale.appointments.map((appt) => {
        const start = new Date(appt.start_time);
        const time = Number.isNaN(start.getTime())
          ? ""
          : `${String(start.getHours()).padStart(2, "0")}:${String(start.getMinutes()).padStart(2, "0")}`;
        return {
          id: appt.id,
          ticket_code: appt.ticket_code ?? `#${appt.id}`,
          client_name: `${sale.client.name} ${sale.client.last_name}`,
          sale_code: sale.sale_code,
          services: appt.services?.map((s) => s.name).join(", ") ?? appt.service?.name ?? "Sin servicio",
          professional: appt.professional?.username ?? "",
          time,
          raw_start: appt.start_time,
          status: appt.status,
          payment: sale.payment_method,
          total_sale: Number(sale.total ?? 0),
        };
      })
    ),
  [todaySales]);

  const todayTotal = useMemo(
    () => todaySales.reduce((sum, s) => sum + Number(s.total ?? 0), 0),
    [todaySales],
  );
  const inQueueCount = existingTickets.filter((t) =>
    ["pending", "confirmed", "in_service"].includes(t.status),
  ).length;

  const handleExportPdf = () => {
    const doc = new jsPDF({ orientation: "landscape" });
    const today = new Date().toLocaleDateString("es-BO", {
      year: "numeric", month: "long", day: "numeric",
    });

    doc.setFontSize(13);
    doc.setTextColor(32, 31, 30);
    doc.text(`Servicios del día — ${today}`, 14, 14);

    doc.setFontSize(9);
    doc.setTextColor(96, 94, 92);
    doc.text(
      `Total cobrado: Bs ${todayTotal.toFixed(2)}   |   Tickets: ${rows.length}   |   En cola: ${inQueueCount}`,
      14, 21,
    );

    autoTable(doc, {
      startY: 28,
      head: [["Código", "Cliente", "Servicios", "Profesional", "Hora", "Estado", "Pago", "Total"]],
      body: rows.map((r) => [
        r.ticket_code,
        r.client_name,
        r.services,
        r.professional || "Sin asignar",
        r.time || "—",
        STATUS_LABELS[r.status] ?? r.status,
        PAY_LABELS[r.payment] ?? r.payment,
        `Bs ${r.total_sale.toFixed(2)}`,
      ]),
      styles: { fontSize: 7.5, cellPadding: 2 },
      headStyles: { fillColor: [0, 120, 212], textColor: 255, fontStyle: "bold" },
      alternateRowStyles: { fillColor: [245, 244, 243] },
      margin: { left: 14, right: 14 },
    });

    doc.save(`servicios-${todayStr}.pdf`);
  };

  return (
    <div className="flex h-full flex-col gap-3 overflow-hidden px-4 py-4">
      {/* KPIs */}
      <div className="grid shrink-0 grid-cols-3 gap-2">
        <StatCard label="Ventas hoy" value={todaySales.length} icon={<Receipt className="h-4 w-4" />} tone="emerald" compact />
        <StatCard label="Tickets hoy" value={rows.length} icon={<CalendarClock className="h-4 w-4" />} tone="blue" compact />
        <StatCard label="En cola" value={inQueueCount} icon={<Clock className="h-4 w-4" />} tone="amber" compact />
      </div>

      {todayTotal > 0 && (
        <div className="shrink-0 rounded-sm border border-[#edebe9] bg-white px-4 py-2 text-right">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-[#605e5c]">Total cobrado hoy</p>
          <p className="text-lg font-bold text-[#107c10]">Bs {todayTotal.toFixed(2)}</p>
        </div>
      )}

      {/* Tabla */}
      <div className="min-h-0 flex-1">
        <DataTable
          data={rows}
          columns={COLUMNS}
          defaultLimit={10}
          availableLimits={[10, 20, 50]}
          tableMinWidth="min-w-[800px]"
          globalSearchPlaceholder="Buscar cliente, código, servicio…"
          renderTopToolbar={() => (
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-[#605e5c]">
                Servicios de hoy
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onNavigateToNewSale}
                  className="flex items-center gap-1.5 rounded border border-[#edebe9] bg-white px-3 py-1.5 text-[11px] font-semibold text-[#323130] transition-colors hover:bg-[#f3f2f1]"
                >
                  <PlusCircle size={13} />
                  Nueva venta
                </button>
                <button
                  type="button"
                  onClick={handleExportPdf}
                  disabled={rows.length === 0}
                  className="flex items-center gap-1.5 rounded border border-[#094732] bg-[#094732] px-3 py-1.5 text-[11px] font-semibold text-white transition-colors hover:bg-[#063324] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <FileDown size={13} />
                  Exportar PDF
                </button>
              </div>
            </div>
          )}
        />
      </div>
    </div>
  );
}
