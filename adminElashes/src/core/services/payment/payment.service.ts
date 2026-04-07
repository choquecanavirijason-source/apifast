import api from "../api";

export interface PaymentCreatePayload {
  client_id: number;
  appointment_id?: number | null;
  branch_id?: number | null;
  amount: number;
  method: string; // cash, card, transfer, qr
  status?: string;
  reference?: string | null;
  notes?: string | null;
}

export interface PaymentItem {
  id: number;
  client_id: number;
  appointment_id?: number | null;
  amount: number;
  method: string;
  status: string;
  paid_at: string;
  reference?: string | null;
  notes?: string | null;
  registered_by?: { id: number; username: string; email?: string } | null;
}

const METHOD_MAP: Record<string, string> = {
  Efectivo: "cash",
  Tarjeta: "card",
  Transferencia: "transfer",
  QR: "qr",
  cash: "cash",
  card: "card",
  transfer: "transfer",
  qr: "qr",
};

export const PaymentService = {
  async list(params?: {
    skip?: number;
    limit?: number;
    client_id?: number;
    appointment_id?: number;
    branch_id?: number;
    method?: string;
    status_filter?: string;
  }) {
    const response = await api.get<PaymentItem[]>("/payments/", {
      params: {
        skip: params?.skip ?? 0,
        limit: params?.limit ?? 100,
        client_id: params?.client_id,
        appointment_id: params?.appointment_id,
        branch_id: params?.branch_id,
        method: params?.method,
        status_filter: params?.status_filter,
      },
    });
    return response.data;
  },

  async create(payload: PaymentCreatePayload) {
    const method = METHOD_MAP[payload.method] ?? payload.method.toLowerCase();
    const response = await api.post("/payments/", {
      ...payload,
      method,
      status: payload.status ?? "paid",
    });
    return response.data;
  },

  async listByAppointment(appointmentId: number) {
    const response = await api.get<PaymentItem[]>("/payments/", {
      params: { appointment_id: appointmentId, limit: 50 },
    });
    return response.data;
  },

  async listByClient(clientId: number) {
    const response = await api.get<PaymentItem[]>("/payments/", {
      params: { client_id: clientId, limit: 100 },
    });
    return response.data;
  },
};
