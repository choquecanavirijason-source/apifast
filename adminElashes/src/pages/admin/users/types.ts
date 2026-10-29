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
  skill_level?: number | null;
  direct_permissions?: PermissionItem[];
  /** Asignación temporal de sucursal */
  temp_branch?: BranchItem | null;
  effective_branch_id?: number | null;
  is_temp_assigned?: boolean;
  temp_branch_id?: number | null;
  temp_branch_until?: string | null;
}

export type SectionTab = "users" | "roles" | "permissions";

export const getRoleName = (role: UserItem["role"]) => {
  if (typeof role === "string") return role;
  if (role && typeof role === "object" && "name" in role) return String(role.name ?? "");
  return "Sin rol";
};

/** La API determina si la asignación temporal sigue activa. */
export const hasTemporaryBranch = (user: UserItem) => user.is_temp_assigned === true;

export const getEffectiveBranchId = (user: UserItem): number | null =>
  user.effective_branch_id ?? (hasTemporaryBranch(user) ? user.temp_branch_id ?? null : user.branch_id ?? user.branch?.id ?? null);

export const getEffectiveBranchName = (user: UserItem): string =>
  hasTemporaryBranch(user)
    ? user.temp_branch?.name ?? `Sucursal #${user.temp_branch_id}`
    : user.branch?.name ?? "Sin sucursal";
