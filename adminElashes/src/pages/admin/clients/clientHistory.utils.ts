export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: "Efectivo",
  card: "Tarjeta",
  transfer: "Transferencia",
  qr: "QR",
};

export const TICKET_STATUS_LABELS: Record<string, string> = {
  pending: "Pendiente",
  confirmed: "Confirmado",
  waiting: "En espera",
  in_service: "En atención",
  completed: "Finalizado",
  cancelled: "Cancelado",
};

export const SALE_STATUS_LABELS: Record<string, string> = {
  paid: "Pagada",
  cancelled: "Cancelada",
};

export const formatDateTime = (iso: string) => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("es-BO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export const formatDateOnly = (iso: string) => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
};

export const formatMoney = (value: number) => `Bs ${Number(value || 0).toFixed(2)}`;

export const matchesDateRange = (iso: string, from: string, to: string) => {
  const day = formatDateOnly(iso);
  if (!day) return false;
  if (from && day < from) return false;
  if (to && day > to) return false;
  return true;
};
