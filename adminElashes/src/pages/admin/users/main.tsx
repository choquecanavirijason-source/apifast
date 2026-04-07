import { useEffect, useMemo, useState } from "react";
import { KeyRound, Plus, Shield, Users as UsersIcon } from "lucide-react";
import { toast } from "react-toastify";

import Layout from "@/components/common/layout";
import api from "@/core/services/api";
import useAuth from "@/core/hooks/useAuth";

import AccessDenied from "./components/AccessDenied";
import EditUserModal from "./components/EditUserModal";
import PermissionsSection from "./components/PermissionsSection";
import RegisterRoleModal from "./components/RegisterRoleModal";
import RegisterUserModal from "./components/RegisterUserModal";
import RolesSection from "./components/RolesSection";
import UsersSection from "./components/UsersSection";
import UsersStats from "./components/UsersStats";
import UsersTabs from "./components/UsersTabs";
import type { BranchItem, PermissionItem, RoleItem, SectionTab, UserItem } from "./types";

export default function UsersMain() {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [roles, setRoles] = useState<RoleItem[]>([]);
  const [branches, setBranches] = useState<BranchItem[]>([]);
  const [permissions, setPermissions] = useState<PermissionItem[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserItem | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCreateUserModalOpen, setIsCreateUserModalOpen] = useState(false);
  const [isCreateRoleModalOpen, setIsCreateRoleModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingRoles, setLoadingRoles] = useState(false);
  const [loadingBranches, setLoadingBranches] = useState(false);
  const [loadingPermissions, setLoadingPermissions] = useState(false);
  const [creatingRole, setCreatingRole] = useState(false);
  const [creatingUser, setCreatingUser] = useState(false);
  const [sectionTab, setSectionTab] = useState<SectionTab>("users");
  const [editUserName, setEditUserName] = useState("");
  const [editUserEmail, setEditUserEmail] = useState("");
  const [editUserPhone, setEditUserPhone] = useState("");
  const [editUserPassword, setEditUserPassword] = useState("");
  const [editUserRoleId, setEditUserRoleId] = useState<number | null>(null);
  const [editUserBranchId, setEditUserBranchId] = useState<number | null>(null);
  const [editUserIsActive, setEditUserIsActive] = useState(true);
  const [updatingUser, setUpdatingUser] = useState(false);

  const { user, roles: authRoles } = useAuth();

  const currentRoleObject =
    user?.role && typeof user.role === "object" ? (user.role as { name?: unknown }) : null;
  const roleName =
    typeof user?.role === "string" ? user.role : currentRoleObject ? String(currentRoleObject.name ?? "") : "";
  const isSuperAdmin = roleName === "SuperAdmin" || authRoles.includes("SuperAdmin");

  const getErrorMessage = (error: unknown, fallback: string) => {
    if (typeof error === "object" && error !== null && "response" in error) {
      const candidate = error as {
        response?: {
          data?:
          | { detail?: string; message?: string }
          | { detail?: Array<{ loc?: Array<string | number>; msg?: string }> };
        };
      };
      const detail = candidate.response?.data?.detail;
      if (Array.isArray(detail) && detail.length > 0) {
        const first = detail[0];
        const field = first.loc?.join(".") ?? "campo";
        const message = first.msg ?? "valor inválido";
        return `${field}: ${message}`;
      }
      if (typeof detail === "string") return detail;
      if (
        candidate.response?.data &&
        "message" in candidate.response.data &&
        typeof candidate.response.data.message === "string"
      ) {
        return candidate.response.data.message;
      }
      return fallback;
    }
    return fallback;
  };

  const normalizeInternationalPhone = (phone?: string | null) => {
    if (!phone) return null;
    const trimmed = phone.trim();
    if (!trimmed) return null;

    const startsWithPlus = trimmed.startsWith("+");
    const digitsOnly = trimmed.replace(/\D/g, "");
    if (!digitsOnly) return null;

    // Backend exige formato internacional +########
    if (startsWithPlus) return `+${digitsOnly}`;
    return `+591${digitsOnly}`;
  };

  const loadUsers = async () => {
    setLoading(true);
    try {
      const response = await api.get("/admin/users");
      setUsers(response.data);
    } catch (error) {
      toast.error(getErrorMessage(error, "Error al cargar usuarios"));
    } finally {
      setLoading(false);
    }
  };

  const loadRoles = async () => {
    setLoadingRoles(true);
    try {
      const response = await api.get("/admin/roles");
      setRoles(response.data);
    } catch (error) {
      toast.error(getErrorMessage(error, "Error al cargar roles"));
    } finally {
      setLoadingRoles(false);
    }
  };

  const loadPermissions = async () => {
    setLoadingPermissions(true);
    try {
      const response = await api.get("/admin/permissions");
      setPermissions(response.data);
    } catch (error) {
      toast.error(getErrorMessage(error, "Error al cargar permisos"));
    } finally {
      setLoadingPermissions(false);
    }
  };

  const loadBranches = async () => {
    setLoadingBranches(true);
    try {
      const response = await api.get("/branches/", {
        params: { skip: 0, limit: 200 },
      });
      setBranches(response.data);
    } catch (error) {
      toast.error(getErrorMessage(error, "Error al cargar sucursales"));
    } finally {
      setLoadingBranches(false);
    }
  };

  useEffect(() => {
    if(!isSuperAdmin) return;
    void loadUsers();
    void loadRoles();
    void loadBranches();
    void loadPermissions();
  }, []);

  const openEditUserModal = (userToEdit: UserItem) => {
    setSelectedUser(userToEdit);
    setEditUserName(userToEdit.username ?? "");
    setEditUserEmail(userToEdit.email ?? "");
    setEditUserPhone(userToEdit.phone ?? "");
    setEditUserPassword("");
    setEditUserRoleId(
      userToEdit.role_id ?? (typeof userToEdit.role === "object" ? userToEdit.role?.id ?? null : null)
    );
    setEditUserBranchId(userToEdit.branch_id ?? userToEdit.branch?.id ?? null);
    setEditUserIsActive(Boolean(userToEdit.is_active));
    setIsModalOpen(true);
  };

  const closeEditModal = () => {
    if (updatingUser) return;
    setIsModalOpen(false);
    setSelectedUser(null);
    setEditUserPassword("");
    setEditUserBranchId(null);
  };

  const handleUpdateUser = async () => {
    if (!selectedUser) return;

    if (!editUserName.trim() || !editUserEmail.trim()) {
      toast.error("Nombre de usuario y correo son obligatorios");
      return;
    }

    if (!editUserRoleId) {
      toast.error("Selecciona un rol válido");
      return;
    }

    setUpdatingUser(true);
    try {
      await api.put(`/admin/users/${selectedUser.id}`, {
        username: editUserName.trim(),
        email: editUserEmail.trim(),
        phone: normalizeInternationalPhone(editUserPhone),
        password: editUserPassword.trim() || undefined,
        role_id: editUserRoleId,
        branch_id: editUserBranchId,
        is_active: editUserIsActive,
      });

      closeEditModal();
      await loadUsers();
      toast.success(`Usuario ${editUserName.trim()} actualizado correctamente`);
    } catch (error) {
      toast.error(getErrorMessage(error, "No se pudo actualizar el usuario"));
    } finally {
      setUpdatingUser(false);
    }
  };

  const handleCreateRole = async (payload: { name: string; permission_ids: number[] }) => {
    if (!payload.name.trim()) {
      toast.error("El nombre del rol es obligatorio");
      return;
    }

    setCreatingRole(true);
    try {
      await api.post("/admin/roles", {
        name: payload.name.trim(),
        permission_ids: payload.permission_ids, 
      });

      toast.success("Rol creado correctamente");
      await loadRoles();
      setIsCreateRoleModalOpen(false);
      setSectionTab("roles");
    } catch (error) {
      toast.error(getErrorMessage(error, "No se pudo crear el rol"));
    } finally {
      setCreatingRole(false);
    }
  };

  const handleCreateUser = async (payload: {
    username: string;
    email: string;
    password: string;
    phone: string | null;
    role_id: number;
    branch_id: number | null;
  }) => {
    if (!payload.username.trim() || !payload.email.trim() || !payload.password.trim()) {
      toast.error("Nombre, correo y contraseña son obligatorios");
      return;
    }

    if (!payload.role_id) {
      toast.error("Selecciona un rol para el usuario");
      return;
    }

    setCreatingUser(true);
    try {
      await api.post("/admin/users", {
        username: payload.username.trim(),
        email: payload.email.trim(),
        password: payload.password.trim(),
        phone: normalizeInternationalPhone(payload.phone),
        role_id: payload.role_id,
        branch_id: payload.branch_id,
      });

      toast.success("Usuario creado correctamente");
      await loadUsers();
      setIsCreateUserModalOpen(false);
      setSectionTab("users");
    } catch (error) {
      toast.error(getErrorMessage(error, "No se pudo crear el usuario"));
    } finally {
      setCreatingUser(false);
    }
  };

  const activeUsers = useMemo(() => users.filter((item) => item.is_active).length, [users]);
  const inactiveUsers = useMemo(() => users.filter((item) => !item.is_active).length, [users]);

  const tabButtons: Array<{ id: SectionTab; label: string; icon: JSX.Element }> = [
    { id: "users", label: "Usuarios", icon: <UsersIcon className="h-4 w-4" /> },
    { id: "roles", label: "Roles", icon: <Shield className="h-4 w-4" /> },
    { id: "permissions", label: "Permisos", icon: <KeyRound className="h-4 w-4" /> },
  ];

  const toolbarAction =
    sectionTab === "users" ? (
      <button
        type="button"
        onClick={() => setIsCreateUserModalOpen(true)}
        className="inline-flex items-center gap-2 rounded-xl bg-[#094732] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#0b5b3f]"
      >
        <Plus className="h-4 w-4" />
        Nuevo usuario
      </button>
    ) : sectionTab === "roles" ? (
      <button
        type="button"
        onClick={() => setIsCreateRoleModalOpen(true)}
        className="inline-flex items-center gap-2 rounded-xl bg-[#094732] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#0b5b3f]"
      >
        <Plus className="h-4 w-4" />
        Nuevo rol
      </button>
    ) : undefined;

  if (!isSuperAdmin) {
    return <AccessDenied />;
  }

  return (
    <Layout
      title="Usuarios, Roles y Permisos"
      subtitle="Administra usuarios del sistema, define roles y organiza permisos por módulo."
      variant="table"
      topContent={
        <UsersStats
          userCount={users.length}
          activeUsers={activeUsers}
          inactiveUsers={inactiveUsers}
          rolesCount={roles.length}
          permissionsCount={permissions.length}
        />
      }
      toolbar={
        <UsersTabs tabs={tabButtons} activeTab={sectionTab} onChange={setSectionTab} right={toolbarAction} />
      }
    >
      {sectionTab === "users" && (
        <UsersSection users={users} loading={loading} onEditUser={openEditUserModal} />
      )}

      {sectionTab === "roles" && <RolesSection roles={roles} loading={loadingRoles} />}

      {sectionTab === "permissions" && <PermissionsSection permissions={permissions} loading={loadingPermissions} />}

      <EditUserModal
        isOpen={isModalOpen}
        selectedUser={selectedUser}
        roles={roles}
        branches={branches}
        editUserName={editUserName}
        editUserEmail={editUserEmail}
        editUserPhone={editUserPhone}
        editUserPassword={editUserPassword}
        editUserRoleId={editUserRoleId}
        editUserBranchId={editUserBranchId}
        editUserIsActive={editUserIsActive}
        updatingUser={updatingUser}
        onClose={closeEditModal}
        onSubmit={handleUpdateUser}
        onNameChange={setEditUserName}
        onEmailChange={setEditUserEmail}
        onPhoneChange={setEditUserPhone}
        onPasswordChange={setEditUserPassword}
        onRoleChange={setEditUserRoleId}
        onBranchChange={setEditUserBranchId}
        onActiveChange={setEditUserIsActive}
      />

      <RegisterUserModal
        isOpen={isCreateUserModalOpen}
        onClose={() => setIsCreateUserModalOpen(false)}
        roles={roles}
        branches={branches}
        isSubmitting={creatingUser || loadingBranches}
        onSubmit={(payload) => void handleCreateUser(payload)}
      />

      <RegisterRoleModal
        isOpen={isCreateRoleModalOpen}
        onClose={() => setIsCreateRoleModalOpen(false)}
        permissions={permissions}
        isSubmitting={creatingRole}
        onSubmit={(payload) => void handleCreateRole(payload)}
      />
    </Layout>
  );
}
