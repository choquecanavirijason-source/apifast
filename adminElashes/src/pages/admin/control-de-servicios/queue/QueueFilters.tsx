import { Dispatch, SetStateAction } from "react";
import { Button, SectionCard } from "../../../components/common/ui";
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
    <SectionCard className="border-[#d2d0ce] bg-[#faf9f8]" bodyClassName="!p-4 sm:!p-5">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-6 xl:grid-cols-7">
        <div className="lg:col-span-2">
          <label className="text-[11px] font-semibold uppercase tracking-wide text-[#605e5c]">Servicio</label>
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
                className="h-10 w-full rounded-sm border border-[#8a8886] bg-white px-10 pr-10 text-sm text-[#323130] placeholder:text-[#8a8886] outline-none transition focus:border-[#0078d4] focus:ring-1 focus:ring-[#0078d4]/35 disabled:bg-[#f3f2f1] disabled:text-[#a19f9d]"
              />
              <button
                type="button"
                onClick={() => setIsServiceFilterMenuOpen((prev) => !prev)}
                className="absolute right-1 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-sm text-[#605e5c] transition hover:bg-[#f3f2f1] hover:text-[#323130]"
                aria-label="Mostrar servicios"
              >
                <ChevronDown className="h-4 w-4" />
              </button>
              {isServiceFilterMenuOpen && (
                <div className="absolute z-40 mt-1 w-full overflow-hidden rounded-sm border border-[#d2d0ce] bg-white shadow-lg">
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
                          className="flex w-full items-center justify-between px-3 py-2 text-left transition hover:bg-[#f3f2f1]"
                        >
                          <span className="truncate text-sm text-[#323130]">{option}</span>
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
          <label className="text-[11px] font-semibold uppercase tracking-wide text-[#605e5c]">Cliente</label>
          <div className="relative mt-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={filterClient}
              onChange={(event) => setFilterClient(event.target.value)}
              placeholder="Buscar por nombre de clienta..."
              className="h-10 w-full rounded-sm border border-[#8a8886] bg-white px-9 text-sm text-[#323130] placeholder:text-[#8a8886] outline-none transition focus:border-[#0078d4] focus:ring-1 focus:ring-[#0078d4]/35 disabled:bg-[#f3f2f1] disabled:text-[#a19f9d]"
            />
          </div>
        </div>
        <div>
          <label className="text-[11px] font-semibold uppercase tracking-wide text-[#605e5c]">Fecha</label>
          <input
            type="date"
            value={filterDate}
            onChange={(event) => setFilterDate(event.target.value)}
            className="h-10 w-full rounded-sm border border-[#8a8886] bg-white px-3 text-sm text-[#323130] mt-1 outline-none transition focus:border-[#0078d4] focus:ring-1 focus:ring-[#0078d4]/35 disabled:bg-[#f3f2f1] disabled:text-[#a19f9d]"
          />
        </div>
        <div>
          <label className="text-[11px] font-semibold uppercase tracking-wide text-[#605e5c]">Hora</label>
          <input
            type="time"
            value={filterTime}
            onChange={(event) => setFilterTime(event.target.value)}
            className="h-10 w-full rounded-sm border border-[#8a8886] bg-white px-3 text-sm text-[#323130] mt-1 outline-none transition focus:border-[#0078d4] focus:ring-1 focus:ring-[#0078d4]/35 disabled:bg-[#f3f2f1] disabled:text-[#a19f9d]"
          />
        </div>
        <div>
          <label className="text-[11px] font-semibold uppercase tracking-wide text-[#605e5c]">Atendiendo</label>
          <select
            value={filterProfessionalId}
            onChange={(event) => setFilterProfessionalId(event.target.value)}
            className="h-10 w-full rounded-sm border border-[#8a8886] bg-white px-3 text-sm text-[#323130] mt-1 outline-none transition focus:border-[#0078d4] focus:ring-1 focus:ring-[#0078d4]/35 disabled:bg-[#f3f2f1] disabled:text-[#a19f9d]"
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
      <div className="mt-4 flex items-center justify-between border-t border-[#edebe9] pt-3">
        <p className="text-xs text-[#605e5c]">
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
