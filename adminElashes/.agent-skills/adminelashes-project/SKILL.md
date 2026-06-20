---
name: adminelashes-project
description: Mapa completo del proyecto adminElashes para agentes IA. Estructura de carpetas, convenciones, servicios HTTP, permisos RBAC, rutas y patrones CRUD. Úsalo al entrar al proyecto, crear módulos nuevos o entender dónde vive cada cosa. Slash: /adminelashes-project
---

# adminElashes — Mapa del proyecto

## Estructura de carpetas

```
adminElashes/
├── src/
│   ├── pages/
│   │   ├── auth/           → Login
│   │   └── admin/          → Todas las pantallas admin
│   ├── components/
│   │   ├── layout/         → App shell (Layout, Header, AppSidebar)
│   │   └── common/         → UI reutilizable (DataTable, modales, PageLayout)
│   ├── core/
│   │   ├── services/       → Llamadas HTTP por dominio (*.service.ts)
│   │   ├── reducer/        → Redux slices (auth, etc.)
│   │   ├── types/          → Interfaces TypeScript
│   │   ├── hooks/          → useAuth, useLogo, etc.
│   │   ├── config/         → variables.ts (API URL, session keys)
│   │   └── utils/          → toastify, branch, generateTablePdf
│   ├── router/             → index.tsx, PrivateRoute, GuestRoute
│   ├── styles/             → brand.ts, colors.ts, Sidebar.css
│   ├── styles.css          → Tailwind v4 @theme + estilos globales
│   └── store.ts
├── src-tauri/              → App desktop
├── public/
└── .agent-skills/          → Skills para agentes IA (este directorio)
```

## Convenciones de código

| Aspecto | Convención |
|---|---|
| Imports | Alias `@/` → `src/` (ej. `@/components/common/ui`) |
| Páginas admin | `src/pages/admin/<modulo>/Main.tsx` |
| Servicios | `src/core/services/<dominio>/<dominio>.service.ts` |
| Tipos | `src/core/types/I<Entity>.ts` |
| Formularios | react-hook-form + yup en modales |
| Toasts | `react-toastify` vía `core/utils/toastify.ts` |
| Sucursal activa | `getSelectedBranchId()` / `BRANCH_STORAGE_KEY` en `core/utils/branch.ts` |

## Patrón CRUD estándar

Referencia: `src/pages/admin/clients/Main.tsx`

```
1. Estado local (items, loading, error, modales)
2. loadItems() → Service.list()
3. DataTable con columns + actions
4. FilterActionBar para filtros
5. SectionCard variant="business" como contenedor
6. Modales para crear/editar (react-hook-form)
7. ConfirmDialog para eliminar
8. Export PDF vía generateTablePdf
```

## Servicios HTTP

Cada dominio tiene su service en `src/core/services/`:

- `client/client.service.ts`
- `branch/branch.service.ts`
- `auth/auth.service.ts`
- `agenda/agenda.service.ts`
- (y más por módulo)

Patrón: métodos estáticos `list`, `get`, `create`, `update`, `delete` usando axios.

## Permisos RBAC

| Archivo | Rol |
|---|---|
| `src/core/types/IPermission.ts` | Tipo permiso |
| `src/core/hooks/useAuth.ts` | `hasPermissionByName`, `isAdmin`, `hasRole` |
| `src/router/PrivateRoute.tsx` | Protección de rutas |
| `src/components/layout/AppSidebar.tsx` | Menú filtrado por permiso |

Formato permisos: `"modulo:view"`, `"modulo:manage"`.

Al añadir módulo:
1. Permiso en backend
2. `permission` en item de `AppSidebar`
3. `PrivateRoute` con permiso requerido
4. `hasPermissionByName` en botones de acción

## Rutas principales

Definidas en `src/router/index.tsx`. Rutas admin van dentro de `<Layout />` (app shell).

## Componentes UI clave

| Componente | Ruta |
|---|---|
| DataTable | `components/common/table/DataTable.tsx` |
| ActionDropdownMenu | `components/common/table/ActionDropdownMenu.tsx` |
| GenericModal | `components/common/modal/GenericModal.tsx` |
| SectionCard | `components/common/ui/SectionCard.tsx` |
| Button | `components/common/ui/Button.tsx` |
| InputField | `components/common/ui/InputField.tsx` |
| StatCard | `components/common/ui/StatCard.tsx` |
| FilterActionBar | `components/common/FilterActionBar.tsx` |
| PageLayout | `components/common/PageLayout.tsx` |
| Layout (página) | `components/common/layout.tsx` |

## Tell Me (búsqueda global)

Registrar nuevas secciones en `src/components/layout/Header.tsx` → array `APP_SECTIONS`:

```ts
{ id: "section-proveedores", label: "Proveedores", href: "/admin/suppliers" }
```

## Paleta de marca

`src/styles/brand.ts` — exporta `BRAND` con primary/secondary/tertiary.

Tailwind: clases `bg-brand`, `text-brand-secondary`, `text-brand-tertiary`, etc. definidas en `src/styles.css` `@theme`.

## Scripts

```bash
npm run dev      # desarrollo
npm run build    # producción
npm run tauri    # desktop
```