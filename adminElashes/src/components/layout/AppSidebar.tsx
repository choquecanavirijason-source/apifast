import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { NavLink, useLocation } from "react-router-dom";
import useAuth from "../../core/hooks/useAuth";
import { useLogo } from "../../core/hooks/useLogo";
import {
  LayoutDashboard,
  CalendarDays,
  CalendarCheck,
  Calendar,
  Sparkles,
  Users,
  Ticket,
  Clock,
  ReceiptText,
  PlusCircle,
  History,
  DoorOpen,
  FileSpreadsheet,
  UserCheck,
  Percent,
  Package,
  SlidersHorizontal,
  Briefcase,
  Layers,
  Cpu,
  Wand2,
  Eye,
  Maximize2,
  Palette,
  ClipboardCheck,
  ShieldCheck,
  Building2,
  Settings,
  Bot,
  ChevronDown,
  PanelLeftClose,
  PanelLeftOpen,
  X,
} from "lucide-react";

type PermissionRule = string | string[];

type MenuSubItem = {
  name: string;
  path: string;
  icon?: ReactNode;
  exact?: boolean;
  permission?: PermissionRule;
};

type MenuItem = {
  name: string;
  icon: ReactNode;
  path?: string;
  exact?: boolean;
  permission?: PermissionRule;
  subItems?: MenuSubItem[];
};

interface AppSidebarProps {
  collapsed: boolean;
  setCollapsed?: (val?: boolean) => void;
  mobileOpen?: boolean;
  setMobileOpen?: (val: boolean) => void;
}

function uniq(arr: string[]) {
  return Array.from(new Set(arr.filter(Boolean)));
}

function normalizePerm(name: unknown): string | null {
  if (typeof name !== "string") return null;
  return name.trim();
}

function submenuRegionId(menuName: string) {
  return `sidebar-submenu-${menuName.replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "")}`;
}

/** Anillo de foco visible accesible */
const navFocusRing =
  "focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/90 focus-visible:ring-offset-2 focus-visible:ring-offset-[#094732]";

export default function AppSidebar({
  collapsed,
  setCollapsed,
  mobileOpen = false,
  setMobileOpen,
}: AppSidebarProps) {
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const { logoBase64 } = useLogo();
  const lastSyncedPathRef = useRef<string | null>(null);
  const lastCollapsedRef = useRef<boolean>(collapsed);
  const asideRef = useRef<HTMLElement | null>(null);
  const navRef = useRef<HTMLElement | null>(null);
  const flyoutRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const expandedSubmenuRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const { user, hasPermissionByName, isAdmin, hasRole } = useAuth();
  const location = useLocation();

  const displayRole = useMemo(() => {
    if (!user) return null;

    const roleValue = (user as { role?: unknown; roles?: unknown[] }).role;

    if (typeof roleValue === "string") return roleValue;

    if (roleValue && typeof roleValue === "object" && "name" in (roleValue as Record<string, unknown>)) {
      const roleName = (roleValue as { name?: unknown }).name;
      if (typeof roleName === "string") return roleName;
    }

    const firstRole = (user as { roles?: unknown[] }).roles?.[0];
    if (typeof firstRole === "string") return firstRole;
    if (firstRole && typeof firstRole === "object" && "name" in (firstRole as Record<string, unknown>)) {
      const roleName = (firstRole as { name?: unknown }).name;
      if (typeof roleName === "string") return roleName;
    }

    return null;
  }, [user]);

  /**
   * Permisos resueltos para el usuario:
   * 1) user.permissions
   * 2) user.role.permissions
   * 3) Fallback por rol
   */
  const permissionNamesFromUser = useMemo(() => {
    if (!user) return [];

    const perms: string[] = [];

    // a) user.permissions
    const directPerms = (user as any)?.permissions;
    if (Array.isArray(directPerms)) {
      for (const p of directPerms) {
        if (typeof p === "string") perms.push(p);
        else perms.push(normalizePerm(p?.name) ?? "");
      }
    }

    // b) user.role.permissions
    const roleObj = (user as any)?.role;
    const rolePerms = roleObj?.permissions;
    if (Array.isArray(rolePerms)) {
      for (const p of rolePerms) perms.push(normalizePerm(p?.name) ?? "");
    }

    // c) fallback por rol
    const roleName = (displayRole || "").toLowerCase();

    if (roleName === "superadmin" || roleName === "admin") {
      perms.push(
        "dashboard:view",
        "ai:view",
        "ai:manage",
        "settings:view",
        "users:manage",
        "branches:manage",
        "branches:view",
        "audit:view",
        "inventory:view",
        "inventory:manage",
        "catalog:view",
        "catalog:manage",
        "services:view",
        "services:manage",
        "clients:view",
        "clients:manage",
        "appointments:view",
        "appointments:manage",
        "payments:view",
        "payments:manage",
        "forms:view",
        "forms:manage",
        "tracking:view",
        "tracking:manage"
      );
    }

    if (perms.length === 0) {
      if (roleName === "operaria") {
        perms.push(
          "clients:view",
          "clients:manage",
          "tracking:view",
          "tracking:manage",
          "forms:view",
          "catalog:view",
          "services:view",
          "services:manage",
          "appointments:view",
          "appointments:manage",
          "payments:view",
          "branches:view"
        );
      } else if (roleName === "secretaria") {
        perms.push(
          "clients:view",
          "clients:manage",
          "tracking:view",
          "forms:view",
          "payments:view",
          "payments:manage",
          "services:view",
          "services:manage",
          "appointments:view",
          "appointments:manage",
          "inventory:view",
          "users:manage"
        );
      } else if (roleName === "encargadaalmacen" || roleName === "encargada_almacen") {
        perms.push("inventory:view", "inventory:manage", "catalog:view");
      }
    }

    return uniq(perms);
  }, [user, displayRole]);

  const hasMenuPermission = (rule?: PermissionRule) => {
    if (!rule) return true;
    if (isAdmin()) return true;

    const rules = Array.isArray(rule) ? rule : [rule];

    return rules.some((permission) => {
      if (hasPermissionByName(permission)) return true;
      return permissionNamesFromUser.includes(permission);
    });
  };

  /**
   * Estructura de navegación solicitada:
   * 1. Visión general: resumen del negocio
   * 2. Agenda: agenda diaria y vista semanal de citas
   * 3. Atención: clientes, tickets y control de servicios
   * 4. Ventas y caja: nueva venta, historial de ventas, apertura y cierre, corte de caja
   * 5. Equipo: seguimiento por operaria y comisiones
   * 6. Inventario
   * 7. Configuración del servicio: catálogo, categorías, tecnología, efectos, tipo de ojo, volumen, diseños y cuestionarios
   * 8. Administración: sucursales, usuarios, auditoría, ajustes y configuración de IA
   */
  const menuItems = useMemo<MenuItem[]>(
    () => [
      {
        name: "Visión general",
        icon: <LayoutDashboard size={19} />,
        path: "/",
        exact: true,
        permission: "dashboard:view",
        subItems: [
          {
            name: "Resumen del negocio",
            path: "/",
            exact: true,
            icon: <LayoutDashboard size={15} />,
            permission: "dashboard:view",
          },
        ],
      },

      {
        name: "Agenda",
        icon: <CalendarDays size={19} />,
        path: "/admin/calendar",
        permission: ["appointments:view", "appointments:manage"],
        subItems: [
          {
            name: "Agenda diaria",
            path: "/admin/calendar/agenda",
            icon: <CalendarCheck size={15} />,
            permission: ["appointments:view", "appointments:manage"],
          },
          {
            name: "Vista semanal de citas",
            path: "/admin/calendar/citas",
            icon: <Calendar size={15} />,
            permission: ["appointments:view", "appointments:manage"],
          },
        ],
      },

      {
        name: "Atención",
        icon: <Sparkles size={19} />,
        path: "/clients",
        permission: [
          "clients:view",
          "clients:manage",
          "payments:view",
          "payments:manage",
          "services:view",
          "services:manage",
          "appointments:view",
        ],
        subItems: [
          {
            name: "Clientes",
            path: "/clients",
            icon: <Users size={15} />,
            permission: ["clients:view", "clients:manage"],
          },
          {
            name: "Tickets",
            path: "/admin/tickets",
            icon: <Ticket size={15} />,
            permission: ["payments:view", "payments:manage", "appointments:view", "appointments:manage"],
          },
          {
            name: "Control de servicios",
            path: "/admin/services/queue",
            icon: <Clock size={15} />,
            permission: ["services:view", "services:manage"],
          },
        ],
      },

      {
        name: "Ventas y caja",
        icon: <ReceiptText size={19} />,
        path: "/admin/pos",
        permission: ["payments:view", "payments:manage"],
        subItems: [
          {
            name: "Nueva venta",
            path: "/admin/pos",
            exact: true,
            icon: <PlusCircle size={15} />,
            permission: ["payments:view", "payments:manage"],
          },
          {
            name: "Historial de ventas",
            path: "/admin/pos/history",
            icon: <History size={15} />,
            permission: ["payments:view", "payments:manage"],
          },
          {
            name: "Apertura y cierre",
            path: "/admin/salons/caja",
            exact: true,
            icon: <DoorOpen size={15} />,
            permission: ["payments:view", "payments:manage"],
          },
          {
            name: "Corte de caja",
            path: "/admin/salons/corte-caja",
            icon: <FileSpreadsheet size={15} />,
            permission: ["payments:view", "payments:manage"],
          },
        ],
      },

      {
        name: "Equipo",
        icon: <UserCheck size={19} />,
        path: "/admin/professionals",
        permission: ["appointments:view", "appointments:manage", "payments:view", "payments:manage"],
        subItems: [
          {
            name: "Seguimiento por operaria",
            path: "/admin/professionals/tickets",
            icon: <Clock size={15} />,
            permission: ["appointments:view", "appointments:manage", "payments:view", "payments:manage"],
          },
          {
            name: "Comisiones",
            path: "/admin/professionals/history",
            icon: <Percent size={15} />,
            permission: ["appointments:view", "appointments:manage", "payments:view", "payments:manage"],
          },
        ],
      },

      {
        name: "Inventario",
        icon: <Package size={19} />,
        path: "/admin/products",
        permission: ["inventory:view", "inventory:manage"],
      },

      {
        name: "Configuración del servicio",
        icon: <SlidersHorizontal size={19} />,
        path: "/admin/services",
        permission: [
          "services:view",
          "services:manage",
          "catalog:view",
          "catalog:manage",
          "forms:view",
          "forms:manage",
        ],
        subItems: [
          {
            name: "Catálogo",
            path: "/admin/services",
            exact: true,
            icon: <Briefcase size={15} />,
            permission: ["services:view", "services:manage"],
          },
          {
            name: "Categorías",
            path: "/admin/services/categories",
            icon: <Layers size={15} />,
            permission: ["services:view", "services:manage"],
          },
          {
            name: "Tecnología",
            path: "/lash-designs",
            icon: <Cpu size={15} />,
            permission: ["catalog:view", "catalog:manage"],
          },
          {
            name: "Efectos",
            path: "/effects",
            icon: <Wand2 size={15} />,
            permission: ["catalog:view", "catalog:manage"],
          },
          {
            name: "Tipo de ojo",
            path: "/eye-types",
            icon: <Eye size={15} />,
            permission: ["catalog:view", "catalog:manage"],
          },
          {
            name: "Volumen",
            path: "/volumen",
            icon: <Maximize2 size={15} />,
            permission: ["catalog:view", "catalog:manage"],
          },
          {
            name: "Diseños",
            path: "/designs",
            icon: <Palette size={15} />,
            permission: ["catalog:view", "catalog:manage"],
          },
          {
            name: "Cuestionarios",
            path: "/questionnaire",
            icon: <ClipboardCheck size={15} />,
            permission: ["forms:view", "forms:manage"],
          },
        ],
      },

      {
        name: "Administración",
        icon: <ShieldCheck size={19} />,
        path: "/admin/salons",
        permission: [
          "branches:manage",
          "branches:view",
          "users:manage",
          "audit:view",
          "settings:view",
          "ai:view",
          "ai:manage",
        ],
        subItems: [
          {
            name: "Sucursales",
            path: "/admin/salons",
            exact: true,
            icon: <Building2 size={15} />,
            permission: ["branches:manage", "branches:view"],
          },
          {
            name: "Usuarios",
            path: "/users",
            icon: <Users size={15} />,
            permission: "users:manage",
          },
          {
            name: "Auditoría",
            path: "/admin/audit-log",
            icon: <History size={15} />,
            permission: "audit:view",
          },
          {
            name: "Ajustes",
            path: "/settings",
            icon: <Settings size={15} />,
            permission: "settings:view",
          },
          {
            name: "Configuración de IA",
            path: "/admin/ai",
            icon: <Bot size={15} />,
            permission: ["ai:view", "ai:manage"],
          },
        ],
      },
    ],
    []
  );

  // Menú filtrado por permisos
  const authorizedMenu = useMemo(() => {
    return menuItems
      .map((item) => {
        if (!item.subItems) {
          return hasMenuPermission(item.permission) ? item : null;
        }

        const visibleSubItems = item.subItems.filter((subItem) => hasMenuPermission(subItem.permission));
        if (!visibleSubItems.length && !hasMenuPermission(item.permission)) return null;

        return { ...item, subItems: visibleSubItems };
      })
      .filter((item): item is MenuItem => Boolean(item));
  }, [menuItems, isAdmin, hasRole, hasPermissionByName, permissionNamesFromUser]);

  // Determina si una subopción está activa
  const isSubItemActive = (sub: MenuSubItem) => {
    if (sub.exact) return location.pathname === sub.path;
    return location.pathname === sub.path || (sub.path !== "/" && location.pathname.startsWith(sub.path));
  };

  // Determina si una sección principal está activa
  const isItemActive = (item: MenuItem) => {
    if (item.subItems && item.subItems.length > 0) {
      return item.subItems.some((sub) => isSubItemActive(sub));
    }
    if (!item.path) return false;
    if (item.exact) return location.pathname === item.path;
    return location.pathname === item.path || (item.path !== "/" && location.pathname.startsWith(item.path));
  };

  // Auto-abrir menú correspondiente al cambiar de ruta
  useEffect(() => {
    const becameExpanded = lastCollapsedRef.current && !collapsed;
    lastCollapsedRef.current = collapsed;

    const pathChanged = lastSyncedPathRef.current !== location.pathname;
    if (!pathChanged && !becameExpanded) return;
    lastSyncedPathRef.current = location.pathname;

    const match = authorizedMenu.find((item) => item.subItems && isItemActive(item));

    if (match) {
      setOpenMenu(match.name);
    }
  }, [location.pathname, collapsed, authorizedMenu]);

  // Cerrar flyout al hacer clic fuera en modo colapsado
  useEffect(() => {
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!asideRef.current?.contains(event.target as Node)) {
        if (collapsed) {
          setOpenMenu(null);
        }
      }
    };

    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, [collapsed]);

  useEffect(() => {
    if (collapsed) {
      setOpenMenu(null);
    }
  }, [collapsed]);

  const getSubmenuLinks = (menuName: string) => {
    if (collapsed) {
      const flyout = flyoutRefs.current[menuName];
      if (!flyout) return [];
      return Array.from(flyout.querySelectorAll<HTMLAnchorElement>("a"));
    }
    const container = expandedSubmenuRefs.current[menuName];
    if (!container) return [];
    return Array.from(container.querySelectorAll<HTMLAnchorElement>("a"));
  };

  const focusSubmenuLink = (menuName: string, index: number) => {
    const links = getSubmenuLinks(menuName);
    if (!links.length) return;

    const nextIndex = ((index % links.length) + links.length) % links.length;
    const el = links[nextIndex];
    el?.focus();
    el?.scrollIntoView({ block: "nearest", inline: "nearest" });
  };

  const focusMenuButton = (menuName: string) => {
    const menuButtons = asideRef.current?.querySelectorAll<HTMLButtonElement>("button[data-menu-name]");
    const button = Array.from(menuButtons ?? []).find((node) => node.dataset.menuName === menuName);
    button?.focus();
    button?.scrollIntoView({ block: "nearest", inline: "nearest" });
  };

  const getRootFocusables = (): HTMLElement[] => {
    const nav = navRef.current;
    if (!nav) return [];
    const all = Array.from(nav.querySelectorAll<HTMLElement>("button[data-menu-name], a[href]"));
    return all.filter((el) => !el.closest("[data-sidebar-submenu]"));
  };

  const focusSubmenuAfterPaint = (menuName: string, index: number) => {
    const tryFocus = (attempt: number) => {
      window.requestAnimationFrame(() => {
        const links = getSubmenuLinks(menuName);
        if (links[index]) {
          links[index].focus();
        } else if (attempt < 8) {
          tryFocus(attempt + 1);
        }
      });
    };
    tryFocus(0);
  };

  const focusAdjacentRoot = (current: HTMLElement, delta: 1 | -1) => {
    const roots = getRootFocusables();
    const idx = roots.indexOf(current);
    if (idx === -1) return;
    const next = roots[idx + delta];
    if (!next) return;
    if (openMenu) setOpenMenu(null);
    next.focus();
  };

  const menuHasVisibleSubitems = (menuName: string) => {
    const item = authorizedMenu.find((i) => i.name === menuName);
    return Boolean(item?.subItems?.length);
  };

  const enterSubmenuFromButton = (menuName: string, isOpen: boolean) => {
    if (!isOpen) {
      setOpenMenu(menuName);
      focusSubmenuAfterPaint(menuName, 0);
    } else {
      focusSubmenuLink(menuName, 0);
    }
  };

  const handleLeafLinkKeyDown = (event: React.KeyboardEvent<HTMLAnchorElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      event.stopPropagation();
      focusAdjacentRoot(event.currentTarget, 1);
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      event.stopPropagation();
      focusAdjacentRoot(event.currentTarget, -1);
    }
  };

  const handleMenuButtonKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, menuName: string) => {
    const isOpen = openMenu === menuName;
    const hasSubmenu = menuHasVisibleSubitems(menuName);

    if (event.key === "ArrowDown") {
      event.preventDefault();
      event.stopPropagation();
      if (isOpen && hasSubmenu) {
        focusSubmenuLink(menuName, 0);
        return;
      }
      focusAdjacentRoot(event.currentTarget, 1);
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      event.stopPropagation();
      if (isOpen && hasSubmenu) {
        const subLinks = getSubmenuLinks(menuName);
        if (subLinks.length) {
          focusSubmenuLink(menuName, subLinks.length - 1);
          return;
        }
      }
      focusAdjacentRoot(event.currentTarget, -1);
      return;
    }

    if ((event.key === "ArrowRight" || event.key === "Enter") && hasSubmenu) {
      event.preventDefault();
      event.stopPropagation();
      enterSubmenuFromButton(menuName, isOpen);
      return;
    }

    if ((event.key === "ArrowLeft" || event.key === "Escape") && isOpen) {
      event.preventDefault();
      event.stopPropagation();
      setOpenMenu(null);
      focusMenuButton(menuName);
      return;
    }
  };

  const handleSubmenuLinkKeyDown = (
    event: React.KeyboardEvent<HTMLAnchorElement>,
    menuName: string,
    linkIndex: number
  ) => {
    const links = getSubmenuLinks(menuName);
    if (!links.length) return;

    const idxFromDom = links.indexOf(event.currentTarget);
    const idx = idxFromDom >= 0 ? idxFromDom : Math.min(Math.max(0, linkIndex), links.length - 1);

    if (event.key === "ArrowDown") {
      event.preventDefault();
      event.stopPropagation();
      const next = idx >= links.length - 1 ? 0 : idx + 1;
      const el = links[next];
      el?.focus();
      el?.scrollIntoView({ block: "nearest", inline: "nearest" });
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      event.stopPropagation();
      const prev = idx <= 0 ? links.length - 1 : idx - 1;
      const el = links[prev];
      el?.focus();
      el?.scrollIntoView({ block: "nearest", inline: "nearest" });
      return;
    }

    if (event.key === "ArrowLeft" || event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      setOpenMenu(null);
      focusMenuButton(menuName);
      return;
    }

    if (event.key === "Home") {
      event.preventDefault();
      event.stopPropagation();
      focusSubmenuLink(menuName, 0);
      return;
    }
    if (event.key === "End") {
      event.preventDefault();
      event.stopPropagation();
      focusSubmenuLink(menuName, links.length - 1);
      return;
    }
  };

  const handleLinkClick = () => {
    if (mobileOpen && setMobileOpen) {
      setMobileOpen(false);
    }
  };

  return (
    <>
      {/* Telón de fondo superpuesto en móvil (Overlay Backdrop - patrón Docufacil) */}
      {mobileOpen && (
        <div
          role="presentation"
          onClick={() => setMobileOpen?.(false)}
          className="fixed inset-x-0 bottom-0 top-11 z-40 bg-black/45 backdrop-blur-[1px] transition-opacity md:hidden"
        />
      )}

      {/* Contenedor del Sidebar: Desktop estático o Drawer móvil deslizante */}
      <aside
        ref={asideRef}
        className={`
          isolate flex h-full flex-col border-r border-white/8 select-none
          transition-[width,transform] duration-200 ease-out
          [&_button]:cursor-pointer [&_a]:cursor-pointer
          fixed bottom-0 left-0 top-11 z-50 w-[260px] md:static md:translate-x-0
          ${mobileOpen ? "translate-x-0 shadow-2xl shadow-black/45" : "-translate-x-full md:translate-x-0"}
          ${collapsed ? "md:w-14" : "md:w-60"}
        `}
        style={{
          background: "linear-gradient(180deg, #094732 0%, #063d2b 58%, #03291d 100%)",
        }}
      >
        {/* Cabecera del Sidebar */}
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-white/8 px-3">
          <div className="flex items-center gap-2.5 overflow-hidden">
            {logoBase64 ? (
              <img
                src={logoBase64}
                alt="E-lashes"
                className={`rounded-lg object-contain transition-all ${
                  collapsed ? "mx-auto h-8 w-8" : "h-9 max-w-32"
                }`}
              />
            ) : (
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/10 text-sm font-bold text-white">
                  E
                </div>
                {!collapsed && (
                  <div className="min-w-0">
                    <span className="block text-sm font-semibold text-white tracking-tight leading-none">
                      E-lashes
                    </span>
                    <span className="mt-0.5 block text-[9px] font-medium text-emerald-200/65 uppercase tracking-[0.14em]">
                      Salón Admin
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Botón de cierre en Móvil */}
          <button
            type="button"
            onClick={() => setMobileOpen?.(false)}
            aria-label="Cerrar menú móvil"
            className="rounded-md p-1.5 text-emerald-100/70 hover:bg-white/10 hover:text-white transition md:hidden"
          >
            <X size={20} />
          </button>

          {/* Botón de colapso rápido en Desktop (solo cuando está expandido) */}
          {!collapsed && setCollapsed && (
            <button
              type="button"
              onClick={() => setCollapsed(!collapsed)}
              title="Colapsar menú lateral"
              aria-label="Colapsar menú lateral"
              className="hidden rounded-md p-1.5 text-emerald-100/55 hover:bg-white/10 hover:text-white transition md:flex"
            >
              <PanelLeftClose size={18} />
            </button>
          )}
        </div>

        {/* Lista de Navegación Principal */}
        <nav
          ref={navRef}
          aria-label="Navegación del panel administrativo"
          className={`
            flex-1 space-y-0.5 px-2 py-2 ${collapsed ? "overflow-visible" : "overflow-y-auto"}
            [&::-webkit-scrollbar]:w-1.5
            [&::-webkit-scrollbar-track]:bg-transparent
            [&::-webkit-scrollbar-thumb]:bg-emerald-700/40
            [&::-webkit-scrollbar-thumb]:rounded-full
            [&::-webkit-scrollbar-thumb]:hover:bg-emerald-500/60
          `}
        >
          {authorizedMenu.map((item) => {
            const hasSub = Boolean(item.subItems && item.subItems.length > 0);
            const isOpen = openMenu === item.name;
            const itemActive = isItemActive(item);

            return (
              <div key={item.name} className="relative">
                {hasSub ? (
                  <div className="space-y-0.5">
                    {/* Botón de Sección con Submenú */}
                    <button
                      type="button"
                      onClick={() => setOpenMenu(isOpen ? null : item.name)}
                      onKeyDown={(event) => handleMenuButtonKeyDown(event, item.name)}
                      data-menu-name={item.name}
                      title={collapsed ? item.name : undefined}
                      aria-label={item.name}
                      aria-expanded={isOpen}
                      aria-haspopup="true"
                      aria-controls={isOpen ? submenuRegionId(item.name) : undefined}
                      className={`
                        w-full flex items-center justify-between px-2.5 py-2 rounded-lg transition-all duration-150 ${navFocusRing}
                        ${
                          itemActive
                            ? "bg-white/10 text-white font-medium ring-1 ring-inset ring-white/8"
                            : "text-emerald-50/68 hover:bg-white/7 hover:text-white"
                        }
                        ${collapsed ? "justify-center px-0 py-2.5" : ""}
                      `}
                    >
                      <div className={`flex items-center gap-3 min-w-0 ${collapsed ? "justify-center" : ""}`}>
                        <span
                          className={`shrink-0 transition-colors ${
                            itemActive ? "text-[#d8c49d]" : "text-emerald-100/58"
                          }`}
                        >
                          {item.icon}
                        </span>
                        {!collapsed && (
                          <span className="truncate text-[12.5px] font-medium">{item.name}</span>
                        )}
                      </div>

                      {!collapsed && (
                        <ChevronDown
                          size={15}
                          className={`text-emerald-300/70 transition-transform duration-200 shrink-0 ${
                            isOpen ? "rotate-180 text-emerald-200" : "rotate-0"
                          }`}
                        />
                      )}
                    </button>

                    {/* Submenú en modo expandido */}
                    {isOpen && !collapsed && (
                      <div
                        ref={(node) => {
                          expandedSubmenuRefs.current[item.name] = node;
                        }}
                        id={submenuRegionId(item.name)}
                        data-sidebar-submenu
                        role="group"
                        aria-label={item.name}
                        className="ml-3.5 space-y-0.5 border-l border-white/10 py-1 pl-2.5"
                      >
                        {item.subItems!.map((sub, subIndex) => {
                          const subActive = isSubItemActive(sub);
                          return (
                            <NavLink
                              key={sub.path}
                              to={sub.path}
                              end={sub.exact}
                              onClick={handleLinkClick}
                              onKeyDown={(event) => handleSubmenuLinkKeyDown(event, item.name, subIndex)}
                              title={sub.name}
                              aria-label={sub.name}
                              className={`
                                flex items-center gap-2 px-2.5 py-1.5 text-[11.5px] rounded-md transition-all duration-150 outline-none ${navFocusRing}
                                ${
                                  subActive
                                    ? "bg-white/10 text-white font-medium"
                                    : "text-emerald-50/62 hover:bg-white/7 hover:text-white"
                                }
                              `}
                            >
                              {sub.icon && (
                                  <span className={subActive ? "text-[#d8c49d]" : "text-emerald-100/45"}>
                                  {sub.icon}
                                </span>
                              )}
                              <span className="truncate">{sub.name}</span>
                            </NavLink>
                          );
                        })}
                      </div>
                    )}

                    {/* Popover Flyout en modo colapsado (Desktop) */}
                    {isOpen && collapsed && (
                      <div
                        ref={(node) => {
                          flyoutRefs.current[item.name] = node;
                        }}
                        id={submenuRegionId(item.name)}
                        data-sidebar-submenu
                        role="group"
                        aria-label={item.name}
                        className="absolute left-full top-0 z-50 ml-2 w-60 overflow-hidden rounded-xl border border-emerald-900/20 bg-[#094732] p-2 shadow-xl shadow-black/35"
                      >
                        <div className="border-b border-emerald-800/60 px-3 py-2 mb-1">
                          <p className="text-xs font-bold uppercase tracking-wider text-emerald-300">
                            {item.name}
                          </p>
                        </div>
                        <div className="space-y-1">
                          {item.subItems!.map((sub, subIndex) => {
                            const subActive = isSubItemActive(sub);
                            return (
                              <NavLink
                                key={sub.path}
                                to={sub.path}
                                end={sub.exact}
                                onClick={() => {
                                  setOpenMenu(null);
                                  handleLinkClick();
                                }}
                                onKeyDown={(event) => handleSubmenuLinkKeyDown(event, item.name, subIndex)}
                                title={sub.name}
                                aria-label={sub.name}
                                className={`
                                  flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs transition duration-150 outline-none ${navFocusRing}
                                  ${
                                    subActive
                                      ? "bg-emerald-500/30 text-white font-semibold"
                                      : "text-emerald-100/80 hover:bg-emerald-800/50 hover:text-white"
                                  }
                                `}
                              >
                                {sub.icon && (
                                  <span className={subActive ? "text-emerald-300" : "text-emerald-400/70"}>
                                    {sub.icon}
                                  </span>
                                )}
                                <span className="truncate">{sub.name}</span>
                              </NavLink>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  /* Enlace directo (sin submenú) */
                  <NavLink
                    to={item.path!}
                    end={item.exact}
                    onClick={handleLinkClick}
                    onKeyDown={handleLeafLinkKeyDown}
                    title={collapsed ? item.name : undefined}
                    aria-label={item.name}
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-2.5 py-2 rounded-lg outline-none transition-all duration-150 ${navFocusRing} ${
                        isActive
                          ? "bg-white/10 text-white font-medium ring-1 ring-inset ring-white/8"
                          : "text-emerald-50/68 hover:bg-white/7 hover:text-white"
                      } ${collapsed ? "justify-center px-0 py-2.5" : ""}`
                    }
                  >
                    <span
                      className={`shrink-0 transition-colors ${
                        itemActive ? "text-[#d8c49d]" : "text-emerald-100/58"
                      }`}
                    >
                      {item.icon}
                    </span>
                    {!collapsed && <span className="truncate text-[12.5px] font-medium">{item.name}</span>}
                  </NavLink>
                )}
              </div>
            );
          })}
        </nav>

        {/* Pie de página del Sidebar (Inspirado en Docufacil: rol, estado, versión y botón colapsar) */}
        <div className="shrink-0 border-t border-white/8 bg-black/5 p-2.5">
          {!collapsed ? (
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                {displayRole && (
                  <span className="inline-block px-2 py-0.5 text-[10px] font-semibold bg-emerald-800/60 border border-emerald-700/60 text-emerald-200 rounded-md truncate max-w-36">
                    {displayRole}
                  </span>
                )}
                <p className="text-[10px] text-emerald-400/50 mt-1 font-mono">v1.2 · Salón E-lashes</p>
              </div>

              {setCollapsed && (
                <button
                  type="button"
                  onClick={() => setCollapsed(true)}
                  title="Colapsar menú lateral"
                  aria-label="Colapsar menú lateral"
                  className="hidden md:flex p-2 rounded-lg text-emerald-300/70 hover:bg-white/10 hover:text-white transition"
                >
                  <PanelLeftClose size={16} />
                </button>
              )}
            </div>
          ) : (
            <div className="flex justify-center">
              {setCollapsed && (
                <button
                  type="button"
                  onClick={() => setCollapsed(false)}
                  title="Expandir menú lateral"
                  aria-label="Expandir menú lateral"
                  className="hidden md:flex p-2 rounded-lg text-emerald-300/70 hover:bg-white/10 hover:text-white transition"
                >
                  <PanelLeftOpen size={18} />
                </button>
              )}
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
