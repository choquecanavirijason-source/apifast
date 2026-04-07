import api from "../api";

export interface CatalogItem {
  id: number;
  name: string;
  description?: string | null;
  image?: string | null;
}

export interface QuestionnaireItem {
  id: number;
  title: string;
  description?: string | null;
  is_active: boolean;
  questions?: Array<{
    id: number;
    questionnaire_id: number;
    text: string;
    question_type: "text" | "number" | "bool" | "select" | "multi_select";
    is_required: boolean;
    sort_order: number;
  }>;
}

export interface QuestionnaireCreatePayload {
  title: string;
  description?: string | null;
  is_active?: boolean;
  questions?: Array<{
    text: string;
    question_type: "text" | "number" | "bool" | "select" | "multi_select";
    is_required?: boolean;
    sort_order?: number;
  }>;
}

export interface QuestionnaireUpdatePayload {
  title?: string | null;
  description?: string | null;
  is_active?: boolean;
  questions?: Array<{
    text: string;
    question_type: "text" | "number" | "bool" | "select" | "multi_select";
    is_required?: boolean;
    sort_order?: number;
  }>;
}

export const CatalogService = {
  async listEyeTypes(params?: { skip?: number; limit?: number }): Promise<CatalogItem[]> {
    const response = await api.get<CatalogItem[]>("/catalogs/eye-types", { params });
    return response.data;
  },

  async listEffects(params?: { skip?: number; limit?: number }): Promise<CatalogItem[]> {
    const response = await api.get<CatalogItem[]>("/catalogs/effects", { params });
    return response.data;
  },

  async listVolumes(params?: { skip?: number; limit?: number }): Promise<CatalogItem[]> {
    const response = await api.get<CatalogItem[]>("/catalogs/volumes", { params });
    return response.data;
  },

  async listLashDesigns(params?: { skip?: number; limit?: number }): Promise<CatalogItem[]> {
    const response = await api.get<CatalogItem[]>("/catalogs/lash-designs", { params });
    return response.data;
  },

  async listQuestionnaires(params?: { skip?: number; limit?: number }): Promise<QuestionnaireItem[]> {
    const response = await api.get<QuestionnaireItem[]>("/catalogs/questionnaires", { params });
    return response.data;
  },

  async getQuestionnaire(id: number): Promise<QuestionnaireItem> {
    const response = await api.get<QuestionnaireItem>(`/catalogs/questionnaires/${id}`);
    return response.data;
  },

  async createQuestionnaire(payload: QuestionnaireCreatePayload): Promise<QuestionnaireItem> {
    const response = await api.post<QuestionnaireItem>("/catalogs/questionnaires", payload);
    return response.data;
  },

  async updateQuestionnaire(id: number, payload: QuestionnaireUpdatePayload): Promise<QuestionnaireItem> {
    const response = await api.put<QuestionnaireItem>(`/catalogs/questionnaires/${id}`, payload);
    return response.data;
  },

  async deleteQuestionnaire(id: number): Promise<void> {
    await api.delete(`/catalogs/questionnaires/${id}`);
  },
};
