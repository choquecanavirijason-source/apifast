import { Navigate, Outlet, useLocation } from "react-router";
import useAuth from "../core/hooks/useAuth";
import type { IPermission } from "@/core/types/IPermission";
import variables from "@/core/config/variables";

const PrivateRoute = () => {
  const location = useLocation();
  const { isAuthenticated, hasAnyPermission, hasAnyPermissionByName, isAdmin } = useAuth();
  const hasToken = Boolean(localStorage.getItem(variables.session.tokenName));

  const currentPath = location.pathname;

  const routePermissions: Record<string, IPermission[] | null> = {
    // SHARED ROUTES - Accessible by ALL authenticated users
    "/admin": null,
    "/admin/perfil": null,
    "/clients": null,
    "/admin/clients": null,
    "/admin/ai": ["ai:view", "ai:manage"] as IPermission[],
  };

  // Si no hay token (sesion expirada/eliminada), siempre forzamos login.
  if (!hasToken || !isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  let requiredPermissions: IPermission[] | null = null;

  if (routePermissions[currentPath] !== undefined) {
    requiredPermissions = routePermissions[currentPath];
  } else {
    for (const route in routePermissions) {
      if (route.includes(':') && currentPath.startsWith(route.split(':')[0])) {
        requiredPermissions = routePermissions[route];
        break;
      }
    }
  }

  if (requiredPermissions === null) {
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