---
name: bc-card-page
description: Crear Card Pages estilo Business Central en adminElashes. Ficha de registro con FastTabs, FieldGrid, GenericModal fullscreen, FactBox. Úsalo para editar/ver un registro tipo Customer Card. Slash: /bc-card-page
---

# BC Card Page — adminElashes

Ficha de un registro con **FastTabs** (General, Detalles, Historial…).

## Estructura

```tsx
import GenericModal from "@/components/common/modal/GenericModal";
import { SectionCard } from "@/components/common/ui";
import InputField from "@/components/common/ui/InputField";

<GenericModal open={open} onClose={onClose} fullScreen title="Cliente — María López">
  {/* FastTabs */}
  <nav className="flex border-b border-[#edebe9]" role="tablist">
    {tabs.map(tab => (
      <button
        key={tab.id}
        role="tab"
        className={`px-4 py-2.5 text-sm font-medium border-b-2 ${
          active === tab.id ? "border-brand text-[#323130]" : "border-transparent text-[#605e5c]"
        }`}
        onClick={() => setActive(tab.id)}
      >
        {tab.label}
      </button>
    ))}
  </nav>

  <div className="grid grid-cols-1 xl:grid-cols-[1fr_280px] gap-4 p-4 bg-[#f3f2f1]">
    <SectionCard variant="business" title="General">
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-x-6 gap-y-4">
        <InputField label="Nombre" ... />
      </div>
    </SectionCard>
    <aside>
      <SectionCard variant="business" title="Detalles">
        <dl className="space-y-2 text-sm">...</dl>
      </SectionCard>
    </aside>
  </div>
</GenericModal>
```

## Reglas

- `GenericModal` con `fullScreen` (no modal centrado redondeado)
- Inputs `rounded-sm border-[#edebe9]`
- Formulario: react-hook-form + yup
- Navegación anterior/siguiente opcional entre registros
- FactBox lateral con metadata (creado, sucursal, etc.)

## Referencia parcial

Modales en `src/pages/admin/clients/RegisterClientModal.tsx` — migrar a fullscreen + FastTabs para BC completo.