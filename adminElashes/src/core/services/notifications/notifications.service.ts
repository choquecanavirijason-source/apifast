import api from "../api";

export interface StockAlertRecipient {
  username: string;
  phone: string;
  sent: boolean;
  mode?: string;
  wa_me_url?: string;
  detail?: string;
}

export interface StockAlertResponse {
  sent: boolean;
  has_wa_me: boolean;
  wa_me_url: string | null;
  low_stock_count: number;
  recipients: StockAlertRecipient[];
  detail: string;
}

export const NotificationsService = {
  async sendStockAlert(): Promise<StockAlertResponse> {
    const response = await api.post<StockAlertResponse>("/notifications/stock-alert");
    return response.data;
  },
};
