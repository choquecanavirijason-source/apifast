import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Menu, Bell, Search, ChevronDown, X, TimerReset, LogOut } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { logout as logoutAction, updateSession } from "@/core/reducer/auth.reducer";
import type { AppDispatch, RootState } from "@/store";
import { BranchService } from "@/core/services/branch/branch.service";
import { AgendaService } from "@/core/services/agenda/agenda.service";
import { AuthService } from "@/core/services/auth/auth.service";
import { getSelectedBranchId, setSelectedBranchId } from "@/core/utils/branch";
import variables from "@/core/config/variables";

interface HeaderProps {
  collapsed: boolean;
  setCollapsed: (v: boolean) => void;
}

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
  { id: "section-tickets-finalizados", label: "Tickets finalizados", href: "/admin/tickets/finalizados" },
  { id: "section-operarias", label: "Operarias", href: "/admin/professionals/history" },
  { id: "section-servicios", label: "Servicios", href: "/admin/services" },
  { id: "section-control-servicios", label: "Control de servicios", href: "/admin/services/queue" },
  { id: "section-calendario", label: "Calendario", href: "/admin/calendar" },
  { id: "section-inventario", label: "Inventario", href: "/admin/products" },
  { id: "section-caja", label: "Caja & Seguimiento", href: "/admin/pos-tracking" },
];

const NOTIFICATION_STATUS_CLASS: Record<string, string> = {
  pending: "border-amber-500/40 bg-amber-500/15 text-amber-100",
  confirmed: "border-sky-500/40 bg-sky-500/15 text-sky-100",
  in_service: "border-emerald-500/40 bg-emerald-500/15 text-emerald-100",
};

export default function Header({ 
  setCollapsed, 
  collapsed,
}: HeaderProps) {
  const idleDeadlineRef = useRef<number>(Date.now());
  const idleLogoutTriggeredRef = useRef(false);
  const idleTimeoutSeconds = 3 * 60 * 60;
  const [showMobileSearch, setShowMobileSearch] = useState(false);
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();
  const { user, sessionExpiresAt } = useSelector((state: RootState) => state.auth);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [idleRemainingSeconds, setIdleRemainingSeconds] = useState(idleTimeoutSeconds);
  const [branches, setBranches] = useState<Array<{ id: number; name: string }>>([]);
  const [selectedBranchId, setSelectedBranchIdState] = useState<number | null>(() => getSelectedBranchId());
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResultItem[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchDropdownOpen, setSearchDropdownOpen] = useState(false);
  const [servicesCache, setServicesCache] = useState<Array<{ id: number; name: string }>>([]);
  const [servicesCacheBranchId, setServicesCacheBranchId] = useState<number | null>(null);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const isRefreshingRef = useRef(false);
  const lastRefreshAtRef = useRef(0);
  const searchPanelRef = useRef<HTMLDivElement | null>(null);
  const notificationPanelRef = useRef<HTMLDivElement | null>(null);
  const profilePanelRef = useRef<HTMLDivElement | null>(null);

  const displayName =
    (user as { username?: string; full_name?: string; name?: string; email?: string } | null)?.username ||
    (user as { full_name?: string; name?: string; email?: string } | null)?.full_name ||
    (user as { name?: string; email?: string } | null)?.name ||
    user?.email ||
    "Usuario";

  const displayRole =
    (() => {
      const roleValue = (user as { role?: unknown; roles?: unknown[] } | null)?.role;
      if (typeof roleValue === "string") return roleValue;
      if (roleValue && typeof roleValue === "object" && "name" in (roleValue as Record<string, unknown>)) {
        const roleName = (roleValue as { name?: unknown }).name;
        if (typeof roleName === "string") return roleName;
      }
      const firstRole = (user as { roles?: unknown[] } | null)?.roles?.[0];
      if (typeof firstRole === "string") return firstRole;
      if (firstRole && typeof firstRole === "object" && "name" in (firstRole as Record<string, unknown>)) {
        const roleName = (firstRole as { name?: unknown }).name;
        if (typeof roleName === "string") return roleName;
      }
      return "Sesión activa";
    })();

  const avatarUrl = (user as { avatar?: string } | null)?.avatar;

  useEffect(() => {
    if (!sessionExpiresAt) {
      setRemainingSeconds(0);
      return;
    }

    const updateRemaining = () => {
      const diff = Math.max(
        0,
        Math.floor((new Date(sessionExpiresAt).getTime() - Date.now()) / 1000)
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
        localStorage.setItem(variables.session.sessionExpiresAt, data.expires_at);
      }
      if (data?.expires_in_minutes != null) {
        localStorage.setItem(variables.session.sessionDurationMinutes, String(data.expires_in_minutes));
      }
      dispatch(updateSession({
        sessionExpiresAt: data?.expires_at ?? null,
        sessionDurationMinutes: data?.expires_in_minutes ?? null,
      }));
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
        Math.floor((idleDeadlineRef.current - Date.now()) / 1000)
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
      if (searchPanelRef.current && target && !searchPanelRef.current.contains(target)) {
        setSearchDropdownOpen(false);
      }
      if (notificationPanelRef.current && target && !notificationPanelRef.current.contains(target)) {
        setNotificationsOpen(false);
      }
      if (profilePanelRef.current && target && !profilePanelRef.current.contains(target)) {
        setProfileDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  useEffect(() => {
    let isMounted = true;
    BranchService.list({ limit: 200 })
      .then((data) => {
        if (!isMounted) return;
        setBranches(data);
        if (!selectedBranchId && data.length > 0) {
          const fallback = data[0].id;
          setSelectedBranchIdState(fallback);
          setSelectedBranchId(fallback);
        }
      })
      .catch((error) => {
        console.error("Error cargando sucursales:", error);
        if (isMounted) setBranches([]);
      });
    return () => {
      isMounted = false;
    };
  }, [selectedBranchId]);

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
          : AgendaService.listServices({ limit: 200, branch_id: activeBranchId }).then((data) => {
              const normalized = data.map((service) => ({ id: service.id, name: service.name }));
              setServicesCache(normalized);
              setServicesCacheBranchId(selectedBranchId ?? null);
              return normalized;
            });

      Promise.allSettled([
        AgendaService.listClientsForSelect({ limit: 8, search: trimmed, branch_id: activeBranchId }),
        AgendaService.listTickets({ limit: 8, search: trimmed, branch_id: activeBranchId }),
        servicesPromise,
      ])
        .then((settled) => {
          const [clientsRes, ticketsRes, servicesRes] = settled;
          const clientsData = clientsRes.status === "fulfilled" ? clientsRes.value : [];
          const ticketsData = ticketsRes.status === "fulfilled" ? ticketsRes.value : [];
          const servicesData = servicesRes.status === "fulfilled" ? servicesRes.value : [];

          const normalizedSearch = trimmed.toLowerCase();
          const serviceMatches = servicesData
            .filter((service) => service.name.toLowerCase().includes(normalizedSearch))
            .slice(0, 8);

          const sectionMatches = APP_SECTIONS
            .filter((section) => section.label.toLowerCase().includes(normalizedSearch))
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
        ["pending", "confirmed", "in_service"].includes(ticket.status)
      );
      setNotifications(
        filtered.slice(0, 8).map((ticket) => ({
          id: ticket.id,
          title: ticket.ticket_code ?? `Ticket #${ticket.id}`,
          subtitle: ticket.client_name,
          status: ticket.status,
          href: "/admin/tickets",
        }))
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

  const sessionLabel = useMemo(() => {
    if (idleRemainingSeconds <= 0) return "Sesión por expirar";

    const hours = Math.floor(idleRemainingSeconds / 3600);
    const minutes = Math.floor((idleRemainingSeconds % 3600) / 60);
    const seconds = idleRemainingSeconds % 60;
    const formatted = `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
    if (idleRemainingSeconds <= 5 * 60) return `Expira en ${formatted}`;
    return formatted;
  }, [idleRemainingSeconds]);

  const tokenLabel = useMemo(() => {
    if (!remainingSeconds || remainingSeconds <= 0) return "--:--";
    const minutes = Math.floor(remainingSeconds / 60);
    const seconds = remainingSeconds % 60;
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }, [remainingSeconds]);

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
    // CAMBIO PRINCIPAL: bg-[#094732] (Verde Esmeralda) y texto blanco
    <header className="h-20 bg-gradient-to-r from-[#162d26] via-[#1C352D] to-[#1a312a] border-b border-emerald-800/80 flex items-center justify-between px-4 md:px-6 sticky top-0 z-40 transition-all duration-300 shadow-lg shadow-emerald-950/30 min-w-0 backdrop-blur-sm">
      
      {/* --- 1. SECCIÓN IZQUIERDA: Toggle & Título --- */}
      <div className={`flex items-center gap-4 transition-opacity duration-200 min-w-0 ${showMobileSearch ? 'opacity-0 md:opacity-100 pointer-events-none md:pointer-events-auto' : 'opacity-100'}`}>
        <button
          onClick={() => setCollapsed(!collapsed)}
          // Botones con hover translúcido claro
          className="p-2.5 rounded-xl text-emerald-100 hover:bg-white/10 hover:text-white transition-colors focus:outline-none focus:ring-2 focus:ring-white/20"
          aria-label={collapsed ? "Expandir menú" : "Colapsar menú"}
        >
          <Menu className="w-6 h-6" />
        </button>
        
          <div className="hidden md:flex flex-col">
            <h1 className="font-bold text-white text-lg leading-tight tracking-tight drop-shadow-sm">
             Panel de Control
           </h1>
            <span className="text-[11px] text-emerald-200/80 font-medium tracking-wide">Bienvenido de nuevo</span>
        </div>
      </div>

      {/* --- 2. SECCIÓN CENTRAL: Buscador (Estilo Dark) --- */}
      <div className="flex-1 flex justify-center px-4 lg:px-10 min-w-0">
        
        <div className="relative w-full max-w-[680px] min-w-0 hidden md:block group" ref={searchPanelRef}>
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-emerald-300 group-focus-within:text-white transition-colors" />
          </div>
          <input
            type="text"
            placeholder="Buscar en el sistema..."
            // Input oscuro semitransparente
            className="w-full pl-11 pr-4 py-2.5 bg-emerald-900/45 border border-emerald-800/80 rounded-xl focus:bg-emerald-900/70 focus:ring-2 focus:ring-emerald-400/30 focus:border-emerald-500 transition-all duration-200 text-sm text-white placeholder:text-emerald-300/55 outline-none shadow-inner"
            value={searchQuery}
            onChange={(event) => {
              setSearchQuery(event.target.value);
              setSearchDropdownOpen(true);
            }}
            onFocus={() => setSearchDropdownOpen(true)}
          />
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
             <kbd className="hidden lg:inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium text-emerald-300 bg-emerald-800/50 border border-emerald-700 rounded-md">
                ⌘ K
             </kbd>
          </div>
          {searchDropdownOpen && (
            <div className="absolute left-0 top-12 w-full rounded-2xl border border-emerald-800/80 bg-[#0F241E]/95 backdrop-blur-md p-4 shadow-2xl">
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
                  <p className="text-sm text-emerald-200">Escribe para buscar.</p>
                ) : searchResults.length === 0 ? (
                  <p className="text-sm text-emerald-200">No se encontraron resultados.</p>
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
                          <p className="truncate text-sm font-semibold text-white">{result.label}</p>
                          {result.subtitle && <p className="truncate text-xs text-emerald-200">{result.subtitle}</p>}
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
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 md:hidden">
            <div className="w-full max-w-lg rounded-2xl bg-white p-4 shadow-2xl">
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
                  onClick={() => setShowMobileSearch(false)}
                  className="p-2 rounded-full bg-slate-100 text-slate-600"
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
                  <p className="text-sm text-slate-500">No se encontraron resultados.</p>
                ) : (
                  <div className="space-y-2">
                    {searchResults.map((result) => (
                      <button
                        key={result.id}
                        type="button"
                        onClick={() => handleSearchSelect(result.href)}
                        className="w-full rounded-xl border border-slate-200 p-3 text-left transition hover:bg-slate-50"
                      >
                        <p className="text-sm font-semibold text-slate-800">{result.label}</p>
                        {result.subtitle && <p className="text-xs text-slate-500">{result.subtitle}</p>}
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
      <div className={`flex items-center gap-2 sm:gap-4 transition-opacity duration-200 min-w-0 ${showMobileSearch ? 'opacity-0 md:opacity-100 pointer-events-none md:pointer-events-auto' : 'opacity-100'}`}>

        <div className="hidden md:flex items-center gap-2 rounded-xl border border-emerald-800 bg-emerald-900/40 px-3 py-2 text-emerald-100">
          <span className="text-[10px] uppercase tracking-wider text-emerald-300/80">Sucursal</span>
          <select
            value={selectedBranchId ?? ""}
            onChange={handleBranchChange}
            className="bg-transparent text-xs font-semibold text-white outline-none"
          >
            {branches.length === 0 ? (
              <option value="">Sin sucursales</option>
            ) : (
              branches.map((branch) => (
                <option key={branch.id} value={branch.id} className="text-slate-900">
                  {branch.name}
                </option>
              ))
            )}
          </select>
        </div>
        
        <button 
          onClick={() => setShowMobileSearch(true)}
          className="md:hidden p-2.5 rounded-xl text-emerald-100 hover:bg-white/10 transition-colors"
        >
          <Search className="w-5 h-5" />
        </button>

        {/* Notificaciones */}
        <div className="relative" ref={notificationPanelRef}>
          <button 
            type="button"
            onClick={() => setNotificationsOpen((prev) => !prev)}
            className="relative p-2.5 rounded-xl text-emerald-100 hover:bg-white/10 hover:text-white transition-all focus:outline-none active:scale-95"
            aria-label="Notificaciones"
          >
            <Bell className="w-5 h-5" />
            {notificationCount > 0 && (
              <span className="absolute top-2.5 right-2.5 flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-400 border-2 border-[#094732]"></span>
              </span>
            )}
          </button>
          {notificationsOpen && (
            <div className="absolute right-0 mt-3 w-80 rounded-2xl border border-emerald-800/80 bg-[#0F241E]/95 backdrop-blur-md p-4 shadow-2xl">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-white">Notificaciones</p>
                <span className="text-xs text-emerald-300">Hoy</span>
              </div>
              <div className="mt-3 max-h-64 space-y-2 overflow-y-auto">
                {notificationsLoading ? (
                  <p className="text-sm text-emerald-200">Cargando...</p>
                ) : notifications.length === 0 ? (
                  <p className="text-sm text-emerald-200">Sin notificaciones.</p>
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
                          <p className="truncate text-sm font-semibold text-white">{item.title}</p>
                          {item.subtitle && <p className="truncate text-xs text-emerald-200">{item.subtitle}</p>}
                        </div>
                        <span
                          className={`inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                            NOTIFICATION_STATUS_CLASS[item.status] ?? "border-slate-500/40 bg-slate-500/15 text-slate-100"
                          }`}
                        >
                          {item.status}
                        </span>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        <div className="h-8 w-px bg-emerald-800 hidden sm:block"></div>

        <div className="hidden lg:flex items-center gap-2 rounded-xl border border-emerald-800 bg-emerald-900/40 px-3 py-2 text-emerald-100">
          <TimerReset className="h-4 w-4 text-emerald-300" />
          <div className="flex flex-col leading-none">
            <span className="text-[10px] uppercase tracking-wider text-emerald-300/80">Sesión</span>
            <span className="mt-1 text-xs font-bold text-white">{sessionLabel}</span>
            <span className="mt-1 text-[10px] font-medium text-emerald-300/80">Token {tokenLabel}</span>
          </div>
        </div>

        {/* Perfil de Usuario */}
        <div className="relative" ref={profilePanelRef}>
          <button
            type="button"
            onClick={() => setProfileDropdownOpen((prev) => !prev)}
            className="flex items-center gap-3 pl-1 pr-2 py-1 rounded-full hover:bg-white/10 transition-all border border-transparent hover:border-emerald-700 group focus:outline-none"
          >
            {/* Avatar Blanco con texto Verde para contrastar */}
            <div className="relative w-9 h-9 rounded-full bg-white flex items-center justify-center text-[#094732] font-bold shadow-md shadow-black/20 ring-2 ring-emerald-800 group-hover:scale-105 transition-transform">
              {avatarUrl ? (
                <img src={avatarUrl} alt="Avatar" className="w-full h-full rounded-full object-cover" />
              ) : (
                  <span className="text-sm">{displayName.charAt(0)}</span>
              )}
              <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border border-[#1C352D] bg-emerald-400" />
            </div>
            
            <div className="hidden md:flex flex-col items-start text-left">
               <p className="text-sm font-bold text-white transition-colors leading-none">
                  {displayName}
               </p>
               <p className="text-[10px] font-medium text-emerald-300 uppercase tracking-wide mt-1 group-hover:text-emerald-200">
                  {displayRole}
               </p>
            </div>

            <ChevronDown className="w-4 h-4 text-emerald-400 group-hover:text-white transition-colors hidden md:block" />
          </button>

          {profileDropdownOpen && (
            <div className="absolute right-0 mt-3 w-64 rounded-2xl border border-emerald-800/80 bg-[#0F241E]/95 backdrop-blur-md p-4 shadow-2xl">
              <p className="text-sm font-semibold text-white">{displayName}</p>
              <p className="mt-1 text-xs text-emerald-200">{displayRole}</p>
              <div className="mt-3 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setProfileDropdownOpen(false)}
                  className="rounded-lg border border-emerald-700/70 px-3 py-1.5 text-xs font-semibold text-emerald-200 transition hover:bg-emerald-900/60"
                >
                  Cerrar
                </button>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="inline-flex items-center gap-1 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-xs font-semibold text-rose-100 transition hover:bg-rose-500/20"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  Cerrar sesión
                </button>
              </div>
            </div>
          )}
        </div>

      </div>
    </header>
  );
}