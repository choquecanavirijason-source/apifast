# Checklist migración a Business Central

Usar al migrar una pantalla existente o validar una nueva.

## Visual

- [ ] Fondo work area `#f3f2f1` (no blanco plano ni `#f8fafc`)
- [ ] `SectionCard variant="business"` en secciones principales
- [ ] Command bar sticky con grupos y separadores `w-px bg-[#edebe9]`
- [ ] Botones ribbon: `secondary` / `ghost` size `sm`, iconos 14px
- [ ] Tipografía 14px cuerpo, título 20px semibold
- [ ] Sin `rounded-xl` / `rounded-2xl` en elementos admin
- [ ] Tabla: header `bg-[#faf9f8]`, filas `hover:bg-[#f3f2f1]`
- [ ] Inputs `rounded-sm border-[#edebe9]`

## Comportamiento

- [ ] Tell Me: entrada en `Header.tsx` → `APP_SECTIONS`
- [ ] Sidebar: item con `permission` en `AppSidebar.tsx`
- [ ] Ruta protegida en `PrivateRoute` si aplica
- [ ] Loading = skeleton en DataTable, no spinner fullscreen
- [ ] Acciones destructivas en menú `⋯`, no en ribbon principal

## Arquitectura

- [ ] Tipo de página BC correcto (List / Card / Role Center / Document)
- [ ] Service HTTP separado del componente
- [ ] Permisos en menú + botones de acción

## Pantallas candidatas a migrar

Prioridad alta (listados con DataTable):

| Pantalla | Archivo | Estado estimado |
|---|---|---|
| Clientes | `clients/Main.tsx` | Parcial BC (referencia) |
| Tickets | `tickets/Main.tsx` | Revisar |
| Productos | `products/Main.tsx` | Revisar |
| Usuarios | `users/main.tsx` | Revisar |
| Sucursales | `salons/Main.tsx` | Revisar |
| Servicios | `services/Main.tsx` | Revisar (usa cards) |
| Catálogo | `catalog/*.tsx` | Revisar |
| Volumen | `Volumen/index.tsx` | Revisar |

Prioridad media:

| Pantalla | Archivo |
|---|---|
| Dashboard | `dashboard/Dashboard` |
| Calendario | `calendar/Main.tsx` |
| Cierre de caja | `cierre-de-caja/CierreDeCaja.tsx` |
| Settings | `settings/Settings.tsx` |

Excluidas (fullscreen / UX propia):

- `pos-tracking/*` — fullscreen sin sidebar
- `pos/Main.tsx` — flujo POS dedicado
- `control-de-servicios/TurnScreen` — pantalla operativa

## Estilos globales a alinear

`src/styles.css` aún tiene clases legacy:
- `.card` con `border-radius: 12px` → migrar a BC
- `.sidebar` con `border-radius: 0 16px` → mantener oscuro, reducir radio si se desea más BC
- `--bg: #f8fafc` en `:root` → considerar `#f3f2f1` para work area