/**
 * Tipos unificados para Caja POS (ventas) y Seguimiento técnico (tracking).
 * Reexporta los contratos de los servicios; la lógica sigue en pos-sale y tracking.
 */
export type {
  PosSaleItemPayload,
  PosSaleCreatePayload,
  PosSaleAppointment,
  PosSalePayment,
  PosSaleItem,
} from "../services/pos-sale/pos-sale.service";

export type { TrackingCreatePayload, TrackingResponse } from "../services/tracking/tracking.service";
