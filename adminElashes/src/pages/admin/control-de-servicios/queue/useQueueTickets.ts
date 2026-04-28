import { useCallback, useEffect, useState } from "react";
import { AgendaService, type TicketItem } from "../../../core/services/agenda/agenda.service";
import { toast } from "react-toastify";
import { todayDate } from "../control.constants";

export function useQueueTickets(activeBranchId: number | null, filterDate: string) {
  const [tickets, setTickets] = useState<TicketItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const loadTickets = useCallback(async () => {
    setIsLoading(true);
    try {
      const today = todayDate();
      const data = await AgendaService.listTickets({
        limit: 500,
        branch_id: activeBranchId ?? undefined,
        start_date: filterDate || today,
        end_date: filterDate || today,
      });
      setTickets(data);
    } catch (error) {
      console.error("Error cargando tickets:", error);
      toast.error("No se pudo cargar el tablero de atencion.");
      setTickets([]);
    } finally {
      setIsLoading(false);
    }
  }, [activeBranchId, filterDate]);

  useEffect(() => {
    void loadTickets();
  }, [loadTickets]);

  return { tickets, isLoading, loadTickets };
}
