import api from "../api";
import type { IClient } from "../../types/IClient";

interface BackendEyeType {
  id: number;
  name: string;
  description?: string | null;
  image?: string | null;
}

export interface EyeTypeOption {
  id: number;
  name: string;
}

interface BackendClient {
  id: number;
  name: string;
  last_name: string;
  age?: number | null;
  phone?: string | null;
  branch_id?: number | null;
  branch?: { id: number; name: string } | null;
  eye_type_id?: number | null;
  eye_type?: BackendEyeType | null;
  visit_count?: number;
  status?: string;
  created_at?: string;
}

export interface ClientCreatePayload {
  name: string;
  last_name: string;
  age?: number;
  phone?: string;
  branch_id?: number;
  eye_type_id?: number;
}

export type ClientUpdatePayload = Partial<ClientCreatePayload>;

const mapBackendClientToIClient = (client: BackendClient): IClient => ({
  id: client.id,
  nombre: client.name,
  apellido: client.last_name,
  edad: client.age ?? 0,
  sexo: "Otro",
  tipoOjos: client.eye_type?.name ?? "-",
  phone: client.phone ?? undefined,
  eye_type_id: client.eye_type_id ?? undefined,
  branch_id: client.branch_id ?? undefined,
  branch_name: client.branch?.name ?? undefined,
  created_at: client.created_at,
  visitas: client.visit_count ?? 0,
  status: (client.status ?? "sin_estado") as IClient["status"],
});

export const ClientService = {
  async listEyeTypes(params?: { skip?: number; limit?: number }): Promise<EyeTypeOption[]> {
    const response = await api.get<BackendEyeType[]>("/catalogs/eye-types", {
      params: {
        skip: params?.skip ?? 0,
        limit: params?.limit ?? 100,
      },
    });

    return response.data.map((eyeType) => ({
      id: eyeType.id,
      name: eyeType.name,
    }));
  },

  async list(params?: { skip?: number; limit?: number; search?: string; branch_id?: number }): Promise<IClient[]> {
    const response = await api.get<BackendClient[]>("/clients/", { params });
    return response.data.map(mapBackendClientToIClient);
  },

  async getById(id: number): Promise<IClient> {
    const response = await api.get<BackendClient>(`/clients/${id}`);
    return mapBackendClientToIClient(response.data);
  },

  async create(data: ClientCreatePayload): Promise<IClient> {
    const response = await api.post<BackendClient>("/clients/", data);
    return mapBackendClientToIClient(response.data);
  },

  async update(id: number, data: ClientUpdatePayload): Promise<IClient> {
    const response = await api.put<BackendClient>(`/clients/${id}`, data);
    return mapBackendClientToIClient(response.data);
  },

  async remove(id: number) {
    const response = await api.delete(`/clients/${id}`);
    return response.data;
  },
  
  async registerTracking(data: any) {
    const response = await api.post("/tracking/register", data);
    return response.data;
  }
};