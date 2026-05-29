import api from "../api";

export interface DailyClosingItem {
  appointment_id: number;
  ticket_code: string | null;
  client_name: string;
  service_names: string[];
  professional_name: string;
  start_time: string;
  duration_minutes: number;
  status: string;
  total_price: number;
  commission: number;
  branch_name: string;
}

export interface DailyClosingResponse {
  date: string;
  branch_id: number | null;
  branch_name: string | null;
  items: DailyClosingItem[];
  grand_total: number;
  grand_commission: number;
}

export const ReportsService = {
  async getDailyClosing(params: {
    date: string;
    branch_id?: number | null;
    professional_id?: number | null;
  }): Promise<DailyClosingResponse> {
    const query: Record<string, string | number> = { date: params.date };
    if (params.branch_id) query.branch_id = params.branch_id;
    if (params.professional_id) query.professional_id = params.professional_id;
    const res = await api.get<DailyClosingResponse>("/reports/daily-closing", { params: query });
    return res.data;
  },

  async updateStatus(appointment_id: number, status: string): Promise<void> {
    await api.patch(`/reports/daily-closing/${appointment_id}/status`, { status });
  },
};
