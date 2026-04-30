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
};
