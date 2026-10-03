import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  Bell,
  Search,
  ChevronDown,
  X,
  LogOut,
  Users,
  Settings,
  Shield,
  CalendarPlus,
  ShoppingBag,
  Activity,
  Menu,
  PanelLeft,
  PanelLeftClose,
} from "lucide-react";
import { useNavigate, NavLink } from "react-router-dom";
import ModeSwitch from "./ModeSwitch";
import HorizontalNavigation from "./HorizontalNavigation";
import LayoutCustomizer from "./LayoutCustomizer";
import { MobileNavigationSheet } from "./SidebarNavigation";
import { useLayout } from "@/core/context/layout.context";
import { useWebSocket } from "@/core/hooks/useWebSocket";
import useAuth from "@/core/hooks/useAuth";
import { useLogo } from "@/core/hooks/useLogo";

import {
  logout as logoutAction,
  updateSession,
} from "@/core/reducer/auth.reducer";
import type { AppDispatch, RootState } from "@/store";
import { BranchService } from "@/core/services/branch/branch.service";
import { AgendaService } from "@/core/services/agenda/agenda.service";
import { AuthService } from "@/core/services/auth/auth.service";
import {
  BRANCH_STORAGE_KEY,
  getSelectedBranchId,
  setSelectedBranchId,
} from "@/core/utils/branch";
import variables from "@/core/config/variables";

type SearchResultType = "client" | "ticket" | "service" | "section";

interface SearchResultItem {
  id: string;
  label: string;
  subtitle?: string;
  type: SearchResultType;
  href: string;
}

interface NotificationItem {
  id: number;
  title: string;
  subtitle?: string;
  status: string;
  href: string;
}

const getLocalDateString = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const SEARCH_TYPE_LABEL: Record<SearchResultType, string> = {
  client: "Cliente",
  ticket: "Ticket",
  service: "Servicio",
  section: "Seccion",
};

const SEARCH_TYPE_CLASS: Record<SearchResultType, string> = {
  client: "border-sky-500/40 bg-sky-500/15 text-sky-100",
  ticket: "border-amber-500/40 bg-amber-500/15 text-amber-100",
  service: "border-emerald-500/40 bg-emerald-500/15 text-emerald-100",
  section: "border-indigo-500/40 bg-indigo-500/15 text-indigo-100",
};

const APP_SECTIONS: Array<{ id: string; label: string; href: string }> = [
  { id: "section-dashboard", label: "Dashboard", href: "/" },
  { id: "section-clientes", label: "Clientes", href: "/clients" },
  { id: "section-tickets", label: "Tickets", href: "/admin/tickets" },
  {
    id: "section-tickets-finalizados",
    label: "Tickets finalizados",
    href: "/admin/tickets/finalizados",
  },
  {
    id: "section-operarias",
    label: "Operarias",
    href: "/admin/professionals/history",
  },
  { id: "section-servicios", label: "Servicios", href: "/admin/services" },
  {
    id: "section-control-servicios",
    label: "Control de servicios",
    href: "/admin/services/queue",
  },
  { id: "section-calendario", label: "Calendario", href: "/admin/calendar" },
  {
    id: "section-agenda-dia",
    label: "Agenda del día",
    href: "/admin/calendar/agenda",
  },
  { id: "section-inventario", label: "Inventario", href: "/admin/products" },
  {
    id: "section-caja",
    label: "Caja & Seguimiento",
    href: "/admin/pos-tracking",
  },
  { id: "section-pos", label: "Punto de venta", href: "/admin/pos" },
  { id: "section-sucursales", label: "Sucursales", href: "/admin/salons" },
  { id: "section-usuarios", label: "Usuarios", href: "/users" },
  { id: "section-auditoria", label: "Auditoría", href: "/admin/audit-log" },
  { id: "section-ajustes", label: "Ajustes", href: "/settings" },
  { id: "section-ia", label: "Configuración IA", href: "/admin/ai" },
  { id: "section-perfil", label: "Mi perfil", href: "/profile" },
];

const STATUS_ES: Record<string, string> = {
  pending: "En espera",
  waiting: "En espera",
  confirmed: "Confirmado",
  in_service: "En servicio",
  completed: "Completado",
  cancelled: "Cancelado",
};

const STATUS_BADGE_CLASS: Record<string, string> = {
  pending: "border-amber-500/40 bg-amber-500/15 text-amber-100",
  waiting: "border-amber-500/40 bg-amber-500/15 text-amber-100",
  confirmed: "border-sky-500/40 bg-sky-500/15 text-sky-100",
  in_service: "border-emerald-500/40 bg-emerald-500/15 text-emerald-100",
  completed: "border-slate-500/40 bg-slate-500/15 text-slate-100",
  cancelled: "border-rose-500/40 bg-rose-500/15 text-rose-100",
};

export default function Header() {
  const idleDeadlineRef = useRef<number>(Date.now());
  const idleLogoutTriggeredRef = useRef(false);
  const idleTimeoutSeconds = 3 * 60 * 60;
  const [showMobileSearch, setShowMobileSearch] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const closeMobileNav = useCallback(() => setMobileNavOpen(false), []);
  const { layoutMode, sidebarPinned, toggleSidebarPinned } = useLayout();
  const isSidebarMode = layoutMode === "sidebar";
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();
  const { isAdmin, hasPermissionByName } = useAuth();
  const { logoBase64 } = useLogo();
  const { user, sessionExpiresAt } = useSelector(
    (state: RootState) => state.auth,
  );
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [idleRemainingSeconds, setIdleRemainingSeconds] =
    useState(idleTimeoutSeconds);
  const [branches, setBranches] = useState<Array<{ id: number; name: string }>>(
    [],
  );
  const [selectedBranchId, setSelectedBranchIdState] = useState<number | null>(
    () => getSelectedBranchId(),
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResultItem[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchDropdownOpen, setSearchDropdownOpen] = useState(false);
  const [servicesCache, setServicesCache] = useState<
    Array<{ id: number; name: string }>
  >([]);
  const [servicesCacheBranchId, setServicesCacheBranchId] = useState<
    number | null
  >(null);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const isRefreshingRef = useRef(false);
  const lastRefreshAtRef = useRef(0);
  const searchPanelRef = useRef<HTMLDivElement | null>(null);
  const notificationPanelRef = useRef<HTMLDivElement | null>(null);
  const profilePanelRef = useRef<HTMLDivElement | null>(null);
  const operariasPanelRef = useRef<HTMLDivElement | null>(null);
  const [operariasOpen, setOperariasOpen] = useState(false);
  const [operarias, setOperarias] = useState<
    Array<{ id: number; username: string; email: string; branch_name?: string | null }>
  >([]);
  const [operariasLoading, setOperariasLoading] = useState(false);

  const displayName =
    (
      user as {
        username?: string;
        full_name?: string;
        name?: string;
        email?: string;
      } | null
    )?.username ||
    (user as { full_name?: string; name?: string; email?: string } | null)
      ?.full_name ||
    (user as { name?: string; email?: string } | null)?.name ||
    user?.email ||
    "Usuario";

  const isSuperAdmin = (() => {
    const roleValue = (user as { role?: unknown } | null)?.role;
    if (typeof roleValue === "string") return roleValue === "SuperAdmin";
    if (
      roleValue &&
      typeof roleValue === "object" &&
      "name" in (roleValue as Record<string, unknown>)
    ) {
      return (roleValue as { name?: unknown }).name === "SuperAdmin";
    }
    return false;
  })();

  const isSecretary = (() => {
    const roleValue = (user as { role?: unknown } | null)?.role;
    if (typeof roleValue === "string") return roleValue === "Secretaria";
    if (
      roleValue &&
      typeof roleValue === "object" &&
      "name" in (roleValue as Record<string, unknown>)
    ) {
      return (roleValue as { name?: unknown }).name === "Secretaria";
    }
    return false;
  })();

  const canSelectBranch = isSuperAdmin || isSecretary;

  const displayRole = (() => {
    const roleValue = (user as { role?: unknown; roles?: unknown[] } | null)
      ?.role;
    if (typeof roleValue === "string") return roleValue;
    if (
      roleValue &&
      typeof roleValue === "object" &&
      "name" in (roleValue as Record<string, unknown>)
    ) {
      const roleName = (roleValue as { name?: unknown }).name;
      if (typeof roleName === "string") return roleName;
    }
    const firstRole = (user as { roles?: unknown[] } | null)?.roles?.[0];
    if (typeof firstRole === "string") return firstRole;
    if (
      firstRole &&
      typeof firstRole === "object" &&
      "name" in (firstRole as Record<string, unknown>)
    ) {
      const roleName = (firstRole as { name?: unknown }).name;
      if (typeof roleName === "string") return roleName;
    }
    return "Sesión activa";
  })();

  const normalizedRole = displayRole.trim().toLowerCase().replace(/\s+/g, "_");
  const canManageAppointments =
    isAdmin() ||
    hasPermissionByName("appointments:view") ||
    hasPermissionByName("appointments:manage") ||
    ["operaria", "secretaria"].includes(normalizedRole);

  const canManagePayments =
    isAdmin() ||
    hasPermissionByName("payments:view") ||
    hasPermissionByName("payments:manage") ||
    normalizedRole === "secretaria";

  const canOpenTracking =
    isAdmin() ||
    hasPermissionByName("tracking:view") ||
    hasPermissionByName("tracking:manage") ||
    canManagePayments;

  const avatarUrl = (user as { avatar?: string } | null)?.avatar;

  useEffect(() => {
    if (!sessionExpiresAt) {
      setRemainingSeconds(0);
      return;
    }

    const updateRemaining = () => {
      const diff = Math.max(
        0,
        Math.floor((new Date(sessionExpiresAt).getTime() - Date.now()) / 1000),
      );
      setRemainingSeconds(diff);
    };

    updateRemaining();
    const interval = window.setInterval(updateRemaining, 1000);
    return () => window.clearInterval(interval);
  }, [sessionExpiresAt]);

  const handleLogout = useCallback(() => {
    void dispatch(logoutAction());
  }, [dispatch]);

  const refreshSessionIfNeeded = useCallback(async () => {
    if (!sessionExpiresAt) return;
    if (isRefreshingRef.current) return;

    const expiresMs = Date.parse(sessionExpiresAt);
    if (!Number.isFinite(expiresMs)) return;

    const now = Date.now();
    if (now - lastRefreshAtRef.current < 5 * 60_000) return;

    isRefreshingRef.current = true;
    lastRefreshAtRef.current = now;
    try {
      const response = await AuthService.refresh();
      const data = response.data;
      if (data?.access_token) {
        localStorage.setItem(variables.session.tokenName, data.access_token);
      }
      if (data?.expires_at) {
        localStorage.setItem(
          variables.session.sessionExpiresAt,
          data.expires_at,
        );
      }
      if (data?.expires_in_minutes != null) {
        localStorage.setItem(
          variables.session.sessionDurationMinutes,
          String(data.expires_in_minutes),
        );
      }
      dispatch(
        updateSession({
          sessionExpiresAt: data?.expires_at ?? null,
          sessionDurationMinutes: data?.expires_in_minutes ?? null,
        }),
      );
    } catch (error) {
      console.error("No se pudo refrescar la sesión:", error);
    } finally {
      isRefreshingRef.current = false;
    }
  }, [dispatch, sessionExpiresAt]);

  useEffect(() => {
    const resetIdleTimer = () => {
      idleDeadlineRef.current = Date.now() + idleTimeoutSeconds * 1000;
      setIdleRemainingSeconds(idleTimeoutSeconds);
      idleLogoutTriggeredRef.current = false;
      void refreshSessionIfNeeded();
    };

    const updateIdleTimer = () => {
      const remaining = Math.max(
        0,
        Math.floor((idleDeadlineRef.current - Date.now()) / 1000),
      );
      setIdleRemainingSeconds(remaining);

      if (remaining === 0 && !idleLogoutTriggeredRef.current) {
        idleLogoutTriggeredRef.current = true;
        handleLogout();
      }
    };

    const activityEvents: Array<keyof WindowEventMap> = [
      "mousemove",
      "mousedown",
      "keydown",
      "scroll",
      "touchstart",
      "wheel",
    ];

    resetIdleTimer();
    const interval = window.setInterval(updateIdleTimer, 1000);
    activityEvents.forEach((eventName) => {
      window.addEventListener(eventName, resetIdleTimer, { passive: true });
    });
    document.addEventListener("visibilitychange", resetIdleTimer);

    return () => {
      window.clearInterval(interval);
      activityEvents.forEach((eventName) => {
        window.removeEventListener(eventName, resetIdleTimer);
      });
      document.removeEventListener("visibilitychange", resetIdleTimer);
    };
  }, [handleLogout, idleTimeoutSeconds]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (
        searchPanelRef.current &&
        target &&
        !searchPanelRef.current.contains(target)
      ) {
        setSearchDropdownOpen(false);
      }
      if (
        notificationPanelRef.current &&
        target &&
        !notificationPanelRef.current.contains(target)
      ) {
        setNotificationsOpen(false);
      }
      if (
        profilePanelRef.current &&
        target &&
        !profilePanelRef.current.contains(target)
      ) {
        setProfileDropdownOpen(false);
      }
      if (
        operariasPanelRef.current &&
        target &&
        !operariasPanelRef.current.contains(target)
      ) {
        setOperariasOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  useEffect(() => {
    const closeTransientUi = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setShowMobileSearch(false);
      setSearchDropdownOpen(false);
      setNotificationsOpen(false);
      setProfileDropdownOpen(false);
      setOperariasOpen(false);
    };

    document.addEventListener("keydown", closeTransientUi);
    return () => document.removeEventListener("keydown", closeTransientUi);
  }, []);

  useEffect(() => {
    let isMounted = true;
    BranchService.list({ limit: 200 })
      .then((data) => {
        if (!isMounted) return;
        setBranches(data);
        const storedRaw =
          typeof window !== "undefined"
            ? window.localStorage.getItem(BRANCH_STORAGE_KEY)
            : null;
        // Solo auto-seleccionar la primera sucursal en la primera visita (sin preferencia guardada).
        // Si el usuario eligió "Todas" (valor "all"), no forzar sucursal.
        if (storedRaw === null && data.length > 0) {
          const fallback = data[0].id;
          setSelectedBranchIdState(fallback);
          setSelectedBranchId(fallback);
          return;
        }
        setSelectedBranchIdState(getSelectedBranchId());
      })
      .catch((error) => {
        console.error("Error cargando sucursales:", error);
        if (isMounted) setBranches([]);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    const trimmed = searchQuery.trim();
    if (!trimmed) {
      setSearchResults([]);
      setSearchError(null);
      return;
    }

    const timer = window.setTimeout(() => {
      setSearchLoading(true);
      setSearchError(null);

      const activeBranchId = selectedBranchId ?? undefined;
      const servicesPromise =
        servicesCache.length > 0 && servicesCacheBranchId === selectedBranchId
          ? Promise.resolve(servicesCache)
          : AgendaService.listServices({
              limit: 200,
              branch_id: activeBranchId,
            }).then((data) => {
              const normalized = data.map((service) => ({
                id: service.id,
                name: service.name,
              }));
              setServicesCache(normalized);
              setServicesCacheBranchId(selectedBranchId ?? null);
              return normalized;
            });

      Promise.allSettled([
        AgendaService.listClientsForSelect({
          limit: 8,
          search: trimmed,
          branch_id: activeBranchId,
        }),
        AgendaService.listTickets({
          limit: 8,
          search: trimmed,
          branch_id: activeBranchId,
        }),
        servicesPromise,
      ])
        .then((settled) => {
          const [clientsRes, ticketsRes, servicesRes] = settled;
          const clientsData =
            clientsRes.status === "fulfilled" ? clientsRes.value : [];
          const ticketsData =
            ticketsRes.status === "fulfilled" ? ticketsRes.value : [];
          const servicesData =
            servicesRes.status === "fulfilled" ? servicesRes.value : [];

          const normalizedSearch = trimmed.toLowerCase();
          const serviceMatches = servicesData
            .filter((service) =>
              service.name.toLowerCase().includes(normalizedSearch),
            )
            .slice(0, 8);

          const sectionMatches = APP_SECTIONS.filter((section) =>
            section.label.toLowerCase().includes(normalizedSearch),
          )
            .slice(0, 8)
            .map((section) => ({
              id: section.id,
              label: section.label,
              subtitle: "Seccion",
              type: "section" as const,
              href: section.href,
            }));

          const results: SearchResultItem[] = [
            ...clientsData.map((client) => ({
              id: `client-${client.id}`,
              label: `${client.nombre} ${client.apellido}`.trim(),
              subtitle: "Cliente",
              type: "client" as const,
              href: "/clients",
            })),
            ...ticketsData.map((ticket) => ({
              id: `ticket-${ticket.id}`,
              label: ticket.ticket_code ?? `Ticket #${ticket.id}`,
              subtitle: ticket.client_name,
              type: "ticket" as const,
              href: "/admin/tickets",
            })),
            ...serviceMatches.map((service) => ({
              id: `service-${service.id}`,
              label: service.name,
              subtitle: "Servicio",
              type: "service" as const,
              href: "/admin/services",
            })),
            ...sectionMatches,
          ];

          const allFailed = settled.every((item) => item.status === "rejected");
          if (allFailed) {
            setSearchError("No se pudieron cargar resultados.");
          }

          setSearchResults(results);
        })
        .finally(() => {
          setSearchLoading(false);
        });
    }, 300);

    return () => window.clearTimeout(timer);
  }, [searchQuery, selectedBranchId, servicesCache, servicesCacheBranchId]);

  const loadNotifications = async (showLoading: boolean) => {
    const today = getLocalDateString();
    if (showLoading) setNotificationsLoading(true);
    try {
      const tickets = await AgendaService.listTickets({
        limit: 20,
        branch_id: selectedBranchId ?? undefined,
        start_date: today,
        end_date: today,
      });
      const filtered = tickets.filter((ticket) =>
        ["pending", "confirmed", "in_service"].includes(ticket.status),
      );
      setNotifications(
        filtered.slice(0, 8).map((ticket) => ({
          id: ticket.id,
          title: ticket.ticket_code ?? `Ticket #${ticket.id}`,
          subtitle: ticket.client_name,
          status: ticket.status,
          href: "/admin/tickets",
        })),
      );
    } catch {
      setNotifications([]);
    } finally {
      if (showLoading) setNotificationsLoading(false);
    }
  };

  useEffect(() => {
    void loadNotifications(false);
  }, [selectedBranchId]);

  useEffect(() => {
    if (!notificationsOpen) return;
    void loadNotifications(true);
  }, [notificationsOpen, selectedBranchId]);

  useWebSocket(selectedBranchId, () => {
    void loadNotifications(false);
  });

  useEffect(() => {
    if (!operariasOpen) return;
    setOperariasLoading(true);
    AgendaService.listProfessionalsForSelect({
      branch_id: selectedBranchId ?? undefined,
      role_name: "Operaria",
      limit: 200,
    })
      .then((data) => setOperarias(data))
      .catch(() => setOperarias([]))
      .finally(() => setOperariasLoading(false));
  }, [operariasOpen, selectedBranchId]);

  const handleSearchSelect = (href: string) => {
    setSearchDropdownOpen(false);
    setShowMobileSearch(false);
    navigate(href);
  };

  const notificationCount = notifications.length;

  const handleBranchChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const value = Number(event.target.value);
    const next = Number.isFinite(value) && value > 0 ? value : null;
    setSelectedBranchIdState(next);
    setSelectedBranchId(next);
  };

  return (
    <header className="relative z-[45] flex min-w-0 shrink-0 flex-col text-[#202522] [&_a]:cursor-pointer [&_button]:cursor-pointer [&_select]:cursor-pointer">
      <div className="relative z-[80] flex h-13 min-w-0 items-center gap-2 border-b border-white/8 bg-[#094732] px-2.5 shadow-[0_1px_0_rgba(255,255,255,0.06)] sm:px-4">
      <div
        className={`flex min-w-0 shrink-0 items-center gap-1 transition-opacity duration-150 ${showMobileSearch ? "pointer-events-none opacity-0 md:pointer-events-auto md:opacity-100" : "opacity-100"}`}
      >
        {/* Celular: abre el menú lateral deslizable (en ambos modos) */}
        <button
          type="button"
          onClick={() => setMobileNavOpen(true)}
          aria-label="Abrir menú"
          title="Menú"
          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-emerald-50/72 transition hover:bg-white/10 hover:text-white md:hidden"
        >
          <Menu className="h-4 w-4" />
        </button>

        {/* Modo sidebar (escritorio): fijar o colapsar la barra lateral */}
        {isSidebarMode && (
          <button
            type="button"
            onClick={toggleSidebarPinned}
            aria-label={sidebarPinned ? "Colapsar menú lateral" : "Fijar menú lateral"}
            title={sidebarPinned ? "Colapsar menú lateral" : "Fijar menú lateral"}
            className="hidden h-8 w-8 items-center justify-center rounded-md text-emerald-50/72 transition hover:bg-white/10 hover:text-white md:inline-flex"
          >
            {sidebarPinned ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeft className="h-4 w-4" />}
          </button>
        )}

        <NavLink
          to="/"
          className={`flex h-9 items-center gap-2 rounded-lg px-1.5 text-white transition hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/35 ${isSidebarMode ? "md:hidden" : ""}`}
          aria-label="Ir a Visión general"
        >
          {logoBase64 ? (
            <img
              src={logoBase64}
              alt="E-lashes"
              className="h-7 w-auto max-w-28 rounded-md bg-white/94 px-1 object-contain"
            />
          ) : (
            <>
              <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/15 bg-white/10 text-xs font-bold text-white shadow-sm">
                E
              </span>
              <span className="hidden text-[14px] font-semibold tracking-tight sm:inline">
                E-Lashes
              </span>
            </>
          )}
        </NavLink>
      </div>

      <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden">
        <div
          className="group relative ml-auto hidden w-52 min-w-0 2xl:block"
          ref={searchPanelRef}
        >
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-2.5">
            <Search className="h-3.5 w-3.5 text-emerald-100/65 transition-colors group-focus-within:text-white" />
          </div>
          <input
            type="text"
            placeholder="Buscar..."
            aria-label="Buscar en el sistema"
            className="h-8 w-full rounded-md border border-white/14 bg-white/9 py-1 pl-8 pr-10 text-xs text-white outline-none transition focus:border-white/28 focus:bg-white/13 focus:ring-2 focus:ring-white/10 placeholder:text-emerald-100/50"
            value={searchQuery}
            onChange={(event) => {
              setSearchQuery(event.target.value);
              setSearchDropdownOpen(true);
            }}
            onFocus={() => setSearchDropdownOpen(true)}
          />
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
            <kbd className="inline-flex items-center rounded border border-white/12 bg-black/10 px-1.5 py-0.5 text-[9px] font-medium text-emerald-100/65">
              ⌘ K
            </kbd>
          </div>
          {searchDropdownOpen && (
            <div className="absolute right-0 top-10 z-[100] w-96 rounded-xl border border-emerald-900/20 bg-[#094732]/98 p-3 shadow-2xl backdrop-blur-md">
              <div className="mb-2 flex items-center justify-between border-b border-emerald-900/70 pb-2">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-white">Resultados</p>
                  <span className="inline-flex items-center rounded-full border border-emerald-700/70 bg-emerald-900/40 px-2 py-0.5 text-[10px] font-semibold text-emerald-200">
                    {searchResults.length}
                  </span>
                </div>
                {searchQuery.trim().length > 0 ? (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery("");
                      setSearchResults([]);
                      setSearchError(null);
                    }}
                    className="rounded-lg border border-emerald-700/60 px-2.5 py-1 text-[11px] font-semibold text-emerald-200 transition hover:bg-emerald-900/60"
                  >
                    Limpiar
                  </button>
                ) : null}
              </div>
              <div className="mt-3 max-h-64 space-y-2 overflow-y-auto">
                {searchLoading ? (
                  <p className="text-sm text-emerald-200">Buscando...</p>
                ) : searchError ? (
                  <p className="text-sm text-rose-200">{searchError}</p>
                ) : searchQuery.trim().length === 0 ? (
                  <p className="text-sm text-emerald-200">
                    Escribe para buscar.
                  </p>
                ) : searchResults.length === 0 ? (
                  <p className="text-sm text-emerald-200">
                    No se encontraron resultados.
                  </p>
                ) : (
                  searchResults.map((result) => (
                    <button
                      key={result.id}
                      type="button"
                      onClick={() => handleSearchSelect(result.href)}
                      className="w-full rounded-xl border border-emerald-900/60 bg-emerald-900/35 p-3 text-left transition hover:bg-emerald-900/60"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-white">
                            {result.label}
                          </p>
                          {result.subtitle && (
                            <p className="truncate text-xs text-emerald-200">
                              {result.subtitle}
                            </p>
                          )}
                        </div>
                        <span
                          className={`inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${SEARCH_TYPE_CLASS[result.type]}`}
                        >
                          {SEARCH_TYPE_LABEL[result.type]}
                        </span>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Mobile Search Overlay (Blanco para legibilidad al escribir) */}
        {showMobileSearch && (
          <div
            className="fixed inset-0 z-[80] flex items-start justify-center bg-black/35 p-4 pt-16 backdrop-blur-sm 2xl:hidden"
            onClick={() => setShowMobileSearch(false)}
            role="presentation"
          >
            <div
              className="w-full max-w-lg rounded-xl bg-white p-4 shadow-2xl"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex items-center gap-3">
                <Search className="h-5 w-5 text-[#094732]" />
                <input
                  autoFocus
                  type="text"
                  placeholder="Buscar..."
                  className="flex-1 bg-transparent border-none outline-none text-slate-800 placeholder:text-slate-400 text-base"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowMobileSearch(false)}
                  className="p-2 rounded-full bg-slate-100 text-slate-600"
                  aria-label="Cerrar búsqueda"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="mt-4 max-h-[60vh] overflow-y-auto">
                {searchLoading ? (
                  <p className="text-sm text-slate-500">Buscando...</p>
                ) : searchError ? (
                  <p className="text-sm text-rose-600">{searchError}</p>
                ) : searchQuery.trim().length === 0 ? (
                  <p className="text-sm text-slate-500">Escribe para buscar.</p>
                ) : searchResults.length === 0 ? (
                  <p className="text-sm text-slate-500">
                    No se encontraron resultados.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {searchResults.map((result) => (
                      <button
                        key={result.id}
                        type="button"
                        onClick={() => handleSearchSelect(result.href)}
                        className="w-full rounded-xl border border-slate-200 p-3 text-left transition hover:bg-slate-50"
                      >
                        <p className="text-sm font-semibold text-slate-800">
                          {result.label}
                        </p>
                        {result.subtitle && (
                          <p className="text-xs text-slate-500">
                            {result.subtitle}
                          </p>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* --- 3. SECCIÓN DERECHA: Acciones --- */}
      <div
        className={`flex min-w-0 shrink-0 items-center gap-0.5 transition-opacity duration-150 ${showMobileSearch ? "pointer-events-none opacity-0 md:pointer-events-auto md:opacity-100" : "opacity-100"}`}
      >
        <div className="hidden items-center gap-0.5 lg:flex">
          {canManageAppointments && (
            <NavLink
              to="/admin/calendar/agenda"
              aria-label="Nueva cita"
              title="Nueva cita"
              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-emerald-50/72 transition hover:bg-white/10 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
            >
              <CalendarPlus className="h-4 w-4" />
            </NavLink>
          )}
          {canManagePayments && (
            <NavLink
              to="/admin/pos"
              aria-label="Nueva venta"
              title="Nueva venta"
              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-emerald-50/72 transition hover:bg-white/10 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
            >
              <ShoppingBag className="h-4 w-4" />
            </NavLink>
          )}
          {canOpenTracking && (
            <NavLink
              to="/admin/pos-tracking"
              aria-label="Control operativo"
              title="Control operativo"
              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-emerald-50/72 transition hover:bg-white/10 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
            >
              <Activity className="h-4 w-4" />
            </NavLink>
          )}
        </div>

        <div className="mx-1 hidden h-4 w-px bg-white/12 lg:block" />

        <div className="flex h-8 shrink-0 items-center gap-1.5 rounded-md border border-white/12 bg-white/8 px-2 text-emerald-50/85">
          <span className="hidden text-[9px] uppercase tracking-[0.12em] text-emerald-100/55 xl:inline">
            Sucursal
          </span>
          {canSelectBranch ? (
            <select
              value={selectedBranchId ?? ""}
              onChange={handleBranchChange}
              className="max-w-28 cursor-pointer bg-transparent text-[11px] font-medium text-white outline-none"
            >
              <option value="" className="text-slate-900">
                Todas
              </option>
              {branches.map((branch) => (
                <option
                  key={branch.id}
                  value={branch.id}
                  className="text-slate-900"
                >
                  {branch.name}
                </option>
              ))}
            </select>
          ) : (
            <span className="max-w-28 truncate text-[11px] font-medium text-white">
              {branches.find((b) => b.id === selectedBranchId)?.name ??
                "Sin sucursal"}
            </span>
          )}
        </div>

        {/* Operarias del turno */}
        <div className="relative hidden 2xl:block" ref={operariasPanelRef}>
          <button
            type="button"
            onClick={() => setOperariasOpen((prev) => !prev)}
            className={`flex h-8 items-center gap-1.5 rounded-md border px-2 text-[11px] font-medium transition-all ${
              operariasOpen
                ? "border-white/25 bg-white/16 text-white"
                : "border-white/12 bg-white/8 text-emerald-50/78 hover:bg-white/14 hover:text-white"
            }`}
            title={
              selectedBranchId
                ? "Ver operarias de esta sucursal"
                : "Ver todas las operarias"
            }
          >
            <Users className="h-3.5 w-3.5" />
            <span>Operarias</span>
          </button>

          {operariasOpen && (
            <div className="absolute right-0 z-[100] mt-3 w-72 rounded-2xl border border-emerald-800/80 bg-[#094732]/98 p-4 shadow-2xl backdrop-blur-md">
              <div className="flex items-center justify-between border-b border-emerald-900/70 pb-2">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-emerald-300" />
                  <p className="text-sm font-semibold text-white">
                    {selectedBranchId
                      ? (branches.find((b) => b.id === selectedBranchId)
                          ?.name ?? "Sucursal")
                      : "Todas las sucursales"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setOperariasOpen(false)}
                  className="rounded-lg p-1 text-emerald-400 hover:bg-emerald-900/60"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>

              <div className="mt-3 max-h-72 space-y-2 overflow-y-auto">
                {operariasLoading ? (
                  <p className="text-sm text-emerald-200">
                    Cargando operarias...
                  </p>
                ) : operarias.length === 0 ? (
                  <p className="text-sm text-emerald-200">
                    No hay operarias registradas.
                  </p>
                ) : (
                  operarias.map((op) => (
                    <div
                      key={op.id}
                      className="flex items-center gap-3 rounded-xl border border-emerald-900/60 bg-emerald-900/35 px-3 py-2"
                    >
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-xs font-bold text-white">
                        {op.username.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-xs font-semibold text-white">
                          {op.username}
                        </p>
                        <p className="truncate text-[10px] text-emerald-300">
                          {op.email}
                        </p>
                        {!selectedBranchId && op.branch_name && (
                          <p className="truncate text-[10px] text-emerald-400">
                            {op.branch_name}
                          </p>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>

              <p className="mt-3 text-[10px] text-emerald-400">
                {operariasLoading
                  ? ""
                  : `${operarias.length} operaria${operarias.length !== 1 ? "s" : ""}`}
              </p>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={() => setShowMobileSearch(true)}
          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-emerald-50/72 transition-colors hover:bg-white/10 hover:text-white 2xl:hidden"
          aria-label="Buscar"
          title="Buscar"
        >
          <Search className="h-4 w-4" />
        </button>

        {/* Posición del menú (sidebar / top) */}
        <LayoutCustomizer />

        {/* Mode switch */}
        <ModeSwitch />

        {/* Notificaciones */}
        <div className="relative" ref={notificationPanelRef}>
          <button
            type="button"
            onClick={() => setNotificationsOpen((prev) => !prev)}
            className="relative inline-flex h-8 w-8 items-center justify-center rounded-md text-emerald-50/72 transition hover:bg-white/10 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/30 active:scale-95"
            aria-label="Notificaciones"
            title="Notificaciones"
          >
            <Bell className="h-4 w-4" />
            {notificationCount > 0 && (
              <span className="absolute right-1.5 top-1.5 flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#9F8351] opacity-60"></span>
                <span className="relative inline-flex h-2 w-2 rounded-full border border-[#f5f6f5] bg-[#9F8351]"></span>
              </span>
            )}
          </button>
          {notificationsOpen && (
            <div className="absolute right-0 z-[100] mt-3 w-80 rounded-2xl border border-emerald-800/80 bg-[#094732]/98 p-4 shadow-2xl backdrop-blur-md">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-white">
                  Notificaciones
                </p>
                <span className="text-xs text-emerald-300">Hoy</span>
              </div>
              <div className="mt-3 max-h-64 space-y-2 overflow-y-auto">
                {notificationsLoading ? (
                  <p className="text-sm text-emerald-200">Cargando...</p>
                ) : notifications.length === 0 ? (
                  <p className="text-sm text-emerald-200">
                    Sin notificaciones.
                  </p>
                ) : (
                  notifications.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleSearchSelect(item.href)}
                      className="w-full rounded-xl border border-emerald-900/60 bg-emerald-900/35 p-3 text-left transition hover:bg-emerald-900/60"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-white">
                            {item.title}
                          </p>
                          {item.subtitle && (
                            <p className="truncate text-xs text-emerald-200">
                              {item.subtitle}
                            </p>
                          )}
                        </div>
                        <span
                          className={`inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${STATUS_BADGE_CLASS[item.status] ?? "border-slate-500/40 bg-slate-500/15 text-slate-100"}`}
                        >
                          {STATUS_ES[item.status] ?? item.status}
                        </span>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        <div className="mx-1 hidden h-4 w-px bg-white/12 sm:block"></div>

        {/* Perfil de Usuario */}
        <div className="relative" ref={profilePanelRef}>
          <button
            type="button"
            onClick={() => setProfileDropdownOpen((prev) => !prev)}
            className="group flex h-8 items-center gap-1.5 rounded-md px-1 transition hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
            aria-label="Abrir menú de usuario"
          >
            <div className="relative flex h-6 w-6 items-center justify-center rounded-full bg-white/14 text-[10px] font-semibold text-white ring-1 ring-white/20 transition-transform group-hover:scale-105">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt="Avatar"
                  className="w-full h-full rounded-full object-cover"
                />
              ) : (
                <span>
                  {displayName.charAt(0).toUpperCase()}
                </span>
              )}
              <span className="absolute -bottom-px -right-px h-2 w-2 rounded-full border border-[#f5f6f5] bg-emerald-500" />
            </div>
            <div className="hidden flex-col items-start text-left 2xl:flex">
              <p className="max-w-28 truncate text-[11px] font-semibold leading-none text-white">
                {displayName}
              </p>
              <p className="mt-0.5 max-w-28 truncate text-[9px] font-medium text-emerald-100/60">
                {displayRole}
              </p>
            </div>
            <ChevronDown
              className={`hidden h-3 w-3 text-emerald-100/55 transition-transform 2xl:block ${profileDropdownOpen ? "rotate-180" : ""}`}
            />
          </button>

          {profileDropdownOpen && (
            <div className="absolute right-0 z-[100] mt-2 w-72 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl shadow-slate-900/15">
              {/* Header del card */}
              <div className="flex items-center gap-3 px-4 py-4 bg-gradient-to-r from-[#094732] to-[#0d5c40]">
                <div className="w-11 h-11 rounded-full bg-white/20 backdrop-blur flex items-center justify-center text-white font-bold text-base ring-2 ring-white/30 shrink-0">
                  {avatarUrl ? (
                    <img
                      src={avatarUrl}
                      alt="Avatar"
                      className="w-full h-full rounded-full object-cover"
                    />
                  ) : (
                    <span>{displayName.charAt(0).toUpperCase()}</span>
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-white truncate">
                    {displayName}
                  </p>
                  <div className="flex items-center gap-1 mt-0.5">
                    <Shield className="h-3 w-3 text-emerald-300 shrink-0" />
                    <p className="text-[11px] text-emerald-200 font-medium truncate">
                      {displayRole}
                    </p>
                  </div>
                </div>
              </div>

              {/* Acciones */}
              <div className="p-2">
                <NavLink
                  to="/profile"
                  onClick={() => setProfileDropdownOpen(false)}
                  className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium text-emerald-700 hover:bg-emerald-50 transition-colors group/item"
                >
                  <div className="w-8 h-8 rounded-lg bg-emerald-50 group-hover/item:bg-emerald-100 flex items-center justify-center transition-colors">
                    <Settings className="h-4 w-4 text-emerald-500 group-hover/item:text-emerald-700 transition-colors" />
                  </div>
                  <span>Configuraciones</span>
                </NavLink>

                {/* Línea separadora con un toque verde muy sutil */}
                <div className="mx-3 my-1.5 border-t border-emerald-50" />

                <button
                  type="button"
                  onClick={() => {
                    setProfileDropdownOpen(false);
                    handleLogout();
                  }}
                  className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium text-rose-600 hover:bg-rose-50 transition-colors group/item"
                >
                  <div className="w-8 h-8 rounded-lg bg-rose-50 group-hover/item:bg-rose-100 flex items-center justify-center transition-colors">
                    <LogOut className="h-4 w-4 text-rose-500 transition-colors" />
                  </div>
                  <span>Cerrar sesión</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
      </div>

      {!isSidebarMode && (
        <div className="hidden md:block">
          <HorizontalNavigation />
        </div>
      )}

      <MobileNavigationSheet open={mobileNavOpen} onClose={closeMobileNav} />
    </header>
  );
}
