# adminElashes

Panel de administración para la marca Elashes. Permite gestionar clientes, usuarios y configuraciones desde una interfaz web.

## Stack
- Vite + React + TypeScript
- Tailwind CSS (v4)
- React Router y Redux Toolkit

## Scripts
- `npm install`: instala dependencias
- `npm run dev`: inicia el servidor de desarrollo
- `npm run build`: genera el build de producción
- `npm run preview`: previsualiza el build

## Estructura general
- `src/pages`: vistas principales (Dashboard, Login, Users, Settings, Clients)
- `src/components`: UI reutilizable
- `src/router`: rutas
- `src/store.ts`: configuración de Redux

## Navegación del panel

El panel de salón utiliza una composición compacta inspirada en Docufacil y
refinada con patrones visuales de Linear:

- Cabecera utilitaria compacta con búsqueda, acciones frecuentes,
  notificaciones, sucursal y perfil.
- Navegación horizontal con las ocho agrupaciones operativas. Visión general e
  Inventario son accesos directos; el resto abre menús compactos con icono,
  título y descripción.
- Los menús se filtran por permisos, se cierran al navegar, al hacer clic fuera
  o al presionar Escape y mantienen visible el grupo de la ruta activa.
- Área de trabajo a todo el ancho, sin menú lateral ni controles de colapsado.

La composición vive en `src/components/layout/Layout.tsx`; la navegación
superior en `Header.tsx`; y la navegación agrupada en
`HorizontalNavigation.tsx`. Las medidas compartidas se definen como variables
CSS en `src/styles.css`.
