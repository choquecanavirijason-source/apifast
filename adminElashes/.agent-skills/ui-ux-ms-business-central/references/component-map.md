# Mapa de componentes BC

## Shell de aplicación

```
┌─────────────────────────────────────────────────────────────┐
│ Header (Tell Me + sucursal + notificaciones)                │
├──────────┬──────────────────────────────────────────────────┤
│          │  Layout común: título + toolbar (command bar)    │
│ AppSidebar│  ────────────────────────────────────────────── │
│ (oscuro) │  SectionCard variant="business"                 │
│          │    └─ DataTable / formulario / tiles            │
└──────────┴──────────────────────────────────────────────────┘
```

| Capa BC | Componente | Archivo |
|---|---|---|
| Navigation Pane | AppSidebar | `src/components/layout/AppSidebar.tsx` |
| Top bar + Tell Me | Header | `src/components/layout/Header.tsx` |
| App shell | Layout | `src/components/layout/Layout.tsx` |
| Page caption + ribbon | Layout (common) | `src/components/common/layout.tsx` |
| Page full BC | PageLayout | `src/components/common/PageLayout.tsx` |
| Work area card | SectionCard | `src/components/common/ui/SectionCard.tsx` |
| Tabla | DataTable | `src/components/common/table/DataTable.tsx` |
| Modal ficha | GenericModal | `src/components/common/modal/GenericModal.tsx` |
| Botones ribbon | Button | `src/components/common/ui/Button.tsx` |
| Filtros | FilterActionBar | `src/components/common/FilterActionBar.tsx` |
| Eliminar | ConfirmDialog | `src/components/common/ConfirmDialog.tsx` |
| KPI tiles | StatCard | `src/components/common/ui/StatCard.tsx` |

## SectionCard

```tsx
<SectionCard variant="business" title="Clientes" bodyClassName="p-0">
  {/* command bar + tabla */}
</SectionCard>
```

- `variant="default"` → `rounded-xl` (evitar en admin)
- `variant="business"` → tokens Fluent BC

## Command bar (dentro de SectionCard)

```tsx
<div className="sticky top-0 z-10 flex flex-wrap items-center gap-1 border-b border-[#edebe9] bg-[#faf9f8] px-3 py-2">
  <Button variant="secondary" size="sm" leftIcon={<Plus size={14} />}>Nuevo</Button>
  <Button variant="ghost" size="sm" leftIcon={<Pencil size={14} />}>Editar</Button>
  <span className="mx-1 h-5 w-px bg-[#edebe9]" />
  <Button variant="ghost" size="sm" leftIcon={<RefreshCw size={14} />}>Actualizar</Button>
</div>
```

## FastTabs (pestañas BC)

```tsx
<nav className="flex gap-0 border-b border-[#edebe9]" role="tablist">
  <button
    className={`px-4 py-2.5 text-sm font-medium border-b-2 ${
      active ? "border-brand text-[#323130]" : "border-transparent text-[#605e5c]"
    }`}
  >
    General
  </button>
</nav>
```

## FactBox (panel lateral)

```tsx
<div className="grid grid-cols-1 xl:grid-cols-[1fr_280px] gap-4">
  <main>{/* tabla */}</main>
  <aside>
    <SectionCard variant="business" title="Detalles">...</SectionCard>
  </aside>
</div>
```

## GenericModal para Card Page

```tsx
<GenericModal open={open} onClose={onClose} fullScreen title="Cliente">
  <FastTabs ... />
  <SectionCard variant="business">...</SectionCard>
</GenericModal>
```