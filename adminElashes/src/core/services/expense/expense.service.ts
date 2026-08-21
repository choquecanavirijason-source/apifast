import api from "../api";

export interface ExpenseOut {
  id: number;
  branch_id: number;
  branch_name: string;
  amount: number;
  description: string;
  expense_date: string;
  photo_url: string | null;
  created_at: string;
  created_by_name: string | null;
}

export interface ExpenseCreate {
  branch_id: number;
  amount: number;
  description: string;
  expense_date: string; // YYYY-MM-DD
  photo_url?: string | null;
}

export interface CashSummary {
  cash_in_register: { ventas_efectivo: number; gastos_efectivo: number; saldo: number };
  income_by_method: { efectivo: number; tarjeta: number; transferencia: number; qr: number; total: number };
  expenses: { gastos: number; total: number };
}

export const ExpenseService = {
  async list(params?: { branch_id?: number; from_date?: string; to_date?: string }): Promise<ExpenseOut[]> {
    const res = await api.get<ExpenseOut[]>("/expenses", { params });
    return res.data;
  },

  async create(body: ExpenseCreate): Promise<ExpenseOut> {
    const res = await api.post<ExpenseOut>("/expenses", body);
    return res.data;
  },

  async remove(id: number): Promise<void> {
    await api.delete(`/expenses/${id}`);
  },

  async uploadPhoto(file: File): Promise<string> {
    const formData = new FormData();
    formData.append("file", file);
    const res = await api.post<{ image: string }>("/catalog/upload-image?folder=expenses", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return res.data.image;
  },

  async getCashSummary(params: { branch_id?: number; start_date?: string; end_date?: string }): Promise<CashSummary> {
    const res = await api.get<CashSummary>("/reports/cash-summary", { params });
    return res.data;
  },
};
