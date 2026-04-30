import api from "../api";
import { getApiErrorMessage } from "../../utils/apiError";

export interface PosSaleItemPayload {
  service_id: number;
  professional_id?: number | null;
  is_ia?: boolean;
  start_time: string;
  end_time: string;
  branch_id?: number | null;
}

export interface PosSaleCreatePayload {
  client_id: number;
  branch_id?: number | null;
  payment_method: string;
  discount_type: "amount" | "percent";
  discount_value: number;
  notes?: string;
  items: PosSaleItemPayload[];
}

export interface PosSaleUpdatePayload {
  client_id?: number;
  discount_type?: "amount" | "percent";
  discount_value?: number;
  payment_method?: string;
  notes?: string;
  status?: "paid" | "cancelled";
}

export interface PosSaleAppointment {
  id: number;
  ticket_code: string | null;
  is_ia?: boolean;
  start_time: string;
  end_time: string;
  status: string;
  branch?: { id: number; name: string } | null;
  service?: { id: number; name: string; price?: number } | null;
  services?: Array<{ id: number; name: string; price?: number }> | null;
  professional?: { id: number; username: string } | null;
  created_by?: { id: number; username: string } | null;
}

export interface PosSalePayment {
  id: number;
  amount: number;
  method: string;
  status: string;
  paid_at: string;
  registered_by?: { id: number; username: string } | null;
}

export interface PosSaleItem {
  id: number;
  sale_code: string;
  branch_id?: number | null;
  subtotal: number;
  discount_type: string;
  discount_value: number;
  total: number;
  payment_method: string;
  status: string;
  notes?: string | null;
  created_at: string;
  client: { id: number; name: string; last_name: string };
  created_by?: { id: number; username: string } | null;
  appointments: PosSaleAppointment[];
  payments: PosSalePayment[];
}

/** Normaliza el body para FastAPI (evita strings vacíos en professional_id, etc.) */
function normalizeCreatePayload(payload: PosSaleCreatePayload): Record<string, unknown> {
  return {
    client_id: payload.client_id,
    branch_id: payload.branch_id ?? null,
    payment_method: payload.payment_method.trim().toLowerCase(),
    discount_type: payload.discount_type,
    discount_value: Number(payload.discount_value) || 0,
    ...(payload.notes?.trim() ? { notes: payload.notes.trim() } : {}),
    items: payload.items.map((item) => ({
      service_id: item.service_id,
      professional_id:
        item.professional_id != null && item.professional_id > 0 ? item.professional_id : null,
      is_ia: Boolean(item.is_ia),
      start_time: item.start_time,
      end_time: item.end_time,
      branch_id: item.branch_id != null && item.branch_id > 0 ? item.branch_id : null,
    })),
  };
}

export const PosSaleService = {
  async list(params?: { skip?: number; limit?: number }): Promise<PosSaleItem[]> {
    try {
      const response = await api.get<PosSaleItem[]>("/pos-sales/", {
        params: {
          skip: params?.skip ?? 0,
          limit: params?.limit ?? 100,
        },
      });
      return response.data;
    } catch (error) {
      throw new Error(getApiErrorMessage(error, "No se pudieron cargar las ventas."));
    }
  },

  async create(payload: PosSaleCreatePayload): Promise<PosSaleItem> {
    if (!payload.items?.length) {
      throw new Error("Debes agregar al menos un servicio.");
    }

    try {
      const body = normalizeCreatePayload(payload);
      const response = await api.post<PosSaleItem>("/pos-sales/", body);
      return response.data;
    } catch (error) {
      throw new Error(getApiErrorMessage(error, "Error al crear la venta."));
    }
  },

  async getById(id: number): Promise<PosSaleItem> {
    try {
      const response = await api.get<PosSaleItem>(`/pos-sales/${id}`);
      return response.data;
    } catch (error) {
      throw new Error(getApiErrorMessage(error, "No se pudo cargar la venta."));
    }
  },

  async update(id: number, payload: PosSaleUpdatePayload): Promise<PosSaleItem> {
    try {
      const response = await api.patch<PosSaleItem>(`/pos-sales/${id}`, payload);
      return response.data;
    } catch (error) {
      throw new Error(getApiErrorMessage(error, "No se pudo actualizar la venta."));
    }
  },

  async cancel(id: number): Promise<PosSaleItem> {
    try {
      const response = await api.post<PosSaleItem>(`/pos-sales/${id}/cancel`);
      return response.data;
    } catch (error) {
      throw new Error(getApiErrorMessage(error, "No se pudo cancelar la venta."));
    }
  },

  async remove(id: number): Promise<void> {
    try {
      await api.delete(`/pos-sales/${id}`);
    } catch (error) {
      throw new Error(getApiErrorMessage(error, "No se pudo eliminar la venta."));
    }
  },

  async getReceiptPdf(id: number, format: "a4" | "thermal"): Promise<Blob> {
    try {
      const response = await api.get(`/pos-sales/${id}/receipt/pdf`, {
        params: { format },
        responseType: "blob",
      });
      return response.data as Blob;
    } catch (error) {
      throw new Error(getApiErrorMessage(error, "No se pudo generar el PDF del comprobante."));
    }
  },
};

export { getApiErrorMessage };
