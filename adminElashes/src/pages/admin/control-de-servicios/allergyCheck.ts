import type { TicketItem } from "../../../core/services/agenda/agenda.service";

/**
 * ¿Hay que confirmar las alergias antes de iniciar la atención? Si a esa atención aún
 * no se le han preguntado. Con una clienta registrada la respuesta vale para siempre
 * (queda en su ficha); con la clienta de mostrador, compartida por muchas personas,
 * vale solo para este ticket, así que cada atención de mostrador se pregunta.
 */
export const needsAllergyConfirmation = (ticket: TicketItem): boolean => !ticket.allergies_confirmed;

/** El mismo ticket con las alergias ya confirmadas (para continuar el inicio y para el ticket impreso). */
export const withConfirmedAllergies = (ticket: TicketItem, allergies: string | null): TicketItem => ({
  ...ticket,
  allergies,
  allergies_confirmed: true,
});

/**
 * Tickets que quedan confirmados al responder: los de esa clienta si está registrada
 * (la respuesta está en su ficha), o solo ese ticket si es la de mostrador.
 */
export const sharesAllergyAnswer = (answered: TicketItem, other: TicketItem): boolean =>
  answered.client?.is_generic ? other.id === answered.id : other.client_id === answered.client_id;
