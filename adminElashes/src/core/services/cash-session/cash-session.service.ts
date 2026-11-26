import api from "../api";

export interface CashSessionOut {
  id: number;
  date: string;
  branch_id: number | null;
  branch_name: string;
  status: "open" | "closed";
  opened_by_name: string | null;
  opened_at: string;
  opening_amount: number | null;
  closed_by_name: string | null;
  closed_at: string | null;
  grand_total: number;
  grand_commission: number;
  total_paid: number;
  total_unpaid: number;
  cash_sales: number | null;
  cash_expenses: number | null;
  /** Comisiones pagadas del efectivo de la caja durante la sesión. */
  cash_commissions?: number | null;
  cash_extras?: number | null;
  expected_cash: number | null;
  counted_amount: number | null;
  difference: number | null;
  next_fund_amount: number | null;
  notes: string | null;
}

export interface CashSessionDetail {
  cash_sales: number;
  cash_expenses: number;
  cash_commissions?: number;
  cash_extras?: number;
  expected_cash: number;
  /** Lo vendido en la sesión, agrupado (como el "diario" del cuaderno). */
  products_sold?: Array<{ product_id: number; name: string; quantity: number; total: number }>;
  services_sold?: Array<{ service_id: number; name: string; count: number; total: number }>;
  income_by_method: {
    efectivo: number;
    tarjeta: number;
    transferencia: number;
    qr: number;
    mixto: number;
    total: number;
  };
  payments: {
    id: number;
    amount: number;
    method: string;
    paid_at: string | null;
    client_name: string | null;
  }[];
  expenses: {
    id: number;
    amount: number;
    description: string;
    created_at: string | null;
  }[];
  /** Cancelaciones de la sesión: motivo, quién, monto y si se devolvió el dinero. */
  cancellations?: {
    id: number;
    created_at: string | null;
    scope: "ticket" | "sale";
    reason: string;
    amount: number;
    refunded: boolean;
    refund_method: string | null;
    user_name: string | null;
    ticket_code: string | null;
    sale_code: string | null;
  }[];
  refunds_total?: number;
}

export const CashSessionService = {
  async getCurrent(branchId: number): Promise<CashSessionOut | null> {
    const res = await api.get<CashSessionOut | null>("/cash-sessions/current", {
      params: { branch_id: branchId },
    });
    return res.data;
  },

  async list(params?: { branch_id?: number; from_date?: string; to_date?: string }): Promise<CashSessionOut[]> {
    const res = await api.get<CashSessionOut[]>("/cash-sessions", { params });
    return res.data;
  },

  async open(body: { branch_id: number; opening_amount: number; notes?: string }): Promise<CashSessionOut> {
    const res = await api.post<CashSessionOut>("/cash-sessions/open", body);
    return res.data;
  },

  async getDetail(sessionId: number): Promise<CashSessionDetail> {
    const res = await api.get<CashSessionDetail>(`/cash-sessions/${sessionId}/detail`);
    return res.data;
  },

  async close(sessionId: number, countedAmount: number, notes: string | undefined, nextFundAmount: number): Promise<CashSessionOut> {
    const res = await api.post<CashSessionOut>(`/cash-sessions/${sessionId}/close`, {
      notes,
      counted_amount: countedAmount,
      next_fund_amount: nextFundAmount,
    });
    return res.data;
  },
};
