---
name: ui-ux-ms-business-central
description: Replicar Microsoft Dynamics 365 Business Central en adminElashes. Tokens Fluent, command bar, FastTabs, Cues, Tell Me, SectionCard business. Úsalo al mejorar UI admin, migrar pantallas a estilo BC, crear listados/fichas/dashboards Dynamics. Slash: /ui-ux-bc
---

# UI/UX — Microsoft Business Central (adminElashes)

Este proyecto debe **verse y comportarse como Dynamics 365 Business Central**, con la marca Elashes (`#094732`).

## Referencias del proyecto (leer primero)

| Archivo | Contenido |
|---|---|
| `references/design-tokens.md` | Colores Fluent + clases Tailwind |
| `references/component-map.md` | Qué componente usar para cada capa BC |
| `references/bc-migration-checklist.md` | Checklist y pantallas a migrar |
| `AGENTS.md` | Guía rápida para agentes |

## Anatomía visual BC

```
┌─────────────────────────────────────────────────────────────┐
│ [≡] Tell Me...          🔔  👤 Usuario  ▼ Sucursal        │
├──────────┬──────────────────────────────────────────────────┤
│          │  Título de página                                │
│  Nav     │  ─────────────────────────────────────────────── │
│  Pane    │  [Nuevo] [Editar] │ [Exportar] [Actualizar]      │  ← Command bar sticky
│  (dark)  │  ─────────────────────────────────────────────── │
│          │  SectionCard variant="business"                  │
│          │    └─ DataTable / formulario / Cues              │
└──────────┴──────────────────────────────────────────────────┘
```

## Shell — no reinventar

| Capa BC | Componente | Archivo |
|---|---|---|
| Navigation Pane | AppSidebar | `src/components/layout/AppSidebar.tsx` |
| Tell Me | Header | `src/components/layout/Header.tsx` |
| App shell | Layout | `src/components/layout/Layout.tsx` |
| Caption + ribbon | Layout (common) | `src/components/common/layout.tsx` |
| Work area card | SectionCard | `variant="business"` |
| Tabla | DataTable | `src/components/common/table/DataTable.tsx` |
| Modal ficha | GenericModal | `fullScreen` |

## Tipos de página BC

| Tipo | Skill | Uso |
|---|---|---|
| List Page | `bc-list-page` | Tablas (80% pantallas) |
| Card Page | `bc-card-page` | Ficha con FastTabs |
| Role Center | `bc-role-center` | Home con Cues/KPIs |
| Document Page | (este skill) | Cabecera + sub-tabla líneas |

## List Page — plantilla mínima

Referencia real: `src/pages/admin/clients/Main.tsx`

```tsx
import Layout from "@/components/common/layout";
import DataTable from "@/components/common/table/DataTable";
import FilterActionBar from "@/components/common/FilterActionBar";
import { Button, SectionCard } from "@/components/common/ui";
import { Plus, Pencil, FileDown, RefreshCw } from "lucide-react";

export default function ExampleListPage() {
  return (
    <Layout
      title="Proveedores"
      subtitle="Gestión de proveedores"
      toolbar={
        <div className="flex flex-wrap items-center gap-1">
          <Button variant="secondary" size="sm" leftIcon={<Plus size={14} />}>Nuevo</Button>
          <Button variant="ghost" size="sm" leftIcon={<Pencil size={14} />}>Editar</Button>
          <span className="mx-1 h-5 w-px bg-[#edebe9]" />
          <Button variant="ghost" size="sm" leftIcon={<FileDown size={14} />}>Exportar</Button>
          <Button variant="ghost" size="sm" leftIcon={<RefreshCw size={14} />}>Actualizar</Button>
        </div>
      }
      pageClassName="bg-[#f3f2f1]"
    >
      <SectionCard variant="business" bodyClassName="p-0">
        <FilterActionBar left={/* filtros */} right={/* contador */} />
        <DataTable data={items} columns={columns} loading={isLoading} />
      </SectionCard>
    </Layout>
  );
}
```

## Command bar — reglas

- Botón promovido del grupo = `secondary` size `sm` (no `primary` grande)
- Separadores: `<span className="mx-1 h-5 w-px bg-[#edebe9]" />`
- Iconos lucide 14px
- Sticky vía `toolbar` en Layout común
- Eliminar → menú `⋯` o ConfirmDialog, no ribbon principal

## FastTabs

Pestañas planas con `border-b-2` en activo (no pills). Ver `references/component-map.md`.

## Tell Me

Al crear página, añadir en `Header.tsx` → `APP_SECTIONS`:

```ts
{ id: "section-proveedores", label: "Proveedores", href: "/admin/suppliers" }
```

## Antipatrones

| Evitar | Usar |
|---|---|
| `rounded-xl`, `shadow-2xl` | `rounded-sm`, sombra mínima |
| `SectionCard` default | `variant="business"` |
| Botones primary en ribbon | `secondary` / `ghost` sm |
| Fondo blanco página | `bg-[#f3f2f1]` |
| Modal redondeado para fichas | `GenericModal fullScreen` |
| Tabs pill | FastTabs `border-b-2` |

## Flujo al migrar una pantalla

1. Leer `references/bc-migration-checklist.md`
2. Identificar tipo BC (List/Card/Role Center)
3. Cambiar contenedores a `SectionCard variant="business"`
4. Aplicar fondo `#f3f2f1` y command bar
5. Registrar Tell Me + sidebar + permisos
6. Validar checklist visual y comportamiento

## Prompt de arranque

```
/ui-ux-bc

Migra src/pages/admin/tickets/Main.tsx a estilo Business Central:
- SectionCard variant="business"
- Command bar sticky con Nuevo, Exportar, Actualizar
- Fondo #f3f2f1, tokens Fluent
- Sin rounded-xl
```