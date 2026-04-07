import { ActionDropdownMenu } from "./ActionDropdownMenu";
import { isValidElement, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  MoreHorizontal,
  Search,
} from "lucide-react";
import TableSkeleton from "../feedback/TableSkeleton";
import EmptyState from "../EmptyState";

type SortDirection = "asc" | "desc";

export interface DataTableColumn<T> {
  key: string;
  header: string;
  render: (item: T) => ReactNode;
  sortable?: boolean;
  searchable?: boolean;
  filterable?: boolean;
  getValue?: (item: T) => string | number | boolean | null | undefined;
}

export interface DataTableAction<T> {
  label: string;
  icon?: ReactNode;
  onClick: (item: T) => void;
  variant?: "primary" | "danger" | "default";
  show?: (item: T) => boolean;
}

export interface DataTablePagination {
  page: number;
  limit: number;
  total: number;
  totalPages?: number;
  mode?: "client" | "server";
}

export type DataTableColumnFilters = Record<string, string>;

interface DataTableProps<T> {
  data: T[];
  columns: DataTableColumn<T>[];
  actions?: DataTableAction<T>[];
  sort?: { key: string; direction: SortDirection };
  onSortChange?: (key: string, direction: SortDirection) => void;
  loading?: boolean;
  renderTopToolbar?: () => ReactNode;
  onSearch?: (search: string) => void;
  pagination?: Partial<DataTablePagination>;
  onPageChange?: (page: number) => void;
  onLimitChange?: (limit: number) => void;
  availableLimits?: number[];
  onFilterChange?: (filter: DataTableColumnFilters) => void;
  enableGlobalSearch?: boolean;
  globalSearchPlaceholder?: string;
  enableColumnFilters?: boolean;
  defaultLimit?: number;
  tableMinWidth?: string;
}

function DataTable<T extends { id: number | string }>({
  data,
  columns,
  actions,
  sort,
  onSortChange,
  loading = false,
  renderTopToolbar,
  onSearch,
  pagination,
  onPageChange,
  onLimitChange,
  availableLimits = [10, 20, 50],
  onFilterChange,
  enableGlobalSearch = true,
  globalSearchPlaceholder = "Buscar",
  enableColumnFilters = true,
  defaultLimit,
  tableMinWidth = "min-w-[760px]",
}: DataTableProps<T>) {
  const initialLimit = defaultLimit ?? pagination?.limit ?? availableLimits[0] ?? 10;
  const [globalSearch, setGlobalSearch] = useState("");
  const [columnFilters, setColumnFilters] = useState<DataTableColumnFilters>({});
  const [currentPage, setCurrentPage] = useState<number>(pagination?.page ?? 1);
  const [rowsPerPage, setRowsPerPage] = useState<number>(initialLimit);
  const [internalSort, setInternalSort] = useState<{ key: string; direction: SortDirection } | undefined>(sort);
  const [openActionRowId, setOpenActionRowId] = useState<number | string | null>(null);
  const [actionAnchorRect, setActionAnchorRect] = useState<DOMRect | null>(null);

  const isServerPagination = pagination?.mode === "server";
  const activeSort = sort ?? internalSort;

  useEffect(() => {
    if (sort) setInternalSort(sort);
  }, [sort]);

  useEffect(() => {
    if (pagination?.page !== undefined) setCurrentPage(pagination.page);
  }, [pagination?.page]);

  useEffect(() => {
    if (pagination?.limit !== undefined) setRowsPerPage(pagination.limit);
  }, [pagination?.limit]);

  const readCellValue = (item: T, column: DataTableColumn<T>): string => {
    if (column.getValue) {
      const customValue = column.getValue(item);
      return customValue == null ? "" : String(customValue);
    }
    const keyValue = (item as Record<string, unknown>)[column.key];
    return keyValue == null ? "" : String(keyValue);
  };

  const renderCellContent = (item: T, column: DataTableColumn<T>): ReactNode => {
    const value = column.render(item);
    if (value == null || typeof value === "boolean") return "";
    if (typeof value === "string" || typeof value === "number") return value;
    if (isValidElement(value)) return value;
    return String(value);
  };

  const filteredData = useMemo(() => {
    return data.filter((item: T) => {
      const matchesGlobalSearch =
        !globalSearch ||
        columns
          .filter((column) => column.searchable !== false)
          .some((column) => readCellValue(item, column).toLowerCase().includes(globalSearch.toLowerCase()));

      const matchesColumnFilters = Object.entries(columnFilters).every(([key, value]) => {
        if (!value) return true;
        const column = columns.find((col) => col.key === key);
        return column ? readCellValue(item, column).toLowerCase().includes(value.toLowerCase()) : true;
      });

      return matchesGlobalSearch && matchesColumnFilters;
    });
  }, [data, columns, globalSearch, columnFilters]);

  // --- LÓGICA DE ORDENACIÓN MEJORADA ---
  const sortedData = useMemo(() => {
    if (!activeSort?.key) return filteredData;

    const activeColumn = columns.find((col) => col.key === activeSort.key);
    if (!activeColumn) return filteredData;

    return [...filteredData].sort((a, b) => {
      const valA = readCellValue(a, activeColumn);
      const valB = readCellValue(b, activeColumn);

      const numA = parseFloat(valA);
      const numB = parseFloat(valB);

      let comparison = 0;
      if (!isNaN(numA) && !isNaN(numB)) {
        comparison = numA - numB;
      } else {
        comparison = valA.localeCompare(valB, "es", { numeric: true, sensitivity: "base" });
      }

      return activeSort.direction === "asc" ? comparison : -comparison;
    });
  }, [filteredData, columns, activeSort]);

  const totalItems = isServerPagination ? (pagination?.total ?? data.length) : sortedData.length;
  const totalPages = pagination?.totalPages ?? Math.max(1, Math.ceil(totalItems / rowsPerPage));
  const tableColSpan = columns.length + 1 + (actions && actions.length > 0 ? 1 : 0);
  const visibleData = isServerPagination
    ? data
    : sortedData.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);
  
  const fromItem = totalItems === 0 ? 0 : (currentPage - 1) * rowsPerPage + 1;
  const toItem = Math.min(currentPage * rowsPerPage, totalItems);

  const handleHeaderClick = (column: DataTableColumn<T>) => {
    if (!column.sortable) return;

    const nextDirection: SortDirection =
      activeSort?.key === column.key && activeSort.direction === "asc" ? "desc" : "asc";

    if (onSortChange) {
      onSortChange(column.key, nextDirection);
    } else {
      setInternalSort({ key: column.key, direction: nextDirection });
    }
  };

  const handleGlobalSearchChange = (value: string) => {
    setGlobalSearch(value);
    setCurrentPage(1);
    onSearch?.(value);
    if (isServerPagination) onPageChange?.(1);
  };

  const handleColumnFilterChange = (columnKey: string, value: string) => {
    const nextFilters = { ...columnFilters, [columnKey]: value };
    setColumnFilters(nextFilters);
    setCurrentPage(1);
    onFilterChange?.(nextFilters);
    if (isServerPagination) onPageChange?.(1);
  };

  const handleLimitChange = (limit: number) => {
    setRowsPerPage(limit);
    setCurrentPage(1);
    onLimitChange?.(limit);
    if (isServerPagination) onPageChange?.(1);
  };

  const handlePageChange = (nextPage: number) => {
    const boundedPage = Math.max(1, Math.min(nextPage, totalPages));
    setCurrentPage(boundedPage);
    onPageChange?.(boundedPage);
  };

  return (
    <div className="flex h-full w-full flex-col overflow-hidden rounded-md border border-slate-200 bg-white font-sans">
      <div className="border-b border-slate-100 bg-slate-50/50 px-2 py-1.5">
        {renderTopToolbar && <div className="mb-1.5">{renderTopToolbar()}</div>}
        <div className="flex flex-col justify-between gap-1.5 md:flex-row md:items-center">
          {enableGlobalSearch && (
            <div className="relative flex-1 md:max-w-sm">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={globalSearch}
                onChange={(e) => handleGlobalSearchChange(e.target.value)}
                placeholder={globalSearchPlaceholder}
                aria-label="Buscar"
                className="w-full rounded border border-slate-200 bg-white py-1 pl-8 pr-2 text-xs text-slate-800 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20"
              />
            </div>
          )}
          <div className="flex items-center gap-3">
            <select
              value={rowsPerPage}
              onChange={(e) => handleLimitChange(Number(e.target.value))}
              aria-label="Filas por página"
              title="Filas por página"
              className="block rounded border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 outline-none focus:border-blue-500"
            >
              {availableLimits.map((limit) => (
                <option key={limit} value={limit}>{limit}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="relative z-0 flex-1 overflow-x-auto overflow-y-visible">
        <table className={`w-full ${tableMinWidth} border-separate border-spacing-0 text-left text-xs`}>
          <thead className="sticky top-0 z-10 bg-slate-50/80 backdrop-blur-sm">
            <tr>
              <th className="w-16 border-b border-slate-200 px-2.5 py-2 text-center text-[10px] font-semibold uppercase text-slate-600">#</th>
              {columns.map((col) => {
                const isSorted = activeSort?.key === col.key;
                return (
                  <th
                    key={col.key}
                    onClick={() => handleHeaderClick(col)}
                    className={`border-b border-slate-200 px-3 py-2 text-[10px] font-semibold uppercase tracking-tight transition-colors ${
                      col.sortable ? "cursor-pointer hover:bg-slate-100/50 hover:text-blue-600 select-none" : "text-slate-600"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className={isSorted ? "text-blue-600" : ""}>{col.header}</span>
                      {col.sortable && (
                        <span className="flex flex-col">
                          <ChevronUp className={`h-3 w-3 -mb-1 ${isSorted && activeSort.direction === "asc" ? "text-blue-600" : "text-slate-300"}`} />
                          <ChevronDown className={`h-3 w-3 ${isSorted && activeSort.direction === "desc" ? "text-blue-600" : "text-slate-300"}`} />
                        </span>
                      )}
                    </div>
                  </th>
                );
              })}
              {actions && actions.length > 0 && (
                <th className="border-b border-slate-200 px-3 py-2 text-right text-[10px] font-semibold uppercase text-slate-600">Acción</th>
              )}
            </tr>

            {enableColumnFilters && (
              <tr className="bg-white">
                <th className="border-b border-slate-100 px-2.5 py-1.5" />
                {columns.map((col) => (
                  <th key={`f-${col.key}`} className="border-b border-slate-100 px-3 py-1.5">
                    {col.filterable !== false && (
                      <div className="relative">
                        <Search className="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-slate-300" />
                        <input
                          type="text"
                          value={columnFilters[col.key] ?? ""}
                          onChange={(e) => handleColumnFilterChange(col.key, e.target.value)}
                          aria-label={`Filtrar ${col.header}`}
                          title={`Filtrar ${col.header}`}
                          className="w-full rounded border border-slate-200 bg-white py-1 pl-6 pr-2 text-[11px] text-slate-700 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20"
                        />
                      </div>
                    )}
                  </th>
                ))}
                {actions && actions.length > 0 && <th className="border-b border-slate-100" />}
              </tr>
            )}
          </thead>

          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <TableSkeleton rows={5} columns={columns.length + 1} showActions={Boolean(actions?.length)} />
            ) : visibleData.length === 0 ? (
              <tr>
                <td colSpan={tableColSpan} className="p-0">
                  <EmptyState title="No hay datos" description="Intenta cambiar los filtros." />
                </td>
              </tr>
            ) : (
              visibleData.map((item, index) => (
                <tr key={item.id} className="group transition-colors hover:bg-blue-50/30">
                  <td className="px-3 py-3 text-center text-xs font-semibold text-slate-500">
                    {(currentPage - 1) * rowsPerPage + index + 1}
                  </td>
                  {columns.map((col) => (
                    <td key={col.key} className="px-4 py-3 text-slate-700">
                      {renderCellContent(item, col)}
                    </td>
                  ))}
                  {actions && actions.length > 0 && (
                    <td className="px-4 py-3 text-right">
                      <div className="relative inline-block text-left">
                        <button
                          onClick={(event) => {
                            if (openActionRowId === item.id) {
                              setOpenActionRowId(null);
                              setActionAnchorRect(null);
                              return;
                            }
                            setOpenActionRowId(item.id);
                            setActionAnchorRect(event.currentTarget.getBoundingClientRect());
                          }}
                          className="cursor-pointer rounded-md p-2 text-slate-600 hover:bg-slate-100"
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </button>
                        {openActionRowId === item.id && (
                          <ActionDropdownMenu
                            actions={actions}
                            item={item}
                            anchorRect={actionAnchorRect}
                            onClose={() => {
                              setOpenActionRowId(null);
                              setActionAnchorRect(null);
                            }}
                          />
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col items-center justify-between gap-2 border-t border-slate-200 bg-slate-50/50 px-4 py-2 sm:flex-row">
        <div className="text-xs text-slate-500">
          <strong>{fromItem}</strong>–<strong>{toItem}</strong> / <strong>{totalItems}</strong>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage <= 1 || loading}
            className="rounded-md border border-slate-200 bg-white p-2 hover:bg-slate-50 disabled:opacity-30"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div className="flex items-center gap-1 text-sm font-medium">
            <span className="bg-blue-600 text-white px-3 py-1 rounded-md">{currentPage}</span>
            <span className="text-slate-400 mx-1">/</span>
            <span className="text-slate-700">{totalPages}</span>
          </div>
          <button
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage >= totalPages || loading}
            className="rounded-md border border-slate-200 bg-white p-2 hover:bg-slate-50 disabled:opacity-30"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default DataTable;