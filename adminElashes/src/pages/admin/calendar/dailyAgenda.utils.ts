import type { ProfessionalForSelect, TicketItem } from "../../../core/services/agenda/agenda.service";
import { GRID_FIRST_HOUR, GRID_LAST_HOUR, STATION_COUNT } from "./dailyAgenda.constants";

export const toIsoDate = (d: Date) => d.toISOString().slice(0, 10);

export function buildWeekStrip(isoDate: string): string[] {
  const center = new Date(`${isoDate}T12:00:00`);
  const dow = center.getDay();
  const toMonday = dow === 0 ? -6 : 1 - dow;
  const monday = new Date(center);
  monday.setDate(center.getDate() + toMonday);
  return Array.from({ length: 7 }, (_, i) => {
    const day = new Date(monday);
    day.setDate(monday.getDate() + i);
    return toIsoDate(day);
  });
}

export const parseTicketDate = (value: string) => {
  if (!value) return new Date("");
  const hasTz = /[zZ]|[+-]\d{2}:\d{2}$/.test(value);
  if (hasTz) return new Date(value);
  const [datePart, timePartRaw = "00:00:00"] = value.split("T");
  const [year, month, day] = datePart.split("-").map(Number);
  const [hour, minute, second] = timePartRaw.split(":").map(Number);
  return new Date(year, (month || 1) - 1, day || 1, hour || 0, minute || 0, second || 0);
};

export const formatLocalDateTime = (date: Date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const h = String(date.getHours()).padStart(2, "0");
  const min = String(date.getMinutes()).padStart(2, "0");
  const s = String(date.getSeconds()).padStart(2, "0");
  return `${y}-${m}-${d}T${h}:${min}:${s}`;
};

function slotKeyForTime(minuteOfDay: number, step: number) {
  return Math.floor(minuteOfDay / step) * step;
}

export function groupTicketsByPlannerSlot(tickets: TicketItem[], dateKey: string): Map<number, TicketItem[]> {
  const map = new Map<number, TicketItem[]>();
  for (const t of tickets) {
    const start = parseTicketDate(t.start_time);
    if (Number.isNaN(start.getTime()) || toIsoDate(start) !== dateKey) continue;
    const mod = start.getHours() * 60 + start.getMinutes();
    let slotStart: number;
    if (mod >= 7 * 60 && mod < 19 * 60) {
      slotStart = slotKeyForTime(mod, 15);
    } else {
      slotStart = Math.max(19 * 60, slotKeyForTime(mod, 30));
    }
    const list = map.get(slotStart) ?? [];
    list.push(t);
    map.set(slotStart, list);
  }
  for (const [k, list] of map) {
    list.sort((a, b) => a.start_time.localeCompare(b.start_time));
    map.set(k, list);
  }
  return map;
}

export function clientPhoneOrRef(t: TicketItem): string {
  const p = t.client_phone?.trim();
  if (p) return p;
  return `#${t.client_id}`;
}

export function groupTicketsByHourAndStation(
  tickets: TicketItem[],
  dateKey: string,
  professionals: ProfessionalForSelect[]
): Map<string, TicketItem[]> {
  const map = new Map<string, TicketItem[]>();
  const stationPros = professionals.slice(0, STATION_COUNT);
  const colByProfessionalId = new Map<number, number>();
  stationPros.forEach((p, index) => colByProfessionalId.set(p.id, index));

  for (const t of tickets) {
    const start = parseTicketDate(t.start_time);
    if (Number.isNaN(start.getTime()) || toIsoDate(start) !== dateKey) continue;
    const hour = start.getHours();
    if (hour < GRID_FIRST_HOUR || hour > GRID_LAST_HOUR) continue;
    const pid = t.professional_id;
    let col = 0;
    if (pid != null) {
      const idx = colByProfessionalId.get(pid);
      col = idx !== undefined ? idx : 0;
    }
    const key = `${hour}__${col}`;
    const list = map.get(key) ?? [];
    list.push(t);
    map.set(key, list);
  }
  for (const [key, list] of map) {
    list.sort((a, b) => a.start_time.localeCompare(b.start_time));
    map.set(key, list);
  }
  return map;
}

export function ticketCardClass(status?: string | null): string {
  const s = (status ?? "").toLowerCase();
  if (s === "cancelled" || s === "cancelado") {
    return "border-rose-300 bg-rose-50 text-rose-900";
  }
  if (s === "confirmed" || s === "confirmado") {
    return "border-emerald-400 bg-emerald-50 text-emerald-900";
  }
  if (s === "waiting" || s === "en_espera_validacion") {
    return "border-amber-300 bg-amber-50 text-amber-950";
  }
  if (s === "completed" || s === "finalizado" || s === "atendido") {
    return "border-emerald-300 bg-emerald-50 text-emerald-900";
  }
  return "border-[#b4d7f0] bg-[#f0f6fc] text-[#004578]";
}

export function newLocalId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

export function getAppointmentDurationMs(ticket: TicketItem): number {
  const baseStart = parseTicketDate(ticket.start_time);
  const baseEnd = parseTicketDate(ticket.end_time);
  if (Number.isNaN(baseStart.getTime()) || Number.isNaN(baseEnd.getTime())) {
    return 60 * 60 * 1000;
  }
  return Math.max(15 * 60 * 1000, baseEnd.getTime() - baseStart.getTime());
}

export function buildRescheduleTimes(
  ticket: TicketItem,
  selectedDate: string,
  hour: number,
  minute: number
): { start_time: string; end_time: string } {
  const [year, month, day] = selectedDate.split("-").map(Number);
  const nextStart = new Date(year, (month || 1) - 1, day || 1, hour, minute, 0);
  const nextEnd = new Date(nextStart.getTime() + getAppointmentDurationMs(ticket));
  return {
    start_time: formatLocalDateTime(nextStart),
    end_time: formatLocalDateTime(nextEnd),
  };
}
