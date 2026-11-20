// Explicación en lenguaje llano de cada permiso: qué pantallas abre y qué se puede
// hacer con él. Se usa en los selectores de permisos (roles y usuarios) para que
// "Ver" / "Gestionar" no sea un misterio. Si aparece un permiso nuevo sin entrada
// aquí, la UI cae al texto genérico de permissionLabels (no se rompe).
export interface PermissionInfo {
  /** Frase corta: qué permite. */
  summary: string;
  /** Detalle: las pantallas/acciones concretas. */
  can: string[];
  /** Aviso de qué más hace falta (o qué NO incluye) para que funcione completo. */
  note?: string;
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
    summary: "Ver la agenda, los tickets y las ventas ya hechas. No puede crear ni cambiar nada.",
    can: [
      "Abrir la Agenda y ver citas y reservas",
      "Abrir Tickets y ver el estado de cada atención",
      "Ver el historial de ventas",
    ],
    note: "Para iniciar o mover una atención necesita también “Gestionar Citas”.",
  },
  "appointments:manage": {
    summary: "Trabajar la agenda: crear, mover y cancelar citas, iniciar atenciones y crear ventas en el POS.",
    can: [
      "Crear, mover y cancelar citas y reservas",
      "Iniciar y finalizar la atención de un servicio (elegir operaria)",
      "Crear ventas en Nueva venta (genera el ticket de atención)",
      "Cancelar o corregir una venta",
    ],
    note: "No cobra por sí solo: para registrar el pago necesita “Gestionar Pagos”.",
  },
  "clients:view": {
    summary: "Ver la lista de clientas y su ficha. No puede registrar ni editar.",
    can: ["Abrir Clientes y Notificaciones", "Ver contacto, alergias e historial de cada clienta", "Buscar clientas al armar una cita o venta"],
  },
  "clients:manage": {
    summary: "Registrar clientas nuevas y editar o eliminar sus datos.",
    can: ["Registrar clientas (el CI es obligatorio)", "Editar teléfono, correo, alergias y fecha de nacimiento", "Eliminar clientas", "Activar o apagar sus avisos"],
  },
  "payments:view": {
    summary: "Ver el dinero: pagos, estado de la caja y reportes. No puede cobrar ni cerrar caja.",
    can: [
      "Ver Apertura y cierre, Corte de caja y Extras y bonos",
      "Ver los pagos registrados",
      "Abrir Equipo: seguimiento por operaria y comisiones pagadas",
    ],
  },
  "payments:manage": {
    summary: "Mover el dinero: cobrar, abrir y cerrar caja, registrar egresos, bonos y pagar comisiones.",
    can: [
      "Cobrar una venta o un servicio",
      "Abrir y cerrar la caja",
      "Registrar egresos y bonos a operarias",
      "Registrar el pago de comisiones",
    ],
    note: "No crea ventas por sí solo: para armar una venta necesita “Gestionar Citas”.",
  },
  "inventory:view": { summary: "Ver productos y existencias. No puede modificar nada.", can: ["Abrir Inventario", "Ver productos, lotes, movimientos y alertas de stock bajo"] },
  "inventory:manage": {
    summary: "Crear y editar productos, registrar entradas y mover stock.",
    can: ["Crear, editar y eliminar productos y categorías", "Registrar lotes y movimientos de stock", "Transferir stock entre sucursales"],
  },
  "services:view": { summary: "Ver los servicios, sus precios y categorías.", can: ["Abrir Catálogo y Categorías de servicios", "Abrir Control de servicios (turnos)"] },
  "services:manage": {
    summary: "Crear, editar y eliminar servicios.",
    can: ["Crear, editar y eliminar servicios y sus fotos"],
    note: "Las categorías de servicios piden además “Gestionar Citas”.",
  },
  "catalog:view": {
    summary: "Ver los estilos, tipos de ojo y opciones del probador. No puede modificarlos.",
    can: ["Abrir Estilos y efectos, Grosores, Colores, Largos, Técnicas y Tipos de ojo"],
  },
  "catalog:manage": {
    summary: "Crear, editar, publicar y borrar estilos y opciones del probador virtual.",
    can: ["Editar y publicar estilos de pestañas", "Crear y ordenar grosores, colores, largos y técnicas", "Editar tipos de ojo y recomendaciones"],
  },
  "forms:view": { summary: "Ver los cuestionarios de las clientas.", can: ["Abrir Cuestionarios y ver sus preguntas"] },
  "forms:manage": { summary: "Crear, editar y eliminar cuestionarios.", can: ["Crear, editar y eliminar cuestionarios"] },
  "tracking:view": { summary: "Ver el seguimiento de las clientas (antes y después de cada trabajo).", can: ["Ver los seguimientos de cada clienta", "Usar las comparaciones y recomendaciones de la IA"] },
  "tracking:manage": {
    summary: "Registrar, editar y borrar seguimientos de clientas.",
    can: ["Crear y editar seguimientos", "Borrar seguimientos"],
  },
  "branches:view": {
    summary: "Ver la lista de sucursales para poder elegirla en la agenda, las ventas y los reportes.",
    can: ["Elegir sucursal en pantallas que lo piden"],
    note: "No abre ninguna pantalla por sí solo. Para entrar a Sucursales se necesita “Gestionar Sucursales”.",
  },
  "branches:manage": {
    summary: "Entrar a Sucursales y crearlas, editarlas o eliminarlas.",
    can: ["Abrir la pantalla Sucursales", "Crear, editar y eliminar sucursales", "Configurar sus integraciones"],
  },
  "ai:view": { summary: "Usar el asistente de IA para hacer consultas.", can: ["Abrir Configuración de IA y conversar con el asistente"] },
  "ai:manage": { summary: "Cambiar la configuración del asistente de IA.", can: ["Modificar los ajustes del asistente"] },
  "dashboard:view": { summary: "Ver el resumen general del negocio: ingresos, gráficas y reportes.", can: ["Abrir Visión general", "Ver ingresos, distribución de servicios e inventario", "Descargar reportes"] },
  "audit:view": { summary: "Ver quién hizo qué: ediciones, eliminaciones y cancelaciones.", can: ["Abrir Auditoría y ver el registro de actividad"] },
  "commissions:pay": { summary: "Marcar como pagadas las comisiones de las operarias.", can: ["Confirmar un lote de comisiones"] },
  "commissions:void": { summary: "Anular un pago de comisión ya registrado.", can: ["Anular un pago de comisión"] },
  "reminders:send": { summary: "Enviar un aviso manual a una clienta (recordatorio de cita o retoque).", can: ["Enviar recordatorios desde Notificaciones y Agenda"] },
  "broadcasts:send": { summary: "Enviar comunicados o promociones a muchas clientas a la vez.", can: ["Crear y enviar comunicados", "Ver el historial de comunicados"] },
  "settings:view": {
    summary: "Entrar a Ajustes (identidad y preferencias del sistema).",
    can: ["Abrir Ajustes"],
    note: "El cupón de cumpleaños y el logo solo los pueden cambiar Admin y SuperAdmin, sin importar este permiso.",
  },
  "users:manage": { summary: "Administrar al personal: crear usuarios, roles y asignar permisos.", can: ["Abrir Usuarios", "Crear y editar usuarios", "Crear roles y elegir sus permisos"] },
};

export function moduleInfo(moduleKey: string): ModuleInfo {
  return MODULE_INFO[moduleKey] ?? { label: moduleKey, description: "" };
}

export function permissionInfo(slug: string): PermissionInfo | null {
  return PERMISSION_INFO[slug] ?? null;
}
