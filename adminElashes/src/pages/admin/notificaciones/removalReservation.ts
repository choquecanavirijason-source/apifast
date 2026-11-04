import type { RetoqueRow } from "@/core/services/client/client.service";

/** Only an explicitly verified backend reservation can render as booked. */
export function removalReservation(row: Pick<RetoqueRow,
  "reserva_retiro_estado" | "reserva_retiro_fecha" | "reserva_retiro_detalle" | "proxima_cita">) {
  if (row.reserva_retiro_estado === "reservado" && row.reserva_retiro_fecha) {
    return { label: "Reservado", date: row.reserva_retiro_fecha, title: "Reserva de retiro verificada" };
  }
  if (row.reserva_retiro_estado === "por_verificar" || row.proxima_cita || row.reserva_retiro_estado === "reservado") {
    return { label: "Por verificar", date: null,
      title: row.reserva_retiro_detalle ?? "Falta identificar el servicio de la cita como retiro." };
  }
  return { label: "Sin reserva", date: null, title: "No hay una cita futura de retiro identificada." };
}
