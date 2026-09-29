import { useEffect, useMemo, useRef, useState } from "react";
import type { ComponentType } from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  Bot,
  Briefcase,
  Building2,
  Calendar,
  CalendarCheck,
  CalendarDays,
  ChevronDown,
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
  SlidersHorizontal,
  Sparkles,
  Ticket,
  UserCheck,
  Users,
  Wand2,
} from "lucide-react";
import useAuth from "@/core/hooks/useAuth";

type PermissionRule = string | string[];

type NavigationChild = {
  label: string;
  description: string;
  path: string;
  icon: ComponentType<{ className?: string }>;
  exact?: boolean;
  permission?: PermissionRule;
};

type NavigationGroup = {
  label: string;
  path?: string;
  icon: ComponentType<{ className?: string }>;
  exact?: boolean;
  permission?: PermissionRule;
  children?: NavigationChild[];
};

const NAVIGATION_GROUPS: NavigationGroup[] = [
  {
    label: "Visión general",
    path: "/",
    exact: true,
    icon: LayoutDashboard,
    permission: "dashboard:view",
  },
  {
    label: "Agenda",
    icon: CalendarDays,
    permission: ["appointments:view", "appointments:manage"],
    children: [
      {
        label: "Agenda diaria",
        description: "Citas y atención del día",
        path: "/admin/calendar/agenda",
        icon: CalendarCheck,
        permission: ["appointments:view", "appointments:manage"],
      },
      {
        label: "Vista semanal de citas",
        description: "Planificación del calendario",
        path: "/admin/calendar/citas",
        icon: Calendar,
        permission: ["appointments:view", "appointments:manage"],
      },
    ],
  },
  {
    label: "Atención",
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
        label: "Clientes",
        description: "Base, historial y frecuencia",
        path: "/clients",
        icon: Users,
        permission: ["clients:view", "clients:manage"],
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
        label: "Control de servicios",
        description: "Turnos y estados de atención",
        path: "/admin/services/queue",
        icon: Clock,
        permission: ["services:view", "services:manage"],
      },
    ],
  },
  {
    label: "Ventas y caja",
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
    path: "/admin/products",
    icon: Package,
    permission: ["inventory:view", "inventory:manage"],
  },
  {
    label: "Configuración del servicio",
    icon: SlidersHorizontal,
    permission: [
      "services:view",
      "services:manage",
      "catalog:view",
      "catalog:manage",
      "forms:view",
      "forms:manage",
    ],
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
      {
        label: "Tecnología",
        description: "Técnicas y materiales",
        path: "/lash-designs",
        icon: Cpu,
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
        label: "Diseños",
        description: "Estilos de aplicación",
        path: "/designs",
        icon: Palette,
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

const isRouteActive = (
  pathname: string,
  path: string,
  exact = false,
) => pathname === path || (!exact && path !== "/" && pathname.startsWith(`${path}/`));

export default function HorizontalNavigation() {
  const { user, hasPermissionByName, isAdmin } = useAuth();
  const location = useLocation();
  const navigationRef = useRef<HTMLElement | null>(null);
  const [openGroup, setOpenGroup] = useState<string | null>(null);

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

  const groups = NAVIGATION_GROUPS.map((group) => {
    const children = group.children?.filter((child) => hasPermission(child.permission));
    if (group.children && !children?.length && !hasPermission(group.permission)) return null;
    if (!group.children && !hasPermission(group.permission)) return null;
    return { ...group, children };
  }).filter((group): group is NavigationGroup => Boolean(group));

  useEffect(() => {
    setOpenGroup(null);
  }, [location.pathname]);

  useEffect(() => {
    const closeOutside = (event: MouseEvent) => {
      if (
        navigationRef.current &&
        !navigationRef.current.contains(event.target as Node)
      ) {
        setOpenGroup(null);
      }
    };
    const closeWithEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpenGroup(null);
    };
    document.addEventListener("mousedown", closeOutside);
    document.addEventListener("keydown", closeWithEscape);
    return () => {
      document.removeEventListener("mousedown", closeOutside);
      document.removeEventListener("keydown", closeWithEscape);
    };
  }, []);

  return (
    <nav
      ref={navigationRef}
      aria-label="Navegación principal"
      className="relative z-[70] h-14 shrink-0 border-t border-white/8 border-b border-black/15 bg-linear-to-r from-[#094732] via-[#0a5038] to-[#063d2b] px-2 shadow-[0_7px_22px_rgba(3,38,26,0.2)] sm:px-4"
    >
      <div className="flex h-full items-center gap-1 overflow-x-auto overscroll-x-contain [scrollbar-width:none] xl:overflow-visible [&::-webkit-scrollbar]:hidden">
        {groups.map((group) => {
          const GroupIcon = group.icon;
          const active = group.path
            ? isRouteActive(location.pathname, group.path, group.exact)
            : Boolean(
                group.children?.some((child) =>
                  isRouteActive(location.pathname, child.path, child.exact),
                ),
              );
          const open = openGroup === group.label;

          if (group.path) {
            return (
              <NavLink
                key={group.label}
                to={group.path}
                end={group.exact}
                className={`relative inline-flex h-10 shrink-0 items-center gap-2 rounded-lg px-3 text-[12px] font-semibold transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[#094732]/30 ${
                  active
                    ? "bg-white/14 text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.16)]"
                    : "text-emerald-50/72 hover:bg-white/9 hover:text-white"
                }`}
              >
                <GroupIcon className="h-4 w-4" />
                <span>{group.label}</span>
                {active && (
                  <span className="absolute inset-x-3 -bottom-[7px] h-0.5 rounded-full bg-[#9F8351]" />
                )}
              </NavLink>
            );
          }

          return (
            <div key={group.label} className="relative shrink-0">
              <button
                type="button"
                onClick={() => setOpenGroup((current) => (current === group.label ? null : group.label))}
                aria-expanded={open}
                aria-haspopup="menu"
                className={`relative inline-flex h-10 items-center gap-2 rounded-lg px-3 text-[12px] font-semibold transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[#094732]/30 ${
                  active || open
                    ? "bg-white/14 text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.16)]"
                    : "text-emerald-50/72 hover:bg-white/9 hover:text-white"
                }`}
              >
                <GroupIcon className="h-4 w-4" />
                <span>{group.label}</span>
                <ChevronDown
                  className={`h-3.5 w-3.5 transition-transform duration-150 ${open ? "rotate-180" : ""}`}
                />
                {active && (
                  <span className="absolute inset-x-3 -bottom-[7px] h-0.5 rounded-full bg-[#9F8351]" />
                )}
              </button>

              {open && group.children && (
                <div
                  role="menu"
                  aria-label={group.label}
                  className="fixed left-3 right-3 top-[6.75rem] z-[90] rounded-xl border border-[#094732]/12 bg-white/98 p-1.5 shadow-[0_18px_50px_rgba(9,40,29,0.18)] backdrop-blur-xl xl:absolute xl:left-0 xl:right-auto xl:top-[calc(100%+10px)] xl:w-80"
                >
                  <div className="mb-1 px-2.5 pb-1.5 pt-1">
                    <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#9F8351]">
                      {group.label}
                    </p>
                  </div>
                  {group.children.map((child) => {
                    const ChildIcon = child.icon;
                    const childActive = isRouteActive(
                      location.pathname,
                      child.path,
                      child.exact,
                    );
                    return (
                      <NavLink
                        key={child.path}
                        to={child.path}
                        end={child.exact}
                        role="menuitem"
                        onClick={() => setOpenGroup(null)}
                        className={`group/item relative flex items-center gap-3 rounded-lg px-2.5 py-2.5 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#094732]/25 ${
                          childActive
                            ? "bg-[#edf6f1] text-[#094732]"
                            : "text-[#313833] hover:bg-[#094732]/5"
                        }`}
                      >
                        {childActive && (
                          <span className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-[#9F8351]" />
                        )}
                        <span
                          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${
                            childActive
                              ? "border-[#094732]/15 bg-white text-[#094732]"
                              : "border-black/6 bg-[#f7f8f7] text-[#6b746e] group-hover/item:text-[#094732]"
                          }`}
                        >
                          <ChildIcon className="h-4 w-4" />
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-[12px] font-semibold">
                            {child.label}
                          </span>
                          <span className="mt-0.5 block truncate text-[10.5px] font-medium text-[#7c857f]">
                            {child.description}
                          </span>
                        </span>
                      </NavLink>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </nav>
  );
}
