export const STATUS_LABELS: Record<string, string> = {
  pending: "En espera",
  in_service: "En servicio",
  completed: "Finalizadas",
  cancelled: "Canceladas",
  confirmed: "Confirmadas",
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

export const todayDate = () => new Date().toISOString().slice(0, 10);

// Mapeo columna droppable -> status API
export const COLUMN_TO_STATUS: Record<string, string> = {
  waiting: "pending",
  in_service: "in_service",
  completed: "completed",
};

export const getColumnForStatus = (status: string): string => {
  if (status === "in_service") return "in_service";
  if (status === "completed") return "completed";
  return "waiting";
};
