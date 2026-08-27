import { Navigate, Outlet, useLocation } from "react-router";
import useAuth from "../core/hooks/useAuth";
import type { IPermission } from "@/core/types/IPermission";
import variables from "@/core/config/variables";

// Returns true only if `route` is a proper path prefix of `path`
// (exact match OR next char after route is '/')
function isPathPrefix(route: string, path: string): boolean {
  if (!path.startsWith(route)) return false;
  return path.length === route.length || path[route.length] === "/";
}

// Roles acotados a un puñado de rutas — a diferencia de routePermissions
// (que solo filtra por permiso y deja pasar cualquier ruta "abierta" no
// listada), esto bloquea TODO lo que no esté en la lista, sin importar qué
// permisos tenga el rol. Pensado para Cajera: solo debe poder usar el POS,
// aunque sus permisos (clients:view, services:view, etc.) también le
// alcancen para entrar a otras pantallas si se las escribe a mano en la URL.
const ROLE_ALLOWED_PREFIXES: Record<string, string[]> = {
  Cajera: ["/admin/pos-tracking", "/admin/perfil"],
};
const ROLE_LANDING_ROUTE: Record<string, string> = {
  Cajera: "/admin/pos-tracking",
};

const PrivateRoute = () => {
  const location = useLocation();
  const { isAuthenticated, hasAnyPermission, hasAnyPermissionByName, hasRole, isAdmin } = useAuth();
  const hasToken = Boolean(localStorage.getItem(variables.session.tokenName));

  const currentPath = location.pathname;

  // null  → any authenticated user may access
  // array → user must have at least one of these permissions (or isAdmin() bypasses)
  //
  // Antes casi todas estas rutas eran `null` (abiertas a cualquiera con
  // sesión), así que cualquier rol podía entrar escribiendo la URL aunque
  // sus permisos no tuvieran nada que ver con esa pantalla. Ahora cada una
  // pide el mismo permiso que ya necesita para cargar sus datos — esto se
  // aplica por PERMISO, no por nombre de rol, así que un rol nuevo que se
  // cree más adelante queda automáticamente bien encajonado según los
  // permisos que se le asignen, sin tener que tocar este archivo de nuevo.
  const routePermissions: Record<string, IPermission[] | null> = {
    // Abierto a cualquiera con sesión — no depende de datos de ningún módulo
    "/admin/perfil": null,

    "/": ["dashboard:view"] as IPermission[],
    "/clients": ["clients:view", "clients:manage"] as IPermission[],
    "/lash-designs": ["catalog:view", "catalog:manage"] as IPermission[],
    "/effects": ["catalog:view", "catalog:manage"] as IPermission[],
    "/eye-types": ["catalog:view", "catalog:manage"] as IPermission[],
    "/designs": ["catalog:view", "catalog:manage"] as IPermission[],
    "/volumen": ["catalog:view", "catalog:manage"] as IPermission[],
    "/questionnaire": ["forms:view", "forms:manage"] as IPermission[],
    "/lash-tracking": ["tracking:view", "tracking:manage"] as IPermission[],
    "/admin/pos": ["payments:view", "payments:manage"] as IPermission[],
    "/admin/pos-tracking": [
      "appointments:view", "appointments:manage", "payments:view", "payments:manage",
    ] as IPermission[],
    "/admin/calendar": ["appointments:view", "appointments:manage"] as IPermission[],
    "/admin/services": ["services:view", "services:manage"] as IPermission[],
    "/admin/tickets": ["appointments:view", "appointments:manage"] as IPermission[],
    "/admin/professionals": ["payments:view", "payments:manage"] as IPermission[],
    "/admin/turns": ["appointments:view", "appointments:manage"] as IPermission[],

    // Admin-restricted routes
    "/users": ["users:manage"] as IPermission[],
    "/settings": ["settings:view"] as IPermission[],
    "/admin/salons": ["branches:manage"] as IPermission[],
    "/admin/salons/corte-caja": ["payments:view", "payments:manage"] as IPermission[],
    "/admin/salons/caja": ["payments:view", "payments:manage"] as IPermission[],
    "/admin/products": ["inventory:view", "inventory:manage"] as IPermission[],
    "/admin/ai": ["ai:view", "ai:manage"] as IPermission[],
  };

  if (!hasToken || !isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // 0. Roles acotados a un set fijo de rutas (ver ROLE_ALLOWED_PREFIXES) —
  // se evalúa antes que la tabla de permisos porque esto es más restrictivo,
  // no un reemplazo: aunque el permiso alcance, si la ruta no está en su
  // lista permitida, no entra.
  const restrictedRoleName = Object.keys(ROLE_ALLOWED_PREFIXES).find((role) => hasRole(role));
  if (restrictedRoleName) {
    const allowedPrefixes = ROLE_ALLOWED_PREFIXES[restrictedRoleName];
    const withinAllowedArea = allowedPrefixes.some((prefix) => isPathPrefix(prefix, currentPath));
    if (!withinAllowedArea) {
      return <Navigate to={ROLE_LANDING_ROUTE[restrictedRoleName]} replace />;
    }
  }

  // 1. Exact match
  let requiredPermissions: IPermission[] | null = null;
  let matched = false;

  if (routePermissions[currentPath] !== undefined) {
    requiredPermissions = routePermissions[currentPath];
    matched = true;
  } else {
    // 2. Longest prefix match (prevents /admin/pos matching /admin/pos-tracking)
    let longestMatch = "";
    for (const route in routePermissions) {
      if (isPathPrefix(route, currentPath) && route.length > longestMatch.length) {
        longestMatch = route;
      }
    }
    if (longestMatch) {
      requiredPermissions = routePermissions[longestMatch];
      matched = true;
    }
  }

  // 3. Route not in table → open to any authenticated user
  if (!matched || requiredPermissions === null) {
    return <Outlet />;
  }

  const allowed =
    requiredPermissions.length === 0 ||
    hasAnyPermission(requiredPermissions) ||
    hasAnyPermissionByName(requiredPermissions as string[]) ||
    isAdmin();

  if (allowed) {
    return <Outlet />;
  }

  return <Navigate to="/" replace state={{ unauthorized: true }} />;
};

export default PrivateRoute;