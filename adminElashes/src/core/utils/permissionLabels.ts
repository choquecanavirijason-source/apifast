// Traducción de los slugs de permiso ("modulo:accion") a texto legible en
// español, para mostrar en UI (ej. panel "Información de cuenta"). Los
// permisos reales del sistema son los listados en MODULE_LABELS — cualquier
// slug fuera de ese set (o con otro formato) se muestra tal cual, sin romper.
export const MODULE_LABELS: Record<string, string> = {
  ai: "Asistente IA",
  clients: "Clientes",
  catalog: "Catálogo",
  tracking: "Seguimiento",
  forms: "Cuestionarios",
  users: "Usuarios",
  settings: "Configuración",
  payments: "Pagos",
  inventory: "Inventario",
  services: "Servicios",
  appointments: "Citas",
  branches: "Sucursales",
  dashboard: "Dashboard",
};

const ACTION_LABELS: Record<string, string> = {
  view: "Ver",
  manage: "Gestionar",
};

/** "ai" -> "Asistente IA". Si no reconoce el módulo, devuelve la clave tal cual. */
export function translateModule(moduleKey: string): string {
  return MODULE_LABELS[moduleKey] ?? moduleKey;
}

/** "view" -> "Ver". Si no reconoce la acción, devuelve la clave tal cual. */
export function translateAction(actionKey: string): string {
  return ACTION_LABELS[actionKey] ?? actionKey;
}

/** "ai:view" -> "Ver Asistente IA". Si no reconoce el formato, devuelve el slug tal cual. */
export function translatePermission(slug: string): string {
  const [moduleKey, actionKey] = slug.split(":");
  if (!actionKey) return slug;

  const moduleLabel = MODULE_LABELS[moduleKey];
  const actionLabel = ACTION_LABELS[actionKey];
  if (!moduleLabel || !actionLabel) return slug;

  return `${actionLabel} ${moduleLabel}`;
}
