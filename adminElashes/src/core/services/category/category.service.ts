import api from "../api";

interface BackendCategory {
  id: number;
  name: string;
  description?: string | null;
}

interface MessageResponse {
  message: string;
}

export interface CategoryItem {
  id: number;
  name: string;
  description?: string | null;
}

export interface CategoryPayload {
  name: string;
  description?: string;
}

const mapCategory = (category: BackendCategory): CategoryItem => ({
  id: category.id,
  name: category.name,
  description: category.description,
});

export const CategoryService = {
  async listCategories(): Promise<CategoryItem[]> {
    const response = await api.get<BackendCategory[]>("/inventory/categories");
    return response.data.map(mapCategory);
  },

  async createCategory(payload: CategoryPayload): Promise<CategoryItem> {
    const response = await api.post<BackendCategory>("/inventory/categories", payload);
    return mapCategory(response.data);
  },

  async updateCategory(id: number, payload: Partial<CategoryPayload>): Promise<CategoryItem> {
    const response = await api.put<BackendCategory>(`/inventory/categories/${id}`, payload);
    return mapCategory(response.data);
  },

  async removeCategory(id: number): Promise<MessageResponse> {
    const response = await api.delete<MessageResponse>(`/inventory/categories/${id}`);
    return response.data;
  },
};
