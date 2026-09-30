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

  const cellBorder = "border-b border-[var(--ui-border)] last:border-r-0";
  const headerCell =
    "align-top border-b border-[var(--ui-border)] bg-[var(--ui-surface-muted)] px-2.5 py-2 text-left text-xs font-medium text-[var(--ui-text-muted)] last:border-r-0";

  return (
    <div className="ui-data-table flex h-full min-h-0 w-full flex-col overflow-hidden rounded-xl border border-[var(--ui-border)] bg-[var(--ui-surface)] font-sans text-[var(--ui-text)] shadow-sm">
      {/* Toolbar superior */}
      <div className="shrink-0 border-b border-[var(--ui-border)] bg-[var(--ui-surface)] px-3 py-2.5">
        {renderTopToolbar && <div className="mb-2 border-b border-[var(--ui-border)] pb-2">{renderTopToolbar()}</div>}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          {enableGlobalSearch && (
            <div className="relative min-w-0 flex-1 sm:max-w-md">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--ui-text-muted)]" />
              <input
                type="text"
                value={globalSearch}
                onChange={(e) => handleGlobalSearchChange(e.target.value)}
                placeholder={globalSearchPlaceholder}
                aria-label="Buscar en la tabla"
                className="h-8 w-full rounded-lg border border-[var(--ui-border-strong)] bg-[var(--ui-input)] pl-8 pr-8 text-xs text-[var(--ui-text)] outline-none transition placeholder:text-[var(--ui-text-muted)] focus:border-brand-secondary focus:ring-2 focus:ring-brand-secondary/25"
              />
              {globalSearch ? (
                <button
                  type="button"
                  aria-label="Limpiar búsqueda"
                  title="Limpiar"
                  onClick={() => handleGlobalSearchChange("")}
                  className="absolute right-1.5 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md text-[var(--ui-text-muted)] hover:bg-[var(--ui-surface-hover)] hover:text-[var(--ui-text)]"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              ) : null}
            </div>
          )}
          <div className="flex shrink-0 items-center gap-2">
            <label className="hidden text-xs font-medium text-[var(--ui-text-muted)] sm:inline" htmlFor="datatable-page-size">
              Filas
            </label>
            <select
              id="datatable-page-size"
              value={rowsPerPage}
              onChange={(e) => handleLimitChange(Number(e.target.value))}
              aria-label="Filas por página"
              title="Filas por página"
              className="h-8 cursor-pointer rounded-lg border border-[var(--ui-border-strong)] bg-[var(--ui-input)] px-2.5 text-xs font-medium text-[var(--ui-text)] outline-none transition hover:border-brand-secondary focus:border-brand-secondary focus:ring-2 focus:ring-brand-secondary/20"
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

      <div className="relative z-0 min-h-0 flex-1 overflow-x-auto">
        <table className={`w-full ${tableMinWidth} border-collapse text-left text-xs leading-snug`}>
          <thead className="sticky top-0 z-10 shadow-[0_1px_0_0_var(--ui-border)]">
            <tr>
              <th scope="col" className={`${headerCell} w-11 text-center`}>
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
                          className={`min-w-0 flex-1 rounded-md px-0.5 py-0.5 text-left leading-snug transition-colors hover:bg-[var(--ui-surface-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-secondary ${
                            isSorted ? "text-[var(--ui-text)]" : "text-[var(--ui-text-muted)]"
                          }`}
                          aria-expanded={filterPanelOpen}
                          aria-controls={`column-filter-${col.key}`}
                          title="Mostrar u ocultar filtro de esta columna"
                          onClick={() => setOpenColumnFilterKey((k) => (k === col.key ? null : col.key))}
                        >
                          <span className="flex items-start gap-1">
                            <span className="min-w-0 flex-1 font-medium">{col.header}</span>
                            {!filterPanelOpen ? (
                              <Search className="mt-0.5 h-3 w-3 shrink-0 opacity-50" aria-hidden />
                            ) : null}
                          </span>
                        </button>
                      ) : (
                        <span
                          className={`min-w-0 flex-1 px-0.5 py-0.5 font-medium leading-snug ${
                            isSorted ? "text-[var(--ui-text)]" : "text-[var(--ui-text-muted)]"
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
                          className="flex shrink-0 flex-col items-center justify-center rounded-md border border-transparent p-0.5 leading-none text-[var(--ui-text-muted)] hover:bg-[var(--ui-surface-hover)] hover:text-[var(--ui-text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-secondary"
                        >
                          {isSorted ? (
                            activeSort!.direction === "asc" ? (
                              <ChevronUp className="h-3.5 w-3.5 text-brand-secondary" aria-hidden />
                            ) : (
                              <ChevronDown className="h-3.5 w-3.5 text-brand-secondary" aria-hidden />
                            )
                          ) : (
                            <ArrowUpDown className="h-3 w-3 opacity-50" aria-hidden />
                          )}
                        </button>
                      ) : null}
                    </div>
                    {filterPanelOpen ? (
                      <div
                        id={`column-filter-${col.key}`}
                        className="mt-1.5 border-t border-[var(--ui-border)] pt-1.5"
                        onClick={(e) => e.stopPropagation()}
                        onMouseDown={(e) => e.stopPropagation()}
                      >
                        <div className="relative">
                          <Search
                            className="pointer-events-none absolute left-1.5 top-1/2 h-3 w-3 -translate-y-1/2 text-[var(--ui-text-muted)]"
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
                            className="h-7 w-full min-w-0 rounded-md border border-[var(--ui-border-strong)] bg-[var(--ui-input)] py-0 pl-6 pr-1 text-xs font-normal text-[var(--ui-text)] outline-none placeholder:text-[var(--ui-text-muted)] focus:border-brand-secondary focus:ring-1 focus:ring-brand-secondary/25"
                          />
                        </div>
                      </div>
                    ) : null}
                  </th>
                );
              })}
              {actions && actions.length > 0 ? (
                <th
                  scope="col"
                  className={`${headerCell} sticky right-0 z-20 w-14 text-right shadow-[-6px_0_6px_-4px_rgba(15,23,42,0.12)]`}
                >
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
                <td colSpan={tableColSpan} className="border-b border-[var(--ui-border)] p-0">
                  <EmptyState title="No hay datos" description="Intenta cambiar los filtros o la búsqueda." />
                </td>
              </tr>
            ) : (
              visibleData.map((item, index) => {
                const stripe = index % 2 === 0 ? "bg-[var(--ui-surface)]" : "bg-[var(--ui-surface-muted)]";
                const stickyStripe = index % 2 === 0 ? "bg-[var(--ui-surface)]" : "bg-[var(--ui-surface-muted)]";
                return (
                  <tr
                    key={item.id}
                    className={`group transition-colors duration-75 hover:bg-[var(--ui-surface-hover)] ${stripe}`}
                  >
                    <td
                      className={`${cellBorder} px-2 py-2 text-center text-xs tabular-nums text-[var(--ui-text-muted)]`}
                    >
                      {(currentPage - 1) * rowsPerPage + index + 1}
                    </td>
                    {columns.map((col) => (
                      <td
                        key={col.key}
                        className={`${cellBorder} px-2.5 py-2 align-middle text-[var(--ui-text)]`}
                      >
                        {renderCellContent(item, col)}
                      </td>
                    ))}
                    {actions && actions.length > 0 ? (() => {
                      const visibleActions = actions.filter(a => !a.show || a.show(item));
                      return (
                        <td
                          className={`${cellBorder} sticky right-0 z-5 px-1.5 py-1 text-right align-middle shadow-[-6px_0_6px_-4px_rgba(15,23,42,0.12)] ${stickyStripe}`}
                        >
                          {visibleActions.length > 0 ? (
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
                                className="rounded-md border border-transparent p-1.5 text-[var(--ui-text-muted)] opacity-70 transition hover:border-[var(--ui-border)] hover:bg-[var(--ui-surface)] hover:text-[var(--ui-text)] hover:opacity-100 group-hover:opacity-100"
                              >
                                <MoreHorizontal className="h-3.5 w-3.5" />
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
                          ) : null}
                        </td>
                      );
                    })() : null}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="flex shrink-0 flex-col items-stretch justify-between gap-2 border-t border-[var(--ui-border)] bg-[var(--ui-surface)] px-3 py-2.5 sm:flex-row sm:items-center">
        <p className="text-center text-xs text-[var(--ui-text-muted)] sm:text-left">
          <span className="tabular-nums font-medium text-[var(--ui-text)]">
            {fromItem} – {toItem}
          </span>
          <span className="mx-1">de</span>
          <span className="tabular-nums font-semibold text-[var(--ui-text)]">{totalItems}</span>
          <span className="ml-1.5">registros</span>
        </p>
        <div className="flex items-center justify-center gap-1.5 sm:justify-end">
          <button
            type="button"
            onClick={() => handlePageChange(1)}
            disabled={currentPage <= 1 || loading}
            className="hidden h-8 rounded-lg border border-[var(--ui-border-strong)] bg-[var(--ui-surface)] px-2.5 text-xs font-medium text-[var(--ui-text-muted)] hover:bg-[var(--ui-surface-hover)] hover:text-[var(--ui-text)] disabled:cursor-not-allowed disabled:opacity-40 sm:inline"
          >
            Primera
          </button>
          <button
            type="button"
            aria-label="Página anterior"
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage <= 1 || loading}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--ui-border-strong)] bg-[var(--ui-surface)] text-[var(--ui-text-muted)] hover:bg-[var(--ui-surface-hover)] hover:text-[var(--ui-text)] disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          <div className="flex min-w-[7rem] items-center justify-center gap-1 rounded-lg border border-[var(--ui-border)] bg-[var(--ui-surface-muted)] px-2 py-1 text-xs">
            <span className="text-[var(--ui-text-muted)]">Pág.</span>
            <span className="font-semibold tabular-nums text-[var(--ui-text)]">{currentPage}</span>
            <span className="text-[var(--ui-text-muted)]">/</span>
            <span className="tabular-nums text-[var(--ui-text-muted)]">{totalPages}</span>
          </div>
          <button
            type="button"
            aria-label="Página siguiente"
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage >= totalPages || loading}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--ui-border-strong)] bg-[var(--ui-surface)] text-[var(--ui-text-muted)] hover:bg-[var(--ui-surface-hover)] hover:text-[var(--ui-text)] disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => handlePageChange(totalPages)}
            disabled={currentPage >= totalPages || loading}
            className="hidden h-8 rounded-lg border border-[var(--ui-border-strong)] bg-[var(--ui-surface)] px-2.5 text-xs font-medium text-[var(--ui-text-muted)] hover:bg-[var(--ui-surface-hover)] hover:text-[var(--ui-text)] disabled:cursor-not-allowed disabled:opacity-40 sm:inline"
          >
            Última
          </button>
        </div>
      </div>
    </div>
  );
}

export default DataTable;
