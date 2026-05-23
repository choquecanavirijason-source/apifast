export const agendaDragId = (ticketId: number) => `ticket:${ticketId}`;

export const plannerDropId = (minuteOfDay: number) => `planner:${minuteOfDay}`;

export const stationDropId = (hour: number, col: number) => `station:${hour}:${col}`;

export function parseDragTicketId(id: string | number): number | null {
  const raw = String(id);
  if (!raw.startsWith("ticket:")) return null;
  const parsed = Number(raw.slice("ticket:".length));
  return Number.isFinite(parsed) ? parsed : null;
}

export type AgendaDropTarget =
  | { type: "planner"; minuteOfDay: number }
  | { type: "station"; hour: number; col: number };

export function parseDropTarget(id: string | number): AgendaDropTarget | null {
  const raw = String(id);
  if (raw.startsWith("planner:")) {
    const minuteOfDay = Number(raw.slice("planner:".length));
    return Number.isFinite(minuteOfDay) ? { type: "planner", minuteOfDay } : null;
  }
  if (raw.startsWith("station:")) {
    const [, hourRaw, colRaw] = raw.split(":");
    const hour = Number(hourRaw);
    const col = Number(colRaw);
    if (Number.isFinite(hour) && Number.isFinite(col)) {
      return { type: "station", hour, col };
    }
  }
  return null;
}
