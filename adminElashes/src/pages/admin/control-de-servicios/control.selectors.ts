import type { TicketItem, ProfessionalForSelect } from "../../../core/services/agenda/agenda.service";
import type { OperariaCurrentStatus, OperariaStatus } from "./control.types";

/**
 * Prioridad de estados: cuanto mayor, más urgente.
 * Determina cuál status "gana" cuando una operaria tiene varios tickets activos.
 */
const STATUS_PRIORITY: Record<string, number> = {
  in_service: 4,
  pending:    3,
  confirmed:  3,
  completed:  2,
  cancelled:  1,
};

function resolveCurrentStatus(tickets: TicketItem[]): OperariaCurrentStatus {
  if (tickets.length === 0) return "free";

  let topPriority = 0;
  let topStatus: OperariaCurrentStatus = "free";

  for (const ticket of tickets) {
    const priority = STATUS_PRIORITY[ticket.status] ?? 0;
    if (priority > topPriority) {
      topPriority = priority;
      topStatus = ticket.status as OperariaCurrentStatus;
    }
  }

  return topStatus;
}

function resolveActiveTicket(tickets: TicketItem[]): TicketItem | null {
  return (
    tickets.find((t) => t.status === "in_service") ??
    tickets.find((t) => t.status === "pending" || t.status === "confirmed") ??
    null
  );
}

/**
 * Función pura — sin efectos, sin React.
 * Dado el listado de tickets del día y los profesionales disponibles,
 * devuelve el estado actual de cada operaria derivado de sus tickets.
 */
export function deriveOperariaStatuses(
  tickets: TicketItem[],
  professionals: ProfessionalForSelect[]
): OperariaStatus[] {
  // Agrupar tickets por professional_id en un solo recorrido O(n)
  const ticketsByPro = new Map<number, TicketItem[]>();
  for (const ticket of tickets) {
    if (ticket.professional_id == null) continue;
    const group = ticketsByPro.get(ticket.professional_id);
    if (group) {
      group.push(ticket);
    } else {
      ticketsByPro.set(ticket.professional_id, [ticket]);
    }
  }

  return professionals.map((prof) => {
    const ticketsToday = ticketsByPro.get(prof.id) ?? [];
    return {
      professionalId:   prof.id,
      professionalName: prof.username,
      currentStatus:    resolveCurrentStatus(ticketsToday),
      activeTicket:     resolveActiveTicket(ticketsToday),
      ticketsToday,
    };
  });
}
