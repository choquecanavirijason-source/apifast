import { useEffect, useMemo, useState, type ReactElement } from "react";
import { FileDown, KeyRound, Plus, Shield, Users as UsersIcon } from "lucide-react";
import { generateTablePdf } from "@/core/utils/generateTablePdf";
import { getRoleName } from "./types";
import { toast } from "react-toastify";

import Layout from "@/components/common/layout";
import api from "@/core/services/api";
import useAuth from "@/core/hooks/useAuth";
import { BRANCH_STORAGE_KEY, getSelectedBranchId } from "@/core/utils/branch";

import AccessDenied from "./components/AccessDenied";
import EditRoleModal from "./components/EditRoleModal";
import EditUserModal from "./components/EditUserModal";
import PermissionsSection from "./components/PermissionsSection";
import RegisterRoleModal from "./components/RegisterRoleModal";
import RegisterUserModal from "./components/RegisterUserModal";
import RolesSection from "./components/RolesSection";
import SkillLevelModal from "./components/SkillLevelModal";
import UsersSection from "./components/UsersSection";
import BranchAssignModal from "./components/BranchAssignModal";
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
  const [isEditRoleModalOpen, setIsEditRoleModalOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState<RoleItem | null>(null);
  const [editingRole, setEditingRole] = useState(false);
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
  const [editUserSkillLevel, setEditUserSkillLevel] = useState<number | null>(null);
  const [editUserDirectPermissionIds, setEditUserDirectPermissionIds] = useState<number[]>([]);
  const [updatingUser, setUpdatingUser] = useState(false);
  const [isSkillLevelModalOpen, setIsSkillLevelModalOpen] = useState(false);
  const [selectedUserForSkill, setSelectedUserForSkill] = useState<UserItem | null>(null);
  const [submittingSkillLevel, setSubmittingSkillLevel] = useState(false);
  const [branchAssignUser, setBranchAssignUser] = useState<UserItem | null>(null);
  const [activeBranchId, setActiveBranchId] = useState<number | null>(() => getSelectedBranchId());

  const { user, roles: authRoles } = useAuth();

  const currentRoleObject =
    user?.role && typeof user.role === "object" ? (user.role as { name?: unknown }) : null;
  const roleName =
    typeof user?.role === "string" ? user.role : currentRoleObject ? String(currentRoleObject.name ?? "") : "";
  const isSuperAdmin = roleName === "SuperAdmin" || authRoles.includes("SuperAdmin");
  const isAdmin = roleName === "Admin" || authRoles.includes("Admin");
  const isSecretary = roleName === "Secretaria" || authRoles.includes("Secretaria");
  const canManageUsers = isSuperAdmin || isAdmin;

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
      const pageSize = 100;
      const allUsers: UserItem[] = [];
      let skip = 0;

      while (true) {
        const response = await api.get<UserItem[]>("/admin/users", {
          params: { skip, limit: pageSize },
        });
        const batch = Array.isArray(response.data) ? response.data : [];
        allUsers.push(...batch);
        if (batch.length < pageSize) break;
        skip += pageSize;
      }

      setUsers(allUsers);
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
    if (!canManageUsers && !isSecretary) return;
    void loadUsers();
    void loadBranches();
    if (isSuperAdmin) {
      void loadRoles();
      void loadPermissions();
    } else if (isSecretary) {
      void loadRoles();
    }
  }, [canManageUsers, isSecretary, isSuperAdmin]);

  useEffect(() => {
    const handleBranchChange = () => setActiveBranchId(getSelectedBranchId());
    const handleStorage = (event: StorageEvent) => {
      if (event.key === BRANCH_STORAGE_KEY) handleBranchChange();
    };
    window.addEventListener("storage", handleStorage);
    window.addEventListener("branchchange", handleBranchChange);
    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("branchchange", handleBranchChange);
    };
  }, []);

  const filteredUsers = useMemo(() => {
    if (!activeBranchId) return users;
    // si el ID guardado ya no existe en la DB, no filtramos (evita lista vacía tras re-seed)
    const branchExists = branches.some((b) => b.id === activeBranchId);
    if (!branchExists) return users;
    return users.filter((item) => {
      const branchId = item.branch_id ?? item.branch?.id ?? null;
      // mostrar usuarios de la sucursal seleccionada O sin sucursal asignada
      return branchId === null || Number(branchId) === activeBranchId;
    });
  }, [users, activeBranchId, branches]);

  const activeBranchName = useMemo(() => {
    if (!activeBranchId) return "Todas las sucursales";
    return branches.find((branch) => branch.id === activeBranchId)?.name ?? `Sucursal #${activeBranchId}`;
  }, [activeBranchId, branches]);

  const displayedUsers = useMemo(() => {
    if (!isSecretary) return filteredUsers;
    return filteredUsers.filter((u) => {
      const role = typeof u.role === "object" ? u.role?.name : u.role;
      return role === "Operaria";
    });
  }, [filteredUsers, isSecretary]);

  const openSkillLevelModal = (userToEdit: UserItem) => {
    setSelectedUserForSkill(userToEdit);
    setIsSkillLevelModalOpen(true);
  };

  const handleUpdateSkillLevel = async (userId: number, level: number | null, branchId: number | null, phone: string | null) => {
    setSubmittingSkillLevel(true);
    try {
      await api.patch(`/admin/users/${userId}/skill-level`, { skill_level: level, branch_id: branchId, phone });
      setIsSkillLevelModalOpen(false);
      setSelectedUserForSkill(null);
      await loadUsers();
      toast.success("Operaria actualizada correctamente");
    } catch (error) {
      toast.error(getErrorMessage(error, "No se pudo actualizar la operaria"));
    } finally {
      setSubmittingSkillLevel(false);
    }
  };

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
    setEditUserSkillLevel(userToEdit.skill_level ?? null);
    setEditUserDirectPermissionIds((userToEdit.direct_permissions ?? []).map((p) => p.id));
    setIsModalOpen(true);
  };

  const closeEditModal = () => {
    if (updatingUser) return;
    setIsModalOpen(false);
    setSelectedUser(null);
    setEditUserName("");
    setEditUserEmail("");
    setEditUserPhone("");
    setEditUserPassword("");
    setEditUserRoleId(null);
    setEditUserBranchId(null);
    setEditUserIsActive(true);
    setEditUserSkillLevel(null);
    setEditUserDirectPermissionIds([]);
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
        skill_level: editUserSkillLevel,
        permission_ids: editUserDirectPermissionIds,
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

  const handleEditRole = async (roleId: number, payload: { name: string; permission_ids: number[] }) => {
    setEditingRole(true);
    try {
      await api.put(`/admin/roles/${roleId}`, payload);
      toast.success("Rol actualizado correctamente");
      await loadRoles();
      setIsEditRoleModalOpen(false);
      setSelectedRole(null);
    } catch (error) {
      toast.error(getErrorMessage(error, "No se pudo actualizar el rol"));
    } finally {
      setEditingRole(false);
    }
  };

  const handleDeleteRole = async (role: RoleItem) => {
    if (!window.confirm(`¿Eliminar el rol "${role.name}"? Esta acción no se puede deshacer.`)) return;
    try {
      await api.delete(`/admin/roles/${role.id}`);
      await loadRoles();
      toast.success(`Rol "${role.name}" eliminado`);
    } catch (error) {
      toast.error(getErrorMessage(error, "No se pudo eliminar el rol"));
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

  const handleDeleteUser = async (userToDelete: UserItem) => {
    if (!window.confirm(`¿Eliminar usuario "${userToDelete.username}"? Esta acción no se puede deshacer.`)) return;
    try {
      await api.delete(`/admin/users/${userToDelete.id}`);
      await loadUsers();
      toast.success(`Usuario ${userToDelete.username} eliminado`);
    } catch (error) {
      toast.error(getErrorMessage(error, "No se pudo eliminar el usuario"));
    }
  };

  const activeUsers = useMemo(() => displayedUsers.filter((item) => item.is_active).length, [displayedUsers]);
  const inactiveUsers = useMemo(() => displayedUsers.filter((item) => !item.is_active).length, [displayedUsers]);

  const tabButtons: Array<{ id: SectionTab; label: string; icon: ReactElement }> = [
    { id: "users", label: isSecretary ? "Operarias" : "Usuarios", icon: <UsersIcon className="h-4 w-4" /> },
    ...(isSuperAdmin ? [
      { id: "roles" as SectionTab, label: "Roles", icon: <Shield className="h-4 w-4" /> },
      { id: "permissions" as SectionTab, label: "Permisos", icon: <KeyRound className="h-4 w-4" /> },
    ] : []),
  ];

  const handleExportUsersPdf = () => {
    void generateTablePdf({
      title: "Listado de Usuarios",
      subtitle: "Usuarios registrados en el sistema",
      filename: "usuarios",
      orientation: "landscape",
      meta: [
        { label: "Sucursal", value: activeBranchName },
        { label: "Total", value: String(displayedUsers.length) },
      ],
      columns: [
        { key: "id", header: "ID" },
        { key: "username", header: "Usuario" },
        { key: "email", header: "Correo" },
        { key: "phone", header: "Teléfono" },
        { key: "role", header: "Rol" },
        { key: "branch", header: "Sucursal" },
        { key: "status", header: "Estado" },
        { key: "created_at", header: "Creado" },
      ],
      rows: displayedUsers.map((u) => ({
        id: u.id,
        username: u.username,
        email: u.email,
        phone: u.phone ?? "—",
        role: getRoleName(u.role),
        branch: u.branch?.name ?? "—",
        status: u.is_active ? "Activo" : "Inactivo",
        created_at: u.created_at ? new Date(u.created_at).toLocaleDateString("es-BO") : "—",
      })),
    });
  };

  const toolbarAction =
    sectionTab === "users" ? (
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleExportUsersPdf}
          title="Descargar reporte PDF"
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600 shadow-sm transition hover:bg-slate-50"
        >
          <FileDown className="h-4 w-4" />
          PDF
        </button>
        <button
          type="button"
          onClick={() => setIsCreateUserModalOpen(true)}
          className="inline-flex items-center gap-2 rounded-xl bg-[#094732] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#0b5b3f]"
        >
          <Plus className="h-4 w-4" />
          {isSecretary ? "Nueva operaria" : "Nuevo usuario"}
        </button>
      </div>
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

  if (!canManageUsers && !isSecretary) {
    return <AccessDenied />;
  }

  return (
    <Layout
      title={isSecretary ? "Operarias" : "Usuarios, Roles y Permisos"}
      subtitle={isSecretary ? `Gestiona el nivel de experiencia de las operarias. Sucursal: ${activeBranchName}.` : `Administra usuarios del sistema, define roles y organiza permisos por módulo. Vista filtrada: ${activeBranchName}.`}
      variant="table"
      topContent={
        <UsersStats
          userCount={displayedUsers.length}
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
        <UsersSection
          users={displayedUsers}
          loading={loading}
          onEditUser={isSecretary ? openSkillLevelModal : openEditUserModal}
          onDeleteUser={(isSuperAdmin || isSecretary) ? handleDeleteUser : undefined}
          onAssignBranch={(isSuperAdmin || isAdmin || isSecretary) ? setBranchAssignUser : undefined}
        />
      )}

      {sectionTab === "roles" && (
        <RolesSection
          roles={roles}
          loading={loadingRoles}
          onEditRole={(role) => { setSelectedRole(role); setIsEditRoleModalOpen(true); }}
          onDeleteRole={(role) => void handleDeleteRole(role)}
        />
      )}

      {sectionTab === "permissions" && <PermissionsSection permissions={permissions} loading={loadingPermissions} />}

      <EditUserModal
        isOpen={isModalOpen}
        selectedUser={selectedUser}
        roles={roles}
        branches={activeBranchId ? branches.filter((b) => b.id === activeBranchId) : branches}
        permissions={permissions}
        editUserName={editUserName}
        editUserEmail={editUserEmail}
        editUserPhone={editUserPhone}
        editUserPassword={editUserPassword}
        editUserRoleId={editUserRoleId}
        editUserBranchId={editUserBranchId}
        editUserIsActive={editUserIsActive}
        editUserSkillLevel={editUserSkillLevel}
        editUserDirectPermissionIds={editUserDirectPermissionIds}
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
        onSkillLevelChange={setEditUserSkillLevel}
        onDirectPermissionIdsChange={setEditUserDirectPermissionIds}
      />

      <RegisterUserModal
        isOpen={isCreateUserModalOpen}
        onClose={() => setIsCreateUserModalOpen(false)}
        roles={isSecretary ? roles.filter((r) => r.name === "Operaria") : roles}
        branches={activeBranchId ? branches.filter((b) => b.id === activeBranchId) : branches}
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

      <EditRoleModal
        isOpen={isEditRoleModalOpen}
        onClose={() => { setIsEditRoleModalOpen(false); setSelectedRole(null); }}
        role={selectedRole}
        permissions={permissions}
        isSubmitting={editingRole}
        onSubmit={(roleId, payload) => void handleEditRole(roleId, payload)}
      />

      <SkillLevelModal
        isOpen={isSkillLevelModalOpen}
        user={selectedUserForSkill}
        branches={branches}
        onClose={() => { if (!submittingSkillLevel) { setIsSkillLevelModalOpen(false); setSelectedUserForSkill(null); } }}
        onSubmit={handleUpdateSkillLevel}
        submitting={submittingSkillLevel}
      />

      {branchAssignUser && (
        <BranchAssignModal
          user={branchAssignUser}
          branches={activeBranchId ? branches.filter((b) => b.id === activeBranchId) : branches}
          onClose={() => setBranchAssignUser(null)}
          onSuccess={(updated) => {
            setUsers((prev) => prev.map((u) => (u.id === updated.id ? { ...u, ...updated } : u)));
            setBranchAssignUser(null);
          }}
        />
      )}
    </Layout>
  );
}
