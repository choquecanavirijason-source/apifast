import { ActionDropdownMenu } from "./ActionDropdownMenu";
import { isValidElement, useEffect, useMemo, useState } from "react";
import type { KeyboardEvent, ReactNode } from "react";
import {
  ArrowUpDown,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  MoreHorizontal,
  Search,
  X,
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
  /** Columna cuyo filtro por campo está visible (se abre al pulsar el título de la columna). */
  const [openColumnFilterKey, setOpenColumnFilterKey] = useState<string | null>(null);

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

  const sortButtonKeyHandler =
    (column: DataTableColumn<T>) => (e: KeyboardEvent<HTMLButtonElement>) => {
      if (!column.sortable) return;
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        handleHeaderClick(column);
      }
    };

  const cellBorder = "border-b border-r border-slate-200/90 last:border-r-0";
  const headerCell =
    "align-top border-b border-r border-slate-300/90 bg-[#eef2f6] px-2 py-2 text-left text-[11px] font-semibold tracking-wide text-slate-700 last:border-r-0";

  return (
    <div className="flex h-full min-h-0 w-full flex-col overflow-hidden rounded-lg border border-slate-300/80 bg-white font-sans shadow-sm ring-1 ring-slate-200/60">
      {/* Barra tipo list page (BC): búsqueda + tamaño de página */}
      <div className="shrink-0 border-b border-slate-300/70 bg-gradient-to-b from-slate-100 to-slate-50/95 px-3 py-2">
        {renderTopToolbar && <div className="mb-2 border-b border-slate-200/80 pb-2">{renderTopToolbar()}</div>}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          {enableGlobalSearch && (
            <div className="relative min-w-0 flex-1 sm:max-w-md">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={globalSearch}
                onChange={(e) => handleGlobalSearchChange(e.target.value)}
                placeholder={globalSearchPlaceholder}
                aria-label="Buscar en la tabla"
                className="h-8 w-full rounded border border-slate-300/90 bg-white pl-8 pr-8 text-xs text-slate-800 shadow-inner outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/25"
              />
              {globalSearch ? (
                <button
                  type="button"
                  aria-label="Limpiar búsqueda"
                  title="Limpiar"
                  onClick={() => handleGlobalSearchChange("")}
                  className="absolute right-1.5 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              ) : null}
            </div>
          )}
          <div className="flex shrink-0 items-center gap-2">
            <label className="hidden text-[11px] font-medium text-slate-500 sm:inline" htmlFor="datatable-page-size">
              Filas
            </label>
            <select
              id="datatable-page-size"
              value={rowsPerPage}
              onChange={(e) => handleLimitChange(Number(e.target.value))}
              aria-label="Filas por página"
              title="Filas por página"
              className="h-8 cursor-pointer rounded border border-slate-300/90 bg-white px-2.5 text-xs font-medium text-slate-700 shadow-sm outline-none transition hover:border-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20"
            >
              {availableLimits.map((limit) => (
                <option key={limit} value={limit}>
                  {limit}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="relative z-0 min-h-0 flex-1 overflow-auto overscroll-contain">
        <table className={`w-full ${tableMinWidth} border-collapse text-left text-[12px] leading-snug`}>
          <thead className="sticky top-0 z-10 shadow-[0_1px_0_0_rgb(203_213_225)]">
            <tr>
              <th scope="col" className={`${headerCell} w-11 text-center text-slate-500`}>
                <span className="inline-block pt-0.5">#</span>
              </th>
              {columns.map((col) => {
                const isSorted = activeSort?.key === col.key;
                const showColFilter = enableColumnFilters && col.filterable !== false;
                const filterPanelOpen = showColFilter && openColumnFilterKey === col.key;
                return (
                  <th
                    key={col.key}
                    scope="col"
                    aria-sort={
                      isSorted
                        ? activeSort!.direction === "asc"
                          ? "ascending"
                          : "descending"
                        : col.sortable
                          ? "none"
                          : undefined
                    }
                    className={`${headerCell} min-w-0`}
                  >
                    <div className="flex items-start justify-between gap-1">
                      {showColFilter ? (
                        <button
                          type="button"
                          className={`min-w-0 flex-1 rounded-sm px-0.5 py-0.5 text-left leading-snug transition-colors hover:bg-slate-200/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-sky-500 ${
                            isSorted ? "text-sky-800" : "text-slate-700"
                          }`}
                          aria-expanded={filterPanelOpen}
                          aria-controls={`column-filter-${col.key}`}
                          title="Mostrar u ocultar filtro de esta columna"
                          onClick={() => setOpenColumnFilterKey((k) => (k === col.key ? null : col.key))}
                        >
                          <span className="flex items-start gap-1">
                            <span className="min-w-0 flex-1 font-semibold">{col.header}</span>
                            {!filterPanelOpen ? (
                              <Search className="mt-0.5 h-3 w-3 shrink-0 text-slate-400 opacity-70" aria-hidden />
                            ) : null}
                          </span>
                        </button>
                      ) : (
                        <span
                          className={`min-w-0 flex-1 px-0.5 py-0.5 font-semibold leading-snug ${
                            isSorted ? "text-sky-800" : "text-slate-700"
                          }`}
                        >
                          {col.header}
                        </span>
                      )}
                      {col.sortable ? (
                        <button
                          type="button"
                          tabIndex={0}
                          aria-label={`Ordenar por ${col.header}`}
                          title="Ordenar"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleHeaderClick(col);
                          }}
                          onKeyDown={sortButtonKeyHandler(col)}
                          className="flex shrink-0 flex-col items-center justify-center rounded-sm border border-transparent p-0.5 leading-none text-slate-400 hover:border-slate-300/80 hover:bg-white hover:text-slate-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-sky-500"
                        >
                          {isSorted ? (
                            activeSort!.direction === "asc" ? (
                              <ChevronUp className="h-3.5 w-3.5 text-sky-600" aria-hidden />
                            ) : (
                              <ChevronDown className="h-3.5 w-3.5 text-sky-600" aria-hidden />
                            )
                          ) : (
                            <ArrowUpDown className="h-3 w-3 opacity-70" aria-hidden />
                          )}
                        </button>
                      ) : null}
                    </div>
                    {filterPanelOpen ? (
                      <div
                        id={`column-filter-${col.key}`}
                        className="mt-1.5 border-t border-slate-300/60 pt-1.5"
                        onClick={(e) => e.stopPropagation()}
                        onMouseDown={(e) => e.stopPropagation()}
                      >
                        <div className="relative">
                          <Search
                            className="pointer-events-none absolute left-1 top-1/2 h-2.5 w-2.5 -translate-y-1/2 text-slate-400"
                            aria-hidden
                          />
                          <input
                            type="text"
                            autoFocus
                            value={columnFilters[col.key] ?? ""}
                            onChange={(e) => handleColumnFilterChange(col.key, e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                            onMouseDown={(e) => e.stopPropagation()}
                            onKeyDown={(e) => {
                              if (e.key === "Escape") {
                                e.preventDefault();
                                setOpenColumnFilterKey(null);
                                return;
                              }
                              e.stopPropagation();
                            }}
                            aria-label={`Filtrar ${col.header}`}
                            placeholder="Filtrar…"
                            title={`Filtrar ${col.header}`}
                            className="h-6 w-full min-w-0 rounded border border-slate-300/80 bg-white py-0 pl-5 pr-1 text-[10px] font-normal text-slate-800 shadow-sm outline-none placeholder:text-slate-400 focus:border-sky-500 focus:ring-1 focus:ring-sky-500/30"
                          />
                        </div>
                      </div>
                    ) : null}
                  </th>
                );
              })}
              {actions && actions.length > 0 ? (
                <th scope="col" className={`${headerCell} w-14 text-right text-slate-500`}>
                  <span className="inline-block pt-0.5">···</span>
                </th>
              ) : null}
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <TableSkeleton rows={5} columns={columns.length + 1} showActions={Boolean(actions?.length)} />
            ) : visibleData.length === 0 ? (
              <tr>
                <td colSpan={tableColSpan} className="border-b border-slate-200 p-0">
                  <EmptyState title="No hay datos" description="Intenta cambiar los filtros o la búsqueda." />
                </td>
              </tr>
            ) : (
              visibleData.map((item, index) => {
                const stripe = index % 2 === 0 ? "bg-white" : "bg-slate-50/70";
                return (
                  <tr
                    key={item.id}
                    className={`group transition-colors duration-75 hover:bg-sky-50/80 ${stripe}`}
                  >
                    <td
                      className={`${cellBorder} px-2 py-2 text-center text-[11px] font-medium tabular-nums text-slate-500`}
                    >
                      {(currentPage - 1) * rowsPerPage + index + 1}
                    </td>
                    {columns.map((col) => (
                      <td
                        key={col.key}
                        className={`${cellBorder} px-2.5 py-2 align-middle text-slate-800`}
                      >
                        {renderCellContent(item, col)}
                      </td>
                    ))}
                    {actions && actions.length > 0 ? (
                      <td className={`${cellBorder} px-1.5 py-1 text-right align-middle`}>
                        <div className="relative inline-flex">
                          <button
                            type="button"
                            aria-label="Acciones"
                            title="Acciones"
                            aria-expanded={openActionRowId === item.id}
                            onClick={(event) => {
                              if (openActionRowId === item.id) {
                                setOpenActionRowId(null);
                                setActionAnchorRect(null);
                                return;
                              }
                              setOpenActionRowId(item.id);
                              setActionAnchorRect(event.currentTarget.getBoundingClientRect());
                            }}
                            className="rounded border border-transparent p-1.5 text-slate-500 opacity-70 transition hover:border-slate-200 hover:bg-white hover:text-slate-800 hover:opacity-100 group-hover:opacity-100"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </button>
                          {openActionRowId === item.id ? (
                            <ActionDropdownMenu
                              actions={actions}
                              item={item}
                              anchorRect={actionAnchorRect}
                              onClose={() => {
                                setOpenActionRowId(null);
                                setActionAnchorRect(null);
                              }}
                            />
                          ) : null}
                        </div>
                      </td>
                    ) : null}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="flex shrink-0 flex-col items-stretch justify-between gap-2 border-t border-slate-300/80 bg-gradient-to-b from-slate-50 to-slate-100/90 px-3 py-2 sm:flex-row sm:items-center">
        <p className="text-center text-[11px] text-slate-600 sm:text-left">
          <span className="tabular-nums font-medium text-slate-800">
            {fromItem} – {toItem}
          </span>
          <span className="mx-1 text-slate-400">de</span>
          <span className="tabular-nums font-semibold text-slate-800">{totalItems}</span>
          <span className="ml-1.5 text-slate-500">registros</span>
        </p>
        <div className="flex items-center justify-center gap-1.5 sm:justify-end">
          <button
            type="button"
            onClick={() => handlePageChange(1)}
            disabled={currentPage <= 1 || loading}
            className="hidden h-8 rounded border border-slate-300/90 bg-white px-2 text-[11px] font-medium text-slate-600 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 sm:inline"
          >
            Primera
          </button>
          <button
            type="button"
            aria-label="Página anterior"
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage <= 1 || loading}
            className="inline-flex h-8 w-8 items-center justify-center rounded border border-slate-300/90 bg-white text-slate-700 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div className="flex min-w-[7rem] items-center justify-center gap-1 rounded border border-slate-200/90 bg-white px-2 py-1 text-xs shadow-inner">
            <span className="text-slate-500">Pág.</span>
            <span className="font-semibold tabular-nums text-sky-800">{currentPage}</span>
            <span className="text-slate-400">/</span>
            <span className="tabular-nums text-slate-700">{totalPages}</span>
          </div>
          <button
            type="button"
            aria-label="Página siguiente"
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage >= totalPages || loading}
            className="inline-flex h-8 w-8 items-center justify-center rounded border border-slate-300/90 bg-white text-slate-700 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => handlePageChange(totalPages)}
            disabled={currentPage >= totalPages || loading}
            className="hidden h-8 rounded border border-slate-300/90 bg-white px-2 text-[11px] font-medium text-slate-600 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 sm:inline"
          >
            Última
          </button>
        </div>
      </div>
    </div>
  );
}

export default DataTable;