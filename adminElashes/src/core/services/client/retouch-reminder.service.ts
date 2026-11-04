import api from "../api";
import type { RetoqueRow } from "./client.service";

export interface RetouchReminderResult {
  broadcast_id: number;
  status: string;
  send_push: boolean;
  send_email: boolean;
  push_status: string | null;
  email_status: string | null;
}

export interface RetouchReminderPreview {
  client_id: number;
  clienta: string;
  servicio: string;
  tipo: string;
  fecha_objetivo: string;
  dias_restantes: number;
  appointment_state: "sin_cita" | "no_verificada";
  appointment_note: string;
  message: string;
  push_available: boolean;
  email_available: boolean;
  consent: boolean;
  delivery_enabled: boolean;
  preview_version: string;
  result: RetouchReminderResult | null;
}

const url = (row: RetoqueRow) => `/clients/retoques/${row.seguimiento_id}/recordatorio/${row.tipo}`;

export const RetouchReminderService = {
  async preview(row: RetoqueRow): Promise<RetouchReminderPreview> {
    return (await api.get<RetouchReminderPreview>(url(row))).data;
  },
  async send(row: RetoqueRow, data: { preview_version: string; send_push: boolean; send_email: boolean }) {
    return (await api.post<RetouchReminderResult>(url(row), data)).data;
  },
};
