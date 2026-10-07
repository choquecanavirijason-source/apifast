// Pantalla de inicio según rol/permisos. Antes cualquier rol que no fuera
// Cajera caía en "/" (Dashboard), que exige dashboard:view — roles como
// Operaria o EncargadaAlmacen no lo tienen y quedaban en blanco.

// Algunos roles tienen una sola pantalla que usan casi todo el tiempo — al
// loguearse van directo ahí. Match por nombre de rol en minúsculas.
const ROLE_DEFAULT_ROUTE: Record<string, string> = {
  cajera: "/admin/pos-tracking",
  operaria: "/admin/calendar/agenda",
};

// Orden de preferencia: la primera ruta cuyo permiso tenga el usuario.
const PERMISSION_LANDING_ROUTES: { path: string; permissions: string[] }[] = [
  { path: "/", permissions: ["dashboard:view"] },
  { path: "/admin/calendar/agenda", permissions: ["appointments:view", "appointments:manage"] },
  { path: "/admin/pos-tracking", permissions: ["payments:view", "payments:manage"] },
  { path: "/clients", permissions: ["clients:view", "clients:manage"] },
  { path: "/admin/services", permissions: ["services:view", "services:manage"] },
  { path: "/admin/products", permissions: ["inventory:view", "inventory:manage"] },
  { path: "/lash-tracking", permissions: ["tracking:view", "tracking:manage"] },
  { path: "/lash-designs", permissions: ["catalog:view", "catalog:manage"] },
];

// Abierta a cualquier usuario con sesión — último recurso.
export const FALLBACK_LANDING_ROUTE = "/profile";

const ADMIN_ROLES = ["superadmin", "super_admin", "super admin", "admin"];

export function resolveLandingRoute(roles: string[], permissions: string[]): string {
  const normalizedRoles = roles.map((role) => role.trim().toLowerCase());
  if (normalizedRoles.some((role) => ADMIN_ROLES.includes(role))) return "/";

  for (const role of normalizedRoles) {
    const route = ROLE_DEFAULT_ROUTE[role];
    if (route) return route;
  }

  const match = PERMISSION_LANDING_ROUTES.find((entry) =>
    entry.permissions.some((permission) => permissions.includes(permission)),
  );
  return match?.path ?? FALLBACK_LANDING_ROUTE;
}
