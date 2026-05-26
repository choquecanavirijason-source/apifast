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

const PrivateRoute = () => {
  const location = useLocation();
  const { isAuthenticated, hasAnyPermission, hasAnyPermissionByName, isAdmin } = useAuth();
  const hasToken = Boolean(localStorage.getItem(variables.session.tokenName));

  const currentPath = location.pathname;

  // null  → any authenticated user may access
  // array → user must have at least one of these permissions (or isAdmin() bypasses)
  const routePermissions: Record<string, IPermission[] | null> = {
    // Open to all authenticated users
    "/": null,
    "/admin/perfil": null,
    "/clients": null,
    "/lash-designs": null,
    "/effects": null,
    "/eye-types": null,
    "/designs": null,
    "/volumen": null,
    "/questionnaire": null,
    "/lash-tracking": null,
    "/admin/pos": null,
    "/admin/pos-tracking": null,
    "/admin/calendar": null,
    "/admin/services": null,
    "/admin/tickets": null,
    "/admin/professionals": null,
    "/admin/turns": null,

    // Admin-restricted routes
    "/users": ["users:manage"] as IPermission[],
    "/settings": ["settings:view"] as IPermission[],
    "/admin/salons": ["branches:manage"] as IPermission[],
    "/admin/products": ["inventory:view", "inventory:manage"] as IPermission[],
    "/admin/ai": ["ai:view", "ai:manage"] as IPermission[],
  };

  if (!hasToken || !isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
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