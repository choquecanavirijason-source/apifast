import api from "../api";

export interface DashboardFilters {
  from?: string;
  to?: string;
  branch_id?: number;
  service_id?: number;
}

export interface DashboardOverview {
  period: {
    from?: string | null;
    to?: string | null;
  };
  scope: {
    branch_id?: number | null;
    branch_name?: string | null;
    service_id?: number | null;
  };
  cards: {
    clients_total: number;
    clients_with_activity: number;
    appointments_total: number;
    appointments_pending: number;
    appointments_confirmed: number;
    appointments_completed: number;
    appointments_cancelled: number;
    payments_paid_total: number;
    payments_count: number;
    avg_payment: number;
    pos_sales_count: number;
    active_employees: number;
    services_count: number;
    products_active_count: number;
    low_stock_items: number;
  };
}

export interface RevenueSeriesItem {
  bucket: string;
  paid_amount: number;
  payments_count: number;
}

export interface ServiceDistributionItem {
  service_id: number | null;
  service_name: string;
  tickets_count: number;
  completed_count: number;
  estimated_revenue: number;
}

export interface InventoryDistributionItem {
  product_id: number;
  product_name: string;
  total_stock: number;
}

const buildParams = (filters?: DashboardFilters) => ({
  from: filters?.from,
  to: filters?.to,
  branch_id: filters?.branch_id,
  service_id: filters?.service_id,
});

export const DashboardService = {
  async getOverview(filters?: DashboardFilters) {
    const response = await api.get<DashboardOverview>("/dashboard/overview", {
      params: buildParams(filters),
    });
    return response.data;
  },

  async getRevenueSeries(filters?: DashboardFilters & { group_by?: "day" | "month" }) {
    const response = await api.get<{ group_by: "day" | "month"; series: RevenueSeriesItem[] }>(
      "/dashboard/revenue-series",
      {
        params: {
          ...buildParams(filters),
          group_by: filters?.group_by ?? "day",
        },
      }
    );
    return response.data;
  },

  async getServiceDistribution(filters?: DashboardFilters & { limit?: number }) {
    const response = await api.get<{ rows: ServiceDistributionItem[] }>("/dashboard/service-distribution", {
      params: {
        ...buildParams(filters),
        limit: filters?.limit ?? 8,
      },
    });
    return response.data;
  },

  async getInventoryDistribution(params?: { branch_id?: number; limit?: number }) {
    const response = await api.get<{ rows: InventoryDistributionItem[] }>("/dashboard/inventory-distribution", {
      params: {
        branch_id: params?.branch_id,
        limit: params?.limit ?? 8,
      },
    });
    return response.data;
  },

  async downloadPaymentsReport(filters?: DashboardFilters & { method?: string; status_filter?: string }) {
    const response = await api.get<Blob>("/reports/payments.csv", {
      params: {
        ...buildParams(filters),
        method: filters?.method,
        status_filter: filters?.status_filter,
      },
      responseType: "blob",
    });
    return response.data;
  },

  async downloadTicketsReport(filters?: DashboardFilters & { status_filter?: string }) {
    const response = await api.get<Blob>("/reports/tickets.csv", {
      params: {
        ...buildParams(filters),
        status_filter: filters?.status_filter,
      },
      responseType: "blob",
    });
    return response.data;
  },

  async downloadPosSalesReport(filters?: DashboardFilters & { payment_method?: string; status_filter?: string }) {
    const response = await api.get<Blob>("/reports/pos-sales.csv", {
      params: {
        ...buildParams(filters),
        payment_method: filters?.payment_method,
        status_filter: filters?.status_filter,
      },
      responseType: "blob",
    });
    return response.data;
  },
};
