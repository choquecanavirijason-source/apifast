import type { TicketItem } from "../../../core/services/agenda/agenda.service";

export type AppointmentStatus = "pending" | "confirmed" | "in_service" | "completed" | "cancelled";
export type OperariaCurrentStatus = AppointmentStatus | "free";

export interface OperariaStatus {
  professionalId: number;
  professionalName: string;
  currentStatus: OperariaCurrentStatus;
  /** Ticket activo que impulsa el estado actual (in_service o próximo pendiente). */
  activeTicket: TicketItem | null;
  ticketsToday: TicketItem[];
}
