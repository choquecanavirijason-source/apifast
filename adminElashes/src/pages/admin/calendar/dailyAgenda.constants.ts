export const GRID_FIRST_HOUR = 9;
export const GRID_LAST_HOUR = 20;
export const STATION_COUNT = 8;

export const AGENDA_VIEW_STORAGE_KEY = "daily-agenda-view-mode";

export type AgendaViewMode = "planner" | "stations";

export type PlannerSlot = { minuteOfDay: number; stepMinutes: number; label: string };

function buildPlannerSlots(): PlannerSlot[] {
  const slots: PlannerSlot[] = [];
  for (let h = 7; h <= 18; h += 1) {
    for (const m of [0, 15, 30, 45]) {
      slots.push({
        minuteOfDay: h * 60 + m,
        stepMinutes: 15,
        label: new Date(2000, 0, 1, h, m).toLocaleTimeString("es-BO", {
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
        }),
      });
    }
  }
  for (let h = 19; h <= 22; h += 1) {
    for (const m of [0, 30]) {
      if (h === 22 && m > 30) break;
      slots.push({
        minuteOfDay: h * 60 + m,
        stepMinutes: 30,
        label: new Date(2000, 0, 1, h, m).toLocaleTimeString("es-BO", {
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
        }),
      });
    }
  }
  return slots;
}

export const PLANNER_SLOTS = buildPlannerSlots();

/** Clases compartidas (estilo LashDesigns / clientes). */
export const agendaFieldClass =
  "w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-[#094732] focus:ring-1 focus:ring-[#094732]/25 disabled:bg-slate-50 disabled:text-slate-400";

export const agendaLabelClass = "text-sm font-medium text-slate-700";
