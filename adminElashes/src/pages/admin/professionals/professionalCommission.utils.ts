import type { TicketItem } from "@/core/services/agenda/agenda.service";

/** Porcentaje de comisión por trabajo completado (0–1). Configurable vía VITE_PROFESSIONAL_COMMISSION_RATE */
export const PROFESSIONAL_COMMISSION_RATE = (() => {
  const raw = import.meta.env?.VITE_PROFESSIONAL_COMMISSION_RATE;
  const parsed = raw != null ? Number(raw) : 0.4;
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 1 ? parsed : 0.4;
})();

export function getTicketPriceTotal(ticket: TicketItem): number {
  if (ticket.service_prices?.length) {
    return ticket.service_prices.reduce((sum, p) => sum + (Number.isFinite(p) ? p : 0), 0);
  }
  if (typeof ticket.service_price === "number" && Number.isFinite(ticket.service_price)) {
    return ticket.service_price;
  }
  return 0;
}

/** Comisión de la operaria: solo aplica cuando el ticket está completado. */
export function getTicketCommission(ticket: TicketItem): number {
  if (ticket.status !== "completed") return 0;
  return getTicketPriceTotal(ticket) * PROFESSIONAL_COMMISSION_RATE;
}

export function formatCommissionRatePercent(): string {
  return `${Math.round(PROFESSIONAL_COMMISSION_RATE * 100)}%`;
}
