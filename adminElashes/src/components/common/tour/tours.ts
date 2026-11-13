import {
  BadgeCheck, BarChart2, Calendar, ClipboardList, Clapperboard, Download, FileDown, Filter, LayoutDashboard,
  List, MapPin, Megaphone, MousePointerClick, Package, PackageSearch, Percent, Plus, RefreshCw, Search, Settings,
  ShoppingBag, Sparkles, Store, Tag, UserCheck, Users, Warehouse, Wallet,
} from "lucide-react";

import type { TourStep } from "./GuidedTour";

// Cada paso apunta a un elemento real con `data-tour="..."`: es lo que la guía resalta. Si el usuario no
// tiene permiso para ese botón (o no está en pantalla) el paso se omite solo.
const t = (name: string) => `[data-tour="${name}"]`;

// ─── Equipo › Seguimiento por operaria ────────────────────────────────────────

export function buildTeamTrackingTour(setTab: (tab: "tickets" | "servicios") => void): TourStep[] {
  return [
    {
      selector: null,
      icon: UserCheck,
      title: "Seguimiento por operaria",
      description:
        "Aquí controlas la calidad del trabajo: cada ticket atendido con quién lo hizo, su estado, las notas de diseño y los cuestionarios. No muestra comisiones (esas están en la sección Comisiones).",
      onEnter: () => setTab("tickets"),
    },
    {
      selector: t("eq-stats"),
      icon: BarChart2,
      title: "Totales del período",
      description: "Cuántos tickets hay y cuánto ingresaron, según los filtros que tengas puestos (operaria, estado y fechas).",
    },
    {
      selector: t("eq-tabs"),
      icon: List,
      title: "Dos vistas",
      description:
        "\"Historial de tickets\" es la lista ticket por ticket. \"Uso por servicio\" cuenta cuántas veces se hizo cada servicio y cuánto generó.",
    },
    {
      selector: t("eq-status"),
      icon: Filter,
      title: "Filtrar por estado",
      description: "Toca un estado (completado, en servicio, pendiente…) para ver solo esos tickets. El número es cuántos hay. \"Todos\" quita el filtro.",
      onEnter: () => setTab("tickets"),
    },
    {
      selector: t("eq-search"),
      icon: Search,
      title: "Buscar",
      description: "Escribe el nombre de la clienta, el código del ticket, el servicio o la operaria.",
    },
    {
      selector: t("eq-operaria"),
      icon: UserCheck,
      title: "Filtrar por operaria",
      description: "Elige una operaria para ver solo los tickets que atendió ella.",
    },
    {
      selector: t("eq-dates"),
      icon: Calendar,
      title: "Rango de fechas",
      description: "\"Desde\" y \"hasta\" limitan el período. Si los dejas vacíos se ven todos los tickets.",
    },
    {
      selector: t("eq-pdf"),
      icon: FileDown,
      title: "Descargar PDF",
      description: "Genera un PDF con exactamente lo que estás viendo (con los filtros aplicados).",
    },
    {
      selector: t("eq-refresh"),
      icon: RefreshCw,
      title: "Actualizar",
      description: "Vuelve a cargar los tickets por si hubo cambios recientes.",
    },
    {
      selector: t("eq-clear"),
      icon: Filter,
      title: "Limpiar filtros",
      description: "Quita de una vez la operaria, el estado, la búsqueda y las fechas.",
    },
    {
      selector: t("eq-services"),
      icon: BarChart2,
      title: "Uso por servicio",
      description: "Cada tarjeta es un servicio: cuántos tickets tuvo, cuántos se completaron y cuánto ingresó.",
      onEnter: () => setTab("servicios"),
    },
  ];
}

// ─── Equipo › Comisiones ──────────────────────────────────────────────────────

export function buildCommissionsTour(setTab: (tab: "tickets" | "comisiones") => void): TourStep[] {
  return [
    {
      selector: null,
      icon: Percent,
      title: "Comisiones por operaria",
      description:
        "Aquí ves cuánto trabajó y cuánto le corresponde a cada operaria, y registras el pago de sus comisiones.",
      onEnter: () => setTab("tickets"),
    },
    {
      selector: t("cm-tabs"),
      icon: List,
      title: "Dos pestañas",
      description:
        "\"Historial de tickets\" es el detalle ticket por ticket (donde marcas qué pagar). \"Comisiones y pagos\" resume cuánto lleva cada operaria y los pagos ya hechos.",
    },
    {
      selector: t("cm-filters"),
      icon: Filter,
      title: "Operaria y fechas",
      description: "Elige una operaria y el rango de fechas. Estos filtros valen para las dos pestañas.",
    },
    {
      selector: t("cm-stats"),
      icon: BarChart2,
      title: "Resumen",
      description: "Tickets totales, completados, en curso, lo que ingresaron y la comisión total, según los filtros.",
      onEnter: () => setTab("tickets"),
    },
    {
      selector: t("cm-pay"),
      icon: BadgeCheck,
      title: "Confirmar pago",
      description:
        "Marca los tickets en la columna \"Pago\" de la tabla y pulsa este botón para registrar que ya le pagaste su comisión. El número es cuántos tickets marcaste.",
      onEnter: () => setTab("tickets"),
    },
    {
      selector: t("cm-pdf"),
      icon: FileDown,
      title: "Descargar PDF",
      description: "PDF de lo que estás viendo en la pestaña activa.",
    },
    {
      selector: t("cm-refresh"),
      icon: RefreshCw,
      title: "Actualizar",
      description: "Recarga los datos.",
    },
    {
      selector: t("cm-clear"),
      icon: Filter,
      title: "Limpiar filtros",
      description: "Quita la operaria y las fechas.",
    },
    {
      selector: t("cm-tabs"),
      icon: Wallet,
      title: "Comisiones y pagos",
      description: "Cambia a esta pestaña para ver el total por operaria y el historial de pagos. Se puede anular un pago si se registró por error.",
      onEnter: () => setTab("comisiones"),
    },
  ];
}

// ─── Servicios › Catálogo ─────────────────────────────────────────────────────

export function buildServicesCatalogTour(): TourStep[] {
  return [
    {
      selector: null,
      icon: Sparkles,
      title: "Catálogo de servicios",
      description:
        "Son los servicios que ofrece el salón con su precio y duración. Lo que cargues aquí es lo que se elige al agendar una cita y al vender en la caja.",
    },
    {
      selector: t("sv-stats"),
      icon: BarChart2,
      title: "Resumen",
      description: "Cuántas categorías y servicios tienes, y cuántos ya tienen imagen y descripción.",
    },
    {
      selector: t("sv-search"),
      icon: Search,
      title: "Buscar un servicio",
      description: "Escribe parte del nombre para encontrarlo rápido.",
    },
    {
      selector: t("sv-new"),
      icon: Plus,
      title: "Nuevo servicio",
      description: "Abre el formulario: nombre, categoría, precio, duración, imagen, descuento y la comisión de la operaria.",
    },
    {
      selector: t("sv-grid"),
      icon: MousePointerClick,
      title: "Las tarjetas",
      description:
        "Cada tarjeta es un servicio. Abajo ves su categoría, duración y precio (con descuento si tiene) y quién cobra comisión: \"Comisión: operaria\" usa la de la operaria; un porcentaje fijo la reemplaza.",
    },
    {
      selector: t("sv-actions"),
      icon: MousePointerClick,
      title: "Editar o eliminar",
      description: "Pasa el mouse por una tarjeta y toca los tres puntos: ahí eliges \"Editar\" o \"Eliminar\" el servicio.",
    },
  ];
}

// ─── Servicios › Categorías ───────────────────────────────────────────────────

export function buildServiceCategoriesTour(): TourStep[] {
  return [
    {
      selector: null,
      icon: Tag,
      title: "Categorías de servicio",
      description:
        "Agrupan los servicios (por ejemplo pestañas, cejas). Cada servicio del catálogo pertenece a una categoría.",
    },
    {
      selector: t("sv-stats"),
      icon: BarChart2,
      title: "Resumen",
      description: "Cantidad de categorías y de servicios registrados.",
    },
    {
      selector: t("sv-search"),
      icon: Search,
      title: "Buscar una categoría",
      description: "Escribe parte del nombre para filtrar.",
    },
    {
      selector: t("sv-new"),
      icon: Plus,
      title: "Nueva categoría",
      description: "Crea una categoría para poder asignarla a los servicios.",
    },
    {
      selector: t("sv-grid"),
      icon: MousePointerClick,
      title: "Las tarjetas",
      description: "Cada tarjeta es una categoría. Desde su menú puedes editarla o eliminarla.",
    },
  ];
}

// ─── Market ───────────────────────────────────────────────────────────────────

const nav = (path: string) => `[data-tour="mk-nav${path}"]`;

export function buildMarketIntroTour(): TourStep[] {
  return [
    {
      selector: null,
      icon: Store,
      title: "Bienvenida a Market",
      description:
        "Market es la tienda en línea de Elashes. Lo que publiques aquí (productos, banners, videos) lo ven las clientas en la app, y los pedidos que hagan llegan a este panel para que los atiendas.",
    },
    {
      selector: t("mk-modeswitch"),
      icon: Store,
      title: "Salón o Market",
      description:
        "Este interruptor cambia entre los dos paneles: el del Salón (agenda, caja, clientas, inventario del local) y este, el de la tienda en línea.",
    },
    {
      selector: nav("/marketplace"),
      icon: LayoutDashboard,
      title: "Dashboard",
      description: "Resumen de la tienda: productos activos, pedidos, ventas y productos con poco stock.",
    },
    {
      selector: nav("/marketplace/products"),
      icon: ShoppingBag,
      title: "Productos",
      description: "Lo que vendes: nombre, precio, stock y fotos. Puedes ocultar un producto para que las clientas no lo vean sin borrarlo.",
    },
    {
      selector: nav("/marketplace/categories"),
      icon: Tag,
      title: "Categorías",
      description: "Ordenan los productos en la app para que la clienta los encuentre por tipo.",
    },
    {
      selector: nav("/marketplace/orders"),
      icon: ClipboardList,
      title: "Pedidos",
      description: "Los pedidos que hacen las clientas desde la app. El número rojo son los pendientes de atender; aquí actualizas el estado de cada uno.",
    },
    {
      selector: nav("/marketplace/ads"),
      icon: Megaphone,
      title: "Publicidad",
      description: "Los banners promocionales del carrusel de la pantalla de inicio de la app.",
    },
    {
      selector: nav("/marketplace/reels"),
      icon: Clapperboard,
      title: "Reels",
      description: "Videos cortos que se muestran en la app; las clientas pueden darles like.",
    },
    {
      selector: nav("/marketplace/delivery-points"),
      icon: MapPin,
      title: "Puntos de entrega",
      description: "Los locales donde la clienta recoge su pedido. La clienta elige su país en la app y solo ve los puntos habilitados ahí.",
    },
    {
      selector: nav("/marketplace/customers"),
      icon: Users,
      title: "Clientes",
      description: "Las personas que compraron en la tienda, ordenadas por quien más gastó.",
    },
    {
      selector: nav("/marketplace/import-inventory"),
      icon: Download,
      title: "Importar inventario",
      description: "Trae productos del inventario del salón a la tienda en línea, y actualiza su stock con el que hay en el local.",
    },
    {
      selector: nav("/marketplace/inventory"),
      icon: Warehouse,
      title: "Inventario general",
      description: "Vista conjunta del inventario del salón y del marketplace.",
    },
    {
      selector: nav("/marketplace/catalog"),
      icon: PackageSearch,
      title: "Catálogo",
      description: "Vista previa de cómo verán las clientas el marketplace en la app.",
    },
    {
      selector: nav("/marketplace/settings"),
      icon: Settings,
      title: "Configuración",
      description: "Estado de la conexión entre el panel, el salón y la tienda. Sirve para ver si todo está funcionando.",
    },
    {
      selector: t("mk-guide"),
      icon: Package,
      title: "Volver a ver esta guía",
      description: "Cuando quieras repasar cómo funciona Market, pulsa \"Guía\" aquí arriba.",
    },
  ];
}
