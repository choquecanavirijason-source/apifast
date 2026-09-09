import api from "../api";

export interface AuditLogOut {
  id: number;
  user_id: number | null;
  user_name: string | null;
  branch_id: number | null;
  branch_name: string | null;
  action: string;
  entity_type: string;
  entity_id: number | null;
  description: string;
  created_at: string;
}

export interface AuditLogFilters {
  skip?: number;
  limit?: number;
  user_id?: number;
  branch_id?: number;
  action?: string;
  entity_type?: string;
  from_date?: string;
  to_date?: string;
}

export const AuditLogService = {
  async list(params?: AuditLogFilters): Promise<AuditLogOut[]> {
    const res = await api.get<AuditLogOut[]>("/audit-logs", { params });
    return res.data;
  },
};
