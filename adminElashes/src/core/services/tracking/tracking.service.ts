import api from "../api";

export interface TrackingCreatePayload {
  client_id: number;
  appointment_id?: number | null;
  branch_id?: number | null;
  professional_id?: number | null;
  eye_type_id?: number | null;
  effect_id?: number | null;
  volume_id?: number | null;
  lash_design_id?: number | null;
  questionnaire_id?: number | null;
  design_notes?: string | null;
  last_application_date?: string | null;
  questionnaire_responses?: Record<string, unknown> | null;
}

export interface TrackingResponse {
  id: number;
  client_id: number;
  appointment_id?: number | null;
  branch_id?: number | null;
  professional_id?: number | null;
  eye_type_id?: number | null;
  effect_id?: number | null;
  volume_id?: number | null;
  lash_design_id?: number | null;
  questionnaire_id?: number | null;
  design_notes?: string | null;
  last_application_date: string;
  questionnaire_responses?: Record<string, unknown> | null;
  client?: { id: number; name: string; last_name: string };
  professional?: { id: number; username: string; email?: string | null } | null;
  questionnaire?: { id: number; title: string } | null;
}

export const TrackingService = {
  async list(params?: { skip?: number; limit?: number; client_id?: number }): Promise<TrackingResponse[]> {
    const response = await api.get<TrackingResponse[]>("/tracking/", {
      params: {
        skip: params?.skip ?? 0,
        limit: params?.limit ?? 20,
        client_id: params?.client_id,
      },
    });
    return response.data;
  },

  async create(payload: TrackingCreatePayload): Promise<TrackingResponse> {
    const response = await api.post<TrackingResponse>("/tracking/", payload);
    return response.data;
  },
};
