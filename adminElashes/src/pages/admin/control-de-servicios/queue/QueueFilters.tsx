import type { Dispatch, SetStateAction } from "react";
import { Button, SectionCard } from "../../../../components/common/ui";
import { ChevronDown, Search } from "lucide-react";
import { todayDate } from "../control.constants";

interface QueueFiltersProps {
  filterService: string;
  setFilterService: Dispatch<SetStateAction<string>>;
  isServiceFilterMenuOpen: boolean;
  setIsServiceFilterMenuOpen: Dispatch<SetStateAction<boolean>>;
  filteredServiceFilterOptions: string[];
  filterClient: string;
  setFilterClient: Dispatch<SetStateAction<string>>;
  filterDate: string;
  setFilterDate: Dispatch<SetStateAction<string>>;
  filterTime: string;
  setFilterTime: Dispatch<SetStateAction<string>>;
  filterProfessionalId: string;
  setFilterProfessionalId: Dispatch<SetStateAction<string>>;
  professionals: any[];
  loadTickets: () => void;
  isLoading: boolean;
}

export default function QueueFilters({
  filterService,
  setFilterService,
  isServiceFilterMenuOpen,
  setIsServiceFilterMenuOpen,
  filteredServiceFilterOptions,
  filterClient,
  setFilterClient,
  filterDate,
  setFilterDate,
  filterTime,
  setFilterTime,
  filterProfessionalId,
  setFilterProfessionalId,
  professionals,
  loadTickets,
  isLoading,
}: QueueFiltersProps) {
  return (
    <SectionCard className="border-[var(--ui-border-strong)] bg-[var(--ui-surface-muted)]" bodyClassName="!p-4 sm:!p-5">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-6 xl:grid-cols-7">
        <div className="lg:col-span-2">
          <label className="text-[11px] font-semibold text-[var(--ui-text-muted)]">Servicio</label>
          <div className="flex gap-2 mt-1">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
              <input
                type="text"
                value={filterService}
                onChange={(event) => {
                  setFilterService(event.target.value);
                  setIsServiceFilterMenuOpen(true);
                }}
                onFocus={() => setIsServiceFilterMenuOpen(true)}
                placeholder="Buscar producto o servicio..."
                className="h-10 w-full rounded-lg border border-[var(--ui-border-strong)] bg-white px-10 pr-10 text-sm text-[var(--ui-text)] placeholder:text-[var(--ui-text-muted)] outline-none transition focus:border-[#094732] focus:ring-1 focus:ring-[#094732]/35 disabled:bg-[var(--ui-surface-muted)] disabled:text-[var(--ui-text-muted)]"
              />
              <button
                type="button"
                onClick={() => setIsServiceFilterMenuOpen((prev) => !prev)}
                className="absolute right-1 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-[var(--ui-text-muted)] transition hover:bg-[var(--ui-surface-hover)] hover:text-[var(--ui-text)]"
                aria-label="Mostrar servicios"
              >
                <ChevronDown className="h-4 w-4" />
              </button>
              {isServiceFilterMenuOpen && (
                <div className="absolute z-40 mt-1 w-full overflow-hidden rounded-lg border border-[var(--ui-border-strong)] bg-white shadow-lg">
                  <div className="max-h-56 overflow-y-auto py-1">
                    {filteredServiceFilterOptions.length === 0 ? (
                      <p className="px-3 py-2 text-xs text-slate-500">No se encontraron servicios.</p>
                    ) : (
                      filteredServiceFilterOptions.map((option) => (
                        <button
                          key={option}
                          type="button"
                          onClick={() => {
                            setFilterService(option);
                            setIsServiceFilterMenuOpen(false);
                          }}
                          className="flex w-full items-center justify-between px-3 py-2 text-left transition hover:bg-[var(--ui-surface-hover)]"
                        >
                          <span className="truncate text-sm text-[var(--ui-text)]">{option}</span>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="lg:col-span-2">
          <label className="text-[11px] font-semibold text-[var(--ui-text-muted)]">Cliente</label>
          <div className="relative mt-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={filterClient}
              onChange={(event) => setFilterClient(event.target.value)}
              placeholder="Buscar por nombre de clienta..."
              className="h-10 w-full rounded-lg border border-[var(--ui-border-strong)] bg-white px-9 text-sm text-[var(--ui-text)] placeholder:text-[var(--ui-text-muted)] outline-none transition focus:border-[#094732] focus:ring-1 focus:ring-[#094732]/35 disabled:bg-[var(--ui-surface-muted)] disabled:text-[var(--ui-text-muted)]"
            />
          </div>
        </div>
        <div>
          <label className="text-[11px] font-semibold text-[var(--ui-text-muted)]">Fecha</label>
          <input
            type="date"
            value={filterDate}
            onChange={(event) => setFilterDate(event.target.value)}
            className="h-10 w-full rounded-lg border border-[var(--ui-border-strong)] bg-white px-3 text-sm text-[var(--ui-text)] mt-1 outline-none transition focus:border-[#094732] focus:ring-1 focus:ring-[#094732]/35 disabled:bg-[var(--ui-surface-muted)] disabled:text-[var(--ui-text-muted)]"
          />
        </div>
        <div>
          <label className="text-[11px] font-semibold text-[var(--ui-text-muted)]">Hora</label>
          <input
            type="time"
            value={filterTime}
            onChange={(event) => setFilterTime(event.target.value)}
            className="h-10 w-full rounded-lg border border-[var(--ui-border-strong)] bg-white px-3 text-sm text-[var(--ui-text)] mt-1 outline-none transition focus:border-[#094732] focus:ring-1 focus:ring-[#094732]/35 disabled:bg-[var(--ui-surface-muted)] disabled:text-[var(--ui-text-muted)]"
          />
        </div>
        <div>
          <label className="text-[11px] font-semibold text-[var(--ui-text-muted)]">Atendiendo</label>
          <select
            value={filterProfessionalId}
            onChange={(event) => setFilterProfessionalId(event.target.value)}
            className="h-10 w-full rounded-lg border border-[var(--ui-border-strong)] bg-white px-3 text-sm text-[var(--ui-text)] mt-1 outline-none transition focus:border-[#094732] focus:ring-1 focus:ring-[#094732]/35 disabled:bg-[var(--ui-surface-muted)] disabled:text-[var(--ui-text-muted)]"
          >
            <option value="">Todas</option>
            {professionals.map((professional) => (
              <option key={professional.id} value={String(professional.id)}>
                {professional.username}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="mt-4 flex items-center justify-between border-t border-[var(--ui-border)] pt-3">
        <p className="text-xs text-[var(--ui-text-muted)]">
          {/* Aquí puedes mostrar el conteo de tickets filtrados si lo pasas por props */}
        </p>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={loadTickets}
            disabled={isLoading}
          >
            {isLoading ? "Actualizando..." : "Actualizar"}
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => {
              setFilterService("");
              setFilterClient("");
              setFilterDate(todayDate());
              setFilterTime("");
              setFilterProfessionalId("");
            }}
          >
            Limpiar filtros
          </Button>
        </div>
      </div>
    </SectionCard>
  );
}
