import type { ProfessionalForSelect, TicketItem } from "../../../../core/services/agenda/agenda.service";
import { GRID_FIRST_HOUR, GRID_LAST_HOUR, STATION_COUNT } from "../dailyAgenda.constants";
import AgendaTicketCard from "./AgendaTicketCard";

type StationsAgendaViewProps = {
  stationLabels: string[];
  stationGridMap: Map<string, TicketItem[]>;
  professionals: ProfessionalForSelect[];
  onCellClick: (hour: number, professionalId: number | null) => void;
};

export default function StationsAgendaView({
  stationLabels,
  stationGridMap,
  professionals,
  onCellClick,
}: StationsAgendaViewProps) {
  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition hover:border-slate-300">
      <div className="border-b border-slate-100 px-4 py-3">
        <h2 className="text-sm font-semibold text-slate-800">Vista puestos (1–8)</h2>
        <p className="mt-0.5 text-xs text-slate-500">
          Filas por hora ({GRID_FIRST_HOUR}:00–{GRID_LAST_HOUR}:00). Columnas = operarias.
        </p>
      </div>
      <div className="max-h-[min(72vh,900px)] overflow-auto p-3">
        <div
          className="grid w-full min-w-[min(100%,920px)]"
          style={{ gridTemplateColumns: `72px repeat(${STATION_COUNT}, minmax(88px, 1fr))` }}
        >
          <div className="sticky left-0 z-10 rounded-tl-lg border border-slate-200 bg-slate-100 px-1 py-2 text-[10px] font-semibold uppercase text-slate-500">
            Hora
          </div>
          {stationLabels.map((label) => (
            <div
              key={label}
              className="border border-slate-200 bg-emerald-50 px-1 py-2 text-center text-[10px] font-semibold leading-tight text-[#094732]"
            >
              {label}
            </div>
          ))}

          {Array.from({ length: GRID_LAST_HOUR - GRID_FIRST_HOUR + 1 }, (_, i) => GRID_FIRST_HOUR + i).map((hour) => (
            <div key={`row-${hour}`} className="contents">
              <div className="sticky left-0 z-10 border border-slate-200 bg-slate-50 px-2 py-3 text-xs font-semibold tabular-nums text-slate-700">
                {String(hour).padStart(2, "0")}:00
              </div>
              {Array.from({ length: STATION_COUNT }, (_, col) => {
                const key = `${hour}__${col}`;
                const cellTickets = stationGridMap.get(key) ?? [];
                const pro = professionals[col];
                const open = () => onCellClick(hour, pro?.id ?? null);

                return (
                  <div
                    key={key}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        open();
                      }
                    }}
                    onClick={open}
                    className="relative min-h-[88px] cursor-pointer border border-slate-100 bg-white p-1.5 transition hover:border-slate-200 hover:bg-slate-50 focus-visible:outline focus-visible:ring-2 focus-visible:ring-[#094732]/30 sm:min-h-[96px]"
                  >
                    <div className="flex min-h-[80px] flex-wrap items-start gap-1 content-start">
                      {cellTickets.map((t) => (
                        <AgendaTicketCard key={t.id} ticket={t} compact />
                      ))}
                    </div>
                    <span
                      className="pointer-events-none absolute bottom-0.5 right-0.5 rounded bg-white/90 px-1 text-[9px] text-slate-300"
                      aria-hidden
                    >
                      +
                    </span>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
