import api from "../api";

export interface CommissionPaymentOut {
  id: number;
  professional_id: number;
  professional_name: string;
  amount: number;
  period_start: string | null;
  period_end: string | null;
  notes: string | null;
  registered_at: string;
  registered_by_name: string | null;
}

export interface CommissionPaymentCreate {
  professional_id: number;
  amount: number;
  period_start?: string | null;
  period_end?: string | null;
  notes?: string | null;
  registered_at?: string | null;
}

export const CommissionPaymentsService = {
  async list(params?: { professional_id?: number; from_date?: string; to_date?: string }): Promise<CommissionPaymentOut[]> {
    const res = await api.get<CommissionPaymentOut[]>("/commission-payments", { params });
    return res.data;
  },

  async create(body: CommissionPaymentCreate): Promise<CommissionPaymentOut> {
    const res = await api.post<CommissionPaymentOut>("/commission-payments", body);
    return res.data;
  },

  async remove(id: number): Promise<void> {
    await api.delete(`/commission-payments/${id}`);
  },
};
