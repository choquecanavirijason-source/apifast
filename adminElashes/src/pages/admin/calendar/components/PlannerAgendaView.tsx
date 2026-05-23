import type { TicketItem } from "../../../../core/services/agenda/agenda.service";
import { PLANNER_SLOTS } from "../dailyAgenda.constants";
import AgendaTicketCard from "./AgendaTicketCard";

type PlannerAgendaViewProps = {
  headerTitle: string;
  weekdayUpper: string;
  plannerMap: Map<number, TicketItem[]>;
  onSlotClick: (hour: number, minute: number) => void;
};

export default function PlannerAgendaView({
  headerTitle,
  weekdayUpper,
  plannerMap,
  onSlotClick,
}: PlannerAgendaViewProps) {
  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition hover:border-slate-300">
      <div className="border-b border-slate-100 bg-emerald-50 px-4 py-3 text-center">
        <h2 className="text-sm font-bold uppercase tracking-wide text-[#094732]">{headerTitle}</h2>
        <p className="mt-0.5 text-[11px] text-slate-500">Fecha de inicio ({weekdayUpper})</p>
      </div>
      <div className="max-h-[min(72vh,900px)] overflow-auto">
        <div className="grid min-w-[min(100%,720px)]" style={{ gridTemplateColumns: "92px minmax(240px, 1fr)" }}>
          {PLANNER_SLOTS.map((slot, idx) => {
            const rowTickets = plannerMap.get(slot.minuteOfDay) ?? [];
            const zebra = idx % 2 === 0;
            const h = Math.floor(slot.minuteOfDay / 60);
            const m = slot.minuteOfDay % 60;
            const open = () => onSlotClick(h, m);

            return (
              <div key={`${slot.minuteOfDay}-${slot.stepMinutes}`} className="contents">
                <div
                  className={`border-b border-r border-slate-100 px-2 py-1.5 text-xs font-medium tabular-nums text-slate-600 ${
                    zebra ? "bg-slate-50" : "bg-white"
                  }`}
                >
                  {slot.label}
                </div>
                <div
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      open();
                    }
                  }}
                  onClick={open}
                  className={`cursor-pointer border-b border-slate-100 px-2 py-1.5 transition hover:bg-emerald-50/50 focus-visible:outline focus-visible:ring-2 focus-visible:ring-[#094732]/30 ${
                    zebra ? "bg-slate-50/50" : "bg-white"
                  }`}
                >
                  <div className="flex min-h-[88px] flex-wrap items-start gap-1.5 content-start py-0.5">
                    {rowTickets.map((t) => (
                      <AgendaTicketCard key={t.id} ticket={t} />
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
