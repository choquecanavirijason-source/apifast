import type { TicketItem } from "../../../core/services/agenda/agenda.service";

export const SLOT_INTERVAL_MINUTES = 30;
export const BUSINESS_START_HOUR = 8;
export const BUSINESS_END_HOUR = 20;

export const getLocalDateInputValue = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const startOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1);

export const startOfCalendarGrid = (date: Date) => {
  const firstDay = startOfMonth(date);
  const firstWeekDay = (firstDay.getDay() + 6) % 7;
  return new Date(firstDay.getFullYear(), firstDay.getMonth(), firstDay.getDate() - firstWeekDay);
};

export const formatDayKey = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const formatTime = (iso: string) => {
  try {
    return new Date(iso).toLocaleTimeString("es-BO", {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
};

export type SlotRow = {
  key: string;
  label: string;
  status: "available" | "occupied" | "cancelled";
  tickets: TicketItem[];
};

export function computeSlotsForDay(dateKey: string, dayTickets: TicketItem[]): SlotRow[] {
  const slots: SlotRow[] = [];

  for (let hour = BUSINESS_START_HOUR; hour < BUSINESS_END_HOUR; hour += 1) {
    for (let minute = 0; minute < 60; minute += SLOT_INTERVAL_MINUTES) {
      const slotStart = new Date(
        `${dateKey}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00`
      );
      const slotEnd = new Date(slotStart.getTime() + SLOT_INTERVAL_MINUTES * 60 * 1000);

      const overlapping = dayTickets.filter((ticket) => {
        const ticketStart = new Date(ticket.start_time);
        const ticketEnd = new Date(ticket.end_time);
        return ticketStart < slotEnd && ticketEnd > slotStart;
      });

      const activeTickets = overlapping.filter((ticket) => ticket.status !== "cancelled");
      const status = activeTickets.length > 0 ? "occupied" : overlapping.length > 0 ? "cancelled" : "available";

      slots.push({
        key: `${dateKey}-${hour}-${minute}`,
        label: `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`,
        status,
        tickets: overlapping,
      });
    }
  }

  return slots;
}

export function formatSelectedDateLong(dateKey: string) {
  try {
    return new Date(`${dateKey}T12:00:00`).toLocaleDateString("es-BO", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return dateKey;
  }
}
