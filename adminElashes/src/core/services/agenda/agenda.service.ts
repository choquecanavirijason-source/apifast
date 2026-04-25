import api from "../api";

/** Categorías de servicio (API REST bajo `/services/categories`, no `/agenda/...`). */
const SERVICE_CATEGORIES_PATH = "/services/categories";

/** Cliente del módulo agenda: citas, selectores y servicios bajo `/agenda`; categorías bajo `/services/categories`. */

export interface ServiceOption {
  id: number;
  name: string;
  description?: string | null;
  image_url?: string | null;
  category_id?: number | null;
  category?: ServiceCategoryOption | null;
  duration_minutes: number;
  price: number;
  branch_ids?: number[] | null;
}

export interface ServiceCreatePayload {
  name: string;
  description?: string | null;
  image_url?: string | null;
  category_id?: number | null;
  duration_minutes: number;
  price: number;
  branch_ids?: number[] | null;
}

export interface ServiceUpdatePayload {
  name?: string | null;
  description?: string | null;
  image_url?: string | null;
  category_id?: number | null;
  duration_minutes?: number | null;
  price?: number | null;
  branch_ids?: number[] | null;
}

export interface ServiceImageUploadResponse {
  image_url: string;
}

export interface ServiceCategoryOption {
  id: number;
  name: string;
  description?: string | null;
  image_url?: string | null;
  is_mobile: boolean;
}

export interface ServiceCategoryCreatePayload {
  name: string;
  description?: string | null;
  image_url?: string | null;
  is_mobile: boolean;
}

export interface ServiceCategoryUpdatePayload {
  name?: string | null;
  description?: string | null;
  image_url?: string | null;
  is_mobile?: boolean;
}

/**
 * Cuando GET /services/categories falla (404, etc.), reconstruye categorías desde el listado de servicios.
 */
export function deriveServiceCategoriesFromServices(serviceList: ServiceOption[]): ServiceCategoryOption[] {
  const map = new Map<number, ServiceCategoryOption>();
  for (const s of serviceList) {
    if (s.category && typeof s.category.id === "number") {
      const c = s.category;
      map.set(c.id, {
        id: c.id,
        name: c.name,
        description: c.description ?? null,
        image_url: c.image_url ?? null,
        is_mobile: Boolean(c.is_mobile),
      });
    } else if (s.category_id != null && Number.isFinite(Number(s.category_id))) {
      const id = Number(s.category_id);
      if (!map.has(id)) {
        map.set(id, {
          id,
          name: `Categoría ${id}`,
          description: null,
          image_url: null,
          is_mobile: false,
        });
      }
    }
  }
  return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name, "es"));
}

export interface AppointmentCreatePayload {
  client_id: number;
  professional_id?: number | null;
  service_id?: number | null;
  service_ids?: number[] | null;
  branch_id?: number | null;
  is_ia?: boolean;
  start_time: string; // ISO datetime
  end_time: string; // ISO datetime
  status?: string;
}

export interface AppointmentUpdatePayload {
  client_id?: number | null;
  professional_id?: number | null;
  service_id?: number | null;
  service_ids?: number[] | null;
  branch_id?: number | null;
  is_ia?: boolean;
  start_time?: string;
  end_time?: string;
  status?: string;
}

export interface TicketItem {
  id: number;
  ticket_code: string | null;
  is_ia?: boolean;
  client_id: number;
  professional_id?: number | null;
  professional_name?: string | null;
  service_id: number | null;
  service_ids?: number[] | null;
  client_name: string;
  service_name: string | null;
  service_names?: string[];
  service_price?: number | null;
  service_prices?: number[];
  start_time: string;
  end_time: string;
  status: string;
  branch_name?: string | null;
}

interface BackendAppointment {
  id: number;
  ticket_code?: string | null;
  is_ia?: boolean;
  client_id: number;
  professional_id?: number | null;
  service_id?: number | null;
  service_ids?: number[] | null;
  start_time: string;
  end_time: string;
  status: string;
  client?: { id: number; name: string; last_name: string };
  professional?: { id: number; username: string; email?: string } | null;
  service?: { id: number; name: string; price?: number } | null;
  services?: Array<{ id: number; name: string; price?: number }> | null;
  branch?: { id: number; name: string } | null;
}

const mapToTicket = (a: BackendAppointment): TicketItem => ({
  id: a.id,
  ticket_code: a.ticket_code ?? null,
  is_ia: a.is_ia ?? false,
  client_id: a.client_id,
  professional_id: a.professional?.id ?? a.professional_id ?? null,
  professional_name: a.professional?.username ?? null,
  service_id: a.service_id ?? null,
  service_ids: a.service_ids ?? a.services?.map((service) => service.id) ?? null,
  client_name: a.client ? `${a.client.name} ${a.client.last_name}`.trim() : `Cliente #${a.client_id}`,
  service_name: a.service?.name ?? null,
  service_names: a.services?.map((service) => service.name) ?? (a.service ? [a.service.name] : undefined),
  service_price: a.service?.price ?? null,
  service_prices: a.services?.map((service) => Number(service.price ?? 0)) ?? undefined,
  start_time: a.start_time,
  end_time: a.end_time,
  status: a.status,
  branch_name: a.branch?.name ?? null,
});

export interface ClientForSelect {
  id: number;
  nombre: string;
  apellido: string;
  phone?: string | null;
}

export interface ProfessionalForSelect {
  id: number;
  username: string;
  email: string;
}

export const AgendaService = {
  async uploadServiceCategoryImage(file: File): Promise<string> {
    const formData = new FormData();
    formData.append("file", file);
    const response = await api.post<ServiceImageUploadResponse>(`${SERVICE_CATEGORIES_PATH}/upload-image`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return response.data.image_url;
  },

  async listServiceCategories(): Promise<ServiceCategoryOption[]> {
    const response = await api.get<ServiceCategoryOption[]>(SERVICE_CATEGORIES_PATH);
    return response.data;
  },

  async createServiceCategory(payload: ServiceCategoryCreatePayload): Promise<ServiceCategoryOption> {
    const response = await api.post<ServiceCategoryOption>(SERVICE_CATEGORIES_PATH, payload, {
      timeout: 120_000,
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
    });
    return response.data;
  },

  async updateServiceCategory(id: number, payload: ServiceCategoryUpdatePayload): Promise<ServiceCategoryOption> {
    const response = await api.put<ServiceCategoryOption>(`${SERVICE_CATEGORIES_PATH}/${id}`, payload, {
      timeout: 120_000,
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
    });
    return response.data;
  },

  async deleteServiceCategory(id: number): Promise<void> {
    await api.delete(`${SERVICE_CATEGORIES_PATH}/${id}`);
  },

  async uploadServiceImage(file: File): Promise<string> {
    const formData = new FormData();
    formData.append("file", file);
    const response = await api.post<ServiceImageUploadResponse>("/agenda/services/upload-image", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return response.data.image_url;
  },

  async listClientsForSelect(params?: {
    skip?: number;
    limit?: number;
    search?: string;
    branch_id?: number;
  }): Promise<ClientForSelect[]> {
    const response = await api.get<ClientForSelect[]>("/agenda/clients-for-select", {
      params: {
        skip: params?.skip ?? 0,
        limit: params?.limit ?? 100,
        search: params?.search,
        branch_id: params?.branch_id,
      },
    });
    return response.data;
  },

  async listServices(params?: { skip?: number; limit?: number; branch_id?: number; category_id?: number }): Promise<ServiceOption[]> {
    const response = await api.get<ServiceOption[]>("/agenda/services", {
      params: {
        skip: params?.skip ?? 0,
        limit: params?.limit ?? 100,
        branch_id: params?.branch_id,
        category_id: params?.category_id,
      },
    });
    return response.data;
  },

  async createService(payload: ServiceCreatePayload): Promise<ServiceOption> {
    const response = await api.post<ServiceOption>("/agenda/services", payload);
    return response.data;
  },

  async updateService(id: number, payload: ServiceUpdatePayload): Promise<ServiceOption> {
    const response = await api.put<ServiceOption>(`/agenda/services/${id}`, payload);
    return response.data;
  },

  async deleteService(id: number): Promise<void> {
    await api.delete(`/agenda/services/${id}`);
  },

  async listProfessionalsForSelect(params?: {
    skip?: number;
    limit?: number;
    search?: string;
  }): Promise<ProfessionalForSelect[]> {
    const response = await api.get<ProfessionalForSelect[]>("/agenda/professionals-for-select", {
      params: {
        skip: params?.skip ?? 0,
        limit: params?.limit ?? 100,
        search: params?.search,
      },
    });
    return response.data;
  },

  async listTickets(params?: {
    skip?: number;
    limit?: number;
    service_id?: number;
    professional_id?: number;
    client_id?: number;
    ticket_code?: string;
    client_name?: string;
    search?: string;  // Busca en código O nombre de cliente
    status_filter?: string;
    branch_id?: number;
    start_date?: string;
    end_date?: string;
  }): Promise<TicketItem[]> {
    const response = await api.get<BackendAppointment[]>("/agenda/appointments", {
      params: {
        skip: params?.skip ?? 0,
        limit: params?.limit ?? 100,
        service_id: params?.service_id,
        professional_id: params?.professional_id,
        client_id: params?.client_id,
        ticket_code: params?.ticket_code,
        client_name: params?.client_name,
        search: params?.search,
        status_filter: params?.status_filter,
        branch_id: params?.branch_id,
        start_date: params?.start_date,
        end_date: params?.end_date,
      },
    });
    return response.data.map(mapToTicket);
  },

  async createAppointment(payload: AppointmentCreatePayload): Promise<TicketItem> {
    const body = {
      client_id: payload.client_id,
      start_time: payload.start_time,
      end_time: payload.end_time,
      status: payload.status ?? "pending",
      ...(payload.is_ia !== undefined && { is_ia: payload.is_ia }),
      ...(payload.professional_id != null && { professional_id: payload.professional_id }),
      ...(payload.service_id != null && { service_id: payload.service_id }),
      ...(payload.service_ids != null && { service_ids: payload.service_ids }),
      ...(payload.branch_id != null && { branch_id: payload.branch_id }),
    };
    const response = await api.post<BackendAppointment>("/agenda/appointments", body);
    return mapToTicket(response.data);
  },

  async updateAppointment(id: number, payload: AppointmentUpdatePayload): Promise<TicketItem> {
    const body = {
      ...(payload.client_id != null && { client_id: payload.client_id }),
      ...(payload.professional_id !== undefined && { professional_id: payload.professional_id }),
      ...(payload.service_id != null && { service_id: payload.service_id }),
      ...(payload.service_ids != null && { service_ids: payload.service_ids }),
      ...(payload.branch_id != null && { branch_id: payload.branch_id }),
      ...(payload.is_ia !== undefined && { is_ia: payload.is_ia }),
      ...(payload.start_time && { start_time: payload.start_time }),
      ...(payload.end_time && { end_time: payload.end_time }),
      ...(payload.status && { status: payload.status }),
    };
    const response = await api.put<BackendAppointment>(`/agenda/appointments/${id}`, body);
    return mapToTicket(response.data);
  },

  async callNextAppointment(payload: { branch_id: number; professional_id?: number | null }): Promise<TicketItem> {
    const response = await api.post<BackendAppointment>("/agenda/appointments/call-next", payload);
    return mapToTicket(response.data);
  },

  async deleteAppointment(id: number): Promise<void> {
    await api.delete(`/agenda/appointments/${id}`);
  },
};
