# Tokens de diseño — Business Central + Elashes

## Marca Elashes (acciones, sidebar, acentos)

```ts
// src/styles/brand.ts
primary:   "#094732"   // shell, navegación, acción primaria
secondary: "#9F8351"   // acentos cálidos, bordes sección
tertiary:  "#000000"   // títulos, texto fuerte
```

Tailwind: `bg-brand`, `bg-brand-hover`, `text-brand-secondary`, `text-brand-tertiary`.

## Fluent / Business Central (área de trabajo)

| Token | Valor | Uso |
|---|---|---|
| pageBg | `#f3f2f1` | Fondo work area |
| surface | `#ffffff` | Cards, paneles |
| border | `#edebe9` | Bordes Fluent |
| headerBg | `#faf9f8` | Cabecera sección / command bar |
| textPrimary | `#323130` | Títulos, celdas |
| textSecondary | `#605e5c` | Subtítulos, hints |
| textMuted | `#a19f9d` | Placeholders |
| navBg | `#031910` / `#094732` | Navigation pane (sidebar) |

## Clases Tailwind BC

```tsx
// Fondo página
className="bg-[#f3f2f1] min-h-full font-sans"

// Card BC (o SectionCard variant="business")
className="rounded-sm border border-[#edebe9] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.06)]"

// Header sección
className="border-b border-[#edebe9] bg-[#faf9f8] px-4 py-3"

// Título página
className="text-xl font-semibold text-[#323130]"

// Caption / subtítulo
className="text-xs font-medium uppercase tracking-wide text-[#605e5c]"

// Command bar sticky
className="sticky top-0 z-10 border-b border-[#edebe9] bg-[#faf9f8] px-4 py-2"

// Separador ribbon
className="mx-1 h-5 w-px bg-[#edebe9]"

// Input BC
className="w-full rounded-sm border border-[#edebe9] px-3 py-1.5 text-sm text-[#323130] focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand/30"

// Fila tabla hover
className="hover:bg-[#f3f2f1] border-b border-[#edebe9]"
```

## Tipografía

- Fuente: Inter (ya en proyecto)
- Título página: `text-xl font-semibold` (20px)
- Título sección: `text-sm font-semibold`
- Cuerpo/celdas: `text-sm` (14px)
- Hints: `text-xs text-[#605e5c]`

## Radios y sombras

| Elemento | Estilo |
|---|---|
| Cards, tablas | `rounded-sm` |
| Botones ribbon | `rounded-sm` o `rounded-md` |
| Modales ficha | `rounded-none` si fullscreen |
| Sombras | `shadow-[0_1px_2px_rgba(0,0,0,0.06)]` máximo |

## Prohibido en pantallas admin

- `rounded-xl`, `rounded-2xl`, `shadow-2xl`
- Gradientes llamativos, glassmorphism
- Botones `primary` grandes en command bar
- Tabs estilo pill/bootstrap
- Fondo blanco en toda la página sin `#f3f2f1`