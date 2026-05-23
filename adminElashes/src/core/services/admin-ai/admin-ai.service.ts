import api from "../api";

export interface AdminAiSettings {
  ai_enabled: boolean;
  ai_api_url: string | null;
  ai_model: string;
  ai_has_token: boolean;
}

export interface AdminAiSettingsPayload {
  ai_enabled?: boolean;
  ai_api_url?: string | null;
  ai_model?: string;
  ai_api_token?: string;
}

export interface AdminAiContext {
  generated_at: string;
  scope: { branch_id: number | null; branch_name: string | null };
  branches: Array<{ id: number; name: string; city?: string | null; department?: string | null }>;
  totals: {
    branches_count: number;
    clients_total: number;
    active_users: number;
  };
  last_30_days: {
    appointments: Record<string, number>;
    pos_sales_count: number;
    pos_sales_total: number;
  };
  today: {
    date: string;
    appointments: Record<string, number>;
  };
}

export interface AdminAiChatResponse {
  reply: string;
  model: string;
  context_summary: {
    branches_count: number;
    clients_total: number;
    appointments_30d: number;
    sales_30d_total: number;
    scope: { branch_id: number | null; branch_name: string | null };
  };
}

export const AdminAiService = {
  async getSettings() {
    const response = await api.get<AdminAiSettings>("/admin/ai/settings");
    return response.data;
  },

  async updateSettings(payload: AdminAiSettingsPayload) {
    const response = await api.put<AdminAiSettings>("/admin/ai/settings", payload);
    return response.data;
  },

  async getContext(branchId?: number | null) {
    const response = await api.get<AdminAiContext>("/admin/ai/context", {
      params: branchId ? { branch_id: branchId } : undefined,
    });
    return response.data;
  },

  async chat(message: string, branchId?: number | null) {
    const response = await api.post<AdminAiChatResponse>("/admin/ai/chat", {
      message,
      branch_id: branchId ?? undefined,
    });
    return response.data;
  },
};
