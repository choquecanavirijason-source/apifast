import { ArrowLeft, ArrowRight, ChevronsLeft, ChevronsRight, Search } from "lucide-react";

import type { PosSaleItem } from "../../../../core/services/pos-sale/pos-sale.service";
import ColFilter from "./ColFilter";
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
  colFilters,
  onColFilterChange,
  pagedSales,
  currentPage,
  totalPages,
  filteredSalesCount,
  onPageChange,
  onViewDetail,
}: SalesHistoryTableProps) {
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

      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="px-4 py-3 text-left w-10">
                  <span className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">#</span>
                </th>
                {[
                  { key: "sale_code", label: "Codigo" },
                  { key: "client", label: "Cliente" },
                  { key: "payment_method", label: "Metodo" },
                  { key: "total", label: "Total" },
                ].map(({ key, label }) => (
                  <th key={key} className="px-4 py-3 text-left">
                    <span className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">{label}</span>
                    <ColFilter
                      value={colFilters[key as keyof SalesColFilters]}
                      onChange={(value) => onColFilterChange(key as keyof SalesColFilters, value)}
                    />
                  </th>
                ))}
                <th className="px-4 py-3 text-left">
                  <span className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">Tickets</span>
                </th>
                <th className="px-4 py-3 text-left">
                  <span className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">Fecha</span>
                </th>
                <th className="px-4 py-3 text-right">
                  <span className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">Accion</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {pagedSales.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-16 text-center text-slate-400 text-sm">
                    Sin resultados para los filtros aplicados.
                  </td>
                </tr>
              ) : (
                pagedSales.map((sale, idx) => (
                  <tr key={sale.id} className="group transition hover:bg-slate-50/60">
                    <td className="px-4 py-3.5 text-slate-400 text-xs font-medium">{(currentPage - 1) * rowsPerPage + idx + 1}</td>
                    <td className="px-4 py-3.5">
                      <span className="font-mono text-xs font-bold text-emerald-600">{sale.sale_code}</span>
                    </td>
                    <td className="px-4 py-3.5 font-semibold text-slate-800">
                      {sale.client?.name} {sale.client?.last_name}
                    </td>
                    <td className="px-4 py-3.5">
                      <StatusBadge status={sale.payment_method ?? "-"} />
                    </td>
                    <td className="px-4 py-3.5 font-black text-slate-900">Bs {sale.total?.toFixed(2)}</td>
                    <td className="px-4 py-3.5">
                      <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-600">
                        {sale.appointments?.length ?? 0} tickets
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-xs text-slate-400">
                      {new Date(sale.created_at).toLocaleDateString("es-BO", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <button
                        onClick={() => onViewDetail(sale)}
                        className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 shadow-sm transition hover:border-slate-300 hover:text-slate-900 opacity-0 group-hover:opacity-100"
                      >
                        Ver detalle
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3">
          <p className="text-xs text-slate-400">
            Mostrando <span className="font-semibold text-slate-600">{filteredSalesCount === 0 ? 0 : (currentPage - 1) * rowsPerPage + 1}</span> a{" "}
            <span className="font-semibold text-slate-600">{Math.min(currentPage * rowsPerPage, filteredSalesCount)}</span> de{" "}
            <span className="font-semibold text-slate-600">{filteredSalesCount}</span>
          </p>

          <div className="flex items-center gap-1">
            {[
              { Icon: ChevronsLeft, onClick: () => onPageChange(1), disabled: currentPage === 1 },
              { Icon: ArrowLeft, onClick: () => onPageChange(currentPage - 1), disabled: currentPage === 1 },
            ].map(({ Icon, onClick, disabled }, i) => (
              <button
                key={i}
                disabled={disabled}
                onClick={onClick}
                className="h-8 w-8 flex items-center justify-center rounded-lg border border-slate-200 text-slate-400 transition hover:border-slate-300 hover:text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <Icon className="h-3.5 w-3.5" />
              </button>
            ))}

            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              const offset = Math.max(0, Math.min(currentPage - 3, totalPages - 5));
              const page = offset + i + 1;
              return page <= totalPages ? (
                <button
                  key={page}
                  onClick={() => onPageChange(page)}
                  className={`h-8 w-8 flex items-center justify-center rounded-lg text-xs font-semibold transition ${
                    currentPage === page
                      ? "bg-slate-900 text-white shadow-sm"
                      : "border border-slate-200 text-slate-500 hover:border-slate-300 hover:text-slate-700"
                  }`}
                >
                  {page}
                </button>
              ) : null;
            })}

            {[
              { Icon: ArrowRight, onClick: () => onPageChange(currentPage + 1), disabled: currentPage === totalPages },
              { Icon: ChevronsRight, onClick: () => onPageChange(totalPages), disabled: currentPage === totalPages },
            ].map(({ Icon, onClick, disabled }, i) => (
              <button
                key={i}
                disabled={disabled}
                onClick={onClick}
                className="h-8 w-8 flex items-center justify-center rounded-lg border border-slate-200 text-slate-400 transition hover:border-slate-300 hover:text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <Icon className="h-3.5 w-3.5" />
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
