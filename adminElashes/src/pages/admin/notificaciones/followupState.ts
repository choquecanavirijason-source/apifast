import type { RetoqueRow } from "@/core/services/client/client.service";

type FollowupRow = Pick<RetoqueRow, "estado_seguimiento" | "seguimiento_id" | "appointment_id" | "tipo" | "vencido" | "cita_estado">;

const STATES = {
  pendiente_atencion: { label: "Pendiente de atención", className: "bg-amber-50 text-amber-700" },
  habilitado: { label: "Seguimiento habilitado", className: "bg-emerald-50 text-emerald-700" },
  recordatorio_enviado: { label: "Recordatorio enviado", className: "bg-sky-50 text-sky-700" },
  vencido: { label: "Vencido", className: "bg-rose-50 text-rose-700" },
  cancelado: { label: "Cancelado", className: "bg-slate-100 text-slate-500" },
} as const;

/** Estado mostrado; respaldo para respuestas antiguas sin estado_seguimiento. */
export function followupState(row: FollowupRow) {
  const key = row.estado_seguimiento ?? (row.seguimiento_id == null ? "pendiente_atencion" : row.vencido ? "vencido" : "habilitado");
  const state = STATES[key];
  const detail = key === "pendiente_atencion" && row.cita_estado === "in_service" ? " · En servicio" : "";
  return { key, label: state.label + detail, className: state.className };
}

/** Id estable por fila: el seguimiento, o la cita si aún está pendiente. */
export const followupRowId = (row: FollowupRow) =>
  `${row.seguimiento_id != null ? `t${row.seguimiento_id}` : `a${row.appointment_id}`}-${row.tipo}`;
