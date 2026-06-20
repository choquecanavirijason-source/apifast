import { useMemo } from "react";
import { FileDown, Search, Receipt, Eye, Pencil, XCircle, Trash2 } from "lucide-react";
import FilterActionBar from "../../../../components/common/FilterActionBar";
import Button from "../../../../components/common/ui/Button";
import { generateReceiptPdf } from "../utils/generateReceiptPdf";
import { generateTablePdf } from "../../../../core/utils/generateTablePdf";

import type { PosSaleItem } from "../../../../core/services/pos-sale/pos-sale.service";
import DataTable, { type DataTableAction, type DataTableColumn, type DataTableColumnFilters } from "../../../../components/common/table/DataTable";
import StatusBadge from "./StatusBadge";

type SalesColFilters = {
  sale_code: string;
  client: string;
  payment_method: string;
  total: string;
};

type SalesHistoryTableProps = {
  historySearch: string;
  onHistorySearchChange: (value: string) => void;
  historyClientFilter: string;
  onHistoryClientFilterChange: (value: string) => void;
  historyClientOptions: string[];
  historyPaymentFilter: string;
  onHistoryPaymentFilterChange: (value: string) => void;
  historyPaymentOptions: string[];
  historyDateFrom: string;
  onHistoryDateFromChange: (value: string) => void;
  historyDateTo: string;
  onHistoryDateToChange: (value: string) => void;
  filteredSalesTotalAmount: number;
  allSalesTotalAmount: number;
  rowsPerPage: number;
  rowsPerPageOptions: number[];
  onRowsPerPageChange: (value: number) => void;
  colFilters: SalesColFilters;
  onColFilterChange: (key: keyof SalesColFilters, value: string) => void;
  pagedSales: PosSaleItem[];
  currentPage: number;
  totalPages: number;
  filteredSalesCount: number;
  onPageChange: (page: number) => void;
  onViewDetail: (sale: PosSaleItem) => void;
  onEditSale: (sale: PosSaleItem) => void;
  onCancelSale: (sale: PosSaleItem) => void;
  onDeleteSale: (sale: PosSaleItem) => void;
  allFilteredSales: PosSaleItem[];
};

export default function SalesHistoryTable({
  historySearch,
  onHistorySearchChange,
  historyClientFilter,
  onHistoryClientFilterChange,
  historyClientOptions,
  historyPaymentFilter,
  onHistoryPaymentFilterChange,
  historyPaymentOptions,
  historyDateFrom,
  onHistoryDateFromChange,
  historyDateTo,
  onHistoryDateToChange,
  filteredSalesTotalAmount,
  allSalesTotalAmount,
  rowsPerPage,
  rowsPerPageOptions,
  onRowsPerPageChange,
  colFilters: _colFilters,
  onColFilterChange,
  pagedSales,
  currentPage,
  totalPages,
  filteredSalesCount,
  onPageChange,
  onViewDetail,
  onEditSale,
  onCancelSale,
  onDeleteSale,
  allFilteredSales,
}: SalesHistoryTableProps) {
  
  const handleExportPdf = () => {
    void generateTablePdf({
      title: "Historial de Ventas POS",
      subtitle: "Ventas registradas en el punto de venta",
      filename: "ventas-pos",
      orientation: "landscape",
      meta: [
        { label: "Total ventas", value: String(allFilteredSales.length) },
        { label: "Monto total", value: `Bs ${allFilteredSales.reduce((s, v) => s + Number(v.total ?? 0), 0).toFixed(2)}` },
      ],
      columns: [
        { key: "sale_code", header: "Código" },
        { key: "client", header: "Cliente" },
        { key: "services", header: "Servicios" },
        { key: "created_by", header: "Registró" },
        { key: "operarias", header: "Operaria(s)" },
        { key: "payment_method", header: "Método de pago" },
        { key: "subtotal", header: "Subtotal" },
        { key: "descuento", header: "Descuento" },
        { key: "total", header: "Total" },
        { key: "status", header: "Estado" },
        { key: "fecha", header: "Fecha" },
      ],
      rows: allFilteredSales.map((s) => ({
        sale_code: s.sale_code,
        client: `${s.client?.name ?? ""} ${s.client?.last_name ?? ""}`.trim(),
        services: s.appointments?.map((a) => a.service?.name ?? a.services?.map((sv) => sv.name).join(", ") ?? "").filter(Boolean).join(" | ") || "—",
        created_by: s.created_by?.username ?? "—",
        operarias: [...new Set((s.appointments ?? []).map((a) => a.professional?.username).filter(Boolean))].join(", ") || "—",
        payment_method: s.payment_method ?? "—",
        subtotal: `Bs ${Number(s.subtotal ?? 0).toFixed(2)}`,
        descuento: s.discount_value ? `${s.discount_type === "percent" ? `${s.discount_value}%` : `Bs ${s.discount_value}`}` : "—",
        total: `Bs ${Number(s.total ?? 0).toFixed(2)}`,
        status: s.status === "paid" ? "Pagado" : s.status === "cancelled" ? "Cancelado" : s.status,
        fecha: s.created_at ? new Date(s.created_at).toLocaleDateString("es-BO") : "—",
      })),
    });
  };

  const renderToolbar = () => (
    <FilterActionBar
      left={
        <div className="flex items-center gap-2">
          <Receipt className="h-5 w-5 text-emerald-600" />
          <span className="font-semibold text-slate-800">Ventas</span>
        </div>
      }
      right={
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            onClick={handleExportPdf}
            leftIcon={<FileDown className="h-4 w-4" />}
            title="Descargar reporte PDF"
            className="whitespace-nowrap"
          >
            Imprimir en PDF
          </Button>
        </div>
      }
    />
  );

  // ── Columnas de la tabla ───────────────────────────────────────────────────
  const columns = useMemo<DataTableColumn<PosSaleItem>[]>(
    () => [
      {
        key: "sale_code",
        header: "Codigo",
        sortable: true,
        render: (sale) => <span className="font-mono text-xs font-bold text-emerald-600">{sale.sale_code}</span>,
        getValue: (sale) => sale.sale_code ?? "",
      },
      {
        key: "client",
        header: "Cliente",
        sortable: true,
        render: (sale) => (
          <span className="font-semibold text-slate-800">
            {sale.client?.name} {sale.client?.last_name}
          </span>
        ),
        getValue: (sale) => `${sale.client?.name ?? ""} ${sale.client?.last_name ?? ""}`,
      },
      {
        key: "payment_method",
        header: "Metodo",
        sortable: true,
        render: (sale) => <StatusBadge status={sale.payment_method ?? "-"} />,
        getValue: (sale) => sale.payment_method ?? "",
      },
      {
        key: "total",
        header: "Total",
        sortable: true,
        render: (sale) => <span className="font-black text-slate-900">Bs {sale.total?.toFixed(2)}</span>,
        getValue: (sale) => sale.total ?? 0,
      },
      {
        key: "tickets",
        header: "Tickets",
        sortable: true,
        filterable: false,
        searchable: false,
        render: (sale) => (
          <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-600">
            {sale.appointments?.length ?? 0} tickets
          </span>
        ),
        getValue: (sale) => sale.appointments?.length ?? 0,
      },
      {
        key: "created_by",
        header: "Registró",
        sortable: true,
        render: (sale) =>
          sale.created_by ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-semibold text-indigo-700">
              {sale.created_by.username}
            </span>
          ) : (
            <span className="text-xs text-slate-400">—</span>
          ),
        getValue: (sale) => sale.created_by?.username ?? "",
      },
      {
        key: "operarias",
        header: "Operaria(s)",
        sortable: false,
        filterable: false,
        searchable: false,
        render: (sale) => {
          const names = [
            ...new Set(
              (sale.appointments ?? [])
                .map((a) => a.professional?.username)
                .filter((n): n is string => Boolean(n))
            ),
          ];
          if (names.length === 0) return <span className="text-xs text-slate-400">—</span>;
          return (
            <div className="flex flex-wrap gap-1">
              {names.map((name) => (
                <span
                  key={name}
                  className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700"
                >
                  {name}
                </span>
              ))}
            </div>
          );
        },
        getValue: (sale) =>
          (sale.appointments ?? [])
            .map((a) => a.professional?.username)
            .filter(Boolean)
            .join(", "),
      },
      {
        key: "created_at",
        header: "Fecha",
        sortable: true,
        render: (sale) => (
          <span className="text-xs text-slate-400">
            {new Date(sale.created_at).toLocaleDateString("es-BO", {
              day: "2-digit",
              month: "short",
              year: "numeric",
            })}
          </span>
        ),
        getValue: (sale) => sale.created_at ?? "",
      },
    ],
    []
  );

  // ── Acciones del dropdown ⋯ (igual que tabla de clientes) ─────────────────
  const actions = useMemo<DataTableAction<PosSaleItem>[]>(
    () => [
      {
        label: "Descargar PDF",
        icon: <Receipt className="w-4 h-4" />,
        onClick: (sale) => void generateReceiptPdf(sale),
      },
      {
        label: "Ver detalle",
        icon: <Eye className="w-4 h-4" />,
        onClick: onViewDetail,
      },
      {
        label: "Editar",
        icon: <Pencil className="w-4 h-4" />,
        onClick: onEditSale,
        variant: "primary",
        show: (sale) => sale.status !== "cancelled",
      },
      {
        label: "Cancelar venta",
        icon: <XCircle className="w-4 h-4" />,
        onClick: onCancelSale,
        show: (sale) => sale.status !== "cancelled",
      },
      {
        label: "Eliminar",
        icon: <Trash2 className="w-4 h-4" />,
        onClick: onDeleteSale,
        variant: "danger",
      },
    ],
    [onCancelSale, onDeleteSale, onEditSale, onViewDetail]
  );

  const handleColumnFilters = (filters: DataTableColumnFilters) => {
    (["sale_code", "client", "payment_method", "total"] as const).forEach((key) => {
      onColFilterChange(key, filters[key] ?? "");
    });
  };

  return (
    <div className="flex flex-col gap-4">
     
      <DataTable
        data={pagedSales}
        columns={columns}
        actions={actions}
        renderTopToolbar={renderToolbar}
        enableGlobalSearch={false}
        globalSearchPlaceholder="Buscar ventas..."
        enableColumnFilters
        onFilterChange={handleColumnFilters}
        pagination={{
          mode: "server",
          page: currentPage,
          limit: rowsPerPage,
          total: filteredSalesCount,
          totalPages,
        }}
        onPageChange={onPageChange}
        onLimitChange={onRowsPerPageChange}
        availableLimits={rowsPerPageOptions}
        tableMinWidth="min-w-[860px]"
      />
    </div>
  );
}
