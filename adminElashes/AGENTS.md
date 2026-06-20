# adminElashes — Guía para agentes IA

Panel administrativo de **Elashes** (salón de pestañas). Objetivo visual: **Microsoft Dynamics 365 Business Central**.

## Antes de tocar código

1. Lee `.agent-skills/panel-administrativo/SKILL.md` (índice de skills).
2. Para UI/UX BC: `.agent-skills/ui-ux-ms-business-central/SKILL.md`.
3. Para mapa del proyecto: `.agent-skills/adminelashes-project/SKILL.md`.

## Stack

| Capa | Tecnología |
|---|---|
| Build | Vite 7 |
| UI | React 19 + TypeScript |
| Estilos | Tailwind CSS v4 (`src/styles.css` con `@theme`) |
| Estado | Redux Toolkit (`src/store.ts`) |
| Rutas | React Router v7 (`src/router/index.tsx`) |
| Formularios | react-hook-form + yup |
| Iconos | lucide-react |
| Desktop | Tauri (`src-tauri/`) |

## Arquitectura de layouts (importante)

Hay **dos** sistemas de layout — no mezclar sin razón:

| Uso | Archivo | Cuándo |
|---|---|---|
| App shell (sidebar + header) | `src/components/layout/Layout.tsx` | Envuelve todas las rutas admin en el router |
| Página con título + toolbar | `src/components/common/layout.tsx` | Dentro de cada página (ej. Clientes) |
| Página full-screen BC | `src/components/common/PageLayout.tsx` | Pantallas que necesitan caption + ribbon propio |

## Componentes BC del proyecto

```
AppSidebar     → Navigation Pane (oscuro, #094732)
Header         → Tell Me + sucursal + notificaciones
Layout (common) → Caption + command bar + work area
SectionCard    → variant="business" (tokens Fluent)
DataTable      → List Pages
GenericModal   → fullScreen para Card Pages
Button         → Command bar: secondary/ghost size sm
FilterActionBar → Filtros sobre tabla
ConfirmDialog  → Eliminar
```

## Tokens de diseño

**Marca Elashes** (`src/styles/brand.ts`): primario `#094732`, secundario `#9F8351`, terciario `#000000`.

**Fluent/BC** (área de trabajo):
- Fondo página: `#f3f2f1`
- Borde: `#edebe9`
- Texto: `#323130` / `#605e5c`
- Card: `rounded-sm`, sombra mínima

Detalle completo: `.agent-skills/ui-ux-ms-business-central/references/design-tokens.md`

## Referencia CRUD (patrón a seguir)

`src/pages/admin/clients/Main.tsx` — List Page con DataTable, SectionCard, FilterActionBar, modales.

## Al crear o migrar una pantalla BC

1. Elegir tipo: List Page / Card Page / Role Center / Document Page.
2. Usar `SectionCard variant="business"` (no `default` con `rounded-xl`).
3. Fondo work area `bg-[#f3f2f1]`; command bar sticky con botones `secondary`/`ghost` size `sm`.
4. Registrar en `Header.tsx` → `APP_SECTIONS` (Tell Me).
5. Registrar en `AppSidebar.tsx` con `permission`.
6. Proteger ruta en `PrivateRoute` si aplica.

## Antipatrones (rompen la ilusión BC)

| Evitar | Usar |
|---|---|
| `rounded-xl`, `rounded-2xl`, `shadow-2xl` | `rounded-sm`, sombra mínima |
| `SectionCard` default en admin | `variant="business"` |
| Botones `primary` grandes en ribbon | `secondary` / `ghost` size `sm` |
| Fondo blanco en toda la página | `bg-[#f3f2f1]` + card blanca |
| Tabs estilo pill | FastTabs con `border-b-2` |

## Comandos

```bash
npm install
npm run dev      # http://localhost:5173
npm run build
npm run tauri    # app desktop
```

## Módulos admin (src/pages/admin/)

| Módulo | Ruta principal | Archivo |
|---|---|---|
| Dashboard | `/` | `dashboard/Dashboard` |
| Clientes | `/clients` | `clients/Main.tsx` |
| Tickets | `/admin/tickets` | `tickets/Main.tsx` |
| Servicios | `/admin/services` | `services/Main.tsx` |
| Calendario | `/admin/calendar` | `calendar/Main.tsx` |
| Inventario | `/admin/products` | `products/Main.tsx` |
| POS | `/admin/pos` | `pos/Main.tsx` |
| POS Tracking | `/admin/pos-tracking` | `pos-tracking/PosTrackingHub.tsx` |
| Usuarios | `/admin/users` | `users/main.tsx` |
| Sucursales | `/admin/salons` | `salons/Main.tsx` |
| Configuración | `/admin/settings` | `settings/Settings.tsx` |