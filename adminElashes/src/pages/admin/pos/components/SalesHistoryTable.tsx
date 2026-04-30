import { useMemo } from "react";
import { Search } from "lucide-react";

import type { PosSaleItem } from "../../../../core/services/pos-sale/pos-sale.service";
import DataTable, { type DataTableColumn, type DataTableColumnFilters } from "../../../../components/common/table/DataTable";
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
}: SalesHistoryTableProps) {
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
      {
        key: "action",
        header: "Acciones",
        sortable: false,
        filterable: false,
        searchable: false,
        render: (sale) => (
          <div className="flex justify-end gap-2">
            <button
              onClick={() => onViewDetail(sale)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 shadow-sm transition hover:border-slate-300 hover:text-slate-900"
            >
              Ver detalle
            </button>
            <button
              onClick={() => onEditSale(sale)}
              className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 shadow-sm transition hover:border-blue-300 hover:bg-blue-100"
            >
              Editar
            </button>
            <button
              onClick={() => onCancelSale(sale)}
              className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700 shadow-sm transition hover:border-amber-300 hover:bg-amber-100"
            >
              Cancelar
            </button>
            <button
              onClick={() => onDeleteSale(sale)}
              className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 shadow-sm transition hover:border-rose-300 hover:bg-rose-100"
            >
              Eliminar
            </button>
          </div>
        ),
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
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3">
          <div className="relative xl:col-span-2">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
            <input
              value={historySearch}
              onChange={(e) => onHistorySearchChange(e.target.value)}
              placeholder="Buscar ventas, clientes o montos..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-700 placeholder-slate-400 outline-none transition focus:border-slate-300 focus:ring-2 focus:ring-slate-100"
            />
          </div>

          <select
            value={historyClientFilter}
            onChange={(e) => onHistoryClientFilterChange(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-slate-300"
          >
            <option value="">Todos los clientes</option>
            {historyClientOptions.map((clientName) => (
              <option key={clientName} value={clientName}>
                {clientName}
              </option>
            ))}
          </select>

          <select
            value={historyPaymentFilter}
            onChange={(e) => onHistoryPaymentFilterChange(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-slate-300"
          >
            <option value="all">Todos los metodos</option>
            {historyPaymentOptions.map((paymentMethod) => (
              <option key={paymentMethod} value={paymentMethod}>
                {paymentMethod}
              </option>
            ))}
          </select>

          <div className="grid grid-cols-2 gap-2">
            <input
              type="date"
              value={historyDateFrom}
              onChange={(e) => onHistoryDateFromChange(e.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-slate-300"
              title="Fecha desde"
            />
            <input
              type="date"
              value={historyDateTo}
              onChange={(e) => onHistoryDateToChange(e.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-slate-300"
              title="Fecha hasta"
            />
          </div>
        </div>

        <div className="mt-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <span>Mostrar</span>
            <select
              value={rowsPerPage}
              onChange={(e) => onRowsPerPageChange(Number(e.target.value))}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-slate-300"
            >
              {rowsPerPageOptions.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>

          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm">
            <span className="text-emerald-700">Monto filtrado: </span>
            <span className="font-bold text-emerald-800">Bs {filteredSalesTotalAmount.toFixed(2)}</span>
            <span className="text-emerald-700"> / Total general: </span>
            <span className="font-bold text-emerald-800">Bs {allSalesTotalAmount.toFixed(2)}</span>
          </div>
        </div>
      </div>

      <DataTable
        data={pagedSales}
        columns={columns}
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
        tableMinWidth="min-w-[980px]"
      />
    </div>
  );
}
