---
name: bc-list-page
description: Crear List Pages estilo Microsoft Business Central en adminElashes. Tabla densa, command bar sticky, filtros, SectionCard business, Tell Me. Úsalo para listados, tablas admin, pantallas tipo Customer List. Slash: /bc-list-page
---

# BC List Page — adminElashes

La **List Page** es el 80% de las pantallas admin BC.

**Referencia:** `src/pages/admin/clients/Main.tsx`

**Tokens y componentes:** leer `ui-ux-ms-business-central/references/`

## Estructura obligatoria

```tsx
import Layout from "@/components/common/layout";
import DataTable, { type DataTableColumn, type DataTableAction } from "@/components/common/table/DataTable";
import FilterActionBar from "@/components/common/FilterActionBar";
import { Button, SectionCard } from "@/components/common/ui";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { Plus, Pencil, Trash2, FileDown, RefreshCw } from "lucide-react";
```

1. `Layout` con `title`, `subtitle`, `toolbar` (command bar), `pageClassName="bg-[#f3f2f1]"`
2. `SectionCard variant="business" bodyClassName="p-0"`
3. `FilterActionBar` para filtros
4. `DataTable` con columns, actions, loading
5. Modales crear/editar + `ConfirmDialog` eliminar
6. Service en `src/core/services/<dominio>/`

## Command bar

```tsx
toolbar={
  <div className="flex flex-wrap items-center gap-1">
    <Button variant="secondary" size="sm" leftIcon={<Plus size={14} />}>Nuevo</Button>
    <Button variant="ghost" size="sm" leftIcon={<Pencil size={14} />}>Editar</Button>
    <span className="mx-1 h-5 w-px bg-[#edebe9]" />
    <Button variant="ghost" size="sm" leftIcon={<FileDown size={14} />}>Exportar</Button>
    <Button variant="ghost" size="sm" leftIcon={<RefreshCw size={14} />}>Actualizar</Button>
  </div>
}
```

## DataTable

- Acciones por fila vía `actions` → `ActionDropdownMenu`
- Sort y filtro por columna ya implementados
- `loading` muestra skeleton
- Export PDF: `generateTablePdf` de `core/utils/generateTablePdf`

## Al terminar

- [ ] `APP_SECTIONS` en `Header.tsx`
- [ ] Item en `AppSidebar.tsx` con `permission`
- [ ] Ruta en `router/index.tsx` + `PrivateRoute`
- [ ] Checklist en `bc-migration-checklist.md`