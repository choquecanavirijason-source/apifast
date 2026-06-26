import { useMemo } from "react";
import type { TicketItem, ProfessionalForSelect } from "../../../../core/services/agenda/agenda.service";
import type { OperariaStatus } from "../control.types";
import { deriveOperariaStatuses } from "../control.selectors";

/**
 * Devuelve el estado actual de cada operaria derivado de los tickets del día.
 * Es un selector memorizado: no dispara fetches, solo recomputa cuando cambian tickets o profesionales.
 */
export function useOperariaStatuses(
  tickets: TicketItem[],
  professionals: ProfessionalForSelect[]
): OperariaStatus[] {
  return useMemo(
    () => deriveOperariaStatuses(tickets, professionals),
    [tickets, professionals]
  );
}
