// Explicación en lenguaje llano de cada permiso: qué pantallas abre y qué se puede
// hacer con él. Se usa en los selectores de permisos (roles y usuarios) para que
// "Ver" / "Gestionar" no sea un misterio. Si aparece un permiso nuevo sin entrada
// aquí, la UI cae al texto genérico de permissionLabels (no se rompe).
export interface PermissionInfo {
  /** Frase corta: qué permite. */
  summary: string;
  /** Detalle: las pantallas/acciones concretas. */
  can: string[];
}

export interface ModuleInfo {
  label: string;
  description: string;
}

export const MODULE_INFO: Record<string, ModuleInfo> = {
  appointments: { label: "Citas y agenda", description: "Agenda de citas, reservas, atención en sala y control de servicios." },
  clients: { label: "Clientas", description: "Listado y fichas de las clientas del salón." },
  payments: { label: "Caja y pagos", description: "Cobros, punto de venta (POS) y corte de caja." },
  inventory: { label: "Inventario y productos", description: "Productos, lotes de stock y transferencias entre sucursales." },
  services: { label: "Servicios", description: "Servicios que ofrece el salón y sus categorías." },
  catalog: { label: "Catálogo de diseños", description: "Catálogo de diseños/estilos que ven las clientas." },
  forms: { label: "Cuestionarios", description: "Formularios que llenan las clientas." },
  tracking: { label: "Seguimiento", description: "Seguimiento de clientas y de reservas del marketplace." },
  branches: { label: "Sucursales", description: "Sucursales del salón." },
  ai: { label: "Asistente IA", description: "Asistente de inteligencia artificial del panel." },
  dashboard: { label: "Dashboard", description: "Resumen general con ingresos y reportes." },
  audit: { label: "Auditoría", description: "Registro de acciones importantes del sistema." },
  commissions: { label: "Pago de comisiones", description: "Pago de comisiones a las operarias." },
  reminders: { label: "Recordatorios", description: "Avisos manuales a una clienta." },
  broadcasts: { label: "Comunicados", description: "Avisos y promociones para muchas clientas a la vez." },
  settings: { label: "Configuración", description: "Ajustes generales del sistema." },
  users: { label: "Usuarios y roles", description: "Cuentas del personal, roles y permisos." },
};

export const PERMISSION_INFO: Record<string, PermissionInfo> = {
  "appointments:view": {
    summary: "Solo mirar la agenda y las citas; no puede cambiar nada.",
    can: ["Ver la agenda y las reservas", "Ver el control de servicios y los tickets de atención"],
  },
  "appointments:manage": {
    summary: "Crear y mover citas, atender clientas y vender desde el POS.",
    can: [
      "Crear, mover y cancelar citas y reservas",
      "Iniciar y finalizar la atención de un servicio (asignar operaria)",
      "Cobrar al iniciar un servicio desde la agenda",
      "Crear ventas y tickets en el punto de venta",
    ],
  },
  "clients:view": { summary: "Solo ver las clientas y sus datos.", can: ["Abrir el listado de Clientas", "Ver la ficha (contacto, alergias, historial)"] },
  "clients:manage": {
    summary: "Registrar y editar clientas.",
    can: ["Registrar clientas nuevas", "Editar sus datos (teléfono, alergias, fecha de nacimiento)"],
  },
  "payments:view": { summary: "Solo consultar pagos y caja.", can: ["Ver cobros, movimientos y el estado de la caja"] },
  "payments:manage": {
    summary: "Cobrar, abrir y cerrar caja.",
    can: ["Registrar cobros en el POS y en la agenda", "Abrir y cerrar la caja (corte de caja)", "Registrar ingresos y egresos de caja"],
  },
  "inventory:view": { summary: "Solo ver productos y stock.", can: ["Ver productos, lotes y existencias"] },
  "inventory:manage": {
    summary: "Crear y editar productos, lotes y transferencias.",
    can: ["Crear y editar productos", "Registrar lotes de entrada", "Transferir stock entre sucursales"],
  },
  "services:view": { summary: "Solo ver los servicios y precios.", can: ["Ver el listado de servicios y sus precios"] },
  "services:manage": { summary: "Crear y editar servicios.", can: ["Crear, editar y desactivar servicios", "Administrar categorías de servicios"] },
  "catalog:view": { summary: "Solo ver el catálogo de diseños.", can: ["Ver los diseños del catálogo"] },
  "catalog:manage": { summary: "Crear y editar el catálogo.", can: ["Subir, editar y borrar diseños", "Administrar la prueba virtual (try-on)"] },
  "forms:view": { summary: "Solo ver cuestionarios.", can: ["Ver los cuestionarios y sus respuestas"] },
  "forms:manage": { summary: "Crear y editar cuestionarios.", can: ["Crear, editar y borrar cuestionarios"] },
  "tracking:view": { summary: "Solo ver el seguimiento.", can: ["Ver el seguimiento de clientas y reservas"] },
  "tracking:manage": {
    summary: "Gestionar el seguimiento y las reservas del marketplace.",
    can: ["Actualizar el seguimiento de clientas", "Gestionar reservas hechas desde la app"],
  },
  "branches:view": { summary: "Solo ver las sucursales.", can: ["Ver el listado de sucursales"] },
  "branches:manage": { summary: "Crear y editar sucursales.", can: ["Crear, editar y desactivar sucursales"] },
  "ai:view": { summary: "Usar el asistente IA para consultar.", can: ["Abrir el asistente IA y hacer consultas"] },
  "ai:manage": { summary: "Configurar el asistente IA.", can: ["Cambiar la configuración del asistente IA"] },
  "dashboard:view": { summary: "Ver el panel general de ingresos y reportes.", can: ["Ver el Dashboard con ingresos y estadísticas", "Exportar reportes"] },
  "audit:view": { summary: "Ver quién hizo qué en el sistema.", can: ["Ver el registro de ediciones, eliminaciones y cancelaciones"] },
  "commissions:pay": { summary: "Confirmar el pago de comisiones.", can: ["Confirmar un lote de comisiones a operarias"] },
  "commissions:void": { summary: "Anular un pago de comisión.", can: ["Anular un pago de comisión ya registrado"] },
  "reminders:send": { summary: "Enviar un recordatorio a una clienta.", can: ["Enviar avisos manuales a su app desde Próximas citas"] },
  "broadcasts:send": { summary: "Enviar comunicados a muchas clientas.", can: ["Enviar promociones o avisos a un grupo o a todas las clientas"] },
  "settings:view": { summary: "Entrar a Configuración.", can: ["Ver y ajustar la configuración general (cupón de cumpleaños, etc.)"] },
  "users:manage": { summary: "Administrar el personal y sus permisos.", can: ["Crear y editar usuarios", "Crear roles y asignar permisos"] },
};

export function moduleInfo(moduleKey: string): ModuleInfo {
  return MODULE_INFO[moduleKey] ?? { label: moduleKey, description: "" };
}

export function permissionInfo(slug: string): PermissionInfo | null {
  return PERMISSION_INFO[slug] ?? null;
}
