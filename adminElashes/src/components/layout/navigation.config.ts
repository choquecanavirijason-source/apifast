import { useMemo } from "react";
import type { ComponentType } from "react";
import { useLocation } from "react-router-dom";
import {
  Bot,
  Briefcase,
  Building2,
  CalendarDays,
  ClipboardCheck,
  Clock,
  Cpu,
  DoorOpen,
  Eye,
  FileSpreadsheet,
  History,
  Layers,
  LayoutDashboard,
  Maximize2,
  Package,
  Palette,
  Percent,
  PlusCircle,
  ReceiptText,
  Settings,
  ShieldCheck,
  Sparkles,
  Ticket,
  UserCheck,
  Users,
  Wand2,
} from "lucide-react";
import useAuth from "@/core/hooks/useAuth";

/** Menú principal del panel. Lo usan la barra superior, la barra lateral y el menú móvil. */


export type PermissionRule = string | string[];

export type NavigationChild = {
  label: string;
  description: string;
  path: string;
  icon: ComponentType<{ className?: string }>;
  exact?: boolean;
  permission?: PermissionRule;
};

export type NavigationGroup = {
  label: string;
  /** Sección a la que pertenece en la barra lateral (ej. "Operación"). */
  section: string;
  path?: string;
  icon: ComponentType<{ className?: string }>;
  exact?: boolean;
  permission?: PermissionRule;
  children?: NavigationChild[];
};

const NAVIGATION_GROUPS: NavigationGroup[] = [
  {
    label: "Visión general",
    section: "Principal",
    path: "/",
    exact: true,
    icon: LayoutDashboard,
    permission: "dashboard:view",
  },
  {
    label: "Agenda",
    section: "Operación",
    // Agenda única (Día / Semana / Mes / Año). La antigua "Vista semanal de citas" redirige aquí.
    path: "/admin/calendar/agenda",
    icon: CalendarDays,
    permission: ["appointments:view", "appointments:manage"],
  },
  {
    label: "Atención",
    section: "Operación",
    icon: Sparkles,
    permission: [
      "clients:view",
      "clients:manage",
      "payments:view",
      "payments:manage",
      "services:view",
      "services:manage",
      "appointments:view",
    ],
    children: [
      {
        label: "Control de servicios",
        description: "Turnos y estados de atención",
        path: "/admin/services/queue",
        icon: Clock,
        permission: ["services:view", "services:manage"],
      },
      {
        label: "Tickets",
        description: "Servicios activos y cobros",
        path: "/admin/tickets",
        icon: Ticket,
        permission: [
          "payments:view",
          "payments:manage",
          "appointments:view",
          "appointments:manage",
        ],
      },
      {
        label: "Clientes",
        description: "Base, historial y frecuencia",
        path: "/clients",
        icon: Users,
        permission: ["clients:view", "clients:manage"],
      },
    ],
  },
  {
    label: "Ventas y caja",
    section: "Operación",
    icon: ReceiptText,
    permission: ["payments:view", "payments:manage"],
    children: [
      {
        label: "Nueva venta",
        description: "Registrar productos y servicios",
        path: "/admin/pos",
        exact: true,
        icon: PlusCircle,
        permission: ["payments:view", "payments:manage"],
      },
      {
        label: "Historial de ventas",
        description: "Movimientos y comprobantes",
        path: "/admin/pos/history",
        icon: History,
        permission: ["payments:view", "payments:manage"],
      },
      {
        label: "Apertura y cierre",
        description: "Estado de la caja diaria",
        path: "/admin/salons/caja",
        exact: true,
        icon: DoorOpen,
        permission: ["payments:view", "payments:manage"],
      },
      {
        label: "Corte de caja",
        description: "Resumen y conciliación",
        path: "/admin/salons/corte-caja",
        icon: FileSpreadsheet,
        permission: ["payments:view", "payments:manage"],
      },
    ],
  },
  {
    label: "Equipo",
    section: "Operación",
    icon: UserCheck,
    permission: [
      "appointments:view",
      "appointments:manage",
      "payments:view",
      "payments:manage",
    ],
    children: [
      {
        label: "Seguimiento por operaria",
        description: "Servicios y desempeño",
        path: "/admin/professionals/tickets",
        icon: Clock,
        permission: [
          "appointments:view",
          "appointments:manage",
          "payments:view",
          "payments:manage",
        ],
      },
      {
        label: "Comisiones",
        description: "Historial y liquidaciones",
        path: "/admin/professionals/history",
        icon: Percent,
        permission: [
          "appointments:view",
          "appointments:manage",
          "payments:view",
          "payments:manage",
        ],
      },
    ],
  },
  {
    label: "Inventario",
    section: "Catálogo e inventario",
    path: "/admin/products",
    icon: Package,
    permission: ["inventory:view", "inventory:manage"],
  },
  {
    // Lo que se vende: servicios y su organización.
    label: "Servicios",
    section: "Catálogo e inventario",
    icon: Briefcase,
    permission: ["services:view", "services:manage"],
    children: [
      {
        label: "Catálogo",
        description: "Servicios disponibles",
        path: "/admin/services",
        exact: true,
        icon: Briefcase,
        permission: ["services:view", "services:manage"],
      },
      {
        label: "Categorías",
        description: "Organización del catálogo",
        path: "/admin/services/categories",
        icon: Layers,
        permission: ["services:view", "services:manage"],
      },
    ],
  },
  {
    // Todo lo técnico de las pestañas (pedido del cliente: separado del catálogo de servicios).
    label: "Pestañas",
    section: "Catálogo e inventario",
    icon: Palette,
    permission: ["catalog:view", "catalog:manage", "forms:view", "forms:manage"],
    children: [
      {
        label: "Diseño de pestañas",
        description: "Estilos de aplicación",
        path: "/designs",
        icon: Palette,
        permission: ["catalog:view", "catalog:manage"],
      },
      {
        label: "Efectos",
        description: "Acabados disponibles",
        path: "/effects",
        icon: Wand2,
        permission: ["catalog:view", "catalog:manage"],
      },
      {
        label: "Tipo de ojo",
        description: "Clasificación para diseños",
        path: "/eye-types",
        icon: Eye,
        permission: ["catalog:view", "catalog:manage"],
      },
      {
        label: "Volumen",
        description: "Niveles y configuraciones",
        path: "/volumen",
        icon: Maximize2,
        permission: ["catalog:view", "catalog:manage"],
      },
      {
        label: "Tecnología",
        description: "Técnicas y materiales",
        path: "/lash-designs",
        icon: Cpu,
        permission: ["catalog:view", "catalog:manage"],
      },
      {
        label: "Cuestionarios",
        description: "Formularios de consulta",
        path: "/questionnaire",
        icon: ClipboardCheck,
        permission: ["forms:view", "forms:manage"],
      },
    ],
  },
  {
    label: "Administración",
    section: "Administración",
    icon: ShieldCheck,
    permission: [
      "branches:manage",
      "branches:view",
      "users:manage",
      "audit:view",
      "settings:view",
      "ai:view",
      "ai:manage",
    ],
    children: [
      {
        label: "Sucursales",
        description: "Sedes y datos operativos",
        path: "/admin/salons",
        exact: true,
        icon: Building2,
        permission: ["branches:manage", "branches:view"],
      },
      {
        label: "Usuarios",
        description: "Accesos, roles y permisos",
        path: "/users",
        icon: Users,
        permission: "users:manage",
      },
      {
        label: "Auditoría",
        description: "Actividad del sistema",
        path: "/admin/audit-log",
        icon: History,
        permission: "audit:view",
      },
      {
        label: "Ajustes",
        description: "Identidad y preferencias",
        path: "/settings",
        icon: Settings,
        permission: "settings:view",
      },
      {
        label: "Configuración de IA",
        description: "Asistente y automatizaciones",
        path: "/admin/ai",
        icon: Bot,
        permission: ["ai:view", "ai:manage"],
      },
    ],
  },
];

const normalizePermission = (value: unknown) =>
  typeof value === "string" ? value.trim() : "";

export const isRouteActive = (
  pathname: string,
  path: string,
  exact = false,
) => pathname === path || (!exact && path !== "/" && pathname.startsWith(`${path}/`));

/** Grupos del menú filtrados por los permisos del usuario actual. */
export function useNavigationGroups() {
  const { user, hasPermissionByName, isAdmin } = useAuth();
  const roleName = useMemo(() => {
    const roleValue = (user as { role?: unknown; roles?: unknown[] } | null)?.role;
    if (typeof roleValue === "string") return roleValue.toLowerCase();
    if (roleValue && typeof roleValue === "object" && "name" in roleValue) {
      return String((roleValue as { name?: unknown }).name ?? "").toLowerCase();
    }
    const firstRole = (user as { roles?: unknown[] } | null)?.roles?.[0];
    if (typeof firstRole === "string") return firstRole.toLowerCase();
    if (firstRole && typeof firstRole === "object" && "name" in firstRole) {
      return String((firstRole as { name?: unknown }).name ?? "").toLowerCase();
    }
    return "";
  }, [user]);

  const permissionNames = useMemo(() => {
    const names: string[] = [];
    const directPermissions = (user as { permissions?: unknown[] } | null)?.permissions;
    if (Array.isArray(directPermissions)) {
      directPermissions.forEach((permission) => {
        names.push(
          typeof permission === "string"
            ? normalizePermission(permission)
            : normalizePermission((permission as { name?: unknown })?.name),
        );
      });
    }

    const rolePermissions = (
      (user as { role?: { permissions?: unknown[] } } | null)?.role as
        | { permissions?: unknown[] }
        | undefined
    )?.permissions;
    if (Array.isArray(rolePermissions)) {
      rolePermissions.forEach((permission) =>
        names.push(normalizePermission((permission as { name?: unknown })?.name)),
      );
    }

    if (["admin", "superadmin"].includes(roleName.replace(/\s+/g, ""))) {
      names.push(
        "dashboard:view",
        "appointments:view",
        "appointments:manage",
        "clients:view",
        "clients:manage",
        "payments:view",
        "payments:manage",
        "services:view",
        "services:manage",
        "inventory:view",
        "inventory:manage",
        "catalog:view",
        "catalog:manage",
        "forms:view",
        "forms:manage",
        "branches:view",
        "branches:manage",
        "users:manage",
        "audit:view",
        "settings:view",
        "ai:view",
        "ai:manage",
      );
    } else if (roleName === "operaria") {
      names.push(
        "clients:view",
        "clients:manage",
        "services:view",
        "services:manage",
        "appointments:view",
        "appointments:manage",
        "catalog:view",
        "forms:view",
        "tracking:view",
        "tracking:manage",
        "payments:view",
        "branches:view",
      );
    } else if (roleName === "secretaria") {
      names.push(
        "clients:view",
        "clients:manage",
        "payments:view",
        "payments:manage",
        "services:view",
        "services:manage",
        "appointments:view",
        "appointments:manage",
        "inventory:view",
        "users:manage",
      );
    } else if (["encargadaalmacen", "encargada_almacen"].includes(roleName)) {
      names.push("inventory:view", "inventory:manage", "catalog:view");
    }

    return Array.from(new Set(names.filter(Boolean)));
  }, [roleName, user]);

  const hasPermission = (rule?: PermissionRule) => {
    if (!rule || isAdmin()) return true;
    const rules = Array.isArray(rule) ? rule : [rule];
    return rules.some(
      (permission) =>
        hasPermissionByName(permission) || permissionNames.includes(permission),
    );
  };

  const groups = NAVIGATION_GROUPS.flatMap((group): NavigationGroup[] => {
    const children = group.children?.filter((child) => hasPermission(child.permission));
    if (group.children && !children?.length && !hasPermission(group.permission)) return [];
    if (!group.children && !hasPermission(group.permission)) return [];
    return [{ ...group, children }];
  });

  return groups;
}

/** Indica si un grupo (o alguno de sus hijos) corresponde a la ruta actual. */
export function useIsGroupActive() {
  const location = useLocation();
  return (group: NavigationGroup) =>
    group.path
      ? isRouteActive(location.pathname, group.path, group.exact)
      : Boolean(
          group.children?.some((child) =>
            isRouteActive(location.pathname, child.path, child.exact),
          ),
        );
}
