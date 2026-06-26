import { useCallback, useEffect, useState } from "react";
import { AgendaService, type TicketItem } from "../../../core/services/agenda/agenda.service";
import type { WsEvent } from "@/core/hooks/useWebSocket";
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

  // Actualiza el estado local al instante sin llamada HTTP.
  // Para ticket_created no hay datos suficientes → se hace fetch completo.
  const applyWsEvent = useCallback((event: WsEvent) => {
    if (event.event === "ticket_created") {
      void loadTickets();
      return;
    }
    setTickets((prev) => {
      if (event.event === "ticket_deleted") {
        return prev.filter((t) => t.id !== event.ticket_id);
      }
      // ticket_updated / ticket_called
      return prev.map((t) =>
        t.id === event.ticket_id
          ? { ...t, status: event.status, professional_id: event.professional_id }
          : t
      );
    });
  }, [loadTickets]);

  useEffect(() => {
    void loadTickets();
  }, [loadTickets]);

  return { tickets, isLoading, loadTickets, applyWsEvent };
}
