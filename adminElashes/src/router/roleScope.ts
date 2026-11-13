// Roles acotados a un puñado de rutas — a diferencia de los permisos (que
// solo filtran y dejan pasar cualquier ruta "abierta"), esto bloquea TODO lo
// que no esté en la lista, sin importar qué permisos tenga el rol. Pensado
// para Cajera: POS, Productos e Inventario y la Agenda (citas y reservas).
// Lo usan PrivateRoute (bloqueo real) y los menús/buscador (para no mostrar
// opciones que igual la rebotarían).
export const ROLE_ALLOWED_PREFIXES: Record<string, string[]> = {
  Cajera: ["/admin/pos-tracking", "/admin/products", "/admin/calendar", "/admin/perfil", "/profile"],
};

export const ROLE_LANDING_ROUTE: Record<string, string> = {
  Cajera: "/admin/pos-tracking",
};

// Returns true only if `route` is a proper path prefix of `path`
// (exact match OR next char after route is '/')
export function isPathPrefix(route: string, path: string): boolean {
  if (!path.startsWith(route)) return false;
  return path.length === route.length || path[route.length] === "/";
}

/** Nombre del rol acotado que tiene el usuario, o undefined si no tiene ninguno. */
export function getRestrictedRole(hasRole: (role: string) => boolean): string | undefined {
  return Object.keys(ROLE_ALLOWED_PREFIXES).find((role) => hasRole(role));
}

/** true si la ruta está permitida para el rol acotado (o si no hay rol acotado). */
export function isPathAllowedForRole(restrictedRole: string | undefined, path: string | undefined): boolean {
  if (!restrictedRole) return true;
  if (!path) return false;
  const cleanPath = path.split(/[?#]/)[0];
  return ROLE_ALLOWED_PREFIXES[restrictedRole].some((prefix) => isPathPrefix(prefix, cleanPath));
}
