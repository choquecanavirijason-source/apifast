import api from "../api";

export interface DailyClosingItem {
  appointment_id: number;
  ticket_code: string | null;
  sale_id: number | null;
  sale_code: string | null;
  client_name: string;
  service_names: string[];
  professional_name: string;
  professional_id: number | null;
  start_time: string;
  duration_minutes: number;
  status: string;
  total_price: number;
  commission_rate: number;
  commission: number;
  branch_name: string;
  payment_method: string | null;
  is_paid: boolean;
  advance_payment_amount: number;
  balance_due: number;
}

export interface ProfessionalSummary {
  professional_id: number | null;
  professional_name: string;
  ticket_count: number;
  total_price: number;
  commission: number;
  commission_rate: number;
}

export interface DailyClosingResponse {
  date: string;
  to_date: string | null;
  branch_id: number | null;
  branch_name: string | null;
  items: DailyClosingItem[];
  grand_total: number;
  grand_commission: number;
  total_paid: number;
  total_unpaid: number;
  totals_by_payment: Record<string, number>;
  summary_by_professional: ProfessionalSummary[];
}

export const ReportsService = {
  async getDailyClosing(params: {
    date: string;
    to_date?: string | null;
    branch_id?: number | null;
    professional_id?: number | null;
  }): Promise<DailyClosingResponse> {
    const query: Record<string, string | number> = { date: params.date };
    if (params.to_date) query.to_date = params.to_date;
    if (params.branch_id)     query.branch_id     = params.branch_id;
    if (params.professional_id) query.professional_id = params.professional_id;
    const res = await api.get<DailyClosingResponse>("/reports/daily-closing", { params: query });
    return res.data;
  },

  async updateStatus(appointment_id: number, status: string): Promise<void> {
    await api.patch(`/reports/daily-closing/${appointment_id}/status`, { status });
  },
};
