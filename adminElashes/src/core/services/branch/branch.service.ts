import api from "../api";

interface BackendBranch {
  id: number;
  name: string;
  address?: string | null;
  city?: string | null;
  department?: string | null;
  opening_hours?: Array<{
    day: string;
    ranges: Array<{ open_time: string; close_time: string }>;
  }> | null;
}

interface MessageResponse {
  message: string;
}

export interface BranchPayload {
  name: string;
  address?: string;
  city?: string;
  department?: string;
  opening_hours?: Array<{
    day: string;
    ranges: Array<{ open_time: string; close_time: string }>;
  }>;
}

export interface BranchIntegrations {
  branch_id: number;
  branch_name: string;
  integration_profile_id: number | null;
  integration_profile_name: string | null;
  use_shared_profile: boolean;
  shared_branch_ids: number[];
  whatsapp_enabled: boolean;
  whatsapp_provider: string;
  whatsapp_api_url: string | null;
  whatsapp_phone_number_id: string | null;
  whatsapp_has_token: boolean;
  ai_api_url: string | null;
  ai_has_token: boolean;
}

export interface BranchIntegrationsPayload {
  mode: "shared" | "own";
  integration_profile_id?: number | null;
  whatsapp_enabled?: boolean;
  whatsapp_provider?: string;
  whatsapp_api_url?: string | null;
  whatsapp_phone_number_id?: string | null;
  whatsapp_api_token?: string;
  ai_api_url?: string | null;
  ai_api_token?: string;
}

export interface BranchIntegrationProfile {
  id: number;
  name: string;
  is_shared: boolean;
  whatsapp_enabled: boolean;
  whatsapp_provider: string;
  whatsapp_api_url: string | null;
  whatsapp_phone_number_id: string | null;
  whatsapp_has_token: boolean;
  ai_api_url: string | null;
  ai_has_token: boolean;
  branch_ids: number[];
}

export interface BranchIntegrationProfilePayload {
  name: string;
  is_shared?: boolean;
  whatsapp_enabled?: boolean;
  whatsapp_provider?: string;
  whatsapp_api_url?: string | null;
  whatsapp_phone_number_id?: string | null;
  whatsapp_api_token?: string;
  ai_api_url?: string | null;
  ai_api_token?: string;
  branch_ids?: number[];
}

export const BranchService = {
  async list(params?: { skip?: number; limit?: number; city?: string; department?: string }) {
    const response = await api.get<BackendBranch[]>("/branches/", { params });
    return response.data;
  },

  async create(payload: BranchPayload) {
    const response = await api.post<BackendBranch>("/branches/", payload);
    return response.data;
  },

  async update(id: number, payload: BranchPayload) {
    const response = await api.put<BackendBranch>(`/branches/${id}`, payload);
    return response.data;
  },

  async remove(id: number) {
    const response = await api.delete<MessageResponse>(`/branches/${id}`);
    return response.data;
  },

  async listIntegrationProfiles() {
    const response = await api.get<BranchIntegrationProfile[]>("/branches/integration-profiles");
    return response.data;
  },

  async createIntegrationProfile(payload: BranchIntegrationProfilePayload) {
    const response = await api.post<BranchIntegrationProfile>("/branches/integration-profiles", payload);
    return response.data;
  },

  async updateIntegrationProfile(id: number, payload: Partial<BranchIntegrationProfilePayload>) {
    const response = await api.put<BranchIntegrationProfile>(`/branches/integration-profiles/${id}`, payload);
    return response.data;
  },

  async removeIntegrationProfile(id: number) {
    const response = await api.delete<MessageResponse>(`/branches/integration-profiles/${id}`);
    return response.data;
  },

  async getIntegrations(branchId: number) {
    const response = await api.get<BranchIntegrations>(`/branches/${branchId}/integrations`);
    return response.data;
  },

  async updateIntegrations(branchId: number, payload: BranchIntegrationsPayload) {
    const response = await api.put<BranchIntegrations>(`/branches/${branchId}/integrations`, payload);
    return response.data;
  },
};
