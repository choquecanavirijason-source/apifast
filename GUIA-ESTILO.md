# Guía de estilo — E-Lashes Admin

> Autor: Pedro Chucamani. Aplica a todo el panel administrativo (`adminElashes/`).
> Estilo: **Minimal SaaS / "Linear-style"** — referencias del cliente: Linear, Tabler y Apple Calendar.
> Identidad: verde #094732 + dorado #9F8351. Temas light / ocean / dark con tokens `--ui-*`.

## 1. Principios
1. **Calma visual:** fondos blancos/suaves, un solo acento (verde; en dark, dorado claro). Nada de azul/violeta de adorno.
2. **Densidad elegante:** compacto pero con aire. Todo alineado al mismo margen (12px).
3. **Bordes finos > sombras:** líneas de 1px; sombras solo `shadow-sm` (tarjetas) y suaves en menús/modales.
4. **Jerarquía por peso y color, no por tamaño ni MAYÚSCULAS.**
5. **Lo interactivo se descubre:** hover, "+ hora", asas visibles suaves, tooltips (`title`).

## 2. Tipografía (fuente Inter / system)
| Uso | Clase |
|---|---|
| Texto general, botones, pestañas, celdas, títulos de columna | `text-xs` (12px) |
| Badges, etiquetas, ayudas, horas | `text-[11px]` |
| Títulos de tarjeta / sección | `text-sm font-semibold` |
| Cifras destacadas (KPI) | `text-sm`–`text-lg font-semibold tabular-nums` |
| Pesos | `font-medium` (nombres, títulos de columna) · `font-semibold` (valores, activos). Evitar `font-bold/black`. |
| MAYÚSCULAS | Solo títulos de sección de menús (`text-[11px] font-semibold uppercase tracking-wider`), tickets impresos y TV. |
| Números | siempre `tabular-nums` |

## 3. Color — usar tokens, nunca grises fijos
| Token | Para qué |
|---|---|
| `--ui-canvas` | fondo de la página |
| `--ui-surface` | tarjetas, tablas, modales, menús |
| `--ui-surface-muted` | cabeceras de tabla, zonas secundarias, filas alternas |
| `--ui-surface-hover` | hover de filas, botones neutros, ítems de menú |
| `--ui-border` / `--ui-border-strong` | líneas / bordes de campos y botones |
| `--ui-text` / `--ui-text-muted` | texto principal / secundario |
| `--ui-input` | fondo de inputs y selects |
| `--ui-accent` / `--ui-accent-soft` | opción activa (verde; dorado claro en dark) / su fondo suave |
| `bg-brand` / `hover:bg-brand-hover` | botón primario |
| `#9F8351` (dorado) | detalles: línea "ahora", marcador activo, foco (`focus:border-brand-secondary`) |
| Estados semánticos | emerald/amber/rose/sky de Tailwind en badges: OK (no tocar) |

**Prohibido:** `#605e5c`, `#323130`, `#201f1e`, `#edebe9`, `#f3f2f1`, `#faf9f8`, `#c8c6c4`, `#d2d0ce`, `#8a8886`, `#0078d4`, `#deecf9` (grises/azul de Microsoft Fluent).

## 4. Formas y espacios
| Elemento | Clase |
|---|---|
| Botones, inputs, selects, chips de filtro | `h-8 rounded-lg` (inputs de formulario `h-9`) |
| Tarjetas, tablas, paneles | `rounded-xl border border-[var(--ui-border)] bg-[var(--ui-surface)] shadow-sm` |
| Menús desplegables / popovers | `rounded-xl border p-1.5–2 shadow-[0_10px_30px_rgba(9,40,29,0.16)]` |
| Badges | `rounded-full px-2 py-0.5 text-[11px] font-medium` |
| Margen interno estándar | `p-3` / `px-3` (12px) — igual que la barra de pestañas del Layout |
| Separación entre bloques | `gap-3` |
| `rounded-sm` | **no usar** (era Business Central) |

## 5. Iconos (lucide-react)
- 14px (`h-3.5 w-3.5`) en botones, tablas, pestañas, menús.
- 16px (`h-4 w-4`) en navegación (sidebar/top), header y botón de ajustes.
- Heredan el color del texto; `shrink-0` junto a texto; `aria-hidden` si son decorativos.
- Nunca "agarradores" de 6 puntos (⋮⋮): se arrastra el elemento completo.

## 6. Componentes oficiales (reutilizar siempre)
- Pestañas: `SegmentedTabs` (no crear otras).
- Tablas: `DataTable` (+ `.ui-data-table` fuerza 12px).
- Tarjetas: `SectionCard`, `StatCard`. Modales: `GenericModal`, `ConfirmDialog`. Campos: `InputField`.
- Layout de página: `components/common/layout.tsx` (toolbar px-3, contenido p-3).
- Menú/navegación: `navigation.config.ts` es la única lista (top, sidebar y móvil).

## 7. Interacción "estilo Apple"
- Arrastrar para mover, asas arriba/abajo para estirar, ajuste a 15 min, doble clic para editar.
- Feedback inmediato (actualización optimista) y **deshacer** si el backend falla (toast de error).
- Escape cancela; clic afuera cierra menús; atajos de teclado visibles (`kbd`).
- Barra de consejos descartable para usuarios nuevos.

## 8. Checklist antes de entregar una pantalla
- [ ] Sin grises/azules Fluent (buscar `#605e5c`, `#0078d4`…). Sin `rounded-sm`.
- [ ] Se ve bien en light, ocean y dark (texto legible, sin bloques blancos en dark).
- [ ] 12px general, iconos 14px, márgenes 12px, alineado con la barra superior.
- [ ] `npx tsc -p tsconfig.app.json --noEmit --ignoreDeprecations 5.0` sin errores nuevos (base: 164).
- [ ] `npm run build` OK. Probado en el navegador (y en celular si aplica).
