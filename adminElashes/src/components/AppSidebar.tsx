import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { NavLink, useLocation } from "react-router-dom";
import useAuth from "../core/hooks/useAuth";
import {
  LayoutDashboard,
  Users,
  Settings,
  ChevronDown,
  Eye,
  Layers,
  Package,
  Building2,
  Briefcase,
  Ticket,
  CalendarDays,
  ReceiptText,
  UserCheck,
} from "lucide-react";

type PermissionRule = string | string[];
type MenuSubItem = {
  name: string;
  path: string;
  permission?: PermissionRule;
};
type MenuItem = {
  name: string;
  icon: ReactNode;
  path?: string;
  permission?: PermissionRule;
  subItems?: MenuSubItem[];
};

function uniq(arr: string[]) {
  return Array.from(new Set(arr.filter(Boolean)));
}

function normalizePerm(name: unknown): string | null {
  if (typeof name !== "string") return null;
  return name.trim();
}

export default function AppSidebar({ collapsed }: { collapsed: boolean }) {
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const lastSyncedPathRef = useRef<string | null>(null);
  const lastCollapsedRef = useRef<boolean>(collapsed);
  const asideRef = useRef<HTMLElement | null>(null);
  const flyoutRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const { user, hasPermissionByName, isAdmin } = useAuth();
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
   * ✅ Permisos disponibles (3 fuentes):
   * 1) user.role.permissions (si tu backend lo manda)
   * 2) user.permissions (si tu hook lo guarda ahí)
   * 3) Fallback por rol (para que Operaria/Secretaria/Almacén vean menú aunque no lleguen permisos)
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

    // c) fallback por rol (si no llegó nada)
    const roleName = (displayRole || "").toLowerCase();

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
          "appointments:view",
          "appointments:manage",
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
          "appointments:view",
          "appointments:manage",
          "branches:view"
        );
      } else if (roleName === "encargadaalmacen" || roleName === "encargada_almacen") {
        perms.push("inventory:view", "inventory:manage", "branches:view", "catalog:view");
      }
    }

    return uniq(perms);
  }, [user, displayRole]);

  const hasMenuPermission = (rule?: PermissionRule) => {
    if (!rule) return true;
    if (isAdmin()) return true;

    const rules = Array.isArray(rule) ? rule : [rule];

    return rules.some((permission) => {
      // 1) el hook (si funciona)
      if (hasPermissionByName(permission)) return true;
      // 2) fallback local desde user
      return permissionNamesFromUser.includes(permission);
    });
  };

  // ✅ Menú (estable para evitar re-renders que cierran el dropdown)
  const menuItems = useMemo<MenuItem[]>(
    () => [
      { name: "Dashboard", icon: <LayoutDashboard size={20} />, path: "/" },

      {
        name: "Clientes",
        icon: <Users size={20} />,
        permission: ["clients:view", "clients:manage"],
        subItems: [{ name: "Lista de clientes", path: "/clients", permission: ["clients:view", "clients:manage"] }],
      },

      {
        name: "Diseño Pestañas",
        icon: <Eye size={20} />,
        path: "/lash-designs",
        permission: ["catalog:view", "catalog:manage"],
        subItems: [
          { name: "Tecnología", path: "/lash-designs", permission: ["catalog:view", "catalog:manage"] },
          { name: "Efectos", path: "/effects", permission: ["catalog:view", "catalog:manage"] },
          { name: "Tipo de ojo", path: "/eye-types", permission: ["catalog:view", "catalog:manage"] },
          { name: "Volumen", path: "/volumen", permission: ["catalog:view", "catalog:manage"] },
          { name: "Diseños", path: "/designs", permission: ["catalog:view", "catalog:manage"] },
        ],
      },

      {
        name: "Caja & Seguimiento",
        icon: <ReceiptText size={20} />,
        path: "/admin/pos",
        subItems: [
          { name: "Nueva venta", path: "/admin/pos" },
          { name: "Historial de ventas", path: "/admin/pos/history" },
          { name: "Caja y seguimiento", path: "/admin/pos-tracking" },
        ],
        permission: undefined,
      },

      {
        name: "Inventario",
        icon: <Package size={20} />,
        path: "/admin/products",
        permission: ["inventory:view", "inventory:manage"],
      },

      {
        name: "Servicios",
        icon: <Briefcase size={20} />,
        path: "/admin/services",
        permission: ["services:view", "services:manage"],
        subItems: [
          { name: "Catálogo", path: "/admin/services", permission: ["services:view", "services:manage"] },
          { name: "Servicios categorias", path: "/admin/services/categories", permission: ["services:view", "services:manage"] },
          // si “queue” requiere citas, puedes añadir appointments:* también
          {
            name: "Control de servicios",
            path: "/admin/services/queue",
            permission: ["services:view", "services:manage"],
          },
        ],
      },

      {
        name: "Tickets",
        icon: <Ticket size={20} />,
        path: "/admin/tickets",
        permission: ["payments:view", "payments:manage"],
        subItems: [
          { name: "Listado", path: "/admin/tickets", permission: ["payments:view", "payments:manage"] },
          { name: "Finalizados", path: "/admin/tickets/finalizados", permission: ["payments:view", "payments:manage"] },
        ],
      },

      {
        name: "Operarias",
        icon: <UserCheck size={20} />,
        path: "/admin/professionals/history",
        permission: ["appointments:view", "appointments:manage"],
        subItems: [
          { name: "Historial de servicios", path: "/admin/professionals/history", permission: ["appointments:view", "appointments:manage"] },
        ],
      },

      {
        name: "Calendario",
        icon: <CalendarDays size={20} />,
        path: "/admin/calendar",
        permission: ["appointments:view", "appointments:manage"],
        subItems: [
          { name: "Citas", path: "/admin/calendar/citas", permission: ["appointments:view", "appointments:manage"] },
          { name: "Agenda del día", path: "/admin/calendar/agenda", permission: ["appointments:view", "appointments:manage"] },
        ],
      },

      {
        name: "Salones",
        icon: <Building2 size={20} />,
        path: "/admin/salons",
        permission: ["branches:view", "branches:manage"],
      },

      {
        name: "Cuestionario",
        icon: <Layers size={20} />,
        path: "/questionnaire",
        permission: ["forms:view", "forms:manage"],
      },

      // ✅ Admin: mejor mostrarlo solo si isAdmin() (SuperAdmin)
      {
        name: "Usuarios",
        icon: <Users size={20} />,
        path: "/users",
        permission: undefined, // lo controlamos abajo con isAdmin()
      },

      { name: "Ajustes", icon: <Settings size={20} />, path: "/settings", permission: "settings:view" },
    ],
    []
  );

  // ✅ menú autorizado
  const authorizedMenu = useMemo(() => {
    return menuItems
      .map((item) => {
        // Usuarios solo para admin
        if (item.name === "Usuarios" && !isAdmin()) return null;

        if (!item.subItems) {
          return hasMenuPermission(item.permission) ? item : null;
        }

        const visibleSubItems = item.subItems.filter((subItem) => hasMenuPermission(subItem.permission));
        if (!visibleSubItems.length && !hasMenuPermission(item.permission)) return null;

        return { ...item, subItems: visibleSubItems };
      })
      .filter((item): item is MenuItem => Boolean(item));
  }, [menuItems, isAdmin, hasPermissionByName, permissionNamesFromUser]);

  // ✅ auto abrir menú cuando la ruta coincide (solo cuando no está colapsado)
  useEffect(() => {
    const becameExpanded = lastCollapsedRef.current && !collapsed;
    lastCollapsedRef.current = collapsed;

    const pathChanged = lastSyncedPathRef.current !== location.pathname;
    if (!pathChanged && !becameExpanded) return;
    lastSyncedPathRef.current = location.pathname;

    const match = authorizedMenu.find(
      (item) =>
        item.subItems?.some((sub) => location.pathname.startsWith(sub.path)) ||
        (item.subItems && item.path && location.pathname.startsWith(item.path))
    );

    if (match) setOpenMenu(match.name);
  }, [location.pathname, collapsed, authorizedMenu]);

  useEffect(() => {
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!asideRef.current?.contains(event.target as Node)) {
        setOpenMenu(null);
      }
    };

    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, []);

  useEffect(() => {
    if (!collapsed) return;
    setOpenMenu(null);
  }, [location.pathname, collapsed]);

  const getFlyoutLinks = (menuName: string) => {
    const flyout = flyoutRefs.current[menuName];
    if (!flyout) return [];
    return Array.from(flyout.querySelectorAll<HTMLAnchorElement>("a"));
  };

  const focusFlyoutLink = (menuName: string, index: number) => {
    const links = getFlyoutLinks(menuName);
    if (!links.length) return;

    const nextIndex = ((index % links.length) + links.length) % links.length;
    links[nextIndex]?.focus();
  };

  const handleCollapsedMenuKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, menuName: string) => {
    if (!collapsed) return;

    const isOpen = openMenu === menuName;
    const links = getFlyoutLinks(menuName);

    if (event.key === "ArrowRight") {
      event.preventDefault();
      setOpenMenu(menuName);
      requestAnimationFrame(() => focusFlyoutLink(menuName, 0));
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (!isOpen) {
        setOpenMenu(menuName);
        requestAnimationFrame(() => focusFlyoutLink(menuName, 0));
      } else {
        focusFlyoutLink(menuName, 0);
      }
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      if (!isOpen) {
        setOpenMenu(menuName);
        requestAnimationFrame(() => {
          const currentLinks = getFlyoutLinks(menuName);
          if (currentLinks.length) focusFlyoutLink(menuName, currentLinks.length - 1);
        });
      } else if (links.length) {
        focusFlyoutLink(menuName, links.length - 1);
      }
      return;
    }

    if (event.key === "Escape" || event.key === "ArrowLeft") {
      event.preventDefault();
      setOpenMenu(null);
    }
  };

  const handleFlyoutLinkKeyDown = (
    event: React.KeyboardEvent<HTMLAnchorElement>,
    menuName: string,
    linkIndex: number
  ) => {
    const links = getFlyoutLinks(menuName);
    if (!links.length) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      focusFlyoutLink(menuName, linkIndex + 1);
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      focusFlyoutLink(menuName, linkIndex - 1);
      return;
    }

    if (event.key === "Home") {
      event.preventDefault();
      focusFlyoutLink(menuName, 0);
      return;
    }

    if (event.key === "End") {
      event.preventDefault();
      focusFlyoutLink(menuName, links.length - 1);
      return;
    }

    if (event.key === "ArrowLeft" || event.key === "Escape") {
      event.preventDefault();
      setOpenMenu(null);

      const menuButtons = asideRef.current?.querySelectorAll<HTMLButtonElement>("button[data-menu-name]");
      const button = Array.from(menuButtons ?? []).find((node) => node.dataset.menuName === menuName);
      button?.focus();
    }
  };

  return (
    <aside
      ref={asideRef}
      className={`relative h-screen flex flex-col transition-all duration-300 border-r border-emerald-900/30 shrink-0 [&_button]:cursor-pointer [&_a]:cursor-pointer ${
        collapsed ? "w-20" : "w-64"
      }`}
      style={{ background: "linear-gradient(180deg, #063324 0%, #021a12 100%)" }}
    >
      {/* Logo */}
      <div className="h-20 flex items-center px-6 border-b border-emerald-800/30 shrink-0">
        {!collapsed && <span className="text-2xl font-black text-white tracking-tight">Admin</span>}
        {collapsed && <span className="mx-auto text-base font-black text-emerald-400">Admin</span>}
      </div>

      {/* Nav */}
      <nav
        className={`
          flex-1 py-4 px-3 space-y-1 ${collapsed ? "overflow-visible" : "overflow-y-auto"}
          [&::-webkit-scrollbar]:w-1
          [&::-webkit-scrollbar-track]:bg-transparent
          [&::-webkit-scrollbar-thumb]:bg-emerald-700/40
          [&::-webkit-scrollbar-thumb]:rounded-full
          [&::-webkit-scrollbar-thumb]:hover:bg-emerald-600/60
          scrollbar-thin
          scrollbar-track-transparent
          scrollbar-thumb-emerald-700/40
        `}
      >
        {authorizedMenu.map((item) => (
          <div key={item.name} className="relative">
            {item.subItems ? (
              <div className="space-y-1">
                <button
                  type="button"
                  onClick={() => setOpenMenu(openMenu === item.name ? null : item.name)}
                  onKeyDown={(event) => handleCollapsedMenuKeyDown(event, item.name)}
                  data-menu-name={item.name}
                  title={item.name}
                  aria-label={item.name}
                  className={`w-full flex items-center justify-between px-3 py-3 rounded-xl transition-all ${
                    (item.path && location.pathname.includes(item.path)) ||
                    item.subItems?.some((sub) => location.pathname.startsWith(sub.path))
                      ? "bg-emerald-800/40 text-white"
                      : "text-emerald-100/70 hover:bg-emerald-900/30"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-emerald-400">{item.icon}</span>
                    {!collapsed && <span className="text-sm font-semibold">{item.name}</span>}
                  </div>
                  {!collapsed && (
                    <ChevronDown size={14} className={`${openMenu === item.name ? "rotate-180" : ""} transition-transform`} />
                  )}
                </button>

                {openMenu === item.name && !collapsed && (
                  <div className="ml-4 pl-4 border-l border-emerald-800/50 space-y-1">
                    {item.subItems.map((sub) => (
                      <NavLink
                        key={sub.path}
                        to={sub.path}
                        end
                        title={sub.name}
                        aria-label={sub.name}
                        className={({ isActive }) =>
                          `block px-3 py-2 text-xs rounded-lg ${
                            isActive ? "text-white bg-emerald-800" : "text-emerald-100/50 hover:text-white"
                          }`
                        }
                      >
                        {sub.name}
                      </NavLink>
                    ))}
                  </div>
                )}

                {openMenu === item.name && collapsed && (
                  <div
                    ref={(node) => {
                      flyoutRefs.current[item.name] = node;
                    }}
                    className="absolute left-full top-0 z-50 ml-2 w-60 overflow-hidden rounded-xl border border-emerald-700/40 bg-[#062f23] shadow-2xl shadow-black/40"
                  >
                    <div className="border-b border-emerald-800/40 px-3 py-2">
                      <p className="text-xs font-semibold uppercase tracking-widest text-emerald-300/90">{item.name}</p>
                    </div>
                    <div className="p-2">
                      {item.subItems.map((sub, subIndex) => (
                        <NavLink
                          key={sub.path}
                          to={sub.path}
                          end
                          onClick={() => setOpenMenu(null)}
                          onKeyDown={(event) => handleFlyoutLinkKeyDown(event, item.name, subIndex)}
                          title={sub.name}
                          aria-label={sub.name}
                          className={({ isActive }) =>
                            `mb-1 block rounded-lg px-3 py-2 text-xs transition ${
                              isActive
                                ? "bg-emerald-700/70 text-white"
                                : "text-emerald-100/80 hover:bg-emerald-800/50 hover:text-white"
                            }`
                          }
                        >
                          {sub.name}
                        </NavLink>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <NavLink
                to={item.path!}
                title={item.name}
                aria-label={item.name}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-3 rounded-xl transition-all ${
                    isActive
                      ? "bg-emerald-600 text-white shadow-lg shadow-emerald-900/40"
                      : "text-emerald-100/70 hover:bg-emerald-900/30 hover:text-white"
                  }`
                }
              >
                <span className="shrink-0">{item.icon}</span>
                {!collapsed && <span className="text-sm font-medium">{item.name}</span>}
              </NavLink>
            )}
          </div>
        ))}
      </nav>

    </aside>
  );
}