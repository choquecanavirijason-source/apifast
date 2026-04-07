export interface PermissionItem {
  id: number;
  name: string;
}

export interface RoleItem {
  id: number;
  name: string;
  permissions?: PermissionItem[];
}

export interface BranchItem {
  id: number;
  name: string;
  address?: string | null;
  city?: string | null;
  department?: string | null;
}

export interface UserItem {
  id: number;
  username: string;
  email: string;
  phone?: string | null;
  role?: RoleItem | string | null;
  branch?: BranchItem | null;
  role_id?: number | null;
  branch_id?: number | null;
  is_active?: boolean;
  created_at?: string | null;
}

export type SectionTab = "users" | "roles" | "permissions";

export const getRoleName = (role: UserItem["role"]) => {
  if (typeof role === "string") return role;
  if (role && typeof role === "object" && "name" in role) return String(role.name ?? "");
  return "Sin rol";
};
