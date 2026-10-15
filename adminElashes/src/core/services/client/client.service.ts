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
  email?: string | null;
  branch_id?: number | null;
  branch?: { id: number; name: string } | null;
  eye_type_id?: number | null;
  eye_type?: BackendEyeType | null;
  visit_count?: number;
  status?: string;
  created_at?: string;
  ci?: string | null;
  marketplace_enabled?: boolean;
}

export interface ClientCreatePayload {
  name: string;
  last_name: string;
  age?: number;
  phone?: string;
  email?: string;
  branch_id?: number;
  eye_type_id?: number;
  ci?: string;
}

export type RetoqueTipo = "mantenimiento" | "retiro";

/** Fila de "Estado de retoques" (GET /clients/retoques). */
export interface RetoqueRow {
  client_id: number;
  seguimiento_id: number;
  clienta: string;
  servicio: string | null;
  tipo: RetoqueTipo;
  /** YYYY-MM-DD, día en hora de La Paz. */
  fecha_objetivo: string;
  /** Negativo = vencido. */
  dias_restantes: number;
  vencido: boolean;
  /** Próxima cita no cancelada, hora de La Paz sin zona (YYYY-MM-DDTHH:mm:ss); null si no agendó. */
  proxima_cita: string | null;
  notificaciones_activas: boolean;
  branch_id: number | null;
}

export type ClientUpdatePayload = Partial<ClientCreatePayload> & {
  status?: string;
  marketplace_enabled?: boolean;
};

const mapBackendClientToIClient = (client: BackendClient): IClient => ({
  id: client.id,
  nombre: client.name,
  apellido: client.last_name,
  edad: client.age ?? 0,
  sexo: "Otro",
  tipoOjos: client.eye_type?.name ?? "-",
  phone: client.phone ?? undefined,
  email: client.email ?? undefined,
  eye_type_id: client.eye_type_id ?? undefined,
  branch_id: client.branch_id ?? undefined,
  branch_name: client.branch?.name ?? undefined,
  created_at: client.created_at,
  visitas: client.visit_count ?? 0,
  status: (client.status ?? "sin_estado") as IClient["status"],
  ci: client.ci ?? undefined,
  marketplaceEnabled: client.marketplace_enabled ?? false,
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

  async listRetoques(params: { dias: number; branch_id?: number }): Promise<RetoqueRow[]> {
    const response = await api.get<RetoqueRow[]>("/clients/retoques", { params });
    return response.data;
  },

  /** Activa/desactiva los avisos de mantenimiento/retiro de la clienta (los de citas siguen). */
  async setNotificaciones(id: number, activas: boolean): Promise<{ id: number; notificaciones_activas: boolean }> {
    const response = await api.patch(`/clients/${id}/notificaciones`, { notificaciones_activas: activas });
    return response.data;
  },
  
  async registerTracking(data: any) {
    const response = await api.post("/tracking/register", data);
    return response.data;
  }
};